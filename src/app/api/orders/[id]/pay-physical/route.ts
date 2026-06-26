import { NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';

// PATCH: Pagar en físico
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const orderId = (await params).id;
    if (!orderId) {
      return NextResponse.json({ error: 'ID de orden no proporcionado.' }, { status: 400 });
    }

    let tokenPayload;
    try {
      tokenPayload = await verifyAccessToken(req);
    } catch (e) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const adminSupabase = createAdminClient();

    // Validar que la orden pertenezca al usuario y esté esperando pago
    const { data: order, error: orderErr } = await adminSupabase
      .from('orders')
      .select('status, user_id')
      .eq('id', orderId)
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ error: 'Orden no encontrada.' }, { status: 404 });
    }

    if (order.user_id !== tokenPayload.user_id) {
      return NextResponse.json({ error: 'No tienes permisos sobre esta orden.' }, { status: 403 });
    }

    if (order.status !== 'awaiting_payment') {
      return NextResponse.json({ error: 'Esta orden no está esperando decisión de pago.' }, { status: 400 });
    }

    // Actualizar estado para mandarla a cocina directamente
    const { error: updateErr } = await adminSupabase
      .from('orders')
      .update({
        status: 'in_preparation',
        // Podemos añadir una nota para la caja, o simplemente dejar payment_status='pending_payment'
      })
      .eq('id', orderId);

    if (updateErr) {
      throw new Error(`DB Error: ${updateErr.message}`);
    }

    return NextResponse.json({ success: true, status: 'in_preparation' });

  } catch (error: any) {
    console.error('Pay physical error:', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
