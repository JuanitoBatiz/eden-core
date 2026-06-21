import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

// PATCH: Rechazar pago
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const orderId = (await params).id;
    if (!orderId) {
      return NextResponse.json({ error: 'ID de orden no proporcionado.' }, { status: 400 });
    }

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
    const { reason } = body;
    if (!reason || reason.trim() === '') {
      return NextResponse.json({ error: 'Debes proporcionar un motivo de rechazo válido.' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Configuración DB ausente' }, { status: 500 });
    }

    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

    // 2. Fetch current payment status
    const { data: order, error: orderErr } = await adminSupabase
      .from('orders')
      .select('payment_status')
      .eq('id', orderId)
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ error: 'Orden no encontrada.' }, { status: 404 });
    }

    if (order.payment_status !== 'payment_submitted') {
      return NextResponse.json({ error: 'Esta orden no está pendiente de validación.' }, { status: 400 });
    }

    // 3. Execute Update
    const { error: updateErr } = await adminSupabase
      .from('orders')
      .update({
        payment_status: 'payment_rejected',
        rejection_reason: reason.trim()
      })
      .eq('id', orderId);

    if (updateErr) {
      throw new Error(`DB Error: ${updateErr.message}`);
    }

    return NextResponse.json({ success: true, payment_status: 'payment_rejected' });

  } catch (error: any) {
    console.error('Reject payment error:', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
