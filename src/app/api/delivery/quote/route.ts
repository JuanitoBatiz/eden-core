/**
 * POST /api/delivery/quote
 * Cotiza la tarifa de envío dado un par de coordenadas (lat, lng).
 *
 * FLUJO:
 * 1. Leer las coordenadas del restaurante desde la tabla `settings`.
 * 2. Si hay GOOGLE_MAPS_SERVER_API_KEY configurada → llamar a Distance Matrix API (distancia real por carretera).
 *    Si NO hay key configurada → usar fórmula Haversine (distancia en línea recta, ~15% menos que por carretera).
 * 3. Buscar la zona correspondiente en `delivery_zones`.
 * 4. Retornar la cotización SIN guardarla (se guarda solo al crear la orden).
 *
 * RATE LIMITING: 30 cotizaciones por IP por minuto (evitar abuse de Distance Matrix API).
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { checkRateLimit, getClientIP } from '@/lib/rateLimit';

// ── Haversine (fallback sin API key) ───────────────────────────────────────────
function haversineDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Radio de la Tierra en km
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

// ── Google Distance Matrix (cuando hay API key) ────────────────────────────────
async function getGoogleDistanceKm(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  apiKey: string
): Promise<number | null> {
  try {
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originLat},${originLng}&destinations=${destLat},${destLng}&mode=driving&language=es&key=${apiKey}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });

    if (!res.ok) {
      console.error('Distance Matrix API HTTP error:', res.status);
      return null;
    }

    const data = await res.json();
    const element = data?.rows?.[0]?.elements?.[0];

    if (element?.status !== 'OK') {
      console.error('Distance Matrix element status:', element?.status);
      return null;
    }

    // La API retorna distancia en metros
    return element.distance.value / 1000;
  } catch (err) {
    console.error('Distance Matrix API fetch error:', err);
    return null;
  }
}

export async function POST(req: Request) {
  try {
    // Rate limiting: 30 cotizaciones por IP por minuto
    const ip = getClientIP(req);
    const rateLimitResult = checkRateLimit(`delivery_quote:ip:${ip}`, 30, 60);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Demasiadas solicitudes. Intenta en un momento.' },
        { status: 429, headers: { 'Retry-After': String(rateLimitResult.retryAfterSeconds) } }
      );
    }

    const body = await req.json();
    let { lat, lng, address_text } = body;

    const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY || '';

    // If we only got text (fallback mode without Maps loaded on client)
    if ((lat === undefined || lng === undefined) && address_text && apiKey) {
      try {
        const geoRes = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address_text + ', México')}&key=${apiKey}`);
        const geoData = await geoRes.json();
        if (geoData.status === 'OK' && geoData.results?.[0]?.geometry?.location) {
          lat = geoData.results[0].geometry.location.lat;
          lng = geoData.results[0].geometry.location.lng;
        }
      } catch (e) {
        console.error('Server geocoding failed', e);
      }
    }

    if (lat === undefined || lng === undefined || typeof lat !== 'number' || typeof lng !== 'number') {
      return NextResponse.json(
        { error: 'Se requieren coordenadas válidas o una dirección de texto para cotizar el envío.' },
        { status: 400 }
      );
    }

    const adminSupabase = createAdminClient();

    // 1. Obtener coordenadas del restaurante desde settings
    const { data: settingData, error: settingErr } = await adminSupabase
      .from('settings')
      .select('value')
      .eq('key', 'restaurant_location')
      .single();

    if (settingErr || !settingData) {
      console.error('Error fetching restaurant_location from settings:', settingErr);
      return NextResponse.json(
        { error: 'No se pudo obtener la ubicación del restaurante.' },
        { status: 500 }
      );
    }

    const restaurantLocation = settingData.value as { lat: number; lng: number };
    const originLat = restaurantLocation.lat;
    const originLng = restaurantLocation.lng;

    // 2. Calcular distancia
    const googleApiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY;
    let distanceKm: number;
    let calculationMethod: 'google_distance_matrix' | 'haversine_fallback';

    if (googleApiKey) {
      const googleDistance = await getGoogleDistanceKm(originLat, originLng, lat, lng, googleApiKey);
      if (googleDistance !== null) {
        const straightDistance = haversineDistanceKm(originLat, originLng, lat, lng);
        distanceKm = Math.max(googleDistance, straightDistance);
        calculationMethod = 'google_distance_matrix';
      } else {
        // Fallback si Google falla
        distanceKm = haversineDistanceKm(originLat, originLng, lat, lng);
        calculationMethod = 'haversine_fallback';
        console.warn('Falling back to Haversine distance calculation');
      }
    } else {
      distanceKm = haversineDistanceKm(originLat, originLng, lat, lng);
      calculationMethod = 'haversine_fallback';
    }

    // Límite máximo operativo estricto (5.0 km) basado en la tabla de zonas
    if (distanceKm > 5.0) {
      return NextResponse.json({
        success: true,
        in_range: false,
        message: `Tu ubicación está a ${distanceKm.toFixed(1)} km. Por el momento nuestro límite de entrega a domicilio es de 5.0 km. ¡Te invitamos a visitarnos o recoger tu pedido en tienda!`
      });
    }

    // 3. Buscar la zona de entrega correspondiente
    const { data: zones, error: zonesErr } = await adminSupabase
      .from('delivery_zones')
      .select('id, label, max_distance_km, fee')
      .eq('active', true)
      .order('max_distance_km', { ascending: true });

    if (zonesErr || !zones) {
      console.error('Error fetching delivery zones:', zonesErr);
      return NextResponse.json(
        { error: 'No se pudieron obtener las zonas de entrega.' },
        { status: 500 }
      );
    }

    // Encontrar la primera zona cuya max_distance_km sea >= distanceKm
    const matchedZone = zones.find((z) => z.max_distance_km >= distanceKm);

    if (!matchedZone) {
      // Fuera de zona de entrega
      return NextResponse.json({
        success: true,
        in_range: false,
        distance_km: Math.round(distanceKm * 10) / 10,
        fee: null,
        zone: null,
        calculation_method: calculationMethod,
        message: 'Lo sentimos, por ahora no llegamos hasta esa ubicación.'
      });
    }

    return NextResponse.json({
      success: true,
      in_range: true,
      distance_km: Math.round(distanceKm * 10) / 10,
      fee: matchedZone.fee,
      zone: {
        id: matchedZone.id,
        label: matchedZone.label,
        max_distance_km: matchedZone.max_distance_km,
        fee: matchedZone.fee,
      },
      calculation_method: calculationMethod,
      lat: lat,
      lng: lng
    });

  } catch (error: any) {
    console.error('Unexpected error in POST /api/delivery/quote:', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
