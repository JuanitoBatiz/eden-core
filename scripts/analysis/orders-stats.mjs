// SOLO LECTURA. Estadísticas agregadas de orders y loyverse_sync_queue (sin datos personales).
import dotenv from 'dotenv'; dotenv.config({ path: '.env.local', quiet: true });
const U = process.env.NEXT_PUBLIC_SUPABASE_URL, K = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: K, Authorization: `Bearer ${K}` };
const all = async (q) => { let out = [], f = 0; for (;;) { const r = await fetch(`${U}/rest/v1/${q}`, { headers: { ...H, Range: `${f}-${f + 999}` } }); if (!r.ok) throw new Error(q + ' ' + r.status + await r.text()); const j = await r.json(); out.push(...j); if (j.length < 1000) break; f += 1000; } return out; };
const tally = (rows, fn) => { const m = {}; for (const r of rows) { const k = fn(r); m[k] = (m[k] || 0) + 1; } return m; };

const orders = await all('orders?select=id,status,payment_status,payment_method,service_type,refund_status,loyverse_receipt_id,proof_url,user_id,created_at,updated_at,total,delivery_fee,delivery_fee_confirmed');
console.log('orders', orders.length, 'rango', orders.map(o => o.created_at).sort()[0], '->', orders.map(o => o.created_at).sort().at(-1));
console.log('status x payment_status', tally(orders, o => `${o.status} | ${o.payment_status}`));
console.log('status x tiene_recibo_loyverse', tally(orders, o => `${o.status} | recibo=${!!o.loyverse_receipt_id}`));
console.log('status x service_type', tally(orders, o => `${o.status} | ${o.service_type}`));
console.log('cancelled: payment_status x refund_status x recibo', tally(orders.filter(o => o.status === 'cancelled'), o => `${o.payment_status} | refund=${o.refund_status} | recibo=${!!o.loyverse_receipt_id}`));
console.log('con proof_url x payment_status', tally(orders.filter(o => o.proof_url), o => o.payment_status));
console.log('user_id nulo', orders.filter(o => !o.user_id).length);
console.log('pedidos activos (received/awaiting/in_prep) antiguos >24h:', orders.filter(o => ['received','awaiting_payment','in_preparation'].includes(o.status) && Date.now() - new Date(o.created_at) > 864e5).map(o => `${o.status}/${o.payment_status}/${o.created_at.slice(0,10)}`));
console.log('delivered sin recibo loyverse:', orders.filter(o => o.status === 'delivered' && !o.loyverse_receipt_id).length);

const q = await all('loyverse_sync_queue?select=entity_type,status,attempts,max_attempts,next_retry_at,created_at,last_error');
console.log('\nqueue por entity_type/status', tally(q, r => `${r.entity_type} | ${r.status}`));
console.log('queue rango', q.map(r => r.created_at).sort()[0], '->', q.map(r => r.created_at).sort().at(-1));
console.log('queue attempts', tally(q, r => `${r.attempts}/${r.max_attempts}`));
console.log('queue last_error (tipos)', tally(q, r => (r.last_error || 'null').replace(/[0-9a-f-]{20,}/g, '<id>').slice(0, 80)));
