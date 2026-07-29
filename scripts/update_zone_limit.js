const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function updateZones() {
  console.log("Updating Zone 4 to 5.0 km...");
  const { data, error } = await supabase.from('delivery_zones')
    .update({ max_distance_km: 5.0 })
    .eq('max_distance_km', 4.5) // update the one we just created
    .select();
    
  if (error) {
    console.error("Error updating:", error);
  } else {
    console.log("Zone updated successfully:", data);
  }
}

updateZones();
