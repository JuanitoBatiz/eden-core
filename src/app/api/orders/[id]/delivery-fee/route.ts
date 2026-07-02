import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase';

/**
 * PATCH /api/orders/[id]/delivery-fee
 * Body: { delivery_fee: number }
 *
 * Permite a caja/cocina (cashier/owner) cotizar el costo de envío de una orden a domicilio.
 * Una vez confirmada, Supabase Realtime notifica al cliente en tiempo real.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // 1. Solo cashier/owner puede cotizar envíos
    let tokenPayload;
    try {
      tokenPayload = await requireRole(req, 'cashier');
    } catch (authErr: any) {
      if (authErr.message.includes('403')) {
        return NextResponse.json({ error: 'insufficient_permissions', required_role: authErr.required_role, your_role: authErr.your_role }, { status: 403 });
      }
      return NextResponse.json({ error: authErr.message || 'No autorizado' }, { status: 401 });
    }

    if (!isSupabaseConfigured) {
      return NextResponse.json({ error: 'Configuración de base de datos ausente.' }, { status: 500 });
    }

    const orderId = (await params).id;
    if (!orderId) {
      return NextResponse.json({ error: 'ID de orden no proporcionado.' }, { status: 400 });
    }

    const body = await req.json();
    const { delivery_fee } = body;

    // Validate: must be a non-negative number
    if (typeof delivery_fee !== 'number' || delivery_fee < 0 || isNaN(delivery_fee)) {
      return NextResponse.json({ error: 'La tarifa de envío debe ser un número mayor o igual a 0.' }, { status: 400 });
    }

    const adminSupabase = createAdminClient();

    // 2. Verify order exists and is a delivery order
    const { data: order, error: fetchErr } = await adminSupabase
      .from('orders')
      .select('id, service_type, status')
      .eq('id', orderId)
      .single();

    if (fetchErr || !order) {
      return NextResponse.json({ error: 'Orden no encontrada.' }, { status: 404 });
    }

    if (order.service_type !== 'delivery') {
      return NextResponse.json({ error: 'Esta orden no es a domicilio.' }, { status: 400 });
    }

    if (order.status === 'cancelled' || order.status === 'delivered') {
      return NextResponse.json({ error: 'No se puede modificar una orden cancelada o entregada.' }, { status: 409 });
    }

    // 3. Update delivery_fee and mark as confirmed
    // Supabase Realtime will broadcast this UPDATE to any subscribed client
    const { error: updateErr } = await adminSupabase
      .from('orders')
      .update({
        delivery_fee: delivery_fee,
        delivery_fee_confirmed: true
      })
      .eq('id', orderId);

    if (updateErr) {
      throw new Error(`DB Error: ${updateErr.message}`);
    }

    return NextResponse.json({
      success: true,
      delivery_fee,
      message: `Tarifa de envío $${delivery_fee} confirmada para la orden ${orderId.slice(-4).toUpperCase()}.`
    });

  } catch (error: any) {
    console.error('Set delivery fee error:', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
