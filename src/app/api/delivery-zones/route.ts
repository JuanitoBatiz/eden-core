/**
 * GET /api/delivery-zones
 * Retorna las zonas de entrega activas, ordenadas por distancia.
 * API pública — no requiere autenticación.
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';

export async function GET() {
  try {
    const adminSupabase = createAdminClient();

    const { data, error } = await adminSupabase
      .from('delivery_zones')
      .select('id, label, max_distance_km, fee, display_order')
      .eq('active', true)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error fetching delivery zones:', error);
      return NextResponse.json({ error: 'Error al obtener las zonas de entrega.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, zones: data ?? [] });

  } catch (error: any) {
    console.error('Unexpected error in GET /api/delivery-zones:', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
