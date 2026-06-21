// src/lib/loyalty.ts
export interface LoyaltyInfo {
  loyalty_points: number;
  loyalty_tier: string;
  _loyverse_raw?: any;
}

/**
 * Consulta la API de Loyverse para obtener los puntos de lealtad en tiempo real.
 * Reutilizado tanto por la búsqueda de cliente por teléfono como por el escáner QR.
 */
export async function getLoyaltyInfoFromLoyverse(loyverseCustomerId: string): Promise<LoyaltyInfo> {
  const loyverseToken = process.env.LOYVERSE_ACCESS_TOKEN || '';
  if (!loyverseToken) {
    return { loyalty_points: 0, loyalty_tier: 'Estándar' };
  }

  try {
    const res = await fetch(`https://api.loyverse.com/v1.0/customers/${loyverseCustomerId}`, {
      headers: { Authorization: `Bearer ${loyverseToken}` }
    });

    if (res.ok) {
      const data = await res.json();
      return {
        loyalty_points: data.total_points || 0,
        loyalty_tier: data.customer_group?.name || 'Estándar',
        _loyverse_raw: data
      };
    }
  } catch (e) {
    console.error('Error fetching Loyverse loyalty data:', e);
  }

  // Fallback si la petición falla o no se encuentra
  return { loyalty_points: 0, loyalty_tier: 'Estándar' };
}
