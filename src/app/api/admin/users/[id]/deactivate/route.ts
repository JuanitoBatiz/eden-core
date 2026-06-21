import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    let tokenPayload;
    try {
      tokenPayload = await requireRole(req, 'owner');
    } catch (authErr: any) {
      if (authErr.message.includes('403')) {
        return NextResponse.json({ error: 'insufficient_permissions', required_role: authErr.required_role, your_role: authErr.your_role }, { status: 403 });
      }
      return NextResponse.json({ error: authErr.message || 'No autorizado' }, { status: 401 });
    }

    const targetUserId = params.id;

    if (tokenPayload.user_id === targetUserId) {
        return NextResponse.json({ error: 'No puedes desactivar tu propia cuenta' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (!supabaseUrl || !serviceRoleKey) return NextResponse.json({ error: 'Configuración DB ausente' }, { status: 500 });
    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

    const { error } = await adminSupabase
      .from('users')
      .update({ active: false })
      .eq('id', targetUserId);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Usuario desactivado' });

  } catch (error: any) {
    console.error('Deactivate user error:', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
