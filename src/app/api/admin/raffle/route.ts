import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';

/**
 * GET /api/admin/raffle
 * Retorna el ranking de todos los usuarios con sus entradas de rifa.
 * Solo accesible para cashier/admin.
 * Útil para hacer la consulta final cuando se realice el sorteo.
 */
export async function GET(req: Request) {
  try {
    // 1. Verificar que sea cajero o admin
    let tokenPayload;
    try {
      tokenPayload = await requireRole(req, 'cashier');
    } catch (authErr: any) {
      if (authErr.message.includes('403')) {
        return NextResponse.json(
          { error: 'insufficient_permissions', required_role: authErr.required_role, your_role: authErr.your_role },
          { status: 403 }
        );
      }
      return NextResponse.json({ error: authErr.message || 'No autorizado' }, { status: 401 });
    }

    const adminSupabase = createAdminClient();

    // 2. Obtener todas las entradas agrupadas por usuario
    // Incluye datos del usuario para mostrar nombre y teléfono
    const { data: entries, error: entriesErr } = await adminSupabase
      .from('raffle_entries')
      .select(`
        id,
        order_id,
        order_total,
        created_at,
        ticket_printed,
        user_id,
        users!raffle_entries_user_id_fkey (
          id,
          name,
          phone
        )
      `)
      .order('created_at', { ascending: false });

    if (entriesErr) {
      console.error('[RIFA ADMIN] Error al consultar entradas:', entriesErr.message);
      return NextResponse.json({ error: 'Error al obtener entradas de rifa.' }, { status: 500 });
    }

    // 3. Agrupar por usuario para generar el ranking
    const userMap = new Map<string, {
      user_id: string;
      name: string | null;
      phone: string;
      total_entries: number;
      last_entry_at: string;
      entries: { id: string; order_id: string; order_total: number; created_at: string; ticket_printed: boolean }[];
    }>();

    for (const entry of entries ?? []) {
      const user = entry.users as any;
      if (!user) continue;

      const uid = entry.user_id;
      if (!userMap.has(uid)) {
        userMap.set(uid, {
          user_id: uid,
          name: user.name ?? null,
          phone: user.phone,
          total_entries: 0,
          last_entry_at: entry.created_at,
          entries: [],
        });
      }

      const record = userMap.get(uid)!;
      record.total_entries += 1;
      record.entries.push({
        id: entry.id,
        order_id: entry.order_id,
        order_total: entry.order_total,
        created_at: entry.created_at,
        ticket_printed: entry.ticket_printed,
      });
      // Mantener la entrada más reciente como referencia
      if (entry.created_at > record.last_entry_at) {
        record.last_entry_at = entry.created_at;
      }
    }

    // 4. Convertir a array y ordenar de mayor a menor entradas
    const ranking = Array.from(userMap.values()).sort(
      (a, b) => b.total_entries - a.total_entries
    );

    return NextResponse.json({
      success: true,
      total_participants: ranking.length,
      total_entries_issued: entries?.length ?? 0,
      ranking,
    });

  } catch (error: any) {
    console.error('[RIFA ADMIN] Error en GET /api/admin/raffle:', error?.message || error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
