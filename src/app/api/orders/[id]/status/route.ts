import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

// Valid state transitions
const VALID_TRANSITIONS: Record<string, string[]> = {
  'received': ['in_preparation', 'cancelled'],
  'in_preparation': ['delivered', 'cancelled'],
  // No transitions allowed out of 'delivered' or 'cancelled' in this basic state machine
  'delivered': [],
  'cancelled': []
};

// PATCH: Cambiar estado de la orden (Admin/Cashier)
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
    const { status: newStatus } = body;

    if (!['received', 'in_preparation', 'delivered', 'cancelled'].includes(newStatus)) {
      return NextResponse.json({ error: 'Estado inválido proporcionado.' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Configuración DB ausente' }, { status: 500 });
    }

    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

    // 2. Fetch current status to validate transition
    const { data: order, error: orderErr } = await adminSupabase
      .from('orders')
      .select('status')
      .eq('id', orderId)
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ error: 'Orden no encontrada.' }, { status: 404 });
    }

    const currentStatus = order.status;

    // Same status, do nothing but return success
    if (currentStatus === newStatus) {
      return NextResponse.json({ success: true, status: newStatus });
    }

    // Validate transition
    const allowedNextStates = VALID_TRANSITIONS[currentStatus] || [];
    if (!allowedNextStates.includes(newStatus)) {
      return NextResponse.json(
        { 
          error: `Transición inválida. No se puede pasar de '${currentStatus}' a '${newStatus}'.`,
          allowed_transitions: allowedNextStates
        }, 
        { status: 400 }
      );
    }

    // 3. Update Status
    const { error: updateErr } = await adminSupabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId);

    if (updateErr) {
      throw new Error(`DB Error: ${updateErr.message}`);
    }

    return NextResponse.json({ success: true, status: newStatus });

  } catch (error: any) {
    console.error('Update order status error:', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
