import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: Request) {
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
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Configuración DB ausente' }, { status: 500 });
    }

    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch whole menu tree (ignoring active/available, only filtering soft deletes)
    const { data: categories, error: catErr } = await adminSupabase
      .from('categories')
      .select('*')
      .is('deleted_at', null)
      .order('display_order');
    if (catErr) throw catErr;

    const { data: products, error: prodErr } = await adminSupabase
      .from('products')
      .select(`
        *,
        variants(*),
        modifier_groups(
          *,
          modifiers(*)
        )
      `)
      .is('deleted_at', null)
      .is('variants.deleted_at', null)
      .is('modifier_groups.deleted_at', null)
      .is('modifier_groups.modifiers.deleted_at', null)
      .order('display_order');
    if (prodErr) throw prodErr;

    return NextResponse.json({
      success: true,
      categories,
      products
    });

  } catch (error: any) {
    console.error('Admin menu fetch error:', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
