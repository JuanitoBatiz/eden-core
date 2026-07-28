/**
 * DELETE /api/me/addresses/[id]      — Elimina una dirección guardada del usuario
 * PATCH  /api/me/addresses/[id]      — Marca como default o actualiza etiqueta
 */
import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function DELETE(req: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    let tokenPayload;
    try {
      tokenPayload = await requireRole(req, 'customer');
    } catch (authErr: any) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    const adminSupabase = createAdminClient();

    // Verificar que la dirección pertenece al usuario antes de eliminar
    const { data: existing } = await adminSupabase
      .from('user_saved_addresses')
      .select('id, user_id')
      .eq('id', id)
      .single();

    if (!existing || existing.user_id !== tokenPayload.user_id) {
      return NextResponse.json({ error: 'Dirección no encontrada.' }, { status: 404 });
    }

    const { error: deleteErr } = await adminSupabase
      .from('user_saved_addresses')
      .delete()
      .eq('id', id);

    if (deleteErr) {
      console.error('Error deleting user address:', deleteErr);
      return NextResponse.json({ error: 'Error al eliminar la dirección.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Unexpected error in DELETE /api/me/addresses/[id]:', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    let tokenPayload;
    try {
      tokenPayload = await requireRole(req, 'customer');
    } catch (authErr: any) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    const body = await req.json();
    const adminSupabase = createAdminClient();

    // Verificar propiedad
    const { data: existing } = await adminSupabase
      .from('user_saved_addresses')
      .select('id, user_id')
      .eq('id', id)
      .single();

    if (!existing || existing.user_id !== tokenPayload.user_id) {
      return NextResponse.json({ error: 'Dirección no encontrada.' }, { status: 404 });
    }

    // Si se marca como default, desmarcar las demás primero
    if (body.is_default === true) {
      await adminSupabase
        .from('user_saved_addresses')
        .update({ is_default: false })
        .eq('user_id', tokenPayload.user_id);
    }

    // Campos actualizables
    const updatePayload: Record<string, any> = { updated_at: new Date().toISOString() };
    if (typeof body.is_default === 'boolean') updatePayload.is_default = body.is_default;
    if (typeof body.label === 'string' && body.label.trim()) updatePayload.label = body.label.trim();

    const { data: updated, error: updateErr } = await adminSupabase
      .from('user_saved_addresses')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (updateErr) {
      console.error('Error updating user address:', updateErr);
      return NextResponse.json({ error: 'Error al actualizar la dirección.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, address: updated });

  } catch (error: any) {
    console.error('Unexpected error in PATCH /api/me/addresses/[id]:', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
