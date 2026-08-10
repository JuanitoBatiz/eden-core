const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key);

async function testUpdate() {
  const { data: order, error: fetchErr } = await supabase
    .from('orders')
    .select('id')
    .limit(1)
    .single();

  if (order) {
    console.log('Testing proof update...');
    const { error } = await supabase
      .from('orders')
      .update({
        payment_status: 'payment_submitted'
      })
      .eq('id', order.id);
      
    if (error) console.log('PROOF UPDATE ERROR:', error);
    else console.log('PROOF UPDATE SUCCESS');
  } else {
    console.log(fetchErr);
  }
}
testUpdate();
