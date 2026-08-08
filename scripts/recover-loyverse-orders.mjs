/**
 * SCRIPT DE RECUPERACIÓN — Envío retroactivo de pedidos a Loyverse POS
 * Ejecutar con: node scripts/recover-loyverse-orders.mjs
 *
 * Recupera 4 pedidos reales del 6-7 de agosto 2026 que nunca llegaron
 * a Loyverse POS por el bug en el campo receipt_id (ya corregido).
 *
 * Después de ejecutar: verificar en Loyverse que aparecen los 4 recibos.
 */

// ── Credenciales ───────────────────────────────────────────────────────────────
const LOYVERSE_ACCESS_TOKEN       = '2d42d924c5f34c87b3a739869563c018';
const LOYVERSE_STORE_ID           = 'c1fea6f1-4c96-4126-97b4-42dd73762277';
const LOYVERSE_GENERIC_VARIANT_ID = 'c95f3b58-2c7f-4a8f-b050-968d269e7ce6';
const LOYVERSE_TRANSFERENCIA_PT   = '6a446aea-0bc8-4e1d-9001-27cf339851e4'; // payment_type_id de "Transferencia"
const LOYVERSE_API_URL            = 'https://api.loyverse.com/v1.0';

const SUPABASE_URL      = 'https://mnfblwxxehyvspkhdkos.supabase.co';
const SUPABASE_KEY      = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1uZmJsd3h4ZWh5dnNwa2hka29zIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjA2Njg3OSwiZXhwIjoyMDk3NjQyODc5fQ.EllJSLxEMH2Qzx-Aqss-ZA7ETfv6k7pg5nBVXi-GuYI';

// ── Órdenes a recuperar (datos completos de la BD) ─────────────────────────────
const ORDERS_TO_RECOVER = [
  {
    id: '7dff1207-f9fc-4cce-870e-5ed5fb6aa034',
    customer_name: 'Levi ro',
    customer_phone: '5565576829',
    loyverse_customer_id: 'dc7f328c-58d2-493d-8051-1941145c8973',
    total: 205.00,
    notes: '',
    service_type: 'delivery',
    delivery_address: 'Constitución 7B, Otumba Centro, 55913 Otumba de Gómez Farías, Méx., México',
    delivery_fee: 15.00,
    delivery_fee_confirmed: true,
    delivery_lat: 19.7015997,
    delivery_lng: -98.7552247,
    delivery_distance_km: 1.00,
    items: [
      { name: 'Ensalada', size: 'Chica', price: 95, quantity: 1, customizations: { proteins: ['Pechuga Empanizada'], toppings: ['Fresa', 'Brócoli y Zanahoria Hervida', 'Pasta', 'Queso Panela'], dressings: ['Cilantro'], seedsAndNuts: ['Almendra', 'Nuez'] } },
      { name: 'Ensalada', size: 'Chica', price: 95, quantity: 1, customizations: { proteins: ['Pechuga Empanizada'], toppings: ['Crutones', 'Brócoli y Zanahoria Hervida', 'Granos de Elote', 'Uva'], dressings: ['Mango Habanero', 'BBQ'], seedsAndNuts: ['Nuez'] } }
    ]
  },
  {
    id: '37822f07-fb59-4c3c-b178-983232fe6d74',
    customer_name: 'Myriam',
    customer_phone: '5567990801',
    loyverse_customer_id: '7fe000e3-f1cf-4316-8f1f-89b8a34e8953',
    total: 715.00,
    notes: '',
    service_type: 'delivery',
    delivery_address: 'Madero #11, 55855 San Pablo Ixquitlán, Méx., México',
    delivery_fee: 60.00,
    delivery_fee_confirmed: true,
    delivery_lat: 19.71246,
    delivery_lng: -98.7903971,
    delivery_distance_km: 3.90,
    items: [
      { name: 'Bowl de Yogurt', price: 65, quantity: 1, customizations: { toppings: ['Plátano', 'Fresa'], seedsAndNuts: ['Nuez', 'Pasas'] } },
      { name: 'Sándwich', price: 75, quantity: 1, customizations: { extras: ['Pechuga asada', 'Pan Blanco'] } },
      { name: 'Burrito de Pollo', price: 85, quantity: 2, customizations: {} },
      { name: 'Bowl de Avena', price: 60, quantity: 1, customizations: { toppings: ['Frambuesa', 'Blueberry'], seedsAndNuts: ['Almendra', 'Coco Rayado'] } },
      { name: 'Bowl de Yogurt', price: 65, quantity: 1, customizations: { toppings: ['Uva', 'Fresa'], seedsAndNuts: ['Nuez', 'Arándano'] } },
      { name: 'Ensalada', size: 'Chica', price: 125, quantity: 1, customizations: { proteins: ['Atún'], toppings: ['Granos de Elote', 'Crutones', 'Queso Panela', 'Pasta', 'Fresa', 'Tomate Cherry'], dressings: ['Mostaza Miel'], seedsAndNuts: ['Nuez', 'Arándano'] } },
      { name: 'Ensalada', size: 'Chica', price: 95, quantity: 1, customizations: { proteins: ['Pechuga Asada'], toppings: ['Mango', 'Uva', 'Fresa', 'Queso Panela'], dressings: ['Miel'], seedsAndNuts: ['Arándano', 'Almendra'] } }
    ]
  },
  {
    id: '1a2c2cd3-6956-42b3-902c-74fa1bc96771',
    customer_name: 'Alejandra García',
    customer_phone: '5511292058',
    loyverse_customer_id: '527a965c-9786-43b1-8a4f-ae3318540872',
    total: 380.00,
    notes: '',
    service_type: 'delivery',
    delivery_address: 'P67V+R4, 55940 Otumba de Gómez Farías, Méx., México',
    delivery_fee: 50.00,
    delivery_fee_confirmed: true,
    delivery_lat: 19.713972,
    delivery_lng: -98.756512,
    delivery_distance_km: 2.80,
    items: [
      { name: 'Ciabatta', price: 95, quantity: 2, customizations: {} },
      { name: 'Smoothies Clásicos', size: 'Chico', price: 70, quantity: 2, customizations: { flavors: ['Mango'] } }
    ]
  },
  {
    id: '367e759e-9a92-4a37-af47-639e79150a77',
    customer_name: 'Levi ro',
    customer_phone: '5565576829',
    loyverse_customer_id: 'dc7f328c-58d2-493d-8051-1941145c8973',
    total: 180.00,
    notes: '',
    service_type: 'pickup',
    delivery_address: null,
    delivery_fee: null,
    delivery_fee_confirmed: false,
    delivery_lat: null,
    delivery_lng: null,
    delivery_distance_km: null,
    items: [
      { name: 'Burrito de Pollo', price: 85, quantity: 1, customizations: { extras: ['Sin pepino'] } },
      { name: 'Ensalada', size: 'Chica', price: 95, quantity: 1, customizations: { proteins: ['Pechuga Empanizada'], toppings: ['Aguacate', 'Blueberry', 'Pasta', 'Mango'], dressings: ['Cilantro'], seedsAndNuts: ['Almendra', 'Nuez'] } }
    ]
  }
];

// ── Helpers ────────────────────────────────────────────────────────────────────
function formatCustomizations(item) {
  const parts = [];
  const c = item.customizations || {};
  if (item.size) parts.push(`Opción: ${item.size}`);
  if (c.proteins?.length)    parts.push(`Prot: ${c.proteins.join(', ')}`);
  if (c.toppings?.length)    parts.push(`Top: ${c.toppings.join(', ')}`);
  if (c.seedsAndNuts?.length) parts.push(`Semillas: ${c.seedsAndNuts.join(', ')}`);
  if (c.dressings?.length)   parts.push(`Aderezo: ${c.dressings.join(', ')}`);
  if (c.flavors?.length)     parts.push(`Sabor: ${c.flavors.join(', ')}`);
  if (c.extras?.length) {
    const sinItems = c.extras.filter(x => x.toLowerCase().startsWith('sin '));
    const otherExtras = c.extras.filter(x => !x.toLowerCase().startsWith('sin '));
    if (sinItems.length)   parts.push(`EXCLUSIONES: ${sinItems.join(', ')}`);
    if (otherExtras.length) parts.push(`Extras: ${otherExtras.join(', ')}`);
  }
  return parts.join(' | ');
}

function buildNote(order) {
  let serviceText = '[PARA RECOGER EN SUCURSAL]';
  if (order.service_type === 'delivery') {
    const mapsLink = order.delivery_lat ? ` | 📍 maps.google.com/?q=${order.delivery_lat},${order.delivery_lng}` : '';
    const dist = order.delivery_distance_km ? ` | ${order.delivery_distance_km} km` : '';
    const fee  = order.delivery_fee_confirmed && order.delivery_fee ? ` | Tarifa: $${order.delivery_fee}` : '';
    serviceText = `[ENVÍO] Dir: ${order.delivery_address || 'No especificada'}${mapsLink}${dist}${fee}`;
  }
  let note = `${serviceText} | [RECUPERADO — YA PAGADO WEB / SPEI]\nPedido Web #${order.id.slice(-4).toUpperCase()} | Cliente: ${order.customer_name} (${order.customer_phone})\nNotas: ${order.notes || 'Ninguna'}`;
  if (note.length > 255) note = note.slice(0, 252) + '...';
  return note;
}

// ── Crear recibo en Loyverse ───────────────────────────────────────────────────
async function createReceipt(order) {
  // Line items de productos
  const lineItems = order.items.map(item => {
    let note = formatCustomizations(item);
    if (note.length > 255) note = note.slice(0, 252) + '...';
    return {
      variant_id: LOYVERSE_GENERIC_VARIANT_ID,
      quantity: item.quantity,
      price: item.price,
      line_note: note || undefined
    };
  });

  // Line item extra para el costo de envío
  if (order.service_type === 'delivery' && order.delivery_fee && order.delivery_fee > 0) {
    lineItems.push({
      variant_id: LOYVERSE_GENERIC_VARIANT_ID,
      quantity: 1,
      price: order.delivery_fee,
      line_note: 'Costo de Envío a Domicilio'
    });
  }

  const payload = {
    store_id: LOYVERSE_STORE_ID,
    note: buildNote(order),
    line_items: lineItems,
    payments: [{ payment_type_id: LOYVERSE_TRANSFERENCIA_PT, amount: order.total }]
  };

  if (order.loyverse_customer_id) {
    payload.customer_id = order.loyverse_customer_id;
  }

  console.log(`   📦 Payload note: ${payload.note.slice(0, 80)}...`);
  console.log(`   📦 Items: ${lineItems.length} | Total: $${order.total}`);

  const res = await fetch(`${LOYVERSE_API_URL}/receipts`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOYVERSE_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Loyverse API ${res.status}: ${text}`);
  }

  const data = JSON.parse(text);
  return {
    receipt_id: data.receipt_number,
    receipt_number: data.receipt_number
  };
}

// ── Actualizar Supabase con el receipt_id ──────────────────────────────────────
async function updateSupabase(orderId, receiptId, receiptNumber) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${orderId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'apikey': SUPABASE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({
      loyverse_receipt_id: receiptId,
      loyverse_receipt_number: receiptNumber
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase update failed: ${text}`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log('═══════════════════════════════════════════════════════════');
console.log('  RECUPERACIÓN DE PEDIDOS EN LOYVERSE — EDEN MENÚ');
console.log(`  ${ORDERS_TO_RECOVER.length} pedidos a recuperar`);
console.log('═══════════════════════════════════════════════════════════\n');

let success = 0;
let failed  = 0;

for (const order of ORDERS_TO_RECOVER) {
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📋 Orden #${order.id.slice(-4).toUpperCase()} — ${order.customer_name} | $${order.total} | ${order.service_type}`);

  try {
    // 1. Crear en Loyverse
    const result = await createReceipt(order);
    console.log(`   ✅ Recibo creado en Loyverse: #${result.receipt_number}`);

    // 2. Actualizar Supabase
    await updateSupabase(order.id, result.receipt_id, result.receipt_number);
    console.log(`   ✅ BD actualizada: loyverse_receipt_id = "${result.receipt_id}"`);

    success++;
  } catch (err) {
    console.error(`   ❌ ERROR: ${err.message}`);
    failed++;
  }

  // Pausa pequeña para no saturar la API
  await new Promise(r => setTimeout(r, 800));
}

console.log('\n═══════════════════════════════════════════════════════════');
console.log(`  RESULTADO: ${success} exitosos | ${failed} fallidos`);
if (failed === 0) {
  console.log('  🎉 Todos los pedidos fueron sincronizados con Loyverse.');
  console.log('  👆 Verifica en Loyverse POS que aparecen los 4 recibos.');
  console.log('  ⚠️  Recuerda anular los recibos de PRUEBA #0031 y #0032.');
} else {
  console.log('  ⚠️  Algunos pedidos fallaron. Revisa los errores arriba.');
}
console.log('═══════════════════════════════════════════════════════════\n');
