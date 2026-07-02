import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function run() {
  console.log('Iniciando actualización de base de datos con los requerimientos del cliente...');
  const supabase = createClient(supabaseUrl, supabaseKey);

  // 1. Actualizar Rollitos Vietnamitas con sus opciones de omisión
  const { data: rollos, error: rollosErr } = await supabase
    .from('products')
    .select('id, name')
    .ilike('name', '%Rollito%');

  if (rollosErr) {
    console.error('❌ Error obteniendo rollitos:', rollosErr);
  } else if (rollos) {
    for (const rollo of rollos) {
      console.log(`Configurando opciones de omisión para "${rollo.name}" (${rollo.id})...`);
      // Eliminar grupos previos para evitar duplicados
      const { data: existingGroups } = await supabase
        .from('modifier_groups')
        .select('id')
        .eq('product_id', rollo.id)
        .eq('name', 'Omitir Ingredientes');

      if (existingGroups && existingGroups.length > 0) {
        const gIds = existingGroups.map(g => g.id);
        await supabase.from('modifiers').delete().in('modifier_group_id', gIds);
        await supabase.from('modifier_groups').delete().in('id', gIds);
      }

      // Crear grupo Omitir Ingredientes
      const { data: omitGroup, error: ogErr } = await supabase
        .from('modifier_groups')
        .insert({
          product_id: rollo.id,
          name: 'Omitir Ingredientes',
          min_selection: 0,
          max_selection: 4,
          free_limit: 4,
          extra_price: 0,
          required: false,
          display_order: 1
        })
        .select()
        .single();

      if (ogErr || !omitGroup) {
        console.error(`❌ Error creando grupo para ${rollo.name}:`, ogErr);
      } else {
        const omitOptions = ['Sin aguacate', 'Sin espinaca', 'Sin pepino', 'Sin zanahoria'];
        const modsToInsert = omitOptions.map((opt, idx) => ({
          modifier_group_id: omitGroup.id,
          name: opt,
          price_modifier: 0,
          available: true,
          display_order: idx
        }));
        const { error: mErr } = await supabase.from('modifiers').insert(modsToInsert);
        if (mErr) {
          console.error(`❌ Error insertando modificadores en ${rollo.name}:`, mErr);
        } else {
          console.log(`✅ Opciones de omisión agregadas a "${rollo.name}".`);
        }
      }
    }
  }

  // 2. Separar y configurar Sándwich y Torta
  const wrapsCatId = '42f7f4cb-1fa0-42c6-8431-f88705770404';

  // Buscar el producto Sándwich / Torta de Pollo o Sándwich para actualizarlo como Sándwich
  const { data: prodSandwich } = await supabase
    .from('products')
    .select('id, name')
    .or('id.eq.7be0e394-31ba-4ea4-b34c-e6fa9aa637cd,name.ilike.%Sándwich / Torta de Pollo%,name.eq.Sándwich')
    .limit(1)
    .single();

  let sandwichId = prodSandwich?.id;
  if (sandwichId) {
    await supabase.from('products').update({
      name: 'Sándwich',
      description: 'Sándwich en pan artesanal tostado con vegetales frescos y aderezo. Elige tu especialidad y tipo de pan.',
      base_price: 65,
      category_id: wrapsCatId,
      available: true
    }).eq('id', sandwichId);
    console.log(`✅ Producto Sándwich actualizado (ID: ${sandwichId}).`);
  } else {
    const { data: newSw } = await supabase.from('products').insert({
      name: 'Sándwich',
      description: 'Sándwich en pan artesanal tostado con vegetales frescos y aderezo. Elige tu especialidad y tipo de pan.',
      base_price: 65,
      category_id: wrapsCatId,
      available: true,
      display_order: 1
    }).select().single();
    sandwichId = newSw?.id;
    console.log(`✅ Producto Sándwich creado (ID: ${sandwichId}).`);
  }

  // Buscar el producto Sándwich / Torta de Jamón de Pavo o Torta para actualizarlo como Torta
  const { data: prodTorta } = await supabase
    .from('products')
    .select('id, name')
    .or('id.eq.5729c2ac-2a3d-4d2a-a08f-70f03fc92604,name.ilike.%Sándwich / Torta de Jamón de Pavo%,name.eq.Torta')
    .limit(1)
    .single();

  let tortaId = prodTorta?.id;
  if (tortaId) {
    await supabase.from('products').update({
      name: 'Torta',
      description: 'Deliciosa torta calientita con queso fundido, vegetales frescos y aderezo. Elige tu especialidad.',
      base_price: 65,
      category_id: wrapsCatId,
      available: true
    }).eq('id', tortaId);
    console.log(`✅ Producto Torta actualizado (ID: ${tortaId}).`);
  } else {
    const { data: newTt } = await supabase.from('products').insert({
      name: 'Torta',
      description: 'Deliciosa torta calientita con queso fundido, vegetales frescos y aderezo. Elige tu especialidad.',
      base_price: 65,
      category_id: wrapsCatId,
      available: true,
      display_order: 2
    }).select().single();
    tortaId = newTt?.id;
    console.log(`✅ Producto Torta creado (ID: ${tortaId}).`);
  }

  // Helper para recrear grupos y modificadores
  const setupProductGroups = async (productId: string, productName: string, groups: Array<{
    name: string;
    min: number;
    max: number;
    required: boolean;
    modifiers: Array<{ name: string; price_modifier: number }>;
  }>) => {
    // Borrar grupos existentes de ese producto para recrearlos limpios
    const { data: existingGroups } = await supabase
      .from('modifier_groups')
      .select('id')
      .eq('product_id', productId);

    if (existingGroups && existingGroups.length > 0) {
      const gIds = existingGroups.map(g => g.id);
      await supabase.from('modifiers').delete().in('modifier_group_id', gIds);
      await supabase.from('modifier_groups').delete().in('id', gIds);
    }

    for (let idx = 0; idx < groups.length; idx++) {
      const g = groups[idx];
      const { data: mg, error: mgErr } = await supabase
        .from('modifier_groups')
        .insert({
          product_id: productId,
          name: g.name,
          min_selection: g.min,
          max_selection: g.max,
          free_limit: g.max,
          extra_price: 0,
          required: g.required,
          display_order: idx + 1
        })
        .select()
        .single();

      if (mgErr || !mg) {
        console.error(`❌ Error creando grupo "${g.name}" para ${productName}:`, mgErr);
      } else {
        const mods = g.modifiers.map((m, mIdx) => ({
          modifier_group_id: mg.id,
          name: m.name,
          price_modifier: m.price_modifier,
          available: true,
          display_order: mIdx
        }));
        await supabase.from('modifiers').insert(mods);
        console.log(`✅ Grupo "${g.name}" creado con ${mods.length} opciones en ${productName}.`);
      }
    }
  };

  const especialidadMods = [
    { name: 'Pechuga empanizada', price_modifier: 10 },
    { name: 'Pechuga asada', price_modifier: 10 },
    { name: 'Jamón de pavo', price_modifier: 0 }
  ];

  const panesMods = [
    { name: 'Pan Blanco', price_modifier: 0 },
    { name: 'Centeno', price_modifier: 0 },
    { name: 'Multigrano', price_modifier: 0 }
  ];

  const omitirSandwichTorta = [
    { name: 'Sin cebolla', price_modifier: 0 },
    { name: 'Sin aguacate', price_modifier: 0 },
    { name: 'Sin mayonesa', price_modifier: 0 },
    { name: 'Sin frijoles', price_modifier: 0 },
    { name: 'Sin jitomate', price_modifier: 0 },
    { name: 'Sin col', price_modifier: 0 },
    { name: 'Sin chile', price_modifier: 0 }
  ];

  if (sandwichId) {
    await setupProductGroups(sandwichId, 'Sándwich', [
      { name: 'Especialidad', min: 1, max: 1, required: true, modifiers: especialidadMods },
      { name: 'Tipo de Pan', min: 1, max: 1, required: true, modifiers: panesMods },
      { name: 'Omitir Ingredientes', min: 0, max: omitirSandwichTorta.length, required: false, modifiers: omitirSandwichTorta }
    ]);
  }

  if (tortaId) {
    await setupProductGroups(tortaId, 'Torta', [
      { name: 'Especialidad', min: 1, max: 1, required: true, modifiers: especialidadMods },
      { name: 'Omitir Ingredientes', min: 0, max: omitirSandwichTorta.length, required: false, modifiers: omitirSandwichTorta }
    ]);
  }

  // 3. Arreglar Burrito de Pollo y Ciabatta si tenían modificadores vacíos
  const { data: burrito } = await supabase.from('products').select('id, name').ilike('name', 'Burrito de Pollo').single();
  if (burrito) {
    const omitirBurrito = [
      { name: 'Sin aderezo', price_modifier: 0 },
      { name: 'Sin zanahoria', price_modifier: 0 },
      { name: 'Sin pepino', price_modifier: 0 },
      { name: 'Sin frijoles', price_modifier: 0 },
      { name: 'Sin chile', price_modifier: 0 },
      { name: 'Sin aguacate', price_modifier: 0 }
    ];
    await setupProductGroups(burrito.id, 'Burrito de Pollo', [
      { name: 'Omitir Ingredientes', min: 0, max: omitirBurrito.length, required: false, modifiers: omitirBurrito }
    ]);
  }

  const { data: ciabatta } = await supabase.from('products').select('id, name').ilike('name', 'Ciabatta').single();
  if (ciabatta) {
    const omitirCiabatta = [
      { name: 'Sin espinaca', price_modifier: 0 },
      { name: 'Sin guacamole', price_modifier: 0 },
      { name: 'Sin queso', price_modifier: 0 },
      { name: 'Sin mayonesa', price_modifier: 0 },
      { name: 'Sin huevo', price_modifier: 0 },
      { name: 'Sin jamón', price_modifier: 0 },
      { name: 'Sin pepino', price_modifier: 0 }
    ];
    await setupProductGroups(ciabatta.id, 'Ciabatta', [
      { name: 'Omitir Ingredientes', min: 0, max: omitirCiabatta.length, required: false, modifiers: omitirCiabatta }
    ]);
  }

  console.log('🎉 ¡Actualización de base de datos completada exitosamente!');
}

run();
