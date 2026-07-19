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
      console.log(`📡 [LOYALTY DIAGNOSTIC] Consultando puntos de lealtad en Loyverse para cliente ${loyverseCustomerId}...`);
      const res = await fetch(`https://api.loyverse.com/v1.0/customers/${loyverseCustomerId}`, {
        headers: { Authorization: `Bearer ${loyverseToken}` }
      });

      if (res.ok) {
        const data = await res.json();
        loyversePoints = data.total_points || 0;
        loyverseRaw = data;
        console.log(`✅ [LOYALTY DIAGNOSTIC SUCCESS] Puntos reportados por Loyverse: ${loyversePoints}`);
      } else {
        const errText = await res.text();
        console.error(`❌ [LOYALTY DIAGNOSTIC ERROR] Loyverse rechazó consultar cliente ${loyverseCustomerId} [HTTP ${res.status}]:`, errText);
      }
    } catch (e: any) {
      console.error('❌ [LOYALTY DIAGNOSTIC EXCEPTION] Error de red/excepción al consultar lealtad en Loyverse:', e?.message || e);
    }
  } else if (!loyverseToken) {
    console.warn('⚠️ [LOYALTY DIAGNOSTIC] LOYVERSE_ACCESS_TOKEN no está configurado. Usando sólo puntos locales.');
  }

  // CÁLCULO LOCAL DE EDÉN (Suma 10% de compras en Edén menos canjes realizados)
  let localPoints = 0;
  if (supabaseUserId) {
    try {
      const adminSupabase = createAdminClient();
      
      // Sumar el 10% (calculado luego como 3%) de órdenes válidas, PAGADAS o ENTREGADAS, y no canceladas.
      const { data: userOrders, error: ordersErr } = await adminSupabase
        .from('orders')
        .select('total')
        .eq('user_id', supabaseUserId)
        .neq('status', 'cancelled')
        .or('payment_status.eq.payment_approved,status.eq.delivered');

      if (ordersErr) {
        console.error('❌ [LOYALTY DIAGNOSTIC DB ERROR] Error consultando órdenes locales del usuario:', ordersErr.message);
      }

      let earnedSimulated = 0;
      if (userOrders && userOrders.length > 0) {
        earnedSimulated = userOrders.reduce((acc, curr) => acc + Math.floor((curr.total || 0) * 0.03), 0);
      }

      // Restar puntos canjeados
      const { data: redemptions, error: redemptionsErr } = await adminSupabase
        .from('loyalty_redemptions')
        .select('points_used')
        .eq('user_id', supabaseUserId);

      if (redemptionsErr) {
        console.error('❌ [LOYALTY DIAGNOSTIC DB ERROR] Error consultando canjes locales:', redemptionsErr.message);
      }

      let spentSimulated = 0;
      if (redemptions && redemptions.length > 0) {
        spentSimulated = redemptions.reduce((acc, curr) => acc + (curr.points_used || 0), 0);
      }

      // El sistema de lealtad vive en la web.
      // Tomamos los puntos base (lo ganado en la web, o lo de loyverse por si acaso es mayor)
      // y SIEMPRE le restamos los puntos que ya se canjearon en la plataforma web.
      const baseEarned = Math.max(earnedSimulated, loyversePoints);
      localPoints = Math.max(0, baseEarned - spentSimulated);
      
      console.log(`📊 [LOYALTY DIAGNOSTIC] Puntos finales calculados: ${localPoints} (Base Ganada: ${baseEarned}, Canjeados Web: ${spentSimulated})`);
    } catch (err: any) {
      console.error('❌ [LOYALTY DIAGNOSTIC EXCEPTION] Excepción calculando puntos locales en DB:', err?.message || err);
    }
  }

  // Para el cliente, la verdad absoluta son los puntos calculados en la web
  const finalPoints = supabaseUserId ? localPoints : loyversePoints;
  let tier = 'Estándar';
  if (finalPoints >= 140) tier = 'Diamante';
  else if (finalPoints >= 90) tier = 'Oro';
  else if (finalPoints >= 40) tier = 'Plata';

  return {
    loyalty_points: finalPoints,
    loyalty_tier: tier,
    _loyverse_raw: loyverseRaw
  };
}
