// SOLO LECTURA. Agrega por mes las anomalías de orders (sin datos personales).
import dotenv from 'dotenv'; dotenv.config({ path: '.env.local', quiet: true });
const U = process.env.NEXT_PUBLIC_SUPABASE_URL, K = process.env.SUPABASE_SERVICE_ROLE_KEY;
const r = await fetch(`${U}/rest/v1/orders?select=status,payment_status,payment_method,loyverse_receipt_id,created_at,updated_at,total,service_type&order=created_at.asc`, { headers: { apikey: K, Authorization: `Bearer ${K}`, Range: '0-1999' } });
const o = await r.json(); const m = {};
const add = (k, f) => { m[k] = m[k] || {}; m[k][f] = (m[k][f] || 0) + 1; };
for (const x of o) { const mo = x.created_at.slice(0, 7);
  add(mo, 'total'); if (x.status === 'delivered' && x.payment_status === 'pending_payment') add(mo, 'delivered_sin_pago');
  if (x.status === 'delivered' && !x.loyverse_receipt_id) add(mo, 'delivered_sin_recibo');
  if (x.status === 'cancelled') add(mo, 'cancelled'); if (x.status === 'awaiting_payment') add(mo, 'awaiting_abandonado'); }
console.table(m);
const ex = o.filter(x => x.status === 'delivered' && x.payment_status === 'pending_payment');
console.log('delivered_sin_pago: payment_method', ex.reduce((a, x) => (a[x.payment_method] = (a[x.payment_method] || 0) + 1, a), {}), 'con recibo:', ex.filter(x => x.loyverse_receipt_id).length, 'suma total $', ex.reduce((s, x) => s + Number(x.total), 0));
const ns = o.filter(x => x.status === 'delivered' && !x.loyverse_receipt_id);
console.log('delivered_sin_recibo: payment_status', ns.reduce((a, x) => (a[x.payment_status] = (a[x.payment_status] || 0) + 1, a), {}), 'suma $', ns.reduce((s, x) => s + Number(x.total), 0));
const dur = o.filter(x => x.status === 'cancelled').map(x => (new Date(x.updated_at) - new Date(x.created_at)) / 60000).sort((a, b) => a - b);
console.log('cancelados: minutos desde creación → mediana', dur[Math.floor(dur.length / 2)]?.toFixed(1), 'p90', dur[Math.floor(dur.length * .9)]?.toFixed(1));
