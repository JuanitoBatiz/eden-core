import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars from the root .env and .env.local files
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const loyverseToken = process.env.LOYVERSE_ACCESS_TOKEN || '';

if (!supabaseUrl || !serviceRoleKey || !loyverseToken) {
  console.error('Error: Faltan variables de entorno (Supabase o Loyverse Token).');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);
const LOYVERSE_API = 'https://api.loyverse.com/v1.0';

async function fetchLoyverseItems() {
  const items: any[] = [];
  let cursor: string | null = null;

  do {
    const url: string = cursor 
      ? `${LOYVERSE_API}/items?cursor=${cursor}`
      : `${LOYVERSE_API}/items`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${loyverseToken}` }
    });

    if (!res.ok) {
      throw new Error(`Loyverse API error: ${res.status}`);
    }

    const data = await res.json();
    items.push(...data.items);
    cursor = data.cursor; // null when no more pages
  } while (cursor);

  return items;
}

async function auditMapping() {
  console.log('Iniciando auditoría de catálogo Supabase vs Loyverse...\n');

  try {
    // 1. Fetch DB Products
    const { data: products, error } = await supabase.from('products').select('*');
    if (error) throw error;

    console.log(`> Productos locales (Supabase): ${products.length}`);

    // 2. Fetch Loyverse Catalog
    console.log(`> Obteniendo catálogo de Loyverse...`);
    const loyverseItems = await fetchLoyverseItems();
    console.log(`> Artículos en Loyverse (Items): ${loyverseItems.length}\n`);

    // 3. Mapping Analysis
    const matched: any[] = [];
    const orphans: any[] = [];
    const matchedLoyverseIds = new Set<string>();

    for (const prod of products) {
      const prodClean = prod.name.toLowerCase().trim();
      const match = loyverseItems.find(li => 
        li.item_name.toLowerCase().trim() === prodClean
      );

      if (match) {
        matchedLoyverseIds.add(match.id || match.item_id || match.item_name);
        const defaultVariant = match.variants?.[0]?.variant_id || null;
        matched.push({
          local: prod.name,
          loyverse: match.item_name,
          variant_id: defaultVariant
        });
      } else {
        const words = prodClean.split(/\s+/).filter((w: string) => w.length > 3 && !['torta', 'botella', 'cero', 'azúcar', 'deluxe', 'premium', 'clásicos', 'mixto'].includes(w));
        const suggestions = loyverseItems
          .filter(li => {
            const liClean = li.item_name.toLowerCase();
            return words.some((w: string) => liClean.includes(w));
          })
          .map(li => li.item_name);

        orphans.push({ name: prod.name, suggestions: Array.from(new Set(suggestions)).slice(0, 3) });
      }
    }

    // 4. Report
    console.log('=== RESULTADOS DEL MAPEO ===\n');
    console.log(`✅ MATCHES CLAROS (${matched.length}):`);
    matched.forEach(m => console.log(`  - [Local] ${m.local} <--> [Loyverse] ${m.loyverse} (Variant: ${m.variant_id})`));
    
    console.log(`\n❌ HUÉRFANOS EN SUPABASE (${orphans.length}) - (Faltan vincular):`);
    orphans.forEach(o => {
      console.log(`  - [Local] "${o.name}"`);
      if (o.suggestions.length > 0) {
        console.log(`      💡 ¿Quizás en Loyverse se llama: ${o.suggestions.map((s: string) => `"${s}"`).join(' o ')} ?`);
      }
    });

    const unmatchedLoyverse = loyverseItems
      .filter(li => !matched.some(m => m.loyverse.toLowerCase() === li.item_name.toLowerCase()))
      .map(li => li.item_name);

    console.log(`\n📦 ARTÍCULOS EN LOYVERSE SIN VINCULAR A LA WEB (${unmatchedLoyverse.length}):`);
    console.log(`  ${unmatchedLoyverse.join(', ')}`);

    const pedidoWebItem = loyverseItems.find(li => li.item_name.toLowerCase().includes('pedido web'));
    if (pedidoWebItem) {
      const officialVariant = pedidoWebItem.variants?.[0]?.variant_id;
      const currentEnvVariant = process.env.LOYVERSE_GENERIC_VARIANT_ID;
      console.log(`\n🔑 VERIFICACIÓN DE CONEXIÓN "PEDIDO WEB":`);
      console.log(`  Artículo en Loyverse: "${pedidoWebItem.item_name}"`);
      console.log(`  Variant ID oficial de Loyverse: ${officialVariant}`);
      console.log(`  Variant ID en tu .env.local:    ${currentEnvVariant}`);
      if (officialVariant === currentEnvVariant) {
        console.log(`  🟢 ¡EXCELENTE! Coinciden al 100%. Tu conexión KDS/Caja ya está lista.`);
      } else {
        console.log(`  🟡 ATENCIÓN: El ID en .env.local es diferente. Cambia LOYVERSE_GENERIC_VARIANT_ID=${officialVariant} en .env.local`);
      }
    }

    console.log('\n============================');
    console.log('NOTA: Este script es solo de lectura. No modificó loyverse_item_id en la BD.');

  } catch (error) {
    console.error('Error en la auditoría:', error);
  }
}

auditMapping();
