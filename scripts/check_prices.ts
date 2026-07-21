import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const targetNames = ['Burrito de Pollo', 'Sándwich', 'Torta', 'Bowl de Yogurt'];
  
  const { data, error } = await supabase
    .from('products')
    .select('id, name, base_price, variants(id, name, price)')
    .in('name', targetNames);
    
  if (error) {
    console.error('Error fetching products:', error);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

main().catch(console.error);
