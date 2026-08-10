import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    
    // 1. Verificar permisos (solo admin o cashier)
    try {
      await requireRole(req, 'cashier');
    } catch (authErr: any) {
      if (authErr.message.includes('403')) {
        return NextResponse.json({ error: 'insufficient_permissions' }, { status: 403 });
      }
      return NextResponse.json({ error: authErr.message || 'No autorizado' }, { status: 401 });
    }

    const orderId = params.id;
    if (!orderId) {
      return NextResponse.json({ error: 'Falta el ID de la orden.' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

    // 2. Ejecutar Update para destrabar el pago
    const { data: updatedOrder, error: updateErr } = await adminSupabase
      .from('orders')
      .update({
        status: 'awaiting_payment',
        payment_status: 'pending_payment',
        rejection_reason: 'Por favor, vuelve a seleccionar tu método de pago.'
      })
      .eq('id', orderId)
      .select('id, status, payment_status, rejection_reason')
      .single();

    if (updateErr) {
      throw new Error(`DB Error: ${updateErr.message}`);
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Pago destrabado correctamente.',
      order: updatedOrder
    });

  } catch (error: any) {
    console.error('Reset payment error:', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
