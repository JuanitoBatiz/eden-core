import { NextResponse } from 'next/server';
import { getLoyaltyInfoFromLoyverse } from '@/lib/loyalty';
import { createAdminClient } from '@/lib/supabase';
import { requireRole } from '@/lib/auth';

export async function GET(req: Request) {
  // En producción: solo accesible para el dueño autenticado
  if (process.env.NODE_ENV === 'production') {
    try {
      await requireRole(req, 'owner');
    } catch {
      // No revelar que el endpoint existe: responder siempre 404 en producción sin auth de owner
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
  }

  try {
    const adminSupabase = createAdminClient();

    // Usar el primer usuario disponible (modo diagnóstico seguro)
    const { data: firstUser } = await adminSupabase
      .from('users')
      .select('id, loyverse_customer_id')
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (!firstUser) {
      return NextResponse.json({ error: 'No users found in database' }, { status: 404 });
    }

    const loyaltyData = await getLoyaltyInfoFromLoyverse(firstUser.loyverse_customer_id || '', firstUser.id);

    const { data: orders } = await adminSupabase
      .from('orders')
      .select('total')
      .eq('user_id', firstUser.id)
      .neq('status', 'cancelled');

    return NextResponse.json({
      success: true,
      user_id: firstUser.id,
      user_loyverse_id: firstUser.loyverse_customer_id,
      loyaltyData,
      orders_count: orders?.length || 0,
      orders
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Error desconocido';
    return NextResponse.json({ error: message });
  }
}

