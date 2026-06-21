import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

// GET: Retornar órdenes con comprobante pendiente de revisión
export async function GET(req: Request) {
  try {
    let tokenPayload;
    try {
      tokenPayload = await requireRole(req, 'cashier');
    } catch (authErr: any) {
      if (authErr.message.includes('403')) {
        return NextResponse.json({ error: 'insufficient_permissions', required_role: authErr.required_role, your_role: authErr.your_role }, { status: 403 });
      }
      return NextResponse.json({ error: authErr.message || 'No autorizado' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Configuración DB ausente' }, { status: 500 });
    }

    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

    const { data, error } = await adminSupabase
      .from('orders')
      .select('id, customer_name, customer_phone, total, created_at, proof_url, status')
      .eq('payment_status', 'payment_submitted')
      .order('created_at', { ascending: true });

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, pendingPayments: data });

  } catch (error: any) {
    console.error('Fetch pending payments error:', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
