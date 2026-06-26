import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';
import { RedeemBenefitRequest } from '@/types/api-contracts';

// POST: Registrar un canje manual de puntos (Loyalty)
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const customerId = (await params).id;
    if (!customerId) {
      return NextResponse.json({ error: 'ID de cliente no proporcionado.' }, { status: 400 });
    }

    let tokenPayload;
    try {
      tokenPayload = await requireRole(req, 'cashier');
    } catch (authErr: any) {
      if (authErr.message.includes('403')) {
        return NextResponse.json({ error: 'insufficient_permissions', required_role: authErr.required_role, your_role: authErr.your_role }, { status: 403 });
      }
      return NextResponse.json({ error: authErr.message || 'No autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const { benefit_id, order_id } = body as RedeemBenefitRequest;

    if (!benefit_id) {
      return NextResponse.json({ error: 'El ID del beneficio es obligatorio.' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Configuración de DB ausente' }, { status: 500 });
    }

    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

    // 2. Verify target customer exists
    const { data: customer, error: customerErr } = await adminSupabase
      .from('users')
      .select('id')
      .eq('id', customerId)
      .single();

    if (customerErr || !customer) {
      return NextResponse.json({ error: 'El cliente especificado no existe.' }, { status: 404 });
    }

    // 3. Obtener detalles del beneficio
    const { data: benefit, error: benefitErr } = await adminSupabase
      .from('loyalty_benefits')
      .select('*')
      .eq('id', benefit_id)
      .single();

    if (benefitErr || !benefit) {
      return NextResponse.json({ error: 'El beneficio especificado no existe o no está activo.' }, { status: 404 });
    }

    if (benefit.active === false || benefit.is_active === false) {
      return NextResponse.json({ error: 'Este beneficio se encuentra inactivo.' }, { status: 400 });
    }

    // 4. Register Redemption Locally
    // Nota Crítica: Como se documentó en el plan, la API v1.0 de Loyverse no provee
    // un endpoint para ajustar libremente los puntos de un cliente. Todo se guarda aquí
    // a manera de bitácora para control de sistema (y el cajero aplica el descuento físico).
    const { error: insertErr } = await adminSupabase
      .from('loyalty_redemptions')
      .insert([{
        user_id: customerId,
        cashier_id: tokenPayload.user_id,
        benefit_id: benefit.id,
        benefit_description: benefit.name,
        points_used: benefit.points_required || benefit.points_cost || 0,
        order_id: order_id || null
      }]);

    if (insertErr) {
      throw new Error(`DB Error insertando canje: ${insertErr.message}`);
    }

    return NextResponse.json({ 
      success: true, 
      message: `Canje aplicado exitosamente: ${benefit.name}`,
      benefit_name: benefit.name
    }, { status: 201 });

  } catch (error: any) {
    console.error('Customer redemption error:', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
