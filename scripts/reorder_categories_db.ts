import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function run() {
  console.log('Iniciando reordenamiento y actualización de categorías en Supabase...');
  const supabase = createClient(supabaseUrl, supabaseKey);

  // 1. Rename "Jugos y Smoothies" to "Jugos"
  const { data: jugosCat, error: jErr } = await supabase
    .from('categories')
    .update({ name: 'Jugos' })
    .ilike('name', '%jugos%')
    .select()
    .single();

  if (jErr) {
    console.error('Error actualizando Jugos:', jErr);
  } else {
    console.log('✅ Categoría "Jugos y Smoothies" renombrada a "Jugos".');
  }

  // 2. Rename "Bowls y Cocteles" to "Bowls y Postres"
  const { data: bowlsCat, error: bErr } = await supabase
    .from('categories')
    .update({ name: 'Bowls y Postres' })
    .ilike('name', '%bowl%')
    .select()
    .single();

  if (bErr) {
    console.error('Error actualizando Bowls:', bErr);
  } else {
    console.log('✅ Categoría "Bowls y Cocteles" renombrada a "Bowls y Postres".');
  }

  // 3. Find or create "Smoothies" category
  let { data: smoothiesCat } = await supabase
    .from('categories')
    .select('*')
    .ilike('name', 'smoothies')
    .single();

  if (!smoothiesCat) {
    const { data: newSmoothiesCat, error: sErr } = await supabase
      .from('categories')
      .insert({ name: 'Smoothies', icon: '🥤', display_order: 3, active: true })
      .select()
      .single();
    if (sErr) {
      console.error('Error creando categoría Smoothies:', sErr);
      return;
    }
    smoothiesCat = newSmoothiesCat;
    console.log('✅ Categoría "Smoothies" creada.');
  } else {
    console.log('ℹ️ Categoría "Smoothies" ya existía.');
  }

  // 4. Move Smoothie products to the new Smoothies category
  if (smoothiesCat) {
    const { error: moveErr } = await supabase
      .from('products')
      .update({ category_id: smoothiesCat.id })
      .ilike('name', '%smoothie%');
    if (moveErr) {
      console.error('Error moviendo productos smoothies:', moveErr);
    } else {
      console.log('✅ Productos Smoothies movidos a su nueva categoría.');
    }
  }

  // 5. Update display_order for all categories
  const orderMap: Record<string, number> = {
    'ensalada': 0,
    'wrap': 1,
    'burrito': 1,
    'sándwich': 1,
    'sandwich': 1,
    'jugo': 2,
    'smoothie': 3,
    'infusió': 4,
    'infusio': 4,
    'bowl': 5,
    'embotellad': 6
  };

  const { data: allCats } = await supabase.from('categories').select('*');
  if (allCats) {
    for (const cat of allCats) {
      const lower = cat.name.toLowerCase();
      let order = 99;
      if (lower.includes('ensalada')) order = 0;
      else if (lower.includes('wrap') || lower.includes('sandwich') || lower.includes('sándwich')) order = 1;
      else if (lower === 'jugos' || lower.includes('jugo')) order = 2;
      else if (lower.includes('smoothie')) order = 3;
      else if (lower.includes('infusi')) order = 4;
      else if (lower.includes('bowl')) order = 5;
      else if (lower.includes('embotellad')) order = 6;

      await supabase.from('categories').update({ display_order: order }).eq('id', cat.id);
      console.log(`📌 Orden asignado a "${cat.name}": ${order}`);
    }
  }

  // 6. Disable Electrolit and Refresco in Embotellados
  const { error: disErr } = await supabase
    .from('products')
    .update({ available: false, display_order: 99 })
    .in('name', ['Electrolit', 'Refresco Cero Azúcar']);

  if (disErr) {
    console.error('Error desactivando Electrolit y Refrescos:', disErr);
  } else {
    console.log('✅ Electrolit y Refresco Cero Azúcar desactivados en Supabase.');
  }

  console.log('🎉 ¡Reordenamiento y limpieza en Supabase terminados con éxito!');
}

run();
