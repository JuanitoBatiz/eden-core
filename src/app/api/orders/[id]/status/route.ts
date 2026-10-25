import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';
import { refundLoyverseReceipt } from '@/lib/loyverse';
import { ensureLoyverseReceipt } from '@/lib/loyverseReceiptSync';
import { buildCancelReason, isStaffCancelReason } from '@/lib/orderCancellation';

const VALID_TRANSITIONS: Record<string, string[]> = {
  'received': ['awaiting_payment', 'in_preparation', 'cancelled'],
  'awaiting_payment': ['in_preparation', 'cancelled'],
  'in_preparation': ['ready', 'cancelled'],
  'ready': ['in_transit', 'delivered', 'cancelled'],
  'in_transit': ['delivered', 'cancelled'],
  'delivered': [],
  'cancelled': []
};

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const orderId = (await params).id;
    if (!orderId) return NextResponse.json({ error: 'ID de orden no proporcionado.' }, { status: 400 });

    let tokenPayload;
    try {
      tokenPayload = await requireRole(req, 'cashier');
    } catch (authErr: any) {
      if (authErr.message.includes('403')) {
        return NextResponse.json({ error: 'insufficient_permissions', required_role: authErr.required_role, your_role: authErr.your_role }, { status: 403 });
      }
      return NextResponse.json({ error: authErr.message || 'No autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const { status: newStatus, reason, note } = body;

    if (!['received', 'awaiting_payment', 'in_preparation', 'ready', 'in_transit', 'delivered', 'cancelled'].includes(newStatus)) {
      return NextResponse.json({ error: 'Estado invalido proporcionado.' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (!supabaseUrl || !serviceRoleKey) return NextResponse.json({ error: 'Configuracion DB ausente' }, { status: 500 });

    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: order, error: orderErr } = await adminSupabase
      .from('orders')
      .select('*, users(loyverse_customer_id)')
      .eq('id', orderId)
      .single();

    if (orderErr || !order) return NextResponse.json({ error: 'Orden no encontrada.' }, { status: 404 });

    const currentStatus = order.status;
    if (currentStatus === newStatus) return NextResponse.json({ success: true, status: newStatus });

    // El cliente pudo cancelar justo antes de que el cajero actuara: avisar con claridad
    if (currentStatus === 'cancelled') {
      return NextResponse.json({
        error: order.cancelled_by === 'customer'
          ? 'El cliente canceló este pedido. Refresca el tablero.'
          : 'Este pedido ya fue cancelado. Refresca el tablero.',
        cancelled_by: order.cancelled_by ?? null
      }, { status: 409 });
    }

    const allowedNextStates = VALID_TRANSITIONS[currentStatus] || [];
    if (!allowedNextStates.includes(newStatus)) {
      return NextResponse.json({ error: "Transicion invalida de '" + currentStatus + "' a '" + newStatus + "'.", allowed_transitions: allowedNextStates }, { status: 400 });
    }

    const updateData: any = { status: newStatus };

    if (newStatus === 'cancelled') {
      // Auditoría: quién, cuándo y por qué (motivo desconocido o ausente = 'otro')
      updateData.cancelled_at = new Date().toISOString();
      updateData.cancelled_by = 'staff';
      updateData.cancelled_by_user_id = tokenPayload.user_id;
      updateData.cancel_reason = buildCancelReason(
        isStaffCancelReason(reason) ? reason : 'otro',
        typeof note === 'string' ? note : undefined
      );
      if (order.payment_status === 'payment_approved') updateData.refund_status = 'pending';
      if (order.loyverse_receipt_id) {
        try {
          await refundLoyverseReceipt(order.loyverse_receipt_id);
        } catch (err: any) {
          console.error('Failed to void receipt in Loyverse POS:', err);
          return NextResponse.json({ error: 'No se pudo cancelar en la caja Loyverse. ' + err.message }, { status: 500 });
        }
      }
    }

    // FIX ROOT CAUSE: admin avanza awaiting_payment -> in_preparation sin que el cliente
    // haya elegido metodo de pago. payment_status y payment_method estaban incorrectos,
    // haciendo que createLoyverseReceipt fallara silenciosamente.
    if (newStatus === 'in_preparation' && currentStatus === 'awaiting_payment') {
      if (order.payment_status !== 'payment_approved') updateData.payment_status = 'payment_approved';
      if (!order.payment_method) updateData.payment_method = 'efectivo';
    }

    let loyverseDiagnostic: { success: boolean; receipt_number: string | null; error: string | null } =
      { success: false, receipt_number: null, error: null };

    if (newStatus === 'in_preparation' && !order.loyverse_receipt_id) {
      // Recibo en Loyverse: idempotente y con reintento automático si Loyverse falla
      const receiptSync = await ensureLoyverseReceipt(adminSupabase, orderId, {
        paymentMethod: updateData.payment_method ?? order.payment_method ?? 'efectivo',
        paymentStatus: updateData.payment_status ?? order.payment_status ?? 'payment_approved',
      });
      loyverseDiagnostic = {
        success: receiptSync.success,
        receipt_number: receiptSync.receipt_number,
        error: receiptSync.error,
      };
    }

    const { data: updatedRows, error: updateErr } = await adminSupabase
      .from('orders')
      .update(updateData)
      .eq('id', orderId)
      .eq('status', currentStatus)
      .select();

    if (updateErr) throw new Error('DB Error: ' + updateErr.message);
    if (!updatedRows || updatedRows.length === 0) {
      return NextResponse.json({ error: 'La orden fue modificada por otro usuario. Refresca la pagina.' }, { status: 409 });
    }

    // RIFA: Registrar entrada si el pago fue aprobado en esta transición y el total es >= $200
    // Solo aplica cuando el admin avanza awaiting_payment → in_preparation (que fuerza payment_approved)
    const paymentJustApproved = newStatus === 'in_preparation' && currentStatus === 'awaiting_payment';
    if (paymentJustApproved && order.total >= 200 && order.user_id) {
      try {
        await adminSupabase
          .from('raffle_entries')
          .upsert(
            { user_id: order.user_id, order_id: order.id, order_total: order.total },
            { onConflict: 'order_id', ignoreDuplicates: true }
          );
        console.log(`[RIFA] Entrada registrada para user=${order.user_id}, order=${order.id}, total=${order.total}`);
      } catch (raffleErr: any) {
        // No bloqueamos el flujo si falla el registro de la rifa
        console.error('[RIFA] Error al registrar entrada de rifa:', raffleErr?.message);
      }
    }

    return NextResponse.json({ success: true, status: newStatus, loyverse_diagnostic: loyverseDiagnostic });

  } catch (error: any) {
    console.error('Update order status error:', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}