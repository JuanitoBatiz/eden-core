// src/lib/loyalty.ts
import { createAdminClient } from '@/lib/supabase';

export interface LoyaltyInfo {
  loyalty_points: number;
  loyalty_tier: string;
  _loyverse_raw?: any;
}

/**
 * Consulta los puntos de lealtad combinando la API de Loyverse y las compras locales en Edén.
 * De esta forma, si el cliente compró en el menú digital (o si Loyverse aún reporta 0),
 * siempre verá reflejados sus puntos reales ganados y canjeados tanto en perfil como al escanear el QR.
 */
export async function getLoyaltyInfoFromLoyverse(loyverseCustomerId: string, supabaseUserId?: string): Promise<LoyaltyInfo> {
  const loyverseToken = process.env.LOYVERSE_ACCESS_TOKEN || '';
  let loyversePoints = 0;
  let loyverseRaw = null;
  
  if (loyverseToken && loyverseCustomerId && !loyverseCustomerId.startsWith('loyverse_cust_')) {
    try {
      const res = await fetch(`https://api.loyverse.com/v1.0/customers/${loyverseCustomerId}`, {
        headers: { Authorization: `Bearer ${loyverseToken}` }
      });

      if (res.ok) {
        const data = await res.json();
        loyversePoints = data.total_points || 0;
        loyverseRaw = data;
      }
    } catch (e) {
      console.error('Error fetching Loyverse loyalty data:', e);
    }
  }

  // CÁLCULO LOCAL DE EDÉN (Suma 10% de compras en Edén menos canjes realizados)
  let localPoints = 0;
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

      // Restar puntos canjeados
      const { data: redemptions } = await adminSupabase
        .from('loyalty_redemptions')
        .select('points_used')
        .eq('user_id', supabaseUserId);

      let spentSimulated = 0;
      if (redemptions && redemptions.length > 0) {
        spentSimulated = redemptions.reduce((acc, curr) => acc + (curr.points_used || 0), 0);
      }

      localPoints = Math.max(0, earnedSimulated - spentSimulated);
    } catch (err) {
      console.error('Error calculating local loyalty points:', err);
    }
  }

  // Tomamos el mayor valor entre lo reportado por Loyverse y lo acumulado localmente en Edén
  const finalPoints = Math.max(loyversePoints, localPoints);
  let tier = 'Estándar';
  if (finalPoints >= 1800) tier = 'Diamante';
  else if (finalPoints >= 600) tier = 'Oro';
  else if (finalPoints >= 150) tier = 'Plata';

  return {
    loyalty_points: finalPoints,
    loyalty_tier: tier,
    _loyverse_raw: loyverseRaw
  };
}
