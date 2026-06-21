import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { CATEGORIES, MENU_ITEMS, SALAD_OPTIONS } from '../src/lib/menuData';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function run() {
  if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('your_supabase_url_here')) {
    console.warn('\n⚠️  ADVERTENCIA: Faltan credenciales reales de Supabase en .env.');
    console.warn('El script de migración está construido y listo para ejecutarse contra la base de datos.');
    console.warn('Para poblar tu base de datos final, configura NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY y ejecuta:\n  npx tsx scripts/migrate-menu-data.ts\n');
    process.exit(0); // Exit gracefully so it doesn't break CI/CD or the user's terminal with a red stack trace
  }

  console.log('Iniciando migración de datos hacia Supabase...');
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    for (const [cIdx, cat] of CATEGORIES.entries()) {
      console.log(`Migrando categoría: ${cat.name}`);
      const { data: category, error: catErr } = await supabase
        .from('categories')
        .insert({
          name: cat.name,
          icon: cat.icon,
          display_order: cIdx
        })
        .select()
        .single();
      
      if (catErr) throw catErr;

      const products = MENU_ITEMS.filter(p => p.category === cat.id);
      
      for (const [pIdx, prod] of products.entries()) {
        console.log(`  -> Migrando producto: ${prod.name}`);
        const { data: product, error: prodErr } = await supabase
          .from('products')
          .insert({
            category_id: category.id,
            name: prod.name,
            description: prod.description || null,
            base_price: prod.price || 0,
            image_url: prod.image,
            display_order: pIdx
          })
          .select()
          .single();
        
        if (prodErr) throw prodErr;

        // Variantes (Tamaños)
        if (prod.prices) {
          let vIdx = 0;
          for (const ObjectKey in prod.prices) {
            const price = prod.prices[ObjectKey as keyof typeof prod.prices];
            await supabase.from('variants').insert({
              product_id: product.id,
              name: ObjectKey,
              price: price,
              display_order: vIdx++
            });
          }
        }

        // Flavors
        if (prod.flavors && prod.flavors.length > 0) {
          const { data: mg, error: mgErr } = await supabase.from('modifier_groups').insert({
            product_id: product.id,
            name: 'Sabor',
            min_selection: 1,
            max_selection: prod.maxFlavors || 1,
            free_limit: prod.maxFlavors || 1,
            extra_price: 0,
            required: true,
            display_order: 0
          }).select().single();
          if (mgErr) throw mgErr;

          let mIdx = 0;
          for (const flavor of prod.flavors) {
            await supabase.from('modifiers').insert({
              modifier_group_id: mg.id,
              name: flavor,
              price_modifier: 0,
              display_order: mIdx++
            });
          }
        }

        // Lógica de Opciones (Ensaladas)
        if (prod.category === 'ensaladas') {
          const isGrande = prod.id === 'ensalada-grande';
          const constraints = isGrande ? 
            { proteins: 2, toppings: 6, seeds: 4, dressings: 1 } : 
            { proteins: 1, toppings: 4, seeds: 2, dressings: 1 };
          
          const groups = [
            { name: 'Proteínas', free: constraints.proteins, extra: 30, items: SALAD_OPTIONS.proteins, req: false },
            { name: 'Toppings', free: constraints.toppings, extra: 15, items: SALAD_OPTIONS.toppings, req: false },
            { name: 'Semillas y Frutos Secos', free: constraints.seeds, extra: 15, items: SALAD_OPTIONS.seedsAndNuts, req: false },
            { name: 'Aderezos', free: constraints.dressings, extra: 0, items: SALAD_OPTIONS.dressings, req: true, min: 1, max: 1 }
          ];

          let gIdx = 1;
          for (const g of groups) {
            const { data: mg, error: mgErr } = await supabase.from('modifier_groups').insert({
              product_id: product.id,
              name: g.name,
              min_selection: g.min || 0,
              max_selection: g.max || null,
              free_limit: g.free,
              extra_price: g.extra,
              required: g.req,
              display_order: gIdx++
            }).select().single();
            if (mgErr) throw mgErr;

            let mIdx = 0;
            for (const item of g.items) {
              await supabase.from('modifiers').insert({
                modifier_group_id: mg.id,
                name: item.name,
                price_modifier: 0,
                display_order: mIdx++
              });
            }
          }
        }

        // Lógica de Opciones (Bowls)
        if (prod.id === 'bowl-avena' || prod.id === 'bowl-yogurt') {
          const allowedToppings = ['mango', 'fresa', 'platano', 'uva', 'kiwi', 'pina', 'blueberry', 'frambuesa'];
          const filteredToppings = SALAD_OPTIONS.toppings.filter(t => allowedToppings.includes(t.id));

          const { data: mgTop, error: mgTopErr } = await supabase.from('modifier_groups').insert({
            product_id: product.id, name: 'Frutas (Toppings)', min_selection: 2, max_selection: 2, free_limit: 2, extra_price: 0, required: true, display_order: 1
          }).select().single();
          if (mgTopErr) throw mgTopErr;
          
          for (let i = 0; i < filteredToppings.length; i++) {
            await supabase.from('modifiers').insert({ modifier_group_id: mgTop.id, name: filteredToppings[i].name, display_order: i });
          }

          const { data: mgSeed, error: mgSeedErr } = await supabase.from('modifier_groups').insert({
            product_id: product.id, name: 'Semillas y Granos', min_selection: 2, max_selection: 2, free_limit: 2, extra_price: 0, required: true, display_order: 2
          }).select().single();
          if (mgSeedErr) throw mgSeedErr;
          
          for (let i = 0; i < SALAD_OPTIONS.seedsAndNuts.length; i++) {
            await supabase.from('modifiers').insert({ modifier_group_id: mgSeed.id, name: SALAD_OPTIONS.seedsAndNuts[i].name, display_order: i });
          }
        }
      }
    }
    console.log('✅ Migración de menú completada exitosamente.');
  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    process.exit(1);
  }
}

run();
