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

    const { category_id, name, description, base_price, image_url, available, display_order, loyverse_item_id } = await req.json();

    if (!name || name.trim() === '' || !category_id) {
      return NextResponse.json({ error: 'El nombre y category_id son requeridos' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (!supabaseUrl || !serviceRoleKey) return NextResponse.json({ error: 'Configuración DB ausente' }, { status: 500 });
    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

    const { data, error } = await adminSupabase
      .from('products')
      .insert([{
        category_id,
        name,
        description: description || null,
        base_price: base_price || 0,
        image_url: image_url || null,
        available: available !== undefined ? available : true,
        display_order: display_order || 0,
        loyverse_item_id: loyverse_item_id || null
      }])
      .select()
      .single();

    if (error) throw error;

    revalidatePath('/api/menu');
    return NextResponse.json({ success: true, product: data }, { status: 201 });

  } catch (error: any) {
    console.error('Create product error:', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
