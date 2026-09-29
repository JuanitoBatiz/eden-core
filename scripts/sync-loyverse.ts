/**
 * scripts/sync-loyverse.ts
 *
 * PASO 1 (void): Anula los 36 recibos inyectados (0111-0146) que tenían datos incompletos.
 * PASO 2 (inject): Re-inyecta los 36 pedidos con datos completos:
 *   - Todos los items con sus customizaciones en line_note
 *   - Nota con service_type, payment_method, cliente y teléfono
 *   - customer_id de Loyverse si el usuario lo tiene registrado
 *   - Tarifa de envío como line item separado (delivery)
 *
 * USO:
 *   Void + re-inject:    cmd /c "npx.cmd tsx scripts/sync-loyverse.ts"
 *   Solo preview:        cmd /c "npx.cmd tsx scripts/sync-loyverse.ts --dry-run"
 *   Solo void (riesgo):  cmd /c "npx.cmd tsx scripts/sync-loyverse.ts --void-only"
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// ─── Config ─────────────────────────────────────────────────────────────────
const SUPABASE_URL        = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY    = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const LOYVERSE_TOKEN      = process.env.LOYVERSE_ACCESS_TOKEN!;
const LOYVERSE_STORE_ID   = process.env.LOYVERSE_STORE_ID!;
const GENERIC_VARIANT_ID  = process.env.LOYVERSE_GENERIC_VARIANT_ID!;
const LOYVERSE_API        = 'https://api.loyverse.com/v1.0';

const DRY_RUN   = process.argv.includes('--dry-run');
const VOID_ONLY = process.argv.includes('--void-only');

// Receipt numbers de los 36 recibos a anular
const RECEIPTS_TO_VOID = [
  '0111','0112','0113','0114','0115','0116','0117','0118','0119','0120',
  '0121','0122','0123','0124','0125','0126','0127','0128','0129','0130',
  '0131','0132','0133','0134','0135','0136','0137','0138','0139','0140',
  '0141','0142','0143','0144','0145','0146'
];

// Nombres de cuentas de prueba — excluidos de inyección
const TEST_PATTERNS = [
  { type: 'startswith', value: 'juan' },
  { type: 'exact', value: 'dueño maestro' },
  { type: 'exact', value: 'jesús' },
  { type: 'exact', value: 'jesus' },
  { type: 'exact', value: 'dueño' },
];

function isTestOrder(name: string): boolean {
  const n = name.toLowerCase().trim();
  return TEST_PATTERNS.some(p =>
    p.type === 'startswith' ? n.startsWith(p.value) : n === p.value
  );
}

// ─── Caché de tipos de pago ───────────────────────────────────────────────────
let cashTypeId: string | null = null;
let transferTypeId: string | null = null;

async function fetchPaymentTypes() {
  const res = await fetch(`${LOYVERSE_API}/payment_types`, {
    headers: { 'Authorization': `Bearer ${LOYVERSE_TOKEN}` }
  });
  if (!res.ok) throw new Error(`Loyverse payment_types error: ${res.status}`);
  const data = await res.json();
  const types: any[] = data.payment_types || [];

  cashTypeId = types.find((p: any) =>
    p.type === 'CASH' ||
    p.name?.toLowerCase().includes('efectivo') ||
    p.name?.toLowerCase().includes('cash')
  )?.id || null;

  transferTypeId = types.find((p: any) =>
    p.name?.toLowerCase().includes('transferencia') ||
    p.name?.toLowerCase().includes('spei') ||
    p.name?.toLowerCase().includes('transfer')
  )?.id || null;

  console.log('\n📋 Tipos de pago en Loyverse:');
  types.forEach((p: any) => console.log(`   ${p.type} | ${p.name} | id: ${p.id}`));
  console.log(`   ✅ Efectivo:      ${cashTypeId}`);
  console.log(`   ${transferTypeId ? '✅' : '⚠️ '} Transferencia: ${transferTypeId || 'No encontrado'}\n`);

  if (!cashTypeId) throw new Error('❌ No se encontró tipo de pago EFECTIVO en Loyverse.');
}

// ─── Formatear customizaciones de item (idéntico a loyverse.ts) ──────────────
function formatItemCustomizations(item: any): string[] {
  const parts: string[] = [];
  if (item.variant || item.size) parts.push(`Opción: ${item.variant || item.size}`);

  if (item.customizations && typeof item.customizations === 'object') {
    const cust = item.customizations;
    if (cust.proteins?.length > 0)   parts.push(`Prot: ${cust.proteins.join(', ')}`);
    if (cust.toppings?.length > 0)   parts.push(`Top: ${cust.toppings.join(', ')}`);
    if (cust.seedsAndNuts?.length > 0) parts.push(`Semillas: ${cust.seedsAndNuts.join(', ')}`);
    if (cust.dressings?.length > 0)  parts.push(`Aderezo: ${cust.dressings.join(', ')}`);
    if (cust.flavors?.length > 0)    parts.push(`Sabor: ${cust.flavors.join(', ')}`);

    if (cust.extras?.length > 0) {
      const omissions = cust.extras.filter((x: any) => typeof x === 'string' && x.toLowerCase().startsWith('sin '));
      const others = cust.extras.filter((x: any) => !(typeof x === 'string' && x.toLowerCase().startsWith('sin ')));
      if (omissions.length > 0) parts.push(`EXCLUSIONES: ${omissions.join(', ')}`);
      if (others.length > 0) parts.push(`Opciones/Extras: ${others.join(', ')}`);
    }

    // Grupos de modificadores dinámicos de Supabase
    const stdKeys = ['proteins', 'toppings', 'seedsAndNuts', 'dressings', 'flavors', 'extras'];
    for (const [key, val] of Object.entries(cust)) {
      if (!stdKeys.includes(key)) {
        if (Array.isArray(val) && (val as any[]).length > 0)
          parts.push(`${key.charAt(0).toUpperCase() + key.slice(1)}: ${(val as any[]).join(', ')}`);
        else if (typeof val === 'string' && val.trim())
          parts.push(`${key.charAt(0).toUpperCase() + key.slice(1)}: ${val}`);
      }
    }
  }

  if (item.notes) parts.push(`Nota: ${item.notes}`);
  return parts;
}

// ─── Construir nota del recibo (idéntico a loyverse.ts) ───────────────────────
function buildReceiptNote(order: any): string {
  let serviceTypeText = '[PARA RECOGER EN SUCURSAL]';
  if (order.service_type === 'delivery') {
    let mapsLink = '';
    if (order.delivery_lat != null && order.delivery_lng != null) {
      mapsLink = ` | 📍 maps.google.com/?q=${order.delivery_lat},${order.delivery_lng}`;
    }
    const feeInfo = order.delivery_fee_confirmed && order.delivery_fee
      ? ` | Tarifa: $${order.delivery_fee}` : '';
    serviceTypeText = `[ENVÍO] Dir: ${order.delivery_address || 'No especificada'}${mapsLink}${feeInfo}`;
  } else if (['dine_in', 'local', 'comer_local'].includes(order.service_type)) {
    serviceTypeText = '[COMER EN LOCAL (MESA)]';
  }

  // Tipo de pago SOLO por payment_method — nunca por payment_status
  let paymentText = '[COBRAR EN CAJA / EFECTIVO]';
  if (order.payment_method === 'transferencia' || order.payment_method === 'spei') {
    paymentText = '[YA PAGADO WEB / SPEI]';
  }

  const note = `${serviceTypeText} | ${paymentText}\nPedido Web #${order.id.slice(-4).toUpperCase()} | Cliente: ${order.customer_name} (${order.customer_phone})\nNotas: ${order.notes || 'Ninguna'}`;
  return note.length > 255 ? note.slice(0, 252) + '...' : note;
}

// ─── Construir line items (idéntico a loyverse.ts) ───────────────────────────
function buildLineItems(order: any): any[] {
  const lines = (order.items as any[]).map((item: any) => {
    const parts = formatItemCustomizations(item);
    let lineNote: string | undefined = parts.length > 0 ? parts.join(' | ') : undefined;
    if (lineNote && lineNote.length > 255) lineNote = lineNote.slice(0, 252) + '...';

    const lineItem: any = {
      variant_id: item.variantId || item.variant_id || GENERIC_VARIANT_ID,
      quantity: item.quantity,
      price: item.price,
    };
    if (lineNote) {
      lineItem.line_note = lineNote;
      lineItem.note = lineNote;
    }
    return lineItem;
  });

  // Tarifa de envío como line item separado
  if (order.service_type === 'delivery' && order.delivery_fee && order.delivery_fee > 0) {
    lines.push({
      variant_id: GENERIC_VARIANT_ID,
      quantity: 1,
      price: order.delivery_fee,
      line_note: 'Costo de Envío a Domicilio',
      note: 'Costo de Envío a Domicilio'
    });
  }
  return lines;
}

// ─── Seleccionar tipo de pago ─────────────────────────────────────────────────
function getPaymentTypeForOrder(order: any): any[] {
  // SOLO por payment_method — nunca por payment_status
  if (order.payment_method === 'transferencia' || order.payment_method === 'spei') {
    return transferTypeId
      ? [{ payment_type_id: transferTypeId, amount: Number(order.total) }]
      : [{ type: 'OTHER', amount: Number(order.total) }];
  }
  if (order.payment_method === 'tarjeta') {
    return [{ type: 'CARD', amount: Number(order.total) }];
  }
  // Efectivo (default)
  return cashTypeId
    ? [{ payment_type_id: cashTypeId, amount: Number(order.total) }]
    : [{ type: 'CASH', amount: Number(order.total) }];
}

// ─── Anular (refund) un recibo en Loyverse ───────────────────────────────────
async function voidReceipt(receiptId: string): Promise<boolean> {
  // 1. Obtener datos del recibo original
  const fetchRes = await fetch(`${LOYVERSE_API}/receipts/${receiptId}`, {
    headers: { 'Authorization': `Bearer ${LOYVERSE_TOKEN}` }
  });
  if (!fetchRes.ok) {
    const body = await fetchRes.text();
    throw new Error(`GET receipt ${receiptId} failed [${fetchRes.status}]: ${body}`);
  }
  const receipt = await fetchRes.json();

  // 2. Construir payload de reembolso (igual que refundLoyverseReceipt en loyverse.ts)
  const refundPayload = {
    line_items: receipt.line_items.map((item: any) => ({
      id: item.id,
      quantity: item.quantity
    }))
  };

  // 3. Enviar reembolso
  const refundRes = await fetch(`${LOYVERSE_API}/receipts/${receiptId}/refund`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOYVERSE_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(refundPayload)
  });

  if (!refundRes.ok) {
    const body = await refundRes.text();
    throw new Error(`Refund ${receiptId} failed [${refundRes.status}]: ${body}`);
  }
  return true;
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  🔄 RE-INYECCIÓN LOYVERSE — Datos Completos');
  console.log(`  Modo: ${DRY_RUN ? '🔍 DRY RUN' : VOID_ONLY ? '🗑️  VOID ONLY' : '🚀 VOID + RE-INJECT'}`);
  console.log('═══════════════════════════════════════════════════════\n');

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error('Faltan variables SUPABASE en .env.local');
  if (!LOYVERSE_TOKEN || !LOYVERSE_STORE_ID || !GENERIC_VARIANT_ID) throw new Error('Faltan variables LOYVERSE en .env.local');

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // ── Cargar tipos de pago
  console.log('🔌 Conectando con Loyverse...');
  await fetchPaymentTypes();

  // ── Obtener los 36 órdenes de Supabase con todos sus datos
  console.log('🗄️  Consultando órdenes en Supabase...');
  const { data: orders, error } = await supabase
    .from('orders')
    .select('*, users(loyverse_customer_id)')
    .in('loyverse_receipt_number', RECEIPTS_TO_VOID)
    .order('loyverse_receipt_number', { ascending: true });

  if (error) throw new Error(`Supabase error: ${error.message}`);
  if (!orders || orders.length === 0) {
    console.log('⚠️  No se encontraron órdenes con esos receipt_numbers. Verifica la consulta SQL de la Fase 1.');
    return;
  }

  console.log(`📦 Órdenes encontradas: ${orders.length} de ${RECEIPTS_TO_VOID.length} esperadas\n`);

  if (orders.length !== RECEIPTS_TO_VOID.length) {
    console.warn(`⚠️  ADVERTENCIA: Se esperaban ${RECEIPTS_TO_VOID.length} pero se encontraron ${orders.length}.`);
    console.warn('   Continúa, pero verifica que no falte ninguno después.\n');
  }

  // ── Preview
  console.log('─── ÓRDENES A PROCESAR ──────────────────────────────────');
  orders.forEach((o, i) => {
    const items = (o.items as any[]) || [];
    console.log(`  ${String(i + 1).padStart(2)}. [${o.loyverse_receipt_number}] ${o.customer_name.padEnd(28)} $${o.total}  (${items.length} item(s))`);
  });
  console.log('─────────────────────────────────────────────────────────\n');

  if (DRY_RUN) {
    console.log('🔍 DRY RUN: no se ejecutó nada. Elimina --dry-run para proceder.');
    return;
  }

  // ═══════════════════════════════════════════════
  // PASO 1: ANULAR los 36 recibos en Loyverse
  // ═══════════════════════════════════════════════
  console.log('🗑️  PASO 1: Anulando recibos en Loyverse...\n');
  const voidResults: { receiptNumber: string; orderId: string; success: boolean; error?: string }[] = [];

  for (const order of orders) {
    const receiptId = order.loyverse_receipt_id;   // es el receipt_number (ej: "0111")
    try {
      await voidReceipt(receiptId);
      voidResults.push({ receiptNumber: order.loyverse_receipt_number, orderId: order.id, success: true });
      console.log(`  🗑️  Anulado: [${order.loyverse_receipt_number}] ${order.customer_name} $${order.total}`);
    } catch (err: any) {
      voidResults.push({ receiptNumber: order.loyverse_receipt_number, orderId: order.id, success: false, error: err.message });
      console.error(`  ❌ Fallo void [${order.loyverse_receipt_number}]: ${err.message}`);
    }
    await new Promise(r => setTimeout(r, 300));
  }

  const voidedOk = voidResults.filter(r => r.success);
  const voidedFail = voidResults.filter(r => !r.success);
  console.log(`\n  ✅ Anulados: ${voidedOk.length} | ❌ Fallidos: ${voidedFail.length}\n`);

  if (VOID_ONLY) {
    console.log('🛑 --void-only activo. No se re-inyecta nada.');
    return;
  }

  // ══════════════════════════════════════════════════════
  // PASO 2: Limpiar loyverse_* en Supabase para los anulados
  // ══════════════════════════════════════════════════════
  console.log('🧹 PASO 2: Limpiando loyverse_receipt_id en Supabase...\n');
  const idsToClean = voidedOk.map(r => r.orderId);
  if (idsToClean.length > 0) {
    const { error: cleanErr } = await supabase
      .from('orders')
      .update({
        loyverse_receipt_id: null,
        loyverse_receipt_number: null
      })
      .in('id', idsToClean);
    if (cleanErr) {
      throw new Error(`Error al limpiar Supabase: ${cleanErr.message}`);
    }
    console.log(`  ✅ ${idsToClean.length} órdenes limpiadas en Supabase.\n`);
  }

  // Re-fetch orders con datos frescos (loyverse_* ya en null)
  const { data: freshOrders, error: fetchErr2 } = await supabase
    .from('orders')
    .select('*, users(loyverse_customer_id)')
    .in('id', idsToClean)
    .order('created_at', { ascending: true });

  if (fetchErr2 || !freshOrders) throw new Error(`Error al re-consultar órdenes: ${fetchErr2?.message}`);

  // ════════════════════════════════════════════════════════
  // PASO 3: Re-inyectar con datos COMPLETOS
  // ════════════════════════════════════════════════════════
  console.log('🚀 PASO 3: Re-inyectando con datos completos...\n');
  let synced = 0;
  let failed = 0;
  const failures: string[] = [];

  for (const order of freshOrders) {
    if (isTestOrder(order.customer_name)) {
      console.log(`  ⏭️  Saltando orden de prueba: ${order.customer_name}`);
      continue;
    }

    try {
      const loyverseCustomerId = (order as any).users?.loyverse_customer_id || undefined;
      const note = buildReceiptNote(order);
      const lineItems = buildLineItems(order);
      const payments = getPaymentTypeForOrder(order);

      const payload: any = {
        store_id: LOYVERSE_STORE_ID,
        note,
        line_items: lineItems,
        payments
      };
      if (loyverseCustomerId) {
        payload.customer_id = loyverseCustomerId;  // vincula puntos de lealtad
      }

      const res = await fetch(`${LOYVERSE_API}/receipts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOYVERSE_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`HTTP ${res.status}: ${body}`);
      }

      const receipt = await res.json();
      const receiptNum = receipt.receipt_number;

      // Guardar en Supabase
      await supabase
        .from('orders')
        .update({
          loyverse_receipt_id: receiptNum,
          loyverse_receipt_number: receiptNum
        })
        .eq('id', order.id);

      synced++;
      const itemCount = (order.items as any[])?.length || 0;
      console.log(`  ✅ [→${receiptNum}] ${order.customer_name.padEnd(28)} $${order.total}  (${itemCount} items) ${loyverseCustomerId ? '👤' : ''}`);

    } catch (err: any) {
      failed++;
      const msg = `${order.customer_name} ($${order.total}): ${err.message}`;
      failures.push(msg);
      console.error(`  ❌ ${msg}`);
    }

    await new Promise(r => setTimeout(r, 300));
  }

  // ── Resumen final
  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`  🗑️  Anulados en Loyverse: ${voidedOk.length} / ${orders.length}`);
  console.log(`  ✅ Re-inyectados: ${synced}`);
  console.log(`  ❌ Fallidos:     ${failed}`);
  if (failures.length > 0) {
    console.log('\n  Pedidos que fallaron en re-inyección:');
    failures.forEach(f => console.log(`    - ${f}`));
  }
  console.log('═══════════════════════════════════════════════════════\n');
}

main().catch(err => {
  console.error('\n💥 ERROR CRÍTICO:', err.message);
  process.exit(1);
});
