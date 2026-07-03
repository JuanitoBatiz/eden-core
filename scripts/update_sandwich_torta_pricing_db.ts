import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function run() {
  console.log('Iniciando actualización de modificadores para Sándwich y Torta en Supabase...');
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Faltan credenciales de Supabase en .env / .env.local');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // 1. Buscar los productos Sándwich y Torta
  const { data: products, error: prodErr } = await supabase
    .from('products')
    .select('id, name')
    .or('name.ilike.%Sándwich%,name.ilike.%Torta%,id.eq.7be0e394-31ba-4ea4-b34c-e6fa9aa637cd,id.eq.5729c2ac-2a3d-4d2a-a08f-70f03fc92604');

  if (prodErr || !products) {
    console.error('❌ Error obteniendo productos Sándwich/Torta:', prodErr);
    return;
  }

  console.log(`Productos encontrados para actualizar:`, products.map(p => p.name));

  for (const prod of products) {
    // Buscar el grupo de modificadores Especialidad
    const { data: groups, error: gErr } = await supabase
      .from('modifier_groups')
      .select('id, name')
      .eq('product_id', prod.id)
      .ilike('name', '%Especialidad%');

    if (gErr) {
      console.error(`❌ Error obteniendo grupo Especialidad para ${prod.name}:`, gErr);
      continue;
    }

    if (groups && groups.length > 0) {
      for (const grp of groups) {
        console.log(`Actualizando grupo "${grp.name}" (${grp.id}) en ${prod.name}...`);
        const { error: upErr } = await supabase
          .from('modifier_groups')
          .update({
            min_selection: 1,
            max_selection: 3,
            free_limit: 1,
            extra_price: 30,
            required: true
          })
          .eq('id', grp.id);

        if (upErr) {
          console.error(`❌ Error actualizando grupo en ${prod.name}:`, upErr);
        } else {
          console.log(`✅ Grupo "${grp.name}" actualizado (min: 1, max: 3, free_limit: 1, extra_price: $30).`);
        }

        // Actualizar todos los modificadores en este grupo para que price_modifier sea 0
        const { error: modErr } = await supabase
          .from('modifiers')
          .update({
            price_modifier: 0,
            available: true
          })
          .eq('modifier_group_id', grp.id);

        if (modErr) {
          console.error(`❌ Error actualizando price_modifier en ${prod.name}:`, modErr);
        } else {
          console.log(`✅ Modificadores de Especialidad actualizados con price_modifier = 0.`);
        }
      }
    } else {
      console.warn(`⚠️ No se encontró grupo Especialidad en ${prod.name}. Creando uno nuevo...`);
      const { data: newGrp, error: createErr } = await supabase
        .from('modifier_groups')
        .insert({
          product_id: prod.id,
          name: 'Especialidad',
          min_selection: 1,
          max_selection: 3,
          free_limit: 1,
          extra_price: 30,
          required: true,
          display_order: 1
        })
        .select()
        .single();

      if (createErr || !newGrp) {
        console.error(`❌ Error creando grupo Especialidad en ${prod.name}:`, createErr);
      } else {
        const especialidades = ['Pechuga empanizada', 'Pechuga asada', 'Jamón de pavo'];
        const modsToInsert = especialidades.map((name, idx) => ({
          modifier_group_id: newGrp.id,
          name,
          price_modifier: 0,
          available: true,
          display_order: idx
        }));
        await supabase.from('modifiers').insert(modsToInsert);
        console.log(`✅ Grupo Especialidad creado con opciones para ${prod.name}.`);
      }
    }
  }

  console.log('🎉 ¡Actualización de base de datos finalizada!');
}

run();
