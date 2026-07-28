/**
 * GET  /api/me/addresses    — Lista las direcciones guardadas del usuario autenticado
 * POST /api/me/addresses    — Guarda una nueva dirección para el usuario
 */
import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';

export async function GET(req: Request) {
  try {
    let tokenPayload;
    try {
      tokenPayload = await requireRole(req, 'customer');
    } catch (authErr: any) {
      return NextResponse.json({ success: true, addresses: [] });
    }

    const adminSupabase = createAdminClient();

    const { data, error } = await adminSupabase
      .from('user_saved_addresses')
      .select('id, label, address_text, lat, lng, is_default, created_at')
      .eq('user_id', tokenPayload.user_id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching user saved addresses:', error);
      return NextResponse.json({ success: true, addresses: [] });
    }

    return NextResponse.json({ success: true, addresses: data ?? [] });

  } catch (error: any) {
    console.error('Unexpected error in GET /api/me/addresses:', error);
    return NextResponse.json({ success: true, addresses: [] });
  }
}

export async function POST(req: Request) {
  try {
    let tokenPayload;
    try {
      tokenPayload = await requireRole(req, 'customer');
    } catch (authErr: any) {
      if (authErr.message?.includes('403')) {
        return NextResponse.json({ error: 'insufficient_permissions' }, { status: 403 });
      }
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    const body = await req.json();
    const { label, address_text, lat, lng } = body;

    if (!label || !address_text || typeof lat !== 'number' || typeof lng !== 'number') {
      return NextResponse.json(
        { error: 'Se requieren: label, address_text, lat, lng.' },
        { status: 400 }
      );
    }

    const adminSupabase = createAdminClient();

    // Si el usuario ya tiene 10 direcciones guardadas, borrar la más antigua (que no sea default)
    const { data: currentAddresses } = await adminSupabase
      .from('user_saved_addresses')
      .select('id, is_default, created_at')
      .eq('user_id', tokenPayload.user_id)
      .order('created_at', { ascending: true });

    if (currentAddresses && currentAddresses.length >= 10) {
      // Find the oldest non-default address
      const addressToDelete = currentAddresses.find(a => !a.is_default) || currentAddresses[0];
      
      if (addressToDelete) {
        await adminSupabase
          .from('user_saved_addresses')
          .delete()
          .eq('id', addressToDelete.id);
      }
    }

    // Si se marca como default, desmarcar las demás
    if (body.is_default) {
      await adminSupabase
        .from('user_saved_addresses')
        .update({ is_default: false })
        .eq('user_id', tokenPayload.user_id);
    }

    const { data: newAddress, error: insertErr } = await adminSupabase
      .from('user_saved_addresses')
      .insert([{
        user_id: tokenPayload.user_id,
        label: label.trim(),
        address_text: address_text.trim(),
        lat,
        lng,
        is_default: body.is_default ?? false,
      }])
      .select()
      .single();

    if (insertErr || !newAddress) {
      console.error('Error saving user address:', insertErr);
      return NextResponse.json({ error: 'Error al guardar la dirección.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, address: newAddress }, { status: 201 });

  } catch (error: any) {
    console.error('Unexpected error in POST /api/me/addresses:', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
