import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function check() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data: prods } = await supabase.from('products').select('id, name, modifier_groups(id, name, free_limit, extra_price, modifiers(count))').in('name', ['Ensalada Chica', 'Ensalada Grande']);
  console.log(JSON.stringify(prods, null, 2));
}

check();
