/**
 * GET /api/admin/delivery-zones     — Lista todas las zonas (activas e inactivas)
 * PUT /api/admin/delivery-zones     — Actualiza una zona por ID
 * POST /api/admin/delivery-zones    — Crea una nueva zona
 * DELETE /api/admin/delivery-zones  — Elimina una zona
 */
import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';

export async function GET(req: Request) {
  try {
    try {
      await requireRole(req, 'cashier');
    } catch (authErr: any) {
      if (authErr.message?.includes('403')) {
        return NextResponse.json({ error: 'insufficient_permissions' }, { status: 403 });
      }
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    const adminSupabase = createAdminClient();
    const { data, error } = await adminSupabase
      .from('delivery_zones')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) {
      return NextResponse.json({ error: 'Error al obtener las zonas.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, zones: data ?? [] });

  } catch (error: any) {
    console.error('Error in GET /api/admin/delivery-zones:', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    try {
      await requireRole(req, 'owner');
    } catch (authErr: any) {
      if (authErr.message?.includes('403')) {
        return NextResponse.json({ error: 'insufficient_permissions' }, { status: 403 });
      }
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    const body = await req.json();
    const { id, label, max_distance_km, fee, active, display_order, min_order_amount, delivery_time_mins } = body;

    if (!id) {
      return NextResponse.json({ error: 'Se requiere el id de la zona.' }, { status: 400 });
    }

    const adminSupabase = createAdminClient();
    const updatePayload: Record<string, any> = { updated_at: new Date().toISOString() };
    if (label !== undefined) updatePayload.label = label;
    if (max_distance_km !== undefined) updatePayload.max_distance_km = max_distance_km;
    if (fee !== undefined) updatePayload.fee = fee;
    if (active !== undefined) updatePayload.active = active;
    if (display_order !== undefined) updatePayload.display_order = display_order;
    if (min_order_amount !== undefined) updatePayload.min_order_amount = min_order_amount;
    if (delivery_time_mins !== undefined) updatePayload.delivery_time_mins = delivery_time_mins;

    const { data, error } = await adminSupabase
      .from('delivery_zones')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating delivery zone:', error);
      return NextResponse.json({ error: 'Error al actualizar la zona.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, zone: data });

  } catch (error: any) {
    console.error('Error in PUT /api/admin/delivery-zones:', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    try {
      await requireRole(req, 'owner');
    } catch (authErr: any) {
      if (authErr.message?.includes('403')) {
        return NextResponse.json({ error: 'insufficient_permissions' }, { status: 403 });
      }
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    const body = await req.json();
    const { label, max_distance_km, fee, display_order, min_order_amount, delivery_time_mins, active } = body;

    if (!label || max_distance_km === undefined || fee === undefined) {
      return NextResponse.json(
        { error: 'Se requieren: label, max_distance_km, fee.' },
        { status: 400 }
      );
    }

    const adminSupabase = createAdminClient();
    const { data, error } = await adminSupabase
      .from('delivery_zones')
      .insert([{ 
        label, 
        max_distance_km, 
        fee, 
        display_order: display_order ?? 99, 
        active: active ?? true,
        min_order_amount: min_order_amount ?? null,
        delivery_time_mins: delivery_time_mins ?? null
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating delivery zone:', error);
      return NextResponse.json({ error: 'Error al crear la zona.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, zone: data }, { status: 201 });

  } catch (error: any) {
    console.error('Error in POST /api/admin/delivery-zones:', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    try {
      await requireRole(req, 'owner');
    } catch (authErr: any) {
      if (authErr.message?.includes('403')) {
        return NextResponse.json({ error: 'insufficient_permissions' }, { status: 403 });
      }
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Se requiere el id de la zona a eliminar.' }, { status: 400 });
    }

    const adminSupabase = createAdminClient();
    const { error } = await adminSupabase
      .from('delivery_zones')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting delivery zone:', error);
      return NextResponse.json({ error: 'Error al eliminar la zona. Verifica si hay pedidos vinculados.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Error in DELETE /api/admin/delivery-zones:', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
