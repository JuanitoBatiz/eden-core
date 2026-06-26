import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// No requiere auth en este nivel porque los beneficios son un catálogo público
export const revalidate = 60; // Cache 1 min

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''; // Usamos anon key porque le dimos política de lectura pública

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Configuración DB ausente' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: benefits, error } = await supabase
      .from('loyalty_benefits')
      .select('*');

    if (error) {
      throw error;
    }

    const mappedBenefits = (benefits || [])
      .filter(b => b.active !== false && b.is_active !== false)
      .map(b => ({
        ...b,
        id: b.id,
        name: b.name,
        description: b.description,
        points_cost: b.points_cost || b.points_required || 0,
        is_active: true
      }))
      .sort((a, b) => a.points_cost - b.points_cost);

    return NextResponse.json({
      success: true,
      benefits: mappedBenefits
    });

  } catch (error: any) {
    console.error('Error fetching benefits:', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
