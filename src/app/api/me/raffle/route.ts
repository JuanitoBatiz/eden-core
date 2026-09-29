import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';

/**
 * GET /api/me/raffle
 * Retorna las entradas de rifa acumuladas por el usuario autenticado.
 * Cada entrada corresponde a un pedido con total >= $200 y pago aprobado.
 */
export async function GET(req: Request) {
  try {
    // 1. Verificar sesión de usuario
    let tokenPayload;
    try {
      tokenPayload = await requireRole(req, 'customer');
    } catch (authErr: any) {
      if (authErr.message.includes('403')) {
        return NextResponse.json(
          { error: 'insufficient_permissions', required_role: authErr.required_role, your_role: authErr.your_role },
          { status: 403 }
        );
      }
      return NextResponse.json({ error: authErr.message || 'No autorizado' }, { status: 401 });
    }

    const userId = tokenPayload.user_id;
    const adminSupabase = createAdminClient();

    // 2. Obtener todas las entradas del usuario ordenadas por fecha
    const { data: entries, error: entriesErr } = await adminSupabase
      .from('raffle_entries')
      .select('id, order_id, order_total, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (entriesErr) {
      console.error('[RIFA] Error al consultar entradas del usuario:', entriesErr.message);
      return NextResponse.json({ error: 'Error al obtener entradas de rifa.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      total_entries: entries?.length ?? 0,
      entries: entries ?? [],
      // Información de la dinámica (configurable a futuro)
      raffle_info: {
        active: true,
        min_ticket_amount: 200,
        prize: 'Dos vuelos en globo aerostático para dos personas',
        rule: 'Una oportunidad por ticket de $200 o más, sin importar el monto exacto',
      },
    });

  } catch (error: any) {
    console.error('[RIFA] Error en GET /api/me/raffle:', error?.message || error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
