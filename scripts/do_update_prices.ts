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
  const updates = [
    { name: 'Burrito de Pollo', price: 85 },
    { name: 'Sándwich', price: 75 },
    { name: 'Torta', price: 75 },
    { name: 'Bowl de Yogurt', price: 65 },
  ];
  
  for (const item of updates) {
    const { data, error } = await supabase
      .from('products')
      .update({ base_price: item.price })
      .eq('name', item.name)
      .select('id, name, base_price');
      
    if (error) {
      console.error(`Error updating ${item.name}:`, error);
    } else {
      console.log(`Updated ${item.name}:`, data);
    }
  }
}

main().catch(console.error);
