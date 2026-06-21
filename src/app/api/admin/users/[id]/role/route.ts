import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
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

    const { role } = await req.json();
    const validRoles = ['customer', 'cashier', 'owner'];
    
    if (!role || !validRoles.includes(role)) {
      return NextResponse.json({ error: 'Rol inválido' }, { status: 400 });
    }

    const targetUserId = (await params).id;
    
    // Regla: No puedes bajar tu propio rol de owner
    if (tokenPayload.user_id === targetUserId && role !== 'owner') {
      return NextResponse.json({ error: 'No puedes modificar tu propio rol de owner, pide a otro owner que lo haga' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (!supabaseUrl || !serviceRoleKey) return NextResponse.json({ error: 'Configuración DB ausente' }, { status: 500 });
    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

    const { error } = await adminSupabase
      .from('users')
      .update({ role })
      .eq('id', targetUserId);

    if (error) throw error;

    return NextResponse.json({ success: true, message: `Rol actualizado a ${role}` });

  } catch (error: any) {
    console.error('Update role error:', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
