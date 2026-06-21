import { NextResponse } from 'next/server';
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase';
import { requireRole } from '@/lib/auth';
import { BankConfigCreateRequest } from '@/types/api-contracts';

// GET: Public endpoint to fetch active bank config for payment display
// NOTA: Este es un caso especial — es público (sin auth) pero bank_config también
// tiene RLS. Se usa adminClient porque necesitamos que la lectura siempre funcione.
// No hay riesgo porque solo se exponen 3 campos no sensibles (bank_name, account_holder, clabe).
export async function GET() {
  try {
    if (!isSupabaseConfigured) {
      return NextResponse.json({ error: 'Configuración de base de datos ausente.' }, { status: 500 });
    }

    const adminSupabase = createAdminClient();

    const { data, error } = await adminSupabase
      .from('bank_config')
      .select('bank_name, account_holder, clabe')
      .eq('active', true)
      .limit(1)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: 'No hay configuración bancaria activa, contacta al restaurante.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, config: data });

  } catch (error: any) {
    console.error('Fetch public bank config error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor.' },
      { status: 500 }
    );
  }
}

// POST: Protected endpoint to create a new bank config (Owner only)
export async function POST(req: Request) {
  try {
    let tokenPayload;
    try {
      tokenPayload = await requireRole(req, 'owner');
    } catch (authErr: any) {
      if (authErr.message.includes('403')) {
        return NextResponse.json({ error: 'insufficient_permissions', required_role: authErr.required_role, your_role: authErr.your_role }, { status: 403 });
      }
      return NextResponse.json({ error: authErr.message || 'No autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const { bank_name, account_holder, clabe } = body as BankConfigCreateRequest;

    if (!bank_name || !account_holder || !clabe || clabe.length !== 18) {
      return NextResponse.json(
        { error: 'Datos incompletos o CLABE inválida (debe tener 18 dígitos).' },
        { status: 400 }
      );
    }

    // Endpoint protegido por requireRole → usar adminClient
    const adminSupabase = createAdminClient();

    // Desactivar todas las configs anteriores antes de insertar la nueva
    await adminSupabase
      .from('bank_config')
      .update({ active: false })
      .eq('active', true);

    const { data: newConfig, error } = await adminSupabase
      .from('bank_config')
      .insert([{ bank_name, account_holder, clabe, active: true }])
      .select()
      .single();

    if (error || !newConfig) {
      throw new Error(`DB Error: ${error?.message}`);
    }

    return NextResponse.json({ success: true, config: newConfig }, { status: 201 });

  } catch (error: any) {
    console.error('Update bank config error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor.' },
      { status: 500 }
    );
  }
}
