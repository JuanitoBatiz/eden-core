// SOLO LECTURA. Detalle de los pedidos entregados, sin pago registrado y sin recibo, cuyo nombre NO parece de prueba.
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', quiet: true });
const U = process.env.NEXT_PUBLIC_SUPABASE_URL, K = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: K, Authorization: `Bearer ${K}` };
const get = async (p, extra = {}) => fetch(`${U}/rest/v1/${p}`, { headers: { ...H, ...extra } });
const tz = { timeZone: 'America/Mexico_City' };

const res = await get('orders?select=id,created_at,updated_at,total,payment_status,payment_method,service_type,customer_name,customer_phone,notes,items,user_id,delivery_address&status=eq.delivered&loyverse_receipt_id=is.null&payment_status=eq.pending_payment&order=created_at.asc');
const orders = await res.json();
const real = orders.filter(x => !/^(juan|jes[uú]s|due[ñn]o)/i.test((x.customer_name || '').trim()));

for (const x of real) {
  const u = (await (await get(`users?select=name,role,created_at&id=eq.${x.user_id}`)).json())[0] || {};
  const cnt = await get(`orders?select=id&user_id=eq.${x.user_id}`, { Prefer: 'count=exact', Range: '0-0' });
  const nOrders = (cnt.headers.get('content-range') || '').split('/')[1];
  console.log(`──── Pedido #${x.id.slice(-4).toUpperCase()}`);
  console.log(`Hecho:     ${new Date(x.created_at).toLocaleString('es-MX', tz)}  | cerrado: ${new Date(x.updated_at).toLocaleString('es-MX', tz)}`);
  console.log(`Cliente:   ${x.customer_name} | tel ***${String(x.customer_phone).slice(-4)} | usuario web: ${u.name} (${u.role}, alta ${String(u.created_at).slice(0, 10)}) | pedidos totales de este usuario: ${nOrders}`);
  console.log(`Total:     $${x.total} | ${x.service_type} | método de pago: ${x.payment_method || '—'} | notas: ${x.notes || '—'}`);
  console.log(`Platillos: ${(x.items || []).map(i => `${i.quantity}x ${i.name}${i.size ? ` (${i.size})` : ''} $${i.price}`).join(' ; ')}`);
}
console.log(`\n(${real.length} pedidos con nombre que no parece de prueba)`);
