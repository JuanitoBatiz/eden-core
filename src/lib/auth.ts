import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { parse } from 'cookie';
import { MinimumRole, ROLE_HIERARCHY } from '@/lib/permissions';

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'dev_access_secret';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret';

export interface JwtPayload {
  user_id: string;
  phone?: string;
  role?: string;
}

export function generateAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_ACCESS_SECRET, { expiresIn: '15m' });
}

export function generateRefreshToken(payload: { user_id: string }): string {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: '7d' });
}

const activeUserCache = new Map<string, { active: boolean, expiresAt: number }>();

/**
 * Extrae y verifica el access_token de una request.
 *
 * Orden de prioridad:
 *   1. Cookie httpOnly `access_token` (fuente primaria — flujo web)
 *   2. Header `Authorization: Bearer <token>` (fallback — futuros clientes API/móvil)
 *
 * Esto garantiza que el flujo web nunca expone el token a JavaScript del cliente
 * mientras mantiene compatibilidad con clientes API externos.
 */
export async function verifyAccessToken(request: NextRequest | Request): Promise<JwtPayload> {
  // 1. Intentar leer de cookie httpOnly (fuente primaria para el navegador)
  const cookieHeader = request.headers.get('cookie') || '';
  const cookies = parse(cookieHeader);
  let token = cookies.access_token;

  // 2. Fallback a Authorization header (para clientes API externos o testing)
  if (!token) {
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
  }

  if (!token) {
    throw new Error('401: Token no proporcionado. Inicia sesión.');
  }

  let decoded: JwtPayload;
  try {
    decoded = jwt.verify(token, JWT_ACCESS_SECRET) as JwtPayload;
  } catch (error) {
    throw new Error('401: Token expirado o inválido');
  }

  // Verificar que la cuenta siga activa (con caché de 15s para no saturar la DB)
  const now = Date.now();
  const cached = activeUserCache.get(decoded.user_id);

  if (cached && cached.expiresAt > now) {
    if (!cached.active) throw new Error('401: Cuenta inactiva');
  } else {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (!supabaseUrl || !serviceRoleKey) {
      // Sin Supabase (modo dev) — asumir activo si el token es válido
      activeUserCache.set(decoded.user_id, { active: true, expiresAt: now + 15000 });
    } else {
      const supabase = createClient(supabaseUrl, serviceRoleKey);
      const { data: user } = await supabase
        .from('users')
        .select('active')
        .eq('id', decoded.user_id)
        .single();

      const isActive = user ? user.active : false;
      activeUserCache.set(decoded.user_id, { active: isActive, expiresAt: now + 15000 }); // 15 segundos de caché

      if (!isActive) throw new Error('401: Cuenta inactiva');
    }
  }

  return decoded;
}

export function verifyRefreshToken(token: string): JwtPayload {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET) as JwtPayload;
  } catch (error) {
    throw new Error('401: Refresh token expirado o inválido');
  }
}

/**
 * Middleware de RBAC centralizado.
 * Lee el token de cookie httpOnly o header Authorization (ver verifyAccessToken).
 * Lanza Error con código 403 si el rol es insuficiente.
 */
export async function requireRole(request: NextRequest | Request, requiredRole: MinimumRole): Promise<JwtPayload & { role: string }> {
  // 1. Verificar token y estado activo
  const tokenPayload = await verifyAccessToken(request);

  // 2. Leer el rol actual desde la DB (siempre desde DB, no del JWT, para reflejar cambios de rol)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !serviceRoleKey) {
    // Sin Supabase — usar el rol del JWT directamente (modo dev)
    const tokenRole = (tokenPayload.role || 'customer') as MinimumRole;
    const tokenRoleIndex = ROLE_HIERARCHY.indexOf(tokenRole);
    const requiredRoleIndex = ROLE_HIERARCHY.indexOf(requiredRole);
    if (tokenRoleIndex === -1 || tokenRoleIndex < requiredRoleIndex) {
      const permError = new Error('403: insufficient_permissions');
      (permError as any).required_role = requiredRole;
      (permError as any).your_role = tokenRole;
      throw permError;
    }
    return { ...tokenPayload, role: tokenRole };
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data: user, error } = await supabase
    .from('users')
    .select('role')
    .eq('id', tokenPayload.user_id)
    .single();

  if (error || !user) {
    throw new Error('401: Usuario no encontrado');
  }

  // 3. Comparar roles usando la jerarquía
  const userRoleIndex = ROLE_HIERARCHY.indexOf(user.role as MinimumRole);
  const requiredRoleIndex = ROLE_HIERARCHY.indexOf(requiredRole);

  if (userRoleIndex === -1 || userRoleIndex < requiredRoleIndex) {
    const permError = new Error('403: insufficient_permissions');
    (permError as any).required_role = requiredRole;
    (permError as any).your_role = user.role;
    throw permError;
  }

  return { ...tokenPayload, role: user.role };
}
