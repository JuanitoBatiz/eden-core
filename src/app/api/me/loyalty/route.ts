import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';
import { getLoyaltyInfoFromLoyverse } from '@/lib/loyalty';

// export const revalidate = 30; // REMOVED: Caching user-specific data causes cache poisoning

export async function GET(req: Request) {
  try {
    // 1. Verify User Session & Role
    let tokenPayload;
    try {
      tokenPayload = await requireRole(req, 'customer');
    } catch (authErr: any) {
      if (authErr.message.includes('403')) {
        return NextResponse.json({ error: 'insufficient_permissions', required_role: authErr.required_role, your_role: authErr.your_role }, { status: 403 });
      }
      return NextResponse.json({ error: authErr.message || 'No autorizado' }, { status: 401 });
    }

    const userId = tokenPayload.user_id;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Configuración DB ausente' }, { status: 500 });
    }

    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

    // 2. Fetch User to get Loyverse Customer ID
    const { data: user, error: userErr } = await adminSupabase
      .from('users')
      .select('loyverse_customer_id')
      .eq('id', userId)
      .single();

    if (userErr || !user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    // 3. Fetch Real-time points (Loyverse API or Simulated Local)
    const loyaltyData = await getLoyaltyInfoFromLoyverse(user.loyverse_customer_id || '', userId);
    const loyalty_points = loyaltyData.loyalty_points;
    const loyalty_tier = loyaltyData.loyalty_tier;

    // 4. Fetch local redemptions history (Last 10)
    // Nota: La API de Loyverse v1.0 no expone historial de puntos ganados,
    // así que solo podemos mostrar lo que el cliente ha canjeado en nuestra plataforma local.
    const { data: history } = await adminSupabase
      .from('loyalty_redemptions')
      .select('id, benefit_description, points_used, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    // 5. Fetch Loyalty Tiers to calculate "Points to next tier"
    const { data: tiers } = await adminSupabase
      .from('loyalty_tiers')
      .select('tier_name, min_points')
      .order('min_points', { ascending: true });

    let nextTier = null;
    let pointsNeeded = 0;

    if (tiers && tiers.length > 0) {
      // Find the next tier that requires more points than the user currently has
      const futureTier = tiers.find(t => t.min_points > loyalty_points);
      if (futureTier) {
        nextTier = futureTier.tier_name;
        pointsNeeded = futureTier.min_points - loyalty_points;
      }
    }

    return NextResponse.json({
      success: true,
      loyalty_points,
      loyalty_tier,
      next_tier: nextTier,
      points_needed_for_next_tier: pointsNeeded,
      history: history || []
    });

  } catch (error: any) {
    console.error('GET Loyalty error:', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
