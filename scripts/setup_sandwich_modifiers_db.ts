import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function run() {
  console.log('Iniciando configuración de modificadores en Supabase...');
  const supabase = createClient(supabaseUrl, supabaseKey);

  // 1. Update Aderezos group for Ensalada
  const { data: saladGroups, error: sgErr } = await supabase
    .from('modifier_groups')
    .update({ max_selection: 5, free_limit: 1, extra_price: 15 })
    .ilike('name', '%aderezo%')
    .select();

  if (sgErr) {
    console.error('❌ Error actualizando grupo Aderezos:', sgErr);
  } else {
    console.log(`✅ Grupo Aderezos actualizado (max: 5, free: 1, extra: $15) para ${saladGroups?.length} registros.`);
  }

  // Helper to fetch product ID by exact or partial name
  const getProdId = async (namePart: string) => {
    const { data } = await supabase
      .from('products')
      .select('id, name')
      .ilike('name', namePart)
      .single();
    return data;
  };

  const burritoPollo = await getProdId('Burrito de Pollo');
  const ciabatta = await getProdId('Ciabatta');
  const sandwichPavo = await getProdId('%Sándwich / Torta de Jamón de Pavo%');
  const sandwichPollo = await getProdId('%Sándwich / Torta de Pollo%');

  const targetProducts = [
    { prod: burritoPollo, panes: null, omitir: ['Sin aderezo', 'Sin zanahoria', 'Sin pepino', 'Sin frijoles', 'Sin chile', 'Sin aguacate'] },
    { prod: ciabatta, panes: null, omitir: ['Sin espinaca', 'Sin guacamole', 'Sin queso', 'Sin mayonesa', 'Sin huevo', 'Sin jamón', 'Sin pepino'] },
    { prod: sandwichPavo, panes: ['Pan Blanco', 'Centeno', 'Multigrano'], omitir: ['Sin cebolla', 'Sin aguacate', 'Sin mayonesa', 'Sin frijoles', 'Sin jitomate', 'Sin col', 'Sin chile'] },
    { prod: sandwichPollo, panes: ['Pan Blanco', 'Centeno', 'Multigrano'], omitir: ['Sin cebolla', 'Sin aguacate', 'Sin mayonesa', 'Sin frijoles', 'Sin jitomate', 'Sin col', 'Sin chile'] }
  ];

  for (const target of targetProducts) {
    if (!target.prod) {
      console.warn('⚠️ No se encontró el producto en DB para configurar modificadores.');
      continue;
    }

    console.log(`Configurando modificadores para "${target.prod.name}" (${target.prod.id})...`);

    // Delete existing modifier groups for these specific names to avoid duplicates
    const { data: existingGroups } = await supabase
      .from('modifier_groups')
      .select('id, name')
      .eq('product_id', target.prod.id)
      .in('name', ['Tipo de Pan', 'Omitir Ingredientes']);

    if (existingGroups && existingGroups.length > 0) {
      const gIds = existingGroups.map(g => g.id);
      await supabase.from('modifiers').delete().in('group_id', gIds);
      await supabase.from('modifier_groups').delete().in('id', gIds);
      console.log(`🧹 Grupos anteriores eliminados para ${target.prod.name}.`);
    }

    // Insert Tipo de Pan if applicable
    if (target.panes) {
      const { data: panGroup, error: pgErr } = await supabase
        .from('modifier_groups')
        .insert({
          product_id: target.prod.id,
          name: 'Tipo de Pan',
          min_selection: 1,
          max_selection: 1,
          free_limit: 1,
          extra_price: 0,
          required: true,
          display_order: 1
        })
        .select()
        .single();

      if (pgErr || !panGroup) {
        console.error(`❌ Error creando grupo Tipo de Pan para ${target.prod.name}:`, pgErr);
      } else {
        const panMods = target.panes.map((p, idx) => ({
          group_id: panGroup.id,
          name: p,
          price: 0,
          available: true,
          display_order: idx
        }));
        await supabase.from('modifiers').insert(panMods);
        console.log(`✅ Grupo "Tipo de Pan" creado para ${target.prod.name}.`);
      }
    }

    // Insert Omitir Ingredientes
    if (target.omitir) {
      const { data: omitGroup, error: ogErr } = await supabase
        .from('modifier_groups')
        .insert({
          product_id: target.prod.id,
          name: 'Omitir Ingredientes',
          min_selection: 0,
          max_selection: target.omitir.length,
          free_limit: target.omitir.length,
          extra_price: 0,
          required: false,
          display_order: 2
        })
        .select()
        .single();

      if (ogErr || !omitGroup) {
        console.error(`❌ Error creando grupo Omitir Ingredientes para ${target.prod.name}:`, ogErr);
      } else {
        const omitMods = target.omitir.map((o, idx) => ({
          group_id: omitGroup.id,
          name: o,
          price: 0,
          available: true,
          display_order: idx
        }));
        await supabase.from('modifiers').insert(omitMods);
        console.log(`✅ Grupo "Omitir Ingredientes" creado para ${target.prod.name}.`);
      }
    }
  }

  console.log('🎉 ¡Configuración de modificadores de sándwiches y ensaladas finalizada!');
}

run();
