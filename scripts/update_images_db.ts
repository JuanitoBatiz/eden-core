import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function run() {
  console.log('Iniciando actualización de imágenes de platillos en Supabase...');
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.');
    return;
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  const updates = [
    { nameMatch: 'Ensalada', imageUrl: '/images/ensalada.png' },
    { nameMatch: 'Burrito de Pollo', imageUrl: '/images/burrito.png' },
    { nameMatch: 'Sándwich', imageUrl: '/images/sandwich.png' },
    { nameMatch: 'Torta', imageUrl: '/images/torta.png' },
    { nameMatch: 'Rollitos Vietnamitas de Pollo', imageUrl: '/images/rollitos_pollo.png' },
    { nameMatch: 'Rollitos Vietnamitas de Tsurimi', imageUrl: '/images/rollitos_tsurimi.png' },
    { nameMatch: 'Rollitos Vietnamitas Mixtos', imageUrl: '/images/rollitosmixtos.png' },
    { nameMatch: 'Ciabatta', imageUrl: '/images/ciabatta.png' },
    { nameMatch: 'Jugos Naturales', imageUrl: '/images/jugo_natural.png' },
    { nameMatch: 'Jugo Mixto', imageUrl: '/images/jugo_mixto.png' },
    { nameMatch: 'Smoothies Deluxe', imageUrl: '/images/smoothie_deluxe.png' },
    { nameMatch: 'Smoothies Clásicos', imageUrl: '/images/smoothie_clasico.png' },
    { nameMatch: 'Infusión Premium', imageUrl: '/images/infusion.png' },
    { nameMatch: 'Bowl de Avena', imageUrl: '/images/bowl_avena.png' },
    { nameMatch: 'Bowl de Yogurt', imageUrl: '/images/yogurt.png' },
    { nameMatch: 'Cóctel de Frutas', imageUrl: '/images/coctel.png' },
    { nameMatch: 'Bowl Rafaella', imageUrl: '/images/rafaello.png' },
    { nameMatch: 'Hotcakes de Avena', imageUrl: '/images/hotcakes.png' },
    { nameMatch: 'Botella de Agua 600ml', imageUrl: '/images/infusion.png' },
    { nameMatch: 'Café', imageUrl: '/images/infusion.png' },
  ];

  for (const item of updates) {
    const { data, error } = await supabase
      .from('products')
      .update({ image_url: item.imageUrl })
      .ilike('name', item.nameMatch);

    if (error) {
      console.error(`❌ Error actualizando imagen para "${item.nameMatch}":`, error.message);
    } else {
      console.log(`✅ Imagen de "${item.nameMatch}" actualizada a ${item.imageUrl}.`);
    }
  }

  console.log('🎉 ¡Todas las imágenes actualizadas exitosamente en Supabase!');
}

run();
