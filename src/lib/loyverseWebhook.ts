// Lógica del webhook de Loyverse: anulaciones y reembolsos hechos en la caja (POS).
//
// Principios:
//  1. El contenido del webhook es solo un AVISO. Antes de cambiar nada se consulta el recibo a la
//     API de Loyverse (con nuestro token) y se actúa sobre lo que Loyverse confirma. Así un
//     webhook falsificado no puede cancelar pedidos.
//  2. Idempotente: el mismo evento (o el eco de nuestro propio reembolso) no vuelve a cambiar nada.
//  3. Reglas acordadas con el dueño:
//       - Pedido AÚN NO entregado  → se cancela (cancelled_by = 'pos').
//       - Pedido YA entregado      → NO se cancela; se marca como reembolso (refund_status).
//       - Reembolso parcial        → solo se registra en el log, no cambia el pedido.

import type { SupabaseClient } from '@supabase/supabase-js';
import { getLoyverseReceipt } from '@/lib/loyverse';

export interface PosReceiptHint {
  receipt_number?: string;
  receipt_type?: string;
  refund_for?: string | null;
  cancelled_at?: string | null;
}

export interface PosReceipt {
  receipt_number: string;
  receipt_type?: string;
  refund_for?: string | null;
  cancelled_at?: string | null;
  total_money?: number;
}

export interface OrderForPosRefund {
  id: string;
  status: string;
  payment_status: string;
  payment_method?: string | null;
  refund_status?: string | null;
  total: number;
}

export type PosRefundAction =
  | { type: 'cancel'; updates: Record<string, unknown> }
  | { type: 'mark_refunded'; updates: Record<string, unknown> }
  | { type: 'noop'; reason: string };

export const POS_CANCEL_REASON = 'anulado_en_pos';
const FULL_REFUND_TOLERANCE = 0.5; // pesos

/** Un reembolso/anulación cubre el pedido completo si el monto alcanza (con tolerancia de redondeo). */
export function isFullRefund(amount: number, orderTotal: number): boolean {
  return amount >= Number(orderTotal) - FULL_REFUND_TOLERANCE;
}

/** Decide qué hacer con un pedido cuyo recibo fue anulado/reembolsado en la caja. Función pura. */
export function decidePosRefundAction(order: OrderForPosRefund, nowIso: string = new Date().toISOString()): PosRefundAction {
  if (order.status === 'cancelled') {
    return { type: 'noop', reason: 'already_cancelled' }; // incluye el eco de nuestro propio reembolso
  }

  const paidByCash = (order.payment_method ?? 'efectivo') === 'efectivo';

  if (order.status === 'delivered') {
    if (order.refund_status && order.refund_status !== 'none') {
      return { type: 'noop', reason: 'already_marked_refund' };
    }
    // Efectivo: el dinero se devolvió en la caja → ya está resuelto. Otros métodos (transferencia):
    // hay que devolver el dinero → queda pendiente en la pestaña Reembolsos.
    return { type: 'mark_refunded', updates: { refund_status: paidByCash ? 'completed' : 'pending' } };
  }

  const updates: Record<string, unknown> = {
    status: 'cancelled',
    cancelled_at: nowIso,
    cancelled_by: 'pos',
    cancel_reason: POS_CANCEL_REASON,
  };
  // Pago por transferencia ya aprobado → hay dinero por devolver. En efectivo no hay nada que devolver.
  if (order.payment_status === 'payment_approved' && !paidByCash && (!order.refund_status || order.refund_status === 'none')) {
    updates.refund_status = 'pending';
  }
  return { type: 'cancel', updates };
}

export interface ReceiptEventOutcome {
  receipt_number: string;
  result:
    | 'ignored_not_refund'
    | 'unverified'
    | 'no_matching_order'
    | 'partial_refund_logged'
    | 'cancelled'
    | 'marked_refunded'
    | 'noop'
    | 'conflict';
  detail?: string;
  order_id?: string;
}

export interface WebhookDeps {
  getReceipt: (receiptNumber: string) => Promise<PosReceipt | null>;
}

/**
 * Procesa los recibos de un evento `receipts.update`. LANZA error si no se puede verificar un recibo
 * por un fallo temporal de la API (para que el endpoint responda 5xx y Loyverse pueda reintentar).
 */
export async function processReceiptsEvent(
  admin: SupabaseClient,
  hints: PosReceiptHint[],
  deps: Partial<WebhookDeps> = {}
): Promise<ReceiptEventOutcome[]> {
  const getReceipt = deps.getReceipt ?? (getLoyverseReceipt as WebhookDeps['getReceipt']);
  const outcomes: ReceiptEventOutcome[] = [];

  for (const hint of hints) {
    const hintNumber = hint.receipt_number ?? hint.refund_for ?? '';
    const isRefundHint = hint.receipt_type === 'REFUND' && !!hint.refund_for;
    const isCancelHint = !!hint.cancelled_at;
    if (!isRefundHint && !isCancelHint) {
      outcomes.push({ receipt_number: hintNumber, result: 'ignored_not_refund' });
      continue;
    }

    // ── 1. Verificar contra Loyverse ───────────────────────────────────────────
    let saleNumber: string;
    let amount: number;
    let cancelledAtIso: string | undefined;

    if (isRefundHint) {
      const refund = await getReceipt(hint.receipt_number!);
      if (!refund || refund.receipt_type !== 'REFUND' || !refund.refund_for) {
        outcomes.push({ receipt_number: hintNumber, result: 'unverified', detail: 'el recibo no es un reembolso en Loyverse' });
        continue;
      }
      saleNumber = refund.refund_for;
      amount = Math.abs(Number(refund.total_money ?? 0));
    } else {
      const sale = await getReceipt(hint.receipt_number!);
      if (!sale || !sale.cancelled_at) {
        outcomes.push({ receipt_number: hintNumber, result: 'unverified', detail: 'el recibo no está anulado en Loyverse' });
        continue;
      }
      saleNumber = sale.receipt_number;
      amount = Math.abs(Number(sale.total_money ?? 0));
      cancelledAtIso = sale.cancelled_at;
    }

    if (!/^[A-Za-z0-9-]{1,32}$/.test(saleNumber)) {
      outcomes.push({ receipt_number: hintNumber, result: 'unverified', detail: 'número de recibo con formato inesperado' });
      continue;
    }

    // ── 2. Buscar el pedido web de ese recibo ─────────────────────────────────
    const { data: orders, error } = await admin
      .from('orders')
      .select('id, status, payment_status, payment_method, refund_status, total')
      .or(`loyverse_receipt_id.eq.${saleNumber},loyverse_receipt_number.eq.${saleNumber}`);
    if (error) throw new Error(`Error buscando pedido del recibo ${saleNumber}: ${error.message}`);

    if (!orders || orders.length === 0) {
      outcomes.push({ receipt_number: saleNumber, result: 'no_matching_order' }); // venta que no vino de la web
      continue;
    }

    for (const order of orders as OrderForPosRefund[]) {
      if (!isFullRefund(amount, order.total)) {
        outcomes.push({ receipt_number: saleNumber, order_id: order.id, result: 'partial_refund_logged', detail: `reembolsado $${amount} de $${order.total}` });
        continue;
      }

      const action = decidePosRefundAction(order, cancelledAtIso);
      if (action.type === 'noop') {
        outcomes.push({ receipt_number: saleNumber, order_id: order.id, result: 'noop', detail: action.reason });
        continue;
      }

      // Actualización condicionada al estado leído: si el pedido cambió entretanto no se pisa
      const { data: rows, error: upErr } = await admin
        .from('orders')
        .update(action.updates)
        .eq('id', order.id)
        .eq('status', order.status)
        .select('id');
      if (upErr) throw new Error(`Error actualizando pedido ${order.id}: ${upErr.message}`);

      if (!rows || rows.length === 0) {
        outcomes.push({ receipt_number: saleNumber, order_id: order.id, result: 'conflict', detail: 'el pedido cambió mientras se procesaba' });
      } else {
        outcomes.push({ receipt_number: saleNumber, order_id: order.id, result: action.type === 'cancel' ? 'cancelled' : 'marked_refunded' });
      }
    }
  }

  return outcomes;
}
