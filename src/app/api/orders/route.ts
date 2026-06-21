import { NextResponse } from 'next/server';
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase';
import { createLoyverseReceipt } from '@/lib/loyverse';
import { requireRole, verifyAccessToken } from '@/lib/auth';
import { OrderCreateRequest } from '@/types/api-contracts';
import { calculateOrderTotal } from '@/lib/pricing';

// GET: Consultar órdenes (Admin/Cashier)
export async function GET(req: Request) {
  try {
    let tokenPayload;
    try {
      tokenPayload = await requireRole(req, 'cashier');
    } catch (authErr: any) {
      if (authErr.message.includes('403')) {
        return NextResponse.json({ error: 'insufficient_permissions', required_role: authErr.required_role, your_role: authErr.your_role }, { status: 403 });
      }
      return NextResponse.json({ error: authErr.message || 'No autorizado' }, { status: 401 });
    }

    // Endpoint protegido por requireRole → usar adminClient para bypassear RLS
    const adminSupabase = createAdminClient();

    const { searchParams } = new URL(req.url);
    const statusQuery = searchParams.get('status');

    let query = adminSupabase
      .from('orders')
      .select('*')
      .in('status', ['received', 'in_preparation', 'delivered', 'cancelled'])
      .order('created_at', { ascending: true });

    if (statusQuery) {
      query = query.eq('status', statusQuery);
    }

    const { data, error } = await query;

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, orders: data });

  } catch (error: any) {
    console.error('Fetch admin orders error:', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    // 1. Autenticación — debe ocurrir antes de cualquier operación
    let tokenPayload;
    try {
      tokenPayload = await requireRole(req, 'customer');
    } catch (authErr: any) {
      if (authErr.message.includes('403')) {
        return NextResponse.json({ error: 'insufficient_permissions', required_role: authErr.required_role, your_role: authErr.your_role }, { status: 403 });
      }
      return NextResponse.json({ error: authErr.message || 'No autorizado' }, { status: 401 });
    }

    if (!isSupabaseConfigured) {
      return NextResponse.json({ error: 'Configuración de base de datos ausente.' }, { status: 500 });
    }

    // Endpoint protegido por requireRole → usar adminClient para bypassear RLS
    const adminSupabase = createAdminClient();

    const orderData = await req.json();
    const { customer_name, customer_phone, customer_email, items, notes } = orderData as OrderCreateRequest;

    if (!customer_name || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'Información de orden incompleta.' },
        { status: 400 }
      );
    }

    // 2. Fetch all products referenced in the cart (requiere adminClient — tabla products tiene RLS)
    const productIds = items.map((i: any) => i.id);
    const { data: dbProducts, error: prodErr } = await adminSupabase
      .from('products')
      .select(`
        *,
        variants(*),
        modifier_groups(
          *,
          modifiers(*)
        )
      `)
      .in('id', productIds);

    if (prodErr || !dbProducts) {
      throw new Error('Error al consultar productos en la base de datos.');
    }

    // 3. Pricing & Validation en servidor (el cliente no puede manipular precios)
    const { total, conflicts, validItems } = calculateOrderTotal(items, dbProducts);

    if (conflicts.length > 0) {
      return NextResponse.json(
        { error: 'item_unavailable', conflicts },
        { status: 409 }
      );
    }

    // 4. Insert en Supabase (requiere adminClient — tabla orders tiene RLS)
    const newOrder = {
      user_id: tokenPayload.user_id,
      customer_name,
      customer_phone: customer_phone || tokenPayload.phone || '',
      customer_email: customer_email || null,
      items: validItems,
      total,
      notes: notes || '',
      status: 'received',
      payment_status: 'pending_payment'
    };

    const { data: createdOrder, error: insertErr } = await adminSupabase
      .from('orders')
      .insert([newOrder])
      .select()
      .single();

    if (insertErr || !createdOrder) {
      throw new Error(`Error al crear la orden: ${insertErr?.message}`);
    }

    // 5. Sincronización asíncrona con Loyverse (no bloquea la respuesta al cliente)
    createLoyverseReceipt({
      id: createdOrder.id,
      customer_name: createdOrder.customer_name,
      customer_phone: createdOrder.customer_phone,
      items: createdOrder.items,
      total: createdOrder.total,
      notes: createdOrder.notes
    }).then(async (loyverseResult) => {
      if (loyverseResult.receipt_id) {
        await adminSupabase
          .from('orders')
          .update({
            loyverse_receipt_id: loyverseResult.receipt_id,
            loyverse_receipt_number: loyverseResult.receipt_number
          })
          .eq('id', createdOrder.id);
      }
    }).catch(err => {
      console.error('Error synchronizing with Loyverse POS:', err);
    });

    return NextResponse.json({
      success: true,
      order: {
        id: createdOrder.id,
        total: createdOrder.total,
        status: createdOrder.status,
        payment_status: createdOrder.payment_status
      }
    }, { status: 201 });

  } catch (error: any) {
    console.error('Order creation error:', error);
    return NextResponse.json(
      { error: 'Error interno al crear el pedido.' },
      { status: 500 }
    );
  }
}
