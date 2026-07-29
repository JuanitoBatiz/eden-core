const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function updateZones() {
  console.log("Deactivating old zones...");
  await supabase.from('delivery_zones').update({ active: false }).neq('id', '00000000-0000-0000-0000-000000000000'); // Dummy condition to update all

  console.log("Deleting old zones for clean slate...");
  await supabase.from('delivery_zones').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  const newZones = [
    { label: 'Zona 1 (Centro)', max_distance_km: 1.5, fee: 15, active: true, display_order: 1 },
    { label: 'Zona 2 (Afueras)', max_distance_km: 2.5, fee: 25, active: true, display_order: 2 },
    { label: 'Zona 3 (Empacadoras)', max_distance_km: 3.2, fee: 50, active: true, display_order: 3 },
    { label: 'Zona 4 (San Pablo y Axapusco)', max_distance_km: 4.5, fee: 60, active: true, display_order: 4 }
  ];

  console.log("Inserting new zones...");
  const { data, error } = await supabase.from('delivery_zones').insert(newZones).select();
  if (error) {
    console.error("Error inserting:", error);
  } else {
    console.log("New zones inserted successfully:", data);
  }
}

updateZones();
