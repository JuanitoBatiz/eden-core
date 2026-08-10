const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing URL or KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(url, key);

async function testUpdate() {
  console.log('Fetching an order in awaiting_payment state...');
  
  // Try to find an order that is awaiting_payment
  const { data: order, error: fetchErr } = await supabase
    .from('orders')
    .select('id, status, payment_status, payment_method')
    .eq('status', 'awaiting_payment')
    .limit(1)
    .single();

  if (fetchErr) {
    if (fetchErr.code === 'PGRST116') {
      console.log('No awaiting_payment orders found. Trying to find ANY order to test the update constraint.');
      const { data: anyOrder, error: anyFetchErr } = await supabase
        .from('orders')
        .select('id')
        .limit(1)
        .single();
      
      if (anyOrder) {
        await runUpdate(anyOrder.id);
      } else {
        console.error('No orders found in the database at all.');
      }
    } else {
      console.error('Error fetching order:', fetchErr);
    }
    return;
  }

  console.log('Found order:', order.id);
  await runUpdate(order.id);
}

async function runUpdate(orderId) {
  console.log(`\nAttempting to update order ${orderId} with pay-physical payload...`);
  
  // This is the EXACT update payload from pay-physical/route.ts
  const { data, error } = await supabase
    .from('orders')
    .update({
      status: 'in_preparation',
      payment_status: 'payment_approved',
      payment_method: 'efectivo'
    })
    .eq('id', orderId)
    .select();

  if (error) {
    console.error('\n❌ DATABASE UPDATE FAILED!');
    console.error('Error Details:', JSON.stringify(error, null, 2));
  } else {
    console.log('\n✅ UPDATE SUCCEEDED!', data);
    // Revert back so we don't mess up their actual data
    console.log('Reverting changes...');
    await supabase.from('orders').update({
      status: 'awaiting_payment',
      payment_status: 'pending_payment',
      payment_method: null
    }).eq('id', orderId);
  }
}

testUpdate();
