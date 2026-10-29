// FASE 0 — SOLO LECTURA (únicamente GET). No imprime tokens, claves ni teléfonos completos.
// Audita: roles elevados, datos bancarios, cambios recientes de configuración, pedidos sin recibo,
// cola de clientes pendientes y su coincidencia con clientes ya existentes en Loyverse.
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', quiet: true });

const U = process.env.NEXT_PUBLIC_SUPABASE_URL, K = process.env.SUPABASE_SERVICE_ROLE_KEY;
const LT = process.env.LOYVERSE_ACCESS_TOKEN;
const SH = { apikey: K, Authorization: `Bearer ${K}` };
const sb = async (path) => {
  const out = []; let from = 0;
  for (;;) {
    const r = await fetch(`${U}/rest/v1/${path}`, { headers: { ...SH, Range: `${from}-${from + 999}` } });
    if (!r.ok) throw new Error(`${path}: ${r.status} ${await r.text()}`);
    const j = await r.json(); out.push(...j); if (j.length < 1000) break; from += 1000;
  }
  return out;
};
const lv = async (path) => { const r = await fetch(`https://api.loyverse.com/v1.0${path}`, { headers: { Authorization: `Bearer ${LT}` } }); return { status: r.status, j: await r.json().catch(() => null) }; };
const mask = (p) => (p ? `***${String(p).slice(-4)}` : '—');
const day = (d) => (d ? String(d).slice(0, 10) : '—');
const LEAK_DATE = '2026-08-08';

console.log('═══ 1. ROLES ELEVADOS (posible escalada tras la filtración del', LEAK_DATE + ') ═══');
const users = await sb('users?select=id,phone,name,role,active,created_at&role=neq.customer&order=created_at.asc');
for (const u of users) console.log(`  ${u.role.padEnd(8)} | ${(u.name || '(sin nombre)').padEnd(22)} | tel ${mask(u.phone)} | creado ${day(u.created_at)} | ${u.active ? 'activo' : 'INACTIVO'}${u.created_at >= LEAK_DATE ? '  ← creado DESPUÉS de la filtración' : ''}`);

console.log('\n═══ 2. DATOS BANCARIOS (¿alguien cambió la CLABE?) ═══');
for (const b of await sb('bank_config?select=bank_name,account_holder,clabe,active,created_at,updated_at&order=created_at.asc'))
  console.log(`  ${b.active ? 'ACTIVA  ' : 'inactiva'} | ${b.bank_name} | titular: ${b.account_holder} | CLABE ***${String(b.clabe).slice(-4)} | creada ${day(b.created_at)} | modificada ${day(b.updated_at)}`);

console.log('\n═══ 3. CONFIGURACIÓN MODIFICADA DESDE LA FILTRACIÓN ═══');
for (const t of ['settings', 'delivery_zones', 'loyalty_benefits', 'products', 'categories']) {
  const rows = await sb(`${t}?select=updated_at&updated_at=gte.${LEAK_DATE}`);
  console.log(`  ${t.padEnd(18)} ${rows.length} fila(s) modificadas desde ${LEAK_DATE}`);
}

console.log('\n═══ 4. PEDIDOS ENTREGADOS SIN RECIBO EN LOYVERSE ═══');
const orders = await sb('orders?select=id,created_at,total,payment_status,payment_method,service_type,customer_name,user_id,loyverse_receipt_id&status=eq.delivered&loyverse_receipt_id=is.null&order=created_at.asc');
const TEST = /^(juan|jes[uú]s|due[ñn]o)/i;
let sum = 0;
const groups = {};
for (const o of orders) {
  const test = TEST.test((o.customer_name || '').trim());
  const key = `${o.payment_status}${test ? ' + nombre de prueba' : ''}`;
  groups[key] = groups[key] || { n: 0, total: 0, from: o.created_at, to: o.created_at };
  groups[key].n++; groups[key].total += Number(o.total); groups[key].to = o.created_at; sum += Number(o.total);
}
console.log(`  total: ${orders.length} pedidos, $${sum}`);
for (const [k, g] of Object.entries(groups)) console.log(`  - ${k}: ${g.n} pedidos, $${g.total} (${day(g.from)} → ${day(g.to)})`);
const byMonth = {}; orders.forEach(o => { const m = o.created_at.slice(0, 7); byMonth[m] = (byMonth[m] || 0) + 1; });
console.log('  por mes:', JSON.stringify(byMonth));

console.log('\n═══ 5. COLA DE CLIENTES PENDIENTES vs CLIENTES YA EXISTENTES EN LOYVERSE ═══');
const queue = await sb('loyverse_sync_queue?select=id,entity_id,payload,status,created_at&status=eq.pending');
const lvCustomers = []; let cursor = null;
do {
  const r = await lv(`/customers?limit=250${cursor ? `&cursor=${cursor}` : ''}`);
  if (r.status !== 200) { console.log('  no se pudo leer clientes de Loyverse:', r.status); break; }
  lvCustomers.push(...(r.j.customers || [])); cursor = r.j.cursor;
} while (cursor);
const digits = (p) => String(p || '').replace(/\D/g, '').slice(-10);
const byPhone = new Map(lvCustomers.map(c => [digits(c.phone_number), c]));
console.log(`  clientes en Loyverse: ${lvCustomers.length}; trabajos pendientes: ${queue.length}`);
let already = 0;
for (const q of queue) { if (byPhone.has(digits(q.payload?.phone))) already++; }
console.log(`  de los ${queue.length} pendientes, ${already} YA existen en Loyverse por teléfono (crearlos otra vez los DUPLICARÍA)`);
const dup = {}; lvCustomers.forEach(c => { const d = digits(c.phone_number); if (d) dup[d] = (dup[d] || 0) + 1; });
console.log(`  teléfonos ya duplicados hoy en Loyverse: ${Object.values(dup).filter(n => n > 1).length}`);
const noLink = await sb('users?select=id&loyverse_customer_id=is.null');
console.log(`  usuarios web sin loyverse_customer_id: ${noLink.length}`);

console.log('\n═══ 6. CAPACIDADES DE LA API DE LOYVERSE (campos de un recibo real) ═══');
const rc = await lv('/receipts?limit=1');
const sample = rc.j?.receipts?.[0];
console.log('  campos de recibo:', sample ? Object.keys(sample).join(', ') : 'n/d');
const wh = await lv('/webhooks');
console.log(`  webhooks registrados: ${(wh.j?.webhooks || []).length}`);
