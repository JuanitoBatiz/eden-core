import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// GET: Cron fallback para sincronizar inventario de Loyverse
export async function GET(req: Request) {
  try {
    const cronSecretHeader = req.headers.get('Authorization');
    const expectedSecret = process.env.CRON_SECRET;

    // Solo aceptar el secreto vía cabecera Authorization para evitar
    // que sea registrado en logs de servidores, proxies y navegadores.
    const isAuthorized = expectedSecret && cronSecretHeader === `Bearer ${expectedSecret}`;

    if (!isAuthorized) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const loyverseToken = process.env.LOYVERSE_ACCESS_TOKEN || '';
    if (!loyverseToken) {
      return NextResponse.json({ error: 'Loyverse Token ausente' }, { status: 500 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Configuración DB ausente' }, { status: 500 });
    }

    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

    const LOYVERSE_API = 'https://api.loyverse.com/v1.0';
    let cursor: string | null = null;
    let totalUpdated = 0;

    // Paginación segura para no saturar memoria
    do {
      const url: string = cursor 
        ? `${LOYVERSE_API}/inventory?cursor=${cursor}`
        : `${LOYVERSE_API}/inventory`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${loyverseToken}` }
      });

      if (!res.ok) {
        throw new Error(`Loyverse API error: ${res.status}`);
      }

      const data = await res.json();
      const inventoryLevels = data.inventory_levels || [];
      
      // Mapear in_stock a availability
      const isAvailableMap: Record<string, boolean> = {};
      const variantIds = [];

      for (const level of inventoryLevels) {
        if (level.variant_id) {
          variantIds.push(level.variant_id);
          isAvailableMap[level.variant_id] = level.in_stock > 0;
        }
      }

      if (variantIds.length > 0) {
        // Fetch local products that match these variants
        const { data: products } = await adminSupabase
          .from('products')
          .select('id, loyverse_item_id')
          .in('loyverse_item_id', variantIds);

        if (products && products.length > 0) {
          const updates = [];
          for (const prod of products) {
            if (prod.loyverse_item_id && isAvailableMap[prod.loyverse_item_id] !== undefined) {
              updates.push({
                id: prod.id,
                available: isAvailableMap[prod.loyverse_item_id]
              });
            }
          }

          if (updates.length > 0) {
            await adminSupabase.from('products').upsert(updates);
            totalUpdated += updates.length;
          }
        }
      }

      cursor = data.cursor; // next page or null
    } while (cursor);

    return NextResponse.json({ 
      success: true, 
      message: 'Sincronización de inventario completada',
      items_updated: totalUpdated
    });

  } catch (error: any) {
    console.error('Inventory sync cron error:', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
