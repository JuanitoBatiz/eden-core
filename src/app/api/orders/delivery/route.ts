/**
 * GET /api/orders/delivery
 * Retorna las órdenes de delivery activas: en preparación, listas y en tránsito.
 * Accesible para el rol cashier (repartidor usa el mismo rol por ahora).
 */
import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';

export async function GET(req: Request) {
  try {
    let tokenPayload;
    try {
      tokenPayload = await requireRole(req, 'cashier');
    } catch (authErr: any) {
      if (authErr.message?.includes('403')) {
        return NextResponse.json({ error: 'insufficient_permissions' }, { status: 403 });
      }
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    const adminSupabase = createAdminClient();

    const { data, error } = await adminSupabase
      .from('orders')
      .select(`
        id, customer_name, customer_phone, delivery_address,
        delivery_lat, delivery_lng, delivery_distance_km, delivery_fee,
        delivery_fee_confirmed, status, total, created_at, service_type,
        items, notes
      `)
      .eq('service_type', 'delivery')
      .in('status', ['in_preparation', 'ready', 'in_transit'])
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) {
      console.error('Error fetching delivery orders:', error);
      return NextResponse.json({ error: 'Error al obtener los pedidos.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, orders: data ?? [] });

  } catch (error: any) {
    console.error('Unexpected error in GET /api/orders/delivery:', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
