// Creación de recibos en Loyverse con idempotencia y reintento automático.
//
// Antes, cada ruta (pay-physical, approve-payment, status) creaba el recibo por su cuenta y, si Loyverse
// fallaba, el error solo se escribía en consola: el pedido seguía sin venta registrada para siempre.
// Esta función centraliza ese paso:
//   1. Si el pedido ya tiene recibo → no hace nada.
//   2. Toma un "candado" atómico en la BD (orders.loyverse_sync_started_at) para que dos solicitudes
//      simultáneas (doble clic, reintento + cajero) no creen dos recibos.
//   3. Si el candado estaba vencido (una ejecución anterior murió), primero BUSCA en Loyverse un recibo
//      que ya lleve el id del pedido en la nota, para no duplicar.
//   4. Crea el recibo. Si falla, libera el candado y ENCOLA un trabajo 'receipt_create' que el cron reintenta.

import type { SupabaseClient } from '@supabase/supabase-js';
import { createLoyverseReceipt, findLoyverseReceiptByOrderId } from '@/lib/loyverse';

/** Un candado más viejo que esto se considera abandonado (la ejecución que lo tomó murió). */
export const RECEIPT_LOCK_STALE_MS = 2 * 60 * 1000;
const RECEIPT_JOB_MAX_ATTEMPTS = 8;

export interface ReceiptSyncResult {
  success: boolean;
  receipt_number: string | null;
  error: string | null;
  /** El pedido ya tenía recibo antes de llamar */
  already_synced?: boolean;
  /** Otro proceso está creando el recibo en este momento */
  busy?: boolean;
  /** Falló y quedó en la cola para reintento automático */
  queued?: boolean;
  /** No aplica crear recibo (p. ej. el pedido fue cancelado) */
  skipped?: string;
}

export interface ReceiptSyncDeps {
  createReceipt: typeof createLoyverseReceipt;
  findReceipt: typeof findLoyverseReceiptByOrderId;
}

export interface ReceiptSyncOptions {
  /** Método de pago con el que se registra la venta (efectivo / transferencia / tarjeta) */
  paymentMethod: string;
  paymentStatus?: string;
  /** Buscar en Loyverse antes de crear (usado por los reintentos) */
  lookupFirst?: boolean;
  /** Encolar un reintento si falla (por defecto sí; el propio cron lo desactiva) */
  enqueueOnFailure?: boolean;
  deps?: Partial<ReceiptSyncDeps>;
}

export async function ensureLoyverseReceipt(
  admin: SupabaseClient,
  orderId: string,
  opts: ReceiptSyncOptions
): Promise<ReceiptSyncResult> {
  const createReceipt = opts.deps?.createReceipt ?? createLoyverseReceipt;
  const findReceipt = opts.deps?.findReceipt ?? findLoyverseReceiptByOrderId;
  const enqueueOnFailure = opts.enqueueOnFailure ?? true;

  const { data: order, error: fetchErr } = await admin
    .from('orders')
    .select('*, users(loyverse_customer_id)')
    .eq('id', orderId)
    .maybeSingle();

  if (fetchErr || !order) {
    return { success: false, receipt_number: null, error: fetchErr?.message || 'Orden no encontrada.' };
  }

  if (order.loyverse_receipt_id) {
    return { success: true, receipt_number: order.loyverse_receipt_number ?? order.loyverse_receipt_id, error: null, already_synced: true };
  }

  if (order.status === 'cancelled') {
    return { success: true, receipt_number: null, error: null, skipped: 'cancelled' };
  }

  // ── Candado atómico ──────────────────────────────────────────────────────────
  const hadLock = !!order.loyverse_sync_started_at;
  const nowIso = new Date().toISOString();
  const staleIso = new Date(Date.now() - RECEIPT_LOCK_STALE_MS).toISOString();
  const { data: locked, error: lockErr } = await admin
    .from('orders')
    .update({ loyverse_sync_started_at: nowIso })
    .eq('id', orderId)
    .is('loyverse_receipt_id', null)
    .or(`loyverse_sync_started_at.is.null,loyverse_sync_started_at.lt.${staleIso}`)
    .select('id');

  if (lockErr) {
    return { success: false, receipt_number: null, error: `No se pudo tomar el candado: ${lockErr.message}` };
  }
  if (!locked || locked.length === 0) {
    return { success: false, receipt_number: null, error: 'Otro proceso está creando el recibo de este pedido.', busy: true };
  }

  const release = async () => {
    await admin.from('orders').update({ loyverse_sync_started_at: null }).eq('id', orderId).is('loyverse_receipt_id', null);
  };

  const saveReceipt = async (receiptId: string, receiptNumber: string) => {
    const { error } = await admin
      .from('orders')
      .update({ loyverse_receipt_id: receiptId, loyverse_receipt_number: receiptNumber, loyverse_sync_started_at: null })
      .eq('id', orderId);
    if (error) {
      // El recibo YA existe en Loyverse pero no pudimos guardarlo: se deja el candado puesto para que el
      // reintento lo encuentre por búsqueda en lugar de duplicarlo.
      console.error(`🚨 [LOYVERSE] Recibo ${receiptNumber} creado pero NO guardado en la orden ${orderId}: ${error.message}`);
      throw new Error(`Recibo ${receiptNumber} creado en Loyverse pero no se pudo guardar: ${error.message}`);
    }
  };

  try {
    // ── ¿Ya existe en Loyverse? (reintentos / ejecución previa muerta) ─────────
    if (opts.lookupFirst || hadLock) {
      const found = await findReceipt(orderId, order.created_at);
      if (found) {
        await saveReceipt(found.receipt_number, found.receipt_number);
        return { success: true, receipt_number: found.receipt_number, error: null };
      }
    }

    // ── Crear ───────────────────────────────────────────────────────────────────
    const created = await createReceipt({
      id: order.id,
      customer_id: order.users?.loyverse_customer_id || undefined,
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      items: order.items,
      total: order.total,
      notes: order.notes || '',
      service_type: order.service_type,
      delivery_address: order.delivery_address,
      payment_method: opts.paymentMethod,
      payment_status: opts.paymentStatus ?? 'payment_approved',
      delivery_fee: order.delivery_fee,
      delivery_lat: order.delivery_lat,
      delivery_lng: order.delivery_lng,
      delivery_fee_confirmed: order.delivery_fee_confirmed,
    });

    if (!created?.receipt_id) {
      throw new Error('Loyverse no devolvió receipt_id');
    }

    await saveReceipt(created.receipt_id, created.receipt_number);
    return { success: true, receipt_number: created.receipt_number, error: null };

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`❌ [LOYVERSE] No se pudo crear el recibo de la orden ${orderId}: ${message}`);

    // Si el fallo fue DESPUÉS de crear el recibo (no se pudo guardar), el candado se queda puesto
    const savedFailure = message.includes('no se pudo guardar');
    if (!savedFailure) await release();

    let queued = false;
    if (enqueueOnFailure) {
      const { error: qErr } = await admin.from('loyverse_sync_queue').insert([{
        entity_type: 'receipt_create',
        entity_id: orderId,
        payload: { payment_method: opts.paymentMethod },
        status: 'pending',
        max_attempts: RECEIPT_JOB_MAX_ATTEMPTS,
        next_retry_at: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
        last_error: message.slice(0, 500),
      }]);
      // 23505 = ya hay un trabajo activo para este pedido (índice único): es lo esperado
      queued = !qErr || qErr.code === '23505';
      if (qErr && qErr.code !== '23505') console.error('[LOYVERSE] No se pudo encolar el reintento del recibo:', qErr.message);
    }

    return { success: false, receipt_number: null, error: message, queued };
  }
}
