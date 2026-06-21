import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars from the root .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') });

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
    const matched = [];
    const orphans = [];

    for (const prod of products) {
      // Find exact or loose name match
      // Note: Loyverse items can have variants. We check item_name first.
      const match = loyverseItems.find(li => 
        li.item_name.toLowerCase().trim() === prod.name.toLowerCase().trim()
      );

      if (match) {
        // Find default variant ID
        const defaultVariant = match.variants?.[0]?.variant_id || null;
        matched.push({
          local: prod.name,
          loyverse: match.item_name,
          variant_id: defaultVariant
        });
      } else {
        orphans.push(prod.name);
      }
    }

    // 4. Report
    console.log('=== RESULTADOS DEL MAPEO ===\n');
    console.log(`✅ MATCHES CLAROS (${matched.length}):`);
    matched.forEach(m => console.log(`  - [Local] ${m.local} <--> [Loyverse] ${m.loyverse} (Variant: ${m.variant_id})`));
    
    console.log(`\n❌ HUÉRFANOS EN SUPABASE (${orphans.length}):`);
    orphans.forEach(o => console.log(`  - ${o}`));

    console.log('\n============================');
    console.log('NOTA: Este script es solo de lectura. No modificó loyverse_item_id en la BD.');

  } catch (error) {
    console.error('Error en la auditoría:', error);
  }
}

auditMapping();
