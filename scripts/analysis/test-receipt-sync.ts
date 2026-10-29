// Prueba de ensureLoyverseReceipt con Loyverse SIMULADO (inyección de dependencias): no se llama a Loyverse.
// Usa la BD real con filas de PRUEBA etiquetadas y las borra al final.
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', quiet: true });
import { createClient } from '@supabase/supabase-js';
import { ensureLoyverseReceipt } from '../../src/lib/loyverseReceiptSync';

const U = process.env.NEXT_PUBLIC_SUPABASE_URL!, K = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(U, K);
const TAG = 'ZZ-PRUEBA-NO-PREPARAR';
const createdOrders: string[] = [];
let userId = '';
let pass = 0, fail = 0;
const check = (name: string, cond: boolean, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'OK   ' : 'FALLA'} ${name} ${cond ? '' : extra}`); };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const mkOrder = async (extra: Record<string, unknown> = {}) => {
  const { data, error } = await admin.from('orders').insert([{
    user_id: userId, customer_name: TAG, customer_phone: '0000000000', items: [{ id: 'x', name: 'Prueba', price: 1, quantity: 1 }],
    total: 1, notes: TAG, status: 'in_preparation', payment_status: 'payment_approved', payment_method: 'efectivo', service_type: 'pickup', ...extra,
  }]).select().single();
  if (error) throw new Error(error.message);
  createdOrders.push(data.id); return data;
};
const getOrder = async (id: string) => (await admin.from('orders').select('loyverse_receipt_id, loyverse_receipt_number, loyverse_sync_started_at').eq('id', id).single()).data!;
const getJobs = async (id: string) => (await admin.from('loyverse_sync_queue').select('*').eq('entity_id', id)).data || [];

const mkDeps = (opts: { fail?: boolean; delayMs?: number; found?: string | null } = {}) => {
  const calls = { create: 0, find: 0 };
  return {
    calls,
    deps: {
      createReceipt: (async () => {
        calls.create++;
        if (opts.delayMs) await sleep(opts.delayMs);
        if (opts.fail) throw new Error('Loyverse API error [HTTP 503] simulado');
        return { receipt_id: `TEST-${calls.create}-${Math.random().toString(36).slice(2, 6)}`, receipt_number: 'TEST-NUM' };
      }) as never,
      findReceipt: (async () => { calls.find++; return opts.found ? { receipt_number: opts.found } : null; }) as never,
    },
  };
};

async function main() {
  const { data: u, error: ue } = await admin.from('users').insert([{ phone: '5599990009', name: TAG, role: 'customer' }]).select().single();
  if (ue) throw new Error(ue.message);
  userId = u.id;

  // 1. Éxito: guarda el recibo, libera el candado y es idempotente
  let o = await mkOrder(); let m = mkDeps();
  let r = await ensureLoyverseReceipt(admin, o.id, { paymentMethod: 'efectivo', deps: m.deps });
  let d = await getOrder(o.id);
  check('éxito: recibo guardado y candado libre', r.success && !!d.loyverse_receipt_id && d.loyverse_sync_started_at === null && m.calls.create === 1, JSON.stringify({ r, d }));
  r = await ensureLoyverseReceipt(admin, o.id, { paymentMethod: 'efectivo', deps: m.deps });
  check('segunda llamada: already_synced, no crea otro', r.already_synced === true && m.calls.create === 1, JSON.stringify(r));

  // 2. Fallo de Loyverse: se encola, se libera el candado y no se duplica el trabajo
  o = await mkOrder(); m = mkDeps({ fail: true });
  r = await ensureLoyverseReceipt(admin, o.id, { paymentMethod: 'transferencia', deps: m.deps });
  let jobs = await getJobs(o.id); d = await getOrder(o.id);
  check('fallo: success=false, queued=true', !r.success && r.queued === true, JSON.stringify(r));
  check('fallo: 1 trabajo receipt_create pendiente (max 8 intentos, método guardado)', jobs.length === 1 && jobs[0].entity_type === 'receipt_create' && jobs[0].status === 'pending' && jobs[0].max_attempts === 8 && jobs[0].payload.payment_method === 'transferencia', JSON.stringify(jobs));
  check('fallo: candado liberado y sin recibo', d.loyverse_sync_started_at === null && d.loyverse_receipt_id === null, JSON.stringify(d));
  r = await ensureLoyverseReceipt(admin, o.id, { paymentMethod: 'transferencia', deps: m.deps });
  jobs = await getJobs(o.id);
  check('segundo fallo: sigue habiendo UN solo trabajo activo', jobs.length === 1 && r.queued === true, JSON.stringify(jobs));

  // 3. Concurrencia: dos llamadas simultáneas → un solo recibo
  o = await mkOrder(); m = mkDeps({ delayMs: 400 });
  const [a, b] = await Promise.all([
    ensureLoyverseReceipt(admin, o.id, { paymentMethod: 'efectivo', deps: m.deps }),
    ensureLoyverseReceipt(admin, o.id, { paymentMethod: 'efectivo', deps: m.deps }),
  ]);
  check('concurrencia: se creó exactamente 1 recibo', m.calls.create === 1 && [a, b].filter(x => x.success && !x.busy).length === 1 && [a, b].filter(x => x.busy).length === 1, JSON.stringify({ a, b, creates: m.calls.create }));

  // 4. Candado vencido + el recibo YA existe en Loyverse → se enlaza, no se crea otro
  o = await mkOrder({ loyverse_sync_started_at: new Date(Date.now() - 10 * 60 * 1000).toISOString() });
  m = mkDeps({ found: 'EXISTENTE-9' });
  r = await ensureLoyverseReceipt(admin, o.id, { paymentMethod: 'efectivo', deps: m.deps });
  d = await getOrder(o.id);
  check('candado vencido + recibo existente: se enlaza sin crear', r.success && m.calls.create === 0 && m.calls.find === 1 && d.loyverse_receipt_id === 'EXISTENTE-9', JSON.stringify({ r, d, calls: m.calls }));

  // 5. Candado vencido y NO existe → se crea
  o = await mkOrder({ loyverse_sync_started_at: new Date(Date.now() - 10 * 60 * 1000).toISOString() });
  m = mkDeps({ found: null });
  r = await ensureLoyverseReceipt(admin, o.id, { paymentMethod: 'efectivo', deps: m.deps });
  check('candado vencido y sin recibo: busca y luego crea', r.success && m.calls.find === 1 && m.calls.create === 1, JSON.stringify({ r, calls: m.calls }));

  // 6. Candado vigente (otro proceso trabajando) → busy, no crea
  o = await mkOrder({ loyverse_sync_started_at: new Date().toISOString() });
  m = mkDeps();
  r = await ensureLoyverseReceipt(admin, o.id, { paymentMethod: 'efectivo', deps: m.deps });
  check('candado vigente: busy y no crea', r.busy === true && m.calls.create === 0, JSON.stringify(r));

  // 7. lookupFirst (reintento del cron) encuentra el recibo
  o = await mkOrder(); m = mkDeps({ found: 'YA-ESTABA-7' });
  r = await ensureLoyverseReceipt(admin, o.id, { paymentMethod: 'efectivo', lookupFirst: true, deps: m.deps });
  check('lookupFirst: enlaza el recibo existente', r.success && m.calls.create === 0 && r.receipt_number === 'YA-ESTABA-7', JSON.stringify(r));

  // 8. Pedido cancelado → se omite
  o = await mkOrder({ status: 'cancelled' }); m = mkDeps();
  r = await ensureLoyverseReceipt(admin, o.id, { paymentMethod: 'efectivo', deps: m.deps });
  check('pedido cancelado: skipped, no crea', r.skipped === 'cancelled' && m.calls.create === 0, JSON.stringify(r));

  // 9. Fallo del cron (enqueueOnFailure=false) no encola otro trabajo
  o = await mkOrder(); m = mkDeps({ fail: true });
  r = await ensureLoyverseReceipt(admin, o.id, { paymentMethod: 'efectivo', lookupFirst: true, enqueueOnFailure: false, deps: m.deps });
  jobs = await getJobs(o.id);
  check('cron: fallo sin encolar duplicados', !r.success && !r.queued && jobs.length === 0, JSON.stringify({ r, jobs }));
}

main().catch(e => { fail++; console.log('ERROR en la prueba:', e.message); }).finally(async () => {
  for (const id of createdOrders) await admin.from('loyverse_sync_queue').delete().eq('entity_id', id);
  for (const id of createdOrders) await admin.from('orders').delete().eq('id', id).eq('customer_name', TAG);
  if (userId) await admin.from('users').delete().eq('id', userId).eq('name', TAG);
  const left = await admin.from('orders').select('id').eq('customer_name', TAG);
  const leftQ = createdOrders.length ? await admin.from('loyverse_sync_queue').select('id').in('entity_id', createdOrders) : { data: [] };
  console.log(`\nLimpieza: ${createdOrders.length} pedidos de prueba creados; restantes: pedidos ${left.data?.length}, trabajos ${leftQ.data?.length}`);
  console.log(`Resultado: ${pass} OK, ${fail} FALLAS`);
  process.exit(fail ? 1 : 0);
});
