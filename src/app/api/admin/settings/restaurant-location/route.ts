/**
 * GET /api/admin/settings/restaurant-location   — Lee las coordenadas del restaurante
 * PUT /api/admin/settings/restaurant-location   — Actualiza las coordenadas del restaurante
 *
 * Permite al dueño/cajero cambiar la ubicación de origen para el cálculo de distancias
 * sin tocar código ni hacer un nuevo deploy.
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
      .from('settings')
      .select('key, value, description, updated_at')
      .eq('key', 'restaurant_location')
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'No se encontró la configuración.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, setting: data });

  } catch (error: any) {
    console.error('Error in GET /api/admin/settings/restaurant-location:', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    try {
      await requireRole(req, 'cashier');
    } catch (authErr: any) {
      if (authErr.message?.includes('403')) {
        return NextResponse.json({ error: 'insufficient_permissions' }, { status: 403 });
      }
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    const body = await req.json();
    const { lat, lng, address } = body;

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return NextResponse.json(
        { error: 'Se requieren lat y lng como números.' },
        { status: 400 }
      );
    }

    const adminSupabase = createAdminClient();
    const { data, error } = await adminSupabase
      .from('settings')
      .update({
        value: { lat, lng, address: address || '' },
        updated_at: new Date().toISOString()
      })
      .eq('key', 'restaurant_location')
      .select()
      .single();

    if (error) {
      console.error('Error updating restaurant location:', error);
      return NextResponse.json({ error: 'Error al actualizar la ubicación.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, setting: data });

  } catch (error: any) {
    console.error('Error in PUT /api/admin/settings/restaurant-location:', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
