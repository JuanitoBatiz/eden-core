import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import { getLoyaltyInfoFromLoyverse } from '@/lib/loyalty';

const JWT_QR_SECRET = process.env.JWT_QR_SECRET || 'fallback_qr_secret_for_dev';

// POST: Validar token QR de EdenPass en el mostrador
export async function POST(req: Request) {
  try {
    // 1. Solo cajeros/owners pueden validar QRs
    let tokenPayload;
    try {
      tokenPayload = await requireRole(req, 'cashier');
    } catch (authErr: any) {
      if (authErr.message.includes('403')) {
        return NextResponse.json({ error: 'insufficient_permissions', required_role: authErr.required_role, your_role: authErr.your_role }, { status: 403 });
      }
      return NextResponse.json({ error: authErr.message || 'No autorizado' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Configuración DB ausente' }, { status: 500 });
    }

    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

    // 2. Parsear Payload
    const body = await req.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json({ error: 'Código QR no proporcionado.' }, { status: 400 });
    }

    // 3. Validar JWT QR
    let decodedQR: any;
    try {
      decodedQR = jwt.verify(token, JWT_QR_SECRET);
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        return NextResponse.json({ error: 'Código QR expirado, pide al cliente que lo actualice' }, { status: 400 });
      }
      return NextResponse.json({ error: 'Código QR inválido' }, { status: 400 });
    }

    // 4. Validar Tipo (Previene inyección de access_tokens de sesión)
    if (decodedQR.type !== 'edenpass_qr') {
      return NextResponse.json({ error: 'Código QR inválido (tipo incorrecto)' }, { status: 400 });
    }

    const targetUserId = decodedQR.user_id;

    // 5. Buscar perfil del cliente
    const { data: customer, error: customerErr } = await adminSupabase
      .from('users')
      .select('id, name, phone, loyverse_customer_id')
      .eq('id', targetUserId)
      .single();

    if (customerErr || !customer) {
      return NextResponse.json({ error: 'Cliente no registrado en la plataforma' }, { status: 404 });
    }

    // 6. Consultar Loyverse para puntos en vivo usando la librería compartida
    let loyverseData = { loyalty_points: 0, loyalty_tier: 'Estándar' };
    if (customer.loyverse_customer_id) {
      loyverseData = await getLoyaltyInfoFromLoyverse(customer.loyverse_customer_id);
    }

    // 7. Retornar Perfil
    return NextResponse.json({
      success: true,
      customer: {
        user_id: customer.id,
        name: customer.name || 'Sin nombre',
        phone: customer.phone,
        loyalty_points: loyverseData.loyalty_points,
        loyalty_tier: loyverseData.loyalty_tier
      }
    });

  } catch (error: any) {
    console.error('QR validate error:', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
