/**
 * SCRIPT DE DIAGNÓSTICO — Loyverse API
 * Ejecutar con: node scripts/diagnose-loyverse.mjs
 *
 * Simula EXACTAMENTE la misma llamada que hace approve-payment/route.ts
 * para encontrar el error real que impide que los recibos lleguen a Loyverse.
 */

// ── Variables (copiadas de .env.local) ────────────────────────────────────────
const LOYVERSE_ACCESS_TOKEN       = '2d42d924c5f34c87b3a739869563c018';
const LOYVERSE_STORE_ID           = 'c1fea6f1-4c96-4126-97b4-42dd73762277';
const LOYVERSE_GENERIC_VARIANT_ID = 'c95f3b58-2c7f-4a8f-b050-968d269e7ce6';
const LOYVERSE_API_URL            = 'https://api.loyverse.com/v1.0';

// ── Paso 1: Probar autenticación ───────────────────────────────────────────────
async function testAuth() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📡 PASO 1: Probando token de Loyverse...');
  console.log(`   Token: ${LOYVERSE_ACCESS_TOKEN.slice(0, 8)}...`);

  const res = await fetch(`${LOYVERSE_API_URL}/payment_types`, {
    headers: { 'Authorization': `Bearer ${LOYVERSE_ACCESS_TOKEN}` }
  });

  const text = await res.text();
  console.log(`   HTTP Status: ${res.status} ${res.statusText}`);

  if (!res.ok) {
    console.error('❌ AUTH FAILED — Token inválido o expirado');
    console.error('   Response:', text);
    return null;
  }

  const data = JSON.parse(text);
  console.log('✅ Token válido. Payment types disponibles:');
  (data.payment_types || []).forEach(p => {
    console.log(`   - [${p.type}] "${p.name}" → ID: ${p.id}`);
  });
  return data.payment_types || [];
}

// ── Paso 2: Verificar LOYVERSE_GENERIC_VARIANT_ID ────────────────────────────
async function testGenericVariant() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📡 PASO 2: Verificando LOYVERSE_GENERIC_VARIANT_ID...');
  console.log(`   Variant ID: ${LOYVERSE_GENERIC_VARIANT_ID}`);

  const res = await fetch(`${LOYVERSE_API_URL}/items?variant_ids=${LOYVERSE_GENERIC_VARIANT_ID}`, {
    headers: { 'Authorization': `Bearer ${LOYVERSE_ACCESS_TOKEN}` }
  });

  const text = await res.text();
  console.log(`   HTTP Status: ${res.status} ${res.statusText}`);

  if (!res.ok) {
    console.error('❌ No se pudo consultar items');
    console.error('   Response:', text);
    return false;
  }

  const data = JSON.parse(text);
  const items = data.items || [];
  if (items.length === 0) {
    console.warn('⚠️  VARIANT_ID NO ENCONTRADO en Loyverse — Este ID fue eliminado');
    console.warn('   Esto causa error 422 al crear recibos');
    return false;
  }

  console.log(`✅ Variant encontrado en item: "${items[0].item_name}"`);
  return true;
}

// ── Paso 3: Crear recibo de PRUEBA ($1 peso) ──────────────────────────────────
async function testCreateReceipt(paymentTypes) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📡 PASO 3: Intentando crear recibo de PRUEBA ($1)...');

  const otherPT = paymentTypes.find(p => p.type === 'OTHER');
  const payments = otherPT
    ? [{ payment_type_id: otherPT.id, amount: 1 }]
    : [{ type: 'OTHER', amount: 1 }];

  const payload = {
    store_id: LOYVERSE_STORE_ID,
    note: '[TEST DIAGNÓSTICO] Recibo de prueba — ignorar',
    line_items: [
      {
        variant_id: LOYVERSE_GENERIC_VARIANT_ID,
        quantity: 1,
        price: 1,
        line_note: 'Prueba de conexión'
      }
    ],
    payments
  };

  console.log('   Payload:', JSON.stringify(payload, null, 2));

  const res = await fetch(`${LOYVERSE_API_URL}/receipts`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOYVERSE_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const text = await res.text();
  console.log(`\n   HTTP Status: ${res.status} ${res.statusText}`);

  if (!res.ok) {
    console.error('\n❌ ERROR AL CREAR RECIBO — Este es el bug exacto:');
    console.error('   ════════════════════════════════════');
    console.error('  ', text);
    console.error('   ════════════════════════════════════');

    if (res.status === 401) {
      console.error('\n🔍 DIAGNÓSTICO: Token inválido, expirado o revocado');
      console.error('   ACCIÓN: Regenerar token en Loyverse → Settings → API');
    } else if (res.status === 422) {
      console.error('\n🔍 DIAGNÓSTICO: Datos inválidos (variant_id, store_id, o payment_type)');
    } else if (res.status === 403) {
      console.error('\n🔍 DIAGNÓSTICO: Token sin permisos para crear recibos');
    }
    return;
  }

  const data = JSON.parse(text);
  console.log('\n✅ RECIBO DE PRUEBA CREADO EXITOSAMENTE');
  console.log('   Receipt ID:', data.id || data.receipt_id);
  console.log('   Receipt #:', data.receipt_number);
  console.log('\n⚠️  Anula este recibo manualmente en Loyverse POS (es de prueba).');
  console.log('\n🔍 La conexión funciona. El bug está en el payload de recibos reales.');
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log('═══════════════════════════════════════════════════');
console.log('   DIAGNÓSTICO LOYVERSE API — EDEN MENÚ');
console.log('═══════════════════════════════════════════════════');

try {
  const paymentTypes = await testAuth();
  if (!paymentTypes) process.exit(1);
  await testGenericVariant();
  await testCreateReceipt(paymentTypes);
} catch (err) {
  console.error('\n💥 ERROR DE RED / EXCEPCIÓN:', err.message);
}

console.log('\n═══════════════════════════════════════════════════\n');
