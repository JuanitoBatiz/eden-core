import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

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

    const { name, icon, display_order, active } = await req.json();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (!supabaseUrl || !serviceRoleKey) return NextResponse.json({ error: 'Configuración DB ausente' }, { status: 500 });
    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

    const updates: any = {};
    if (name !== undefined) {
        if (!name || name.trim() === '') return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
        updates.name = name;
    }
    if (icon !== undefined) updates.icon = icon;
    if (display_order !== undefined) updates.display_order = display_order;
    if (active !== undefined) updates.active = active;

    const { data, error } = await adminSupabase
      .from('categories')
      .update(updates)
      .eq('id', (await params).id)
      .select()
      .single();

    if (error) throw error;

    revalidatePath('/api/menu');
    return NextResponse.json({ success: true, category: data });

  } catch (error: any) {
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
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

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (!supabaseUrl || !serviceRoleKey) return NextResponse.json({ error: 'Configuración DB ausente' }, { status: 500 });
    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

    // Soft delete
    const { error } = await adminSupabase
      .from('categories')
      .update({ active: false, deleted_at: new Date().toISOString() })
      .eq('id', (await params).id);

    if (error) throw error;

    revalidatePath('/api/menu');
    return NextResponse.json({ success: true, message: 'Categoría eliminada lógicamente.' });

  } catch (error: any) {
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
