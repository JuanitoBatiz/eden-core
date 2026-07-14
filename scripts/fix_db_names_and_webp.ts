import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function run() {
  console.log('Iniciando corrección en DB Supabase (Rafaello y formatos .webp)...');
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.');
    return;
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  // 1. Corregir nombre en la base de datos: Rafaella -> Bowl Rafaello
  const { error: renameErr } = await supabase
    .from('products')
    .update({ name: 'Bowl Rafaello' })
    .ilike('name', '%rafaell%');

  if (renameErr) {
    console.error('❌ Error al renombrar Rafaello en DB:', renameErr.message);
  } else {
    console.log('✅ Nombre actualizado en DB: Bowl Rafaello');
  }

  // 2. Traer todos los productos para actualizar sus image_url de .png a .webp y mapear local
  const { data: products, error: getErr } = await supabase
    .from('products')
    .select('id, name, image_url');

  if (getErr || !products) {
    console.error('❌ Error al obtener productos de DB:', getErr?.message);
    return;
  }

  for (const p of products) {
    let newUrl = p.image_url || '';
    if (newUrl && newUrl.includes('.png')) {
      newUrl = newUrl.replace(/\.png$/i, '.webp');
    }

    const lowerName = (p.name || '').toLowerCase();
    if (lowerName.includes('rafaell')) newUrl = '/images/rafaello.webp';
    else if (lowerName.includes('hotcakes')) newUrl = '/images/hotcakes.webp';
    else if (lowerName.includes('avena')) newUrl = '/images/bowl_avena.webp';
    else if (lowerName.includes('cóctel') || lowerName.includes('coctel')) newUrl = '/images/coctel.webp';
    else if (lowerName.includes('yogurt')) newUrl = '/images/yogurt.webp';
    else if (lowerName.includes('burrito')) newUrl = '/images/burrito.webp';
    else if (lowerName.includes('pollo') && lowerName.includes('rollito')) newUrl = '/images/rollito1.webp';
    else if (lowerName.includes('tsurimi') && lowerName.includes('rollito')) newUrl = '/images/rollito2.webp';
    else if (lowerName.includes('mixto') && lowerName.includes('rollito')) newUrl = '/images/rollito3.webp';
    else if (lowerName.includes('ciabatta')) newUrl = '/images/ciabatta.webp';
    else if (lowerName.includes('torta')) newUrl = '/images/torta.webp';
    else if (lowerName.includes('sandwich') || lowerName.includes('sándwich')) newUrl = '/images/sandwich.webp';
    else if (lowerName.includes('ensalada')) newUrl = '/images/ensalada.webp';
    else if (lowerName.includes('infusión') || lowerName.includes('infusion')) newUrl = '/images/infusion.webp';
    else if (lowerName.includes('clasico') || lowerName.includes('clásico')) newUrl = '/images/smoothie_clasico.webp';
    else if (lowerName.includes('deluxe') || lowerName.includes('súper') || lowerName.includes('super')) newUrl = '/images/smoothie_deluxe.webp';
    else if (lowerName.includes('natural')) newUrl = '/images/jugo_natural.webp';
    else if (lowerName.includes('mixto') && lowerName.includes('jugo')) newUrl = '/images/jugo_mixto.webp';

    if (newUrl !== p.image_url) {
      await supabase
        .from('products')
        .update({ image_url: newUrl })
        .eq('id', p.id);
      console.log(`✅ Producto "${p.name}" actualizado -> ${newUrl}`);
    }
  }

  console.log('🚀 DB sincronizada y lista.');
}

run();
