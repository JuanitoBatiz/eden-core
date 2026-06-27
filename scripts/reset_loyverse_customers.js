const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: users, error } = await supabase.from('users').select('*');
  if (error) {
    console.error(error);
    return;
  }
  
  for (const user of users) {
    if (user.loyverse_customer_id && user.loyverse_customer_id.startsWith('loyverse_cust_')) {
      console.log(`Resetting user ${user.name || user.phone}`);
      await supabase.from('users').update({ loyverse_customer_id: null }).eq('id', user.id);
    }
  }
  console.log("Done resetting fake Loyverse IDs!");
}
run();
