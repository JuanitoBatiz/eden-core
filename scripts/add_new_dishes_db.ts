import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function run() {
  console.log('Iniciando adición de nuevos platillos a Supabase...');
  const supabase = createClient(supabaseUrl, supabaseKey);

  const wrapsCatId = '42f7f4cb-1fa0-42c6-8431-f88705770404';
  const bowlsCatId = '6bc1d08b-c26a-4c43-b035-f1e3865e0723';
  const embotelladosCatId = 'abdf597a-8f47-4ac8-a0e4-71f1104dbf89';

  // 1. Update existing Vietnamese rolls descriptions
  await supabase
    .from('products')
    .update({
      description: 'Orden de 2 rollitos. Nuestra joya oriental. Frescos bocados envueltos en delicado papel de arroz, crujientes por dentro y perfectos para remojar en nuestra salsa secreta.'
    })
    .ilike('name', '%Rollitos Vietnamitas de Pollo%');

  await supabase
    .from('products')
    .update({
      description: 'Orden de 2 rollitos. Una experiencia fresca y exótica. Tsurimi desmenuzado con toques orientales, verduras crocantes y envueltos artesanalmente al momento.'
    })
    .ilike('name', '%Rollitos Vietnamitas de Tsurimi%');

  console.log('✅ Descripciones actualizadas para rollitos existentes.');

  const newProducts = [
    {
      category_id: wrapsCatId,
      name: 'Rollitos Vietnamitas Mixtos',
      description: 'Orden de 2 rollitos (uno de pollo y uno de tsurimi). Una combinación perfecta envuelta artesanalmente en delicado papel de arroz con verduras crocantes.',
      base_price: 95,
      image_url: '/images/chicken_wrap.png',
      available: true,
      display_order: 4
    },
    {
      category_id: wrapsCatId,
      name: 'Ciabatta',
      description: 'Sándwich artesanal en crujiente pan ciabatta horneado, relleno con ingredientes frescos de calidad premium.',
      base_price: 95,
      image_url: '/images/chicken_wrap.png',
      available: true,
      display_order: 5
    },
    {
      category_id: bowlsCatId,
      name: 'Bowl Rafaella',
      description: 'Especialidad de la casa con un sabor exquisito y reconfortante. Preparado con ingredientes selectos y toque artesanal.',
      base_price: 95,
      image_url: '/images/salad_bowl.png',
      available: true,
      display_order: 3
    },
    {
      category_id: bowlsCatId,
      name: 'Hotcakes de Avena',
      description: 'Esponjosos y saludables hotcakes elaborados con base de avena. Un postre o desayuno nutritivo lleno de sabor.',
      base_price: 85,
      image_url: '/images/salad_bowl.png',
      available: true,
      display_order: 4
    },
    {
      category_id: embotelladosCatId,
      name: 'Café',
      description: 'Caliente y aromático, preparado al momento.',
      base_price: 35,
      image_url: '/images/cold_pressed_juice.png',
      available: true,
      display_order: 1
    }
  ];

  for (const prod of newProducts) {
    const { data: existing } = await supabase
      .from('products')
      .select('id')
      .ilike('name', prod.name)
      .single();

    if (existing) {
      await supabase.from('products').update(prod).eq('id', existing.id);
      console.log(`ℹ️ Producto "${prod.name}" actualizado en Supabase.`);
    } else {
      const { error: insErr } = await supabase.from('products').insert(prod);
      if (insErr) {
        console.error(`❌ Error insertando "${prod.name}":`, insErr);
      } else {
        console.log(`✅ Producto "${prod.name}" creado en Supabase.`);
      }
    }
  }

  console.log('🎉 ¡Nuevos platillos agregados/actualizados con éxito en la base de datos!');
}

run();
