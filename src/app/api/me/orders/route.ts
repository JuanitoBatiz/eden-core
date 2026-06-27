import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';

export async function GET(req: Request) {
  try {
    let tokenPayload;
    try {
      tokenPayload = await requireRole(req, 'customer');
    } catch (authErr: any) {
      return NextResponse.json({ success: true, active_orders: [] });
    }

    const adminSupabase = createAdminClient();

    const { data, error } = await adminSupabase
      .from('orders')
      .select('id, status, created_at')
      .eq('user_id', tokenPayload.user_id)
      .in('status', ['received', 'in_preparation', 'ready', 'in_transit'])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching active orders for user:', error);
      return NextResponse.json({ success: true, active_orders: [] });
    }

    return NextResponse.json({ success: true, active_orders: data });

  } catch (error: any) {
    console.error('Unexpected error in /api/me/orders:', error);
    return NextResponse.json({ success: true, active_orders: [] });
  }
}
