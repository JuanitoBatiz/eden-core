// Pruebas del webhook de Loyverse. NO escriben en Loyverse y no consultan recibos reales:
//  A) reglas puras  B) procesamiento contra la BD real con filas de PRUEBA y Loyverse SIMULADO
//  C) autenticación HTTP contra el servidor local (http://localhost:3101, hay que levantarlo antes)
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', quiet: true });
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { decidePosRefundAction, isFullRefund, processReceiptsEvent, type PosReceipt } from '../../src/lib/loyverseWebhook';

const U = process.env.NEXT_PUBLIC_SUPABASE_URL!, K = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SECRET = process.env.LOYVERSE_WEBHOOK_SECRET || '';
const admin = createClient(U, K);
const TAG = 'ZZ-PRUEBA-NO-PREPARAR';
const BASE = 'http://localhost:3101';
let pass = 0, fail = 0;
const check = (name: string, cond: boolean, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'OK   ' : 'FALLA'} ${name} ${cond ? '' : extra}`); };

const created: string[] = []; let userId = '';
const mk = async (extra: Record<string, unknown>) => {
  const { data, error } = await admin.from('orders').insert([{
    user_id: userId, customer_name: TAG, customer_phone: '0000000000', items: [], total: 100, notes: TAG,
    status: 'in_preparation', payment_status: 'payment_approved', payment_method: 'efectivo', service_type: 'pickup', ...extra,
  }]).select().single();
  if (error) throw new Error(error.message);
  created.push(data.id); return data;
};
const row = async (id: string) => (await admin.from('orders').select('status,refund_status,cancelled_by,cancel_reason,cancelled_at').eq('id', id).single()).data!;

// Loyverse simulado: tabla de recibos por número
const fakeReceipts: Record<string, PosReceipt> = {};
const getReceipt = async (n: string) => fakeReceipts[n] ?? null;
const refundEvent = (refundNo: string, saleNo: string) => [{ receipt_number: refundNo, receipt_type: 'REFUND', refund_for: saleNo }];

async function partA() {
  console.log('── A) reglas puras');
  const o = (p: object) => ({ id: 'x', status: 'in_preparation', payment_status: 'payment_approved', payment_method: 'efectivo', refund_status: 'none', total: 100, ...p });
  let a = decidePosRefundAction(o({}));
  check('en preparación, efectivo → cancela por POS sin refund', a.type === 'cancel' && a.updates.cancelled_by === 'pos' && a.updates.cancel_reason === 'anulado_en_pos' && !('refund_status' in a.updates), JSON.stringify(a));
  a = decidePosRefundAction(o({ payment_method: 'transferencia' }));
  check('en preparación, transferencia aprobada → cancela + refund pendiente', a.type === 'cancel' && a.updates.refund_status === 'pending', JSON.stringify(a));
  a = decidePosRefundAction(o({ status: 'delivered' }));
  check('entregado, efectivo → NO cancela; refund completed', a.type === 'mark_refunded' && a.updates.refund_status === 'completed' && !('status' in a.updates), JSON.stringify(a));
  a = decidePosRefundAction(o({ status: 'delivered', payment_method: 'transferencia' }));
  check('entregado, transferencia → refund pendiente', a.type === 'mark_refunded' && a.updates.refund_status === 'pending', JSON.stringify(a));
  a = decidePosRefundAction(o({ status: 'delivered', refund_status: 'completed' }));
  check('entregado ya marcado → noop', a.type === 'noop', JSON.stringify(a));
  a = decidePosRefundAction(o({ status: 'cancelled' }));
  check('ya cancelado (eco de nuestro reembolso) → noop', a.type === 'noop', JSON.stringify(a));
  check('reembolso total con tolerancia de redondeo', isFullRefund(99.6, 100) && isFullRefund(100, 100) && !isFullRefund(60, 100));
}

async function partB() {
  console.log('── B) procesamiento contra BD real con Loyverse simulado');
  const { data: u, error } = await admin.from('users').insert([{ phone: '5599990008', name: TAG, role: 'customer' }]).select().single();
  if (error) throw new Error(error.message);
  userId = u.id;

  const cash = await mk({ loyverse_receipt_id: 'ZZT-1', loyverse_receipt_number: 'ZZT-1' });
  const transf = await mk({ loyverse_receipt_id: 'ZZT-2', loyverse_receipt_number: 'ZZT-2', payment_method: 'transferencia' });
  const delCash = await mk({ loyverse_receipt_id: 'ZZT-3', loyverse_receipt_number: 'ZZT-3', status: 'delivered' });
  const delTr = await mk({ loyverse_receipt_id: 'ZZT-4', loyverse_receipt_number: 'ZZT-4', status: 'delivered', payment_method: 'transferencia' });
  const partial = await mk({ loyverse_receipt_id: 'ZZT-5', loyverse_receipt_number: 'ZZT-5' });
  const cancelledSale = await mk({ loyverse_receipt_id: 'ZZT-6', loyverse_receipt_number: 'ZZT-6' });

  for (const [n, saleNo] of [['ZZR-1', 'ZZT-1'], ['ZZR-2', 'ZZT-2'], ['ZZR-3', 'ZZT-3'], ['ZZR-4', 'ZZT-4']] as const)
    fakeReceipts[n] = { receipt_number: n, receipt_type: 'REFUND', refund_for: saleNo, total_money: 100 };
  fakeReceipts['ZZR-5'] = { receipt_number: 'ZZR-5', receipt_type: 'REFUND', refund_for: 'ZZT-5', total_money: 40 };
  fakeReceipts['ZZT-6'] = { receipt_number: 'ZZT-6', receipt_type: 'SALE', cancelled_at: new Date().toISOString(), total_money: 100 };

  let out = await processReceiptsEvent(admin, [
    ...refundEvent('ZZR-1', 'ZZT-1'), ...refundEvent('ZZR-2', 'ZZT-2'), ...refundEvent('ZZR-3', 'ZZT-3'),
    ...refundEvent('ZZR-4', 'ZZT-4'), ...refundEvent('ZZR-5', 'ZZT-5'),
    { receipt_number: 'ZZT-6', receipt_type: 'SALE', cancelled_at: new Date().toISOString() },
  ], { getReceipt });

  let d = await row(cash.id);
  check('en prep. efectivo → cancelled/pos/anulado_en_pos', d.status === 'cancelled' && d.cancelled_by === 'pos' && d.cancel_reason === 'anulado_en_pos' && !!d.cancelled_at && d.refund_status === 'none', JSON.stringify(d));
  d = await row(transf.id);
  check('en prep. transferencia → cancelled + refund pending', d.status === 'cancelled' && d.refund_status === 'pending', JSON.stringify(d));
  d = await row(delCash.id);
  check('entregado efectivo → sigue delivered, refund completed', d.status === 'delivered' && d.refund_status === 'completed' && d.cancelled_by === null, JSON.stringify(d));
  d = await row(delTr.id);
  check('entregado transferencia → sigue delivered, refund pending', d.status === 'delivered' && d.refund_status === 'pending', JSON.stringify(d));
  d = await row(partial.id);
  check('reembolso parcial → sin cambios', d.status === 'in_preparation' && out.some(o => o.result === 'partial_refund_logged'), JSON.stringify({ d, out: out.map(o => o.result) }));
  d = await row(cancelledSale.id);
  check('recibo anulado (cancelled_at) → pedido cancelado', d.status === 'cancelled' && d.cancelled_by === 'pos', JSON.stringify(d));

  // Idempotencia: mismo evento otra vez
  out = await processReceiptsEvent(admin, [...refundEvent('ZZR-1', 'ZZT-1'), ...refundEvent('ZZR-3', 'ZZT-3')], { getReceipt });
  check('repetir el evento → noop (idempotente)', out.length === 2 && out.every(o => o.result === 'noop'), JSON.stringify(out));
  d = await row(delCash.id);
  check('…y no cambia nada', d.refund_status === 'completed' && d.status === 'delivered');

  // Verificación contra Loyverse: aviso falso
  out = await processReceiptsEvent(admin, [{ receipt_number: 'ZZ-FALSO', receipt_type: 'REFUND', refund_for: 'ZZT-5' }], { getReceipt });
  check('aviso falso (Loyverse no lo confirma) → unverified', out[0].result === 'unverified', JSON.stringify(out));
  out = await processReceiptsEvent(admin, [{ receipt_number: 'ZZT-5', cancelled_at: new Date().toISOString() }], { getReceipt });
  check('aviso de anulación que Loyverse no confirma → unverified y sin cambios', out[0].result === 'unverified' && (await row(partial.id)).status === 'in_preparation', JSON.stringify(out));

  // Otros casos
  fakeReceipts['ZZR-9'] = { receipt_number: 'ZZR-9', receipt_type: 'REFUND', refund_for: 'ZZT-NO-EXISTE', total_money: 50 };
  out = await processReceiptsEvent(admin, refundEvent('ZZR-9', 'ZZT-NO-EXISTE'), { getReceipt });
  check('venta que no vino de la web → no_matching_order', out[0].result === 'no_matching_order', JSON.stringify(out));
  out = await processReceiptsEvent(admin, [{ receipt_number: 'ZZT-5', receipt_type: 'SALE' }], { getReceipt });
  check('recibo normal (venta) → ignorado', out[0].result === 'ignored_not_refund', JSON.stringify(out));
  fakeReceipts['ZZR-8'] = { receipt_number: 'ZZR-8', receipt_type: 'REFUND', refund_for: 'a,b)', total_money: 50 };
  out = await processReceiptsEvent(admin, refundEvent('ZZR-8', 'a,b)'), { getReceipt });
  check('número de recibo con caracteres peligrosos → unverified', out[0].result === 'unverified', JSON.stringify(out));
  let threw = false;
  try { await processReceiptsEvent(admin, refundEvent('ZZR-1', 'ZZT-1'), { getReceipt: async () => { throw new Error('HTTP 503'); } }); } catch { threw = true; }
  check('fallo de la API de Loyverse → lanza error (el endpoint responde 5xx)', threw);
}

async function partC() {
  console.log('── C) autenticación HTTP (servidor local)');
  const post = async (path: string, body: string, headers: Record<string, string> = {}) =>
    (await fetch(`${BASE}/api/webhooks/loyverse${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body })).status;
  const body = JSON.stringify({ type: 'customers.update', zz_test: true });
  check('sin clave ni firma → 401', (await post('', body)) === 401);
  check('clave incorrecta → 401', (await post('?k=incorrecta', body)) === 401);
  check('clave correcta en la URL → 200', (await post(`?k=${encodeURIComponent(SECRET)}`, body)) === 200);
  const sig = crypto.createHmac('sha1', SECRET).update(body).digest('base64');
  check('firma HMAC correcta → 200', (await post('', body, { 'X-Loyverse-Signature': sig })) === 200);
  check('firma HMAC en la otra cabecera → 200', (await post('', body, { 'X-Loyverse-Webhook-Signature': sig })) === 200);
  check('firma incorrecta → 401', (await post('', body, { 'X-Loyverse-Signature': 'AAAA' })) === 401);
  check('firma de otro cuerpo → 401', (await post('', body + ' ', { 'X-Loyverse-Signature': sig })) === 401);
  check('JSON inválido con clave correcta → 400', (await post(`?k=${encodeURIComponent(SECRET)}`, 'no-es-json')) === 400);
  // Un recibo "reembolsado" falso con clave válida: Loyverse real no lo confirma → no cambia nada (200 igualmente)
  const fake = JSON.stringify({ type: 'receipts.update', zz_test: true, receipts: [{ receipt_number: 'ZZ-NO-EXISTE-999', receipt_type: 'REFUND', refund_for: 'ZZ-NO-EXISTE-998' }] });
  check('receipts.update con recibo inexistente → 200 sin efectos', (await post(`?k=${encodeURIComponent(SECRET)}`, fake)) === 200);
  const logs = await fetch(`${U}/rest/v1/webhook_logs?select=status,event_type&payload->>zz_test=eq.true`, { headers: { apikey: K, Authorization: `Bearer ${K}` } }).then(r => r.json());
  check('los eventos quedaron en webhook_logs', Array.isArray(logs) && logs.length >= 4 && logs.every((l: { status: string }) => l.status === 'processed'), JSON.stringify(logs).slice(0, 200));
}

(async () => {
  try {
    await partA();
    await partB();
    await partC();
  } catch (e) { fail++; console.log('ERROR en la prueba:', (e as Error).message); }
  finally {
    for (const id of created) await admin.from('orders').delete().eq('id', id).eq('customer_name', TAG);
    if (userId) await admin.from('users').delete().eq('id', userId).eq('name', TAG);
    await fetch(`${U}/rest/v1/webhook_logs?payload->>zz_test=eq.true`, { method: 'DELETE', headers: { apikey: K, Authorization: `Bearer ${K}` } });
    const left = await admin.from('orders').select('id').eq('customer_name', TAG);
    const leftLogs = await fetch(`${U}/rest/v1/webhook_logs?select=id&payload->>zz_test=eq.true`, { headers: { apikey: K, Authorization: `Bearer ${K}` } }).then(r => r.json());
    console.log(`\nLimpieza: ${created.length} pedidos de prueba; restantes: pedidos ${left.data?.length}, logs ${leftLogs.length}`);
    console.log(`Resultado: ${pass} OK, ${fail} FALLAS`);
    process.exit(fail ? 1 : 0);
  }
})();
