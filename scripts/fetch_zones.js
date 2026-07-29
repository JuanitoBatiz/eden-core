const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkZones() {
  const { data, error } = await supabase.from('delivery_zones').select('*').order('max_distance_km', { ascending: true });
  console.log("Zonas actuales:", data);
  if (error) console.error("Error:", error);
}

checkZones();
