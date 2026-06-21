import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

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

    const { name, price_modifier, available, display_order } = await req.json();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (!supabaseUrl || !serviceRoleKey) return NextResponse.json({ error: 'Configuración DB ausente' }, { status: 500 });
    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

    const updates: any = {};
    if (name !== undefined) {
        if (!name || name.trim() === '') return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
        updates.name = name;
    }
    if (price_modifier !== undefined) updates.price_modifier = price_modifier;
    if (available !== undefined) updates.available = available;
    if (display_order !== undefined) updates.display_order = display_order;

    const { data, error } = await adminSupabase
      .from('modifiers')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single();

    if (error) throw error;

    revalidatePath('/api/menu');
    return NextResponse.json({ success: true, modifier: data });

  } catch (error: any) {
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
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
      .from('modifiers')
      .update({ available: false, deleted_at: new Date().toISOString() })
      .eq('id', params.id);

    if (error) throw error;

    revalidatePath('/api/menu');
    return NextResponse.json({ success: true, message: 'Modificador eliminado lógicamente.' });

  } catch (error: any) {
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
