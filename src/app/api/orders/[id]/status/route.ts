import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';
import { refundLoyverseReceipt, createLoyverseReceipt } from '@/lib/loyverse';

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
    const { status: newStatus } = body;

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

    const allowedNextStates = VALID_TRANSITIONS[currentStatus] || [];
    if (!allowedNextStates.includes(newStatus)) {
      return NextResponse.json({ error: "Transicion invalida de '" + currentStatus + "' a '" + newStatus + "'.", allowed_transitions: allowedNextStates }, { status: 400 });
    }

    const updateData: any = { status: newStatus };

    if (newStatus === 'cancelled') {
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
      try {
        const loyverseCustomerId = (order as any).users?.loyverse_customer_id || undefined;
        const effectivePaymentMethod = updateData.payment_method ?? order.payment_method ?? 'efectivo';
        const effectivePaymentStatus  = updateData.payment_status  ?? order.payment_status  ?? 'payment_approved';

        const loyverseResult = await createLoyverseReceipt({
          id: order.id,
          customer_id: loyverseCustomerId,
          customer_name: order.customer_name,
          customer_phone: order.customer_phone,
          items: order.items,
          total: order.total,
          notes: order.notes || '',
          service_type: order.service_type,
          delivery_address: order.delivery_address,
          payment_method: effectivePaymentMethod,
          payment_status: effectivePaymentStatus,
          delivery_fee: order.delivery_fee,
          delivery_lat: order.delivery_lat,
          delivery_lng: order.delivery_lng,
          delivery_fee_confirmed: order.delivery_fee_confirmed,
        });

        if (loyverseResult?.receipt_id) {
          updateData.loyverse_receipt_id     = loyverseResult.receipt_id;
          updateData.loyverse_receipt_number = loyverseResult.receipt_number;
          loyverseDiagnostic = { success: true, receipt_number: loyverseResult.receipt_number, error: null };
          console.log('[STATUS] Recibo Loyverse creado: ' + loyverseResult.receipt_number);
        } else {
          loyverseDiagnostic = { success: false, receipt_number: null, error: 'Loyverse no devolvio receipt_id' };
          console.error('[STATUS] Loyverse no devolvio receipt_id para orden:', order.id);
        }
      } catch (loyverseErr: any) {
        loyverseDiagnostic = { success: false, receipt_number: null, error: loyverseErr.message };
        console.error('[STATUS] No se pudo crear recibo en Loyverse:', loyverseErr.message);
      }
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