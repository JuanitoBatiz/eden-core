import { NextResponse } from 'next/server';
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase';
import { requireRole } from '@/lib/auth';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    let tokenPayload;
    try {
      tokenPayload = await requireRole(req, 'customer');
    } catch (authErr: any) {
      if (authErr.message.includes('403')) {
        return NextResponse.json({ error: 'insufficient_permissions', required_role: authErr.required_role, your_role: authErr.your_role }, { status: 403 });
      }
      return NextResponse.json({ error: authErr.message || 'No autorizado' }, { status: 401 });
    }

    if (!isSupabaseConfigured) {
      return NextResponse.json({ error: 'Configuración de base de datos ausente.' }, { status: 500 });
    }

    const orderId = params.id;
    if (!orderId) {
      return NextResponse.json({ error: 'ID de orden no proporcionado.' }, { status: 400 });
    }

    // Endpoint protegido por requireRole → usar adminClient para bypassear RLS
    const adminSupabase = createAdminClient();

    const { data: order, error } = await adminSupabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (error) {
      console.error('Fetch order DB error:', error.message);
      return NextResponse.json({ error: 'Error al consultar la orden.' }, { status: 500 });
    }

    if (!order) {
      return NextResponse.json({ error: 'Orden no encontrada.' }, { status: 404 });
    }

    // Verificación de ownership: el cliente solo puede ver sus propias órdenes
    if (order.user_id !== tokenPayload.user_id && tokenPayload.role !== 'cashier' && tokenPayload.role !== 'owner') {
      return NextResponse.json({ error: 'Prohibido. No tienes permiso para ver esta orden.' }, { status: 403 });
    }

    return NextResponse.json({ success: true, order });

  } catch (error: any) {
    console.error('Fetch order error:', error);
    return NextResponse.json(
      { error: 'Error interno al obtener el pedido.' },
      { status: 500 }
    );
  }
}
