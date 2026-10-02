import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';

/**
 * PATCH /api/admin/raffle/[id]
 * Permite marcar o desmarcar un ticket como impreso (físico).
 * Solo accesible para cashier/admin.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // 1. Verificar rol
    try {
      await requireRole(req, 'cashier');
    } catch (authErr: any) {
      return NextResponse.json({ error: authErr.message || 'No autorizado' }, { status: 403 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Falta el ID del ticket' }, { status: 400 });
    }

    // Parse the body
    const body = await req.json();
    if (typeof body.ticket_printed !== 'boolean') {
      return NextResponse.json({ error: 'El campo ticket_printed es requerido y debe ser booleano' }, { status: 400 });
    }

    const adminSupabase = createAdminClient();

    // 2. Actualizar el registro
    const { data, error } = await adminSupabase
      .from('raffle_entries')
      .update({ ticket_printed: body.ticket_printed })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[RIFA ADMIN] Error al actualizar ticket_printed:', error.message);
      return NextResponse.json({ error: 'No se pudo actualizar el estado del boleto' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Estado del boleto actualizado',
      ticket: data
    });

  } catch (error: any) {
    console.error('[RIFA ADMIN] Error en PATCH /api/admin/raffle/[id]:', error?.message || error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
