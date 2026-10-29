// SOLO LECTURA: prueba findLoyverseCustomerByPhone contra Loyverse real con los teléfonos de la cola pendiente.
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', quiet: true });

const U = process.env.NEXT_PUBLIC_SUPABASE_URL!, K = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const main = async () => {
  const { findLoyverseCustomerByPhone } = await import('../../src/lib/loyverse');
  const r = await fetch(`${U}/rest/v1/loyverse_sync_queue?select=id,payload,entity_id&status=eq.pending`, { headers: { apikey: K, Authorization: `Bearer ${K}` } });
  const jobs: any[] = await r.json();
  let link = 0, create = 0, err = 0;
  for (const j of jobs) {
    try {
      const id = await findLoyverseCustomerByPhone(j.payload.phone);
      id ? link++ : create++;
      console.log(`  job ${j.id.slice(0, 8)} tel ***${String(j.payload.phone).slice(-4)} → ${id ? 'ENLAZAR con cliente existente' : 'CREAR (no existe)'}`);
    } catch (e: any) { err++; console.log('  error:', e.message); }
  }
  console.log(`Resumen: ${link} a enlazar, ${create} a crear, ${err} errores (de ${jobs.length})`);
  console.log('Teléfono inexistente →', await findLoyverseCustomerByPhone('5500000000'));
  console.log('Teléfono corto →', await findLoyverseCustomerByPhone('123'));
};
main();
