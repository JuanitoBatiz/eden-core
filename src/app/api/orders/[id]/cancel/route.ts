import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase';
import {
  CUSTOMER_CANCELLABLE_STATUSES,
  buildCancelReason,
  customerCancelBlockedMessage,
  isCustomerCancelReason,
  isCustomerCancellable,
} from '@/lib/orderCancellation';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST: el cliente cancela su propio pedido, solo antes de preparación.
// No toca Loyverse: en esta ventana todavía no existe recibo.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const orderId = (await params).id;
    if (!orderId || !UUID_RE.test(orderId)) {
      return NextResponse.json({ error: 'ID de orden inválido.' }, { status: 400 });
    }

    let tokenPayload;
    try {
      tokenPayload = await requireRole(req, 'customer');
    } catch (authErr) {
      const e = authErr as Error & { required_role?: string; your_role?: string };
      if (e.message?.includes('403')) {
        return NextResponse.json({ error: 'insufficient_permissions', required_role: e.required_role, your_role: e.your_role }, { status: 403 });
      }
      return NextResponse.json({ error: e.message || 'No autorizado' }, { status: 401 });
    }

    if (!isSupabaseConfigured) {
      return NextResponse.json({ error: 'Configuración de base de datos ausente.' }, { status: 500 });
    }

    let body: { reason?: unknown; note?: unknown } = {};
    try { body = await req.json(); } catch { /* cuerpo opcional */ }
    const reason = isCustomerCancelReason(body?.reason) ? body.reason : 'otro';
    const note = typeof body?.note === 'string' ? body.note : undefined;

    const adminSupabase = createAdminClient();

    const { data: order, error: fetchErr } = await adminSupabase
      .from('orders')
      .select('id, user_id, status, payment_status')
      .eq('id', orderId)
      .maybeSingle();

    if (fetchErr) throw new Error(fetchErr.message);
    if (!order) return NextResponse.json({ error: 'Orden no encontrada.' }, { status: 404 });

    if (order.user_id !== tokenPayload.user_id) {
      return NextResponse.json({ error: 'No tienes permiso sobre esta orden.' }, { status: 403 });
    }

    // Idempotente: cancelar dos veces no es un error
    if (order.status === 'cancelled') {
      return NextResponse.json({ success: true, status: 'cancelled', already_cancelled: true });
    }

    if (!isCustomerCancellable(order)) {
      return NextResponse.json({ error: customerCancelBlockedMessage(order) }, { status: 409 });
    }

    // Cancelación atómica: solo si SIGUE en la ventana permitida. Si el cajero lo pasó a
    // preparación o el cliente subió un comprobante entre el SELECT y este UPDATE, no afecta filas.
    const { data: updatedRows, error: updateErr } = await adminSupabase
      .from('orders')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_by: 'customer',
        cancelled_by_user_id: tokenPayload.user_id,
        cancel_reason: buildCancelReason(reason, note),
      })
      .eq('id', orderId)
      .eq('user_id', tokenPayload.user_id)
      .in('status', [...CUSTOMER_CANCELLABLE_STATUSES])
      .eq('payment_status', 'pending_payment')
      .select('id');

    if (updateErr) throw new Error(updateErr.message);

    if (!updatedRows || updatedRows.length === 0) {
      // Alguien cambió el pedido justo ahora: releer para dar el mensaje correcto
      const { data: fresh } = await adminSupabase
        .from('orders')
        .select('status, payment_status')
        .eq('id', orderId)
        .maybeSingle();
      if (fresh?.status === 'cancelled') {
        return NextResponse.json({ success: true, status: 'cancelled', already_cancelled: true });
      }
      return NextResponse.json(
        { error: fresh ? customerCancelBlockedMessage(fresh) : 'No se pudo cancelar el pedido.' },
        { status: 409 }
      );
    }

    console.log(`[CANCEL] Orden ${orderId} cancelada por el cliente ${tokenPayload.user_id} (${reason})`);
    return NextResponse.json({ success: true, status: 'cancelled' });

  } catch (error) {
    console.error('[CANCEL] Error:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
