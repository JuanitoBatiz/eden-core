import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function run() {
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Faltan credenciales');
    return;
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: categories, error: catErr } = await supabase
    .from('categories')
    .select('*')
    .order('display_order');

  console.log('Categorías en BD:', categories);

  const { data: products } = await supabase
    .from('products')
    .select('id, name, category_id');

  console.log('Total productos:', products?.length);

  // Buscar categoría Smoothies y categoría Infusiones
  const smoothiesCat = categories?.find(c => c.name.toLowerCase().includes('smoothie'));
  const infusionesCat = categories?.find(c => c.name.toLowerCase().includes('infusion'));

  if (smoothiesCat) {
    console.log(`Renombrando categoría "${smoothiesCat.name}" (${smoothiesCat.id}) a "Smoothies e Infusiones"...`);
    await supabase
      .from('categories')
      .update({ name: 'Smoothies e Infusiones', icon: '🥤' })
      .eq('id', smoothiesCat.id);

    if (infusionesCat && infusionesCat.id !== smoothiesCat.id) {
      console.log(`Moviendo productos de Infusiones (${infusionesCat.id}) a la nueva categoría agrupada (${smoothiesCat.id})...`);
      await supabase
        .from('products')
        .update({ category_id: smoothiesCat.id })
        .eq('category_id', infusionesCat.id);

      console.log(`Desactivando categoría antigua Infusiones...`);
      await supabase
        .from('categories')
        .update({ active: false })
        .eq('id', infusionesCat.id);
    }
    console.log('✅ Categorías en Supabase agrupadas exitosamente.');
  } else {
    console.log('⚠️ No se encontró categoría smoothies en BD.');
  }
}

run();
