// src/lib/loyalty.ts
import { createAdminClient } from '@/lib/supabase';

export interface LoyaltyInfo {
  loyalty_points: number;
  loyalty_tier: string;
  _loyverse_raw?: any;
}

/**
 * Consulta la API de Loyverse para obtener los puntos de lealtad en tiempo real.
 * Si las variables de Loyverse están comentadas en .env.local (modo dev/pruebas),
 * calcula matemáticamente los puntos simulados basados en las compras locales del usuario.
 */
export async function getLoyaltyInfoFromLoyverse(loyverseCustomerId: string, supabaseUserId?: string): Promise<LoyaltyInfo> {
  const loyverseToken = process.env.LOYVERSE_ACCESS_TOKEN || '';
  
  if (loyverseToken && loyverseCustomerId && !loyverseCustomerId.startsWith('loyverse_cust_')) {
    try {
      const res = await fetch(`https://api.loyverse.com/v1.0/customers/${loyverseCustomerId}`, {
        headers: { Authorization: `Bearer ${loyverseToken}` }
      });

      if (res.ok) {
        const data = await res.json();
        const pts = data.total_points || 0;
        let tier = 'Estándar';
        if (pts >= 1800) tier = 'Diamante';
        else if (pts >= 600) tier = 'Oro';
        else if (pts >= 150) tier = 'Plata';

        return {
          loyalty_points: pts,
          loyalty_tier: tier,
          _loyverse_raw: data
        };
      }
    } catch (e) {
      console.error('Error fetching Loyverse loyalty data:', e);
    }
  }

  // FALLBACK DE SIMULACIÓN LOCAL (Cuando .env.local tiene #LOYVERSE o es un usuario de prueba)
  if (supabaseUserId) {
    try {
      const adminSupabase = createAdminClient();
      
      // Sumar el 10% de todas las órdenes válidas (no canceladas) de este usuario
      const { data: userOrders } = await adminSupabase
        .from('orders')
        .select('total')
        .eq('user_id', supabaseUserId)
        .neq('status', 'cancelled');

      let earnedSimulated = 0;
      if (userOrders && userOrders.length > 0) {
        earnedSimulated = userOrders.reduce((acc, curr) => acc + Math.floor((curr.total || 0) * 0.1), 0);
      }

      // Restar puntos canjeados en pruebas
      const { data: redemptions } = await adminSupabase
        .from('loyalty_redemptions')
        .select('points_used')
        .eq('user_id', supabaseUserId);

      let spentSimulated = 0;
      if (redemptions && redemptions.length > 0) {
        spentSimulated = redemptions.reduce((acc, curr) => acc + (curr.points_used || 0), 0);
      }

      const simPoints = Math.max(0, earnedSimulated - spentSimulated);
      let simTier = 'Estándar';
      if (simPoints >= 1800) simTier = 'Diamante';
      else if (simPoints >= 600) simTier = 'Oro';
      else if (simPoints >= 150) simTier = 'Plata';

      return {
        loyalty_points: simPoints,
        loyalty_tier: simTier
      };
    } catch (err) {
      console.error('Error calculating simulated loyalty points:', err);
    }
  }

  return { loyalty_points: 0, loyalty_tier: 'Estándar' };
}
