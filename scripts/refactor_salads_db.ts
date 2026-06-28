import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function run() {
  console.log('Iniciando refactorización de Ensaladas en Supabase...');
  const supabase = createClient(supabaseUrl, supabaseKey);

  const chicaId = 'ea451785-8e52-4328-8f70-491615c7c553';
  const grandeId = 'b8968d83-4830-4409-931c-776466bd9154';

  // 1. Actualizar producto Chica para ser el producto unificado Ensalada
  const { error: updErr } = await supabase
    .from('products')
    .update({
      name: 'Ensalada',
      description: 'Nuestra deliciosa ensalada fresca. Una cama de hojas crujientes coronada con la proteína de tu elección, deliciosos toppings de temporada, semillas y tu aderezo favorito. Arma tu combinación perfecta en tamaño Chica o Grande.',
      base_price: 95
    })
    .eq('id', chicaId);

  if (updErr) {
    console.error('Error actualizando Ensalada Chica:', updErr);
    return;
  }
  console.log('✅ Producto unificado actualizado a "Ensalada".');

  // 2. Insertar variantes si no existen
  const { data: existingVariants } = await supabase
    .from('variants')
    .select('*')
    .eq('product_id', chicaId);

  if (!existingVariants || existingVariants.length === 0) {
    const { error: varErr } = await supabase.from('variants').insert([
      { product_id: chicaId, name: 'Chica', price: 95, display_order: 0 },
      { product_id: chicaId, name: 'Grande', price: 150, display_order: 1 }
    ]);
    if (varErr) {
      console.error('Error creando variantes:', varErr);
      return;
    }
    console.log('✅ Variantes Chica ($95) y Grande ($150) creadas.');
  } else {
    console.log('ℹ️ Variantes ya existen para este producto:', existingVariants);
  }

  // 3. Desactivar producto Ensalada Grande (para evitar duplicados en el menú, conservando historial)
  const { error: disErr } = await supabase
    .from('products')
    .update({ available: false, display_order: 99 })
    .eq('id', grandeId);

  if (disErr) {
    console.error('Error desactivando Ensalada Grande:', disErr);
    return;
  }
  console.log('✅ Ensalada Grande individual ocultada exitosamente.');
  console.log('🎉 ¡Refactorización en Supabase terminada!');
}

run();
