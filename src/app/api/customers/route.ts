import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';
import { getLoyaltyInfoFromLoyverse } from '@/lib/loyalty';

// GET: Búsqueda de cliente por teléfono para cajeros
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const phone = searchParams.get('phone');

    if (!phone) {
      return NextResponse.json({ error: 'Debes proporcionar un número de teléfono.' }, { status: 400 });
    }

    let tokenPayload;
    try {
      tokenPayload = await requireRole(req, 'cashier');
    } catch (authErr: any) {
      if (authErr.message.includes('403')) {
        return NextResponse.json({ error: 'insufficient_permissions', required_role: authErr.required_role, your_role: authErr.your_role }, { status: 403 });
      }
      return NextResponse.json({ error: authErr.message || 'No autorizado' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Configuración de DB ausente' }, { status: 500 });
    }

    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

    // 2. Find customer in local database
    const { data: customer, error: customerErr } = await adminSupabase
      .from('users')
      .select('id, name, phone, role, loyverse_customer_id')
      .eq('phone', phone)
      .single();

    if (customerErr || !customer) {
      return NextResponse.json({ error: 'Cliente no registrado en la plataforma' }, { status: 404 });
    }

    // 3. Consultar puntos en vivo (Loyverse API o Simulación Local)
    const loyverseData = await getLoyaltyInfoFromLoyverse(customer.loyverse_customer_id || '', customer.id);

    return NextResponse.json({
      success: true,
      customer: {
        user_id: customer.id,
        name: customer.name || 'Sin nombre',
        phone: customer.phone,
        loyverse_customer_id: customer.loyverse_customer_id,
        loyalty_points: loyverseData.loyalty_points,
        loyalty_tier: loyverseData.loyalty_tier,
        _loyverse_raw: loyverseData._loyverse_raw
      }
    });

  } catch (error: any) {
    console.error('Customer search error:', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
