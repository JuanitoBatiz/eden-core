import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import jwt from 'jsonwebtoken';

const JWT_QR_SECRET = process.env.JWT_QR_SECRET || 'fallback_qr_secret_for_dev';

/**
 * IMPORTANTE: Este JWT secret es EXCLUSIVO para códigos QR.
 * NO debe usarse para validar la sesión del usuario (cookie de auth),
 * ya que un QR es mostrado físicamente a terceros y su compromiso 
 * no debe comprometer la cuenta completa del usuario.
 * Solo autoriza la lectura del perfil de lealtad en caja.
 */

// GET: Genera un token QR de vida ultracorta (5 mins) para EdenPass
export async function GET(req: Request) {
  try {
    let tokenPayload;
    try {
      tokenPayload = await requireRole(req, 'customer');
    } catch (authErr: any) {
      if (authErr.message.includes('403')) {
        return NextResponse.json({ error: 'insufficient_permissions', required_role: authErr.required_role, your_role: authErr.your_role }, { status: 403 });
      }
      return NextResponse.json({ error: authErr.message || 'No autorizado' }, { status: 401 });
    }

    const userId = tokenPayload.user_id;

    // Generar JWT dedicado
    const qrToken = jwt.sign(
      { 
        user_id: userId, 
        type: 'edenpass_qr' 
      },
      JWT_QR_SECRET,
      { expiresIn: '5m' } // 5 minutos de vida
    );

    // Calcular expiración exacta para el frontend
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    return NextResponse.json({
      success: true,
      qr_token: qrToken,
      expires_at: expiresAt
    });

  } catch (error: any) {
    console.error('QR token generation error:', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
