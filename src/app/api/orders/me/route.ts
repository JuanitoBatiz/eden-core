import { NextResponse } from 'next/server';
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase';
import { requireRole } from '@/lib/auth';

export async function GET(req: Request) {
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

    // Endpoint protegido por requireRole → usar adminClient para bypassear RLS
    const adminSupabase = createAdminClient();

    const { data: orders, error } = await adminSupabase
      .from('orders')
      .select('*')
      .eq('user_id', tokenPayload.user_id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Fetch user orders DB error:', error.message);
      throw new Error('Error al consultar el historial de órdenes.');
    }

    return NextResponse.json({ success: true, orders });

  } catch (error: any) {
    console.error('Fetch user orders error:', error);
    return NextResponse.json(
      { error: 'Error interno al obtener el historial.' },
      { status: 500 }
    );
  }
}
