import { NextResponse } from 'next/server';
import { getLoyaltyInfoFromLoyverse } from '@/lib/loyalty';
import { createAdminClient } from '@/lib/supabase';

export async function GET() {
  try {
    const userId = '2162cedc-4e28-48a3-8829-49e863a349e5'; // Juan Jesus
    const adminSupabase = createAdminClient();
    
    const { data: user } = await adminSupabase
      .from('users')
      .select('loyverse_customer_id')
      .eq('id', userId)
      .single();

    const loyaltyData = await getLoyaltyInfoFromLoyverse(user?.loyverse_customer_id || '', userId);
    
    const { data: orders } = await adminSupabase
      .from('orders')
      .select('total')
      .eq('user_id', userId)
      .neq('status', 'cancelled');

    return NextResponse.json({
      success: true,
      user_loyverse_id: user?.loyverse_customer_id,
      loyaltyData,
      orders_count: orders?.length || 0,
      orders
    });
  } catch(e: any) {
    return NextResponse.json({ error: e.message });
  }
}
