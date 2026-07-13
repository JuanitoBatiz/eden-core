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
    // Normalize: strip spaces, dashes, plus signs
    const rawPhone = phone.replace(/[\s\-\+]/g, '');
    
    // Build phone variants to search (with and without MX country code 52)
    const phoneVariants: string[] = [rawPhone];
    if (rawPhone.startsWith('52') && rawPhone.length === 12) {
      // Has 52 prefix — also try without it (local 10-digit)
      phoneVariants.push(rawPhone.slice(2));
    } else if (!rawPhone.startsWith('52') && rawPhone.length === 10) {
      // Local 10-digit — also try with 52 prefix
      phoneVariants.push('52' + rawPhone);
    } else if (rawPhone.startsWith('521') && rawPhone.length === 13) {
      // Some carriers include 521 — also try without the 1
      phoneVariants.push('52' + rawPhone.slice(3));
      phoneVariants.push(rawPhone.slice(3));
    }

    // Search across all phone variants
    const { data: customer, error: customerErr } = await adminSupabase
      .from('users')
      .select('id, name, phone, role, loyverse_customer_id')
      .in('phone', phoneVariants)
      .limit(1)
      .single();

    if (customerErr || !customer) {
      console.warn(`[CUSTOMER SEARCH] No encontrado para variantes: ${phoneVariants.join(', ')}`);
      return NextResponse.json({ error: 'Cliente no registrado en la plataforma. Verifica el número o pídele que muestre su QR.' }, { status: 404 });
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
