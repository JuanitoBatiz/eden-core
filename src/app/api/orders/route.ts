import { NextResponse } from 'next/server';
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase';
import { requireRole, verifyAccessToken } from '@/lib/auth';
import { OrderCreateRequest } from '@/types/api-contracts';
import { calculateOrderTotal } from '@/lib/pricing';

// ── Haversine helper (mismo que en /api/delivery/quote) ────────────────────────
function haversineDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const straightLine = R * c;
  // Penalty for road distance approximation (~25% more than straight line)
  return straightLine * 1.25;
}

async function getGoogleDistanceKm(
  originLat: number, originLng: number,
  destLat: number, destLng: number,
  apiKey: string
): Promise<number | null> {
  try {
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originLat},${originLng}&destinations=${destLat},${destLng}&mode=driving&language=es&key=${apiKey}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const data = await res.json();
    const element = data?.rows?.[0]?.elements?.[0];
    if (element?.status !== 'OK') return null;
    return element.distance.value / 1000;
  } catch { return null; }
}

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
      .in('status', ['received', 'in_preparation', 'ready', 'in_transit', 'delivered', 'cancelled'])
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
    const {
      customer_name, customer_phone, customer_email, items, notes, service_type,
      delivery_address, delivery_lat, delivery_lng, delivery_zone_id
    } = orderData as OrderCreateRequest;

    if (!customer_name || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'Información de orden incompleta.' },
        { status: 400 }
      );
    }

    // 2. Validación adicional para delivery: se requieren coordenadas
    if (service_type === 'delivery') {
      if (typeof delivery_lat !== 'number' || typeof delivery_lng !== 'number') {
        return NextResponse.json(
          { error: 'Para pedidos a domicilio se requieren las coordenadas de entrega.' },
          { status: 400 }
        );
      }
      if (!delivery_address) {
        return NextResponse.json(
          { error: 'Para pedidos a domicilio se requiere la dirección de entrega.' },
          { status: 400 }
        );
      }
    }

    // 3. Fetch all products referenced in the cart (requiere adminClient — tabla products tiene RLS)
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

    // 4. Pricing & Validation en servidor (el cliente no puede manipular precios)
    let { total, conflicts, validItems } = calculateOrderTotal(items, dbProducts);

    if (conflicts.length > 0) {
      return NextResponse.json(
        { error: 'item_unavailable', conflicts },
        { status: 409 }
      );
    }

    // 5. Calcular y validar tarifa de delivery en el servidor (seguridad: el cliente no puede manipularla)
    let serverDeliveryFee: number | null = null;
    let serverDistanceKm: number | null = null;
    let resolvedZoneId: string | null = null;

    if (service_type === 'delivery' && typeof delivery_lat === 'number' && typeof delivery_lng === 'number') {
      // 5a. Obtener coordenadas del restaurante desde settings
      const { data: settingData } = await adminSupabase
        .from('settings')
        .select('value')
        .eq('key', 'restaurant_location')
        .single();

      const restaurantLoc = settingData?.value as { lat: number; lng: number } | undefined;
      const originLat = restaurantLoc?.lat ?? 19.6997;
      const originLng = restaurantLoc?.lng ?? -98.7628;

      // 5b. Calcular distancia (Google o Haversine como fallback)
      const googleApiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY;
      if (googleApiKey) {
        const googleDist = await getGoogleDistanceKm(originLat, originLng, delivery_lat, delivery_lng, googleApiKey);
        serverDistanceKm = googleDist ?? haversineDistanceKm(originLat, originLng, delivery_lat, delivery_lng);
      } else {
        serverDistanceKm = haversineDistanceKm(originLat, originLng, delivery_lat, delivery_lng);
      }
      
      // 5b. Distancia no debe exceder límite rígido
      if (serverDistanceKm > 30) {
        return NextResponse.json({ error: 'La dirección supera nuestro límite máximo de distancia operativa (30 km).' }, { status: 422 });
      }

      // 5c. Buscar la zona de entrega correspondiente en la BD
      const { data: zones } = await adminSupabase
        .from('delivery_zones')
        .select('id, label, max_distance_km, fee, min_order_amount')
        .eq('active', true)
        .order('max_distance_km', { ascending: true });

      const matchedZone = (zones ?? []).find((z: any) => z.max_distance_km >= serverDistanceKm!);

      if (!matchedZone) {
        return NextResponse.json(
          { error: 'La dirección indicada está fuera de nuestra zona de entrega.' },
          { status: 422 }
        );
      }

      if (matchedZone.min_order_amount && total < matchedZone.min_order_amount) {
        return NextResponse.json(
          { error: `El pedido mínimo para esta zona es de $${matchedZone.min_order_amount}. Te faltan $${(matchedZone.min_order_amount - total).toFixed(2)}.` },
          { status: 422 }
        );
      }

      serverDeliveryFee = matchedZone.fee;
      resolvedZoneId = matchedZone.id;
      total += matchedZone.fee; // ADD DELIVERY FEE TO TOTAL!
    }

    // 6. Insert en Supabase (requiere adminClient — tabla orders tiene RLS)
    const newOrder: Record<string, any> = {
      user_id: tokenPayload.user_id,
      customer_name,
      customer_phone: customer_phone || tokenPayload.phone || '',
      customer_email: customer_email || null,
      items: validItems,
      total,
      notes: notes || '',
      service_type: service_type || 'pickup',
      delivery_address: delivery_address || null,
      status: 'received',
      payment_status: 'pending_payment'
    };

    // Campos de delivery — solo se añaden cuando service_type === 'delivery'
    if (service_type === 'delivery') {
      newOrder.delivery_lat = delivery_lat;
      newOrder.delivery_lng = delivery_lng;
      newOrder.delivery_distance_km = serverDistanceKm !== null
        ? Math.round(serverDistanceKm * 10) / 10
        : null;
      newOrder.delivery_fee = serverDeliveryFee;
      // Se auto-confirma si el servidor calculó la tarifa exitosamente
      newOrder.delivery_fee_confirmed = serverDeliveryFee !== null;
      newOrder.delivery_zone_id = resolvedZoneId;
    }

    const { data: createdOrder, error: insertErr } = await adminSupabase
      .from('orders')
      .insert([newOrder])
      .select()
      .single();

    if (insertErr || !createdOrder) {
      throw new Error(`Error al crear la orden: ${insertErr?.message}`);
    }

    return NextResponse.json({
      success: true,
      order: {
        id: createdOrder.id,
        total: createdOrder.total,
        status: createdOrder.status,
        payment_status: createdOrder.payment_status,
        delivery_fee: createdOrder.delivery_fee,
        delivery_fee_confirmed: createdOrder.delivery_fee_confirmed,
        delivery_distance_km: createdOrder.delivery_distance_km,
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
