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

    const { category_id, name, description, base_price, image_url, available, display_order, loyverse_item_id } = await req.json();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (!supabaseUrl || !serviceRoleKey) return NextResponse.json({ error: 'Configuración DB ausente' }, { status: 500 });
    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

    const updates: any = {};
    if (name !== undefined) {
        if (!name || name.trim() === '') return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
        updates.name = name;
    }
    if (category_id !== undefined) updates.category_id = category_id;
    if (description !== undefined) updates.description = description;
    if (base_price !== undefined) updates.base_price = base_price;
    if (image_url !== undefined) updates.image_url = image_url;
    if (available !== undefined) updates.available = available;
    if (display_order !== undefined) updates.display_order = display_order;
    if (loyverse_item_id !== undefined) updates.loyverse_item_id = loyverse_item_id;

    const { data, error } = await adminSupabase
      .from('products')
      .update(updates)
      .eq('id', (await params).id)
      .select()
      .single();

    if (error) throw error;

    revalidatePath('/api/menu');
    return NextResponse.json({ success: true, product: data });

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

    // Soft delete: set available = false and deleted_at = now
    const { error } = await adminSupabase
      .from('products')
      .update({ available: false, deleted_at: new Date().toISOString() })
      .eq('id', (await params).id);

    if (error) throw error;

    revalidatePath('/api/menu');
    return NextResponse.json({ success: true, message: 'Producto eliminado lógicamente.' });

  } catch (error: any) {
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
