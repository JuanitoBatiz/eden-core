import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

export async function POST(req: Request) {
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

    const { name, icon, display_order, active } = await req.json();

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Configuración DB ausente' }, { status: 500 });
    }

    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

    const { data, error } = await adminSupabase
      .from('categories')
      .insert([{
        name,
        icon: icon || null,
        display_order: display_order || 0,
        active: active !== undefined ? active : true
      }])
      .select()
      .single();

    if (error) throw error;

    // Invalidar cache de menú
    revalidatePath('/api/menu');

    return NextResponse.json({ success: true, category: data }, { status: 201 });

  } catch (error: any) {
    console.error('Create category error:', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
