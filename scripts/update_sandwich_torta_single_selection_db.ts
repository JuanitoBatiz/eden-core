import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function run() {
  console.log('Iniciando actualización de Especialidad a selección única en Sándwich y Torta...');
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Faltan credenciales');
    return;
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: products, error: prodErr } = await supabase
    .from('products')
    .select('id, name')
    .or('name.ilike.%Sándwich%,name.ilike.%Torta%,id.eq.7be0e394-31ba-4ea4-b34c-e6fa9aa637cd,id.eq.5729c2ac-2a3d-4d2a-a08f-70f03fc92604');

  if (prodErr || !products) {
    console.error('❌ Error obteniendo productos:', prodErr);
    return;
  }

  for (const prod of products) {
    const { data: groups } = await supabase
      .from('modifier_groups')
      .select('id, name')
      .eq('product_id', prod.id)
      .ilike('name', '%Especialidad%');

    if (groups && groups.length > 0) {
      for (const grp of groups) {
        console.log(`Actualizando grupo "${grp.name}" (${grp.id}) en ${prod.name} a max_selection=1...`);
        await supabase
          .from('modifier_groups')
          .update({
            min_selection: 1,
            max_selection: 1,
            free_limit: 1,
            extra_price: 0,
            required: true
          })
          .eq('id', grp.id);

        await supabase
          .from('modifiers')
          .update({ price_modifier: 0, available: true })
          .eq('modifier_group_id', grp.id);
      }
    }
  }

  console.log('🎉 ¡Actualización en BD completada exitosamente!');
}

run();
