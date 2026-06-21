/**
 * =============================================================================
 * Rate Limiter — almacenamiento en memoria de proceso (Map)
 * =============================================================================
 *
 * DECISIÓN DE ARQUITECTURA:
 * Se usa un Map en memoria en lugar de Redis o Supabase por las siguientes razones:
 *
 * 1. Railway (y plataformas similares) corre el proyecto en UNA SOLA instancia
 *    de Node.js por defecto. Un Map en proceso es coherente en ese contexto.
 *
 * 2. El volumen esperado es de un restaurante pequeño-mediano, no miles de
 *    requests concurrentes. Un Map de timestamps es suficiente protección.
 *
 * 3. Agregar Redis añadiría ~$7/mes de costo mínimo, latencia de red extra,
 *    y un punto de falla externo — todo sin beneficio real en este escenario.
 *
 * 4. Si en el futuro el proyecto escala a múltiples instancias (horizontal
 *    scaling), esta función puede ser reemplazada por una con Upstash Redis
 *    o una tabla Supabase de rate_limits sin cambiar la interfaz de llamada.
 *
 * LIMITACIÓN CONOCIDA:
 * Si el servidor se reinicia, el historial de rate limiting se pierde. En el
 * contexto de un restaurante esto es aceptable — un atacante que logra reiniciar
 * el servidor tiene problemas mayores que el rate limiting.
 *
 * TTL de OTP (evaluación solicitada):
 * Se mantiene en 5 minutos. Con rate limiting de 3 intentos/10min por teléfono
 * y 20 verificaciones/15min por IP, la ventana de ataque efectiva es
 * prácticamente cerrada. Bajar el TTL a 3 min añadiría fricción al usuario
 * legítimo sin añadir seguridad real dado el nuevo rate limiting.
 * =============================================================================
 */

interface RateLimitEntry {
  timestamps: number[]; // Timestamps (ms) de cada solicitud dentro de la ventana
}

// Almacén global persistente durante la vida del proceso Node.js
const rateLimitStore = new Map<string, RateLimitEntry>();

// Limpieza periódica del Map para evitar fugas de memoria
// Elimina entradas cuyas ventanas de tiempo ya expiraron
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    // Si todos los timestamps son viejos, la entrada puede eliminarse
    if (entry.timestamps.every(ts => now - ts > 30 * 60 * 1000)) { // 30 min máximo
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000); // Limpieza cada 5 minutos

/**
 * Verifica si una clave (IP, teléfono, userId, etc.) ha excedido el límite de
 * solicitudes dentro de una ventana de tiempo deslizante.
 *
 * @param key          Identificador único del recurso a limitar (ej. `sms:ip:1.2.3.4`)
 * @param maxRequests  Número máximo de solicitudes permitidas en la ventana
 * @param windowSeconds Tamaño de la ventana en segundos (ej. 600 = 10 minutos)
 * @returns { allowed: boolean, retryAfterSeconds: number }
 *
 * @example
 * // Limitar a 3 SMS por teléfono en 10 minutos
 * const result = checkRateLimit(`sms:phone:${phone}`, 3, 600);
 * if (!result.allowed) return NextResponse.json({ error: '...' }, { status: 429 });
 *
 * @example
 * // Limitar a 20 intentos de verificación por IP en 15 minutos
 * const result = checkRateLimit(`otp:ip:${ip}`, 20, 900);
 */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const windowStart = now - windowMs;

  // Obtener o crear la entrada para esta clave
  const entry = rateLimitStore.get(key) ?? { timestamps: [] };

  // Eliminar timestamps fuera de la ventana deslizante actual
  entry.timestamps = entry.timestamps.filter(ts => ts > windowStart);

  if (entry.timestamps.length >= maxRequests) {
    // Calcular cuándo expira el timestamp más antiguo dentro de la ventana
    const oldestInWindow = entry.timestamps[0];
    const retryAfterMs = oldestInWindow + windowMs - now;
    const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);

    rateLimitStore.set(key, entry);
    return { allowed: false, retryAfterSeconds: Math.max(1, retryAfterSeconds) };
  }

  // Registrar esta solicitud y guardar
  entry.timestamps.push(now);
  rateLimitStore.set(key, entry);
  return { allowed: true, retryAfterSeconds: 0 };
}

/**
 * Extrae la IP real del cliente desde los headers de la request.
 * Respeta x-forwarded-for (Railway, Vercel, proxies) con sanitización.
 *
 * @param req Request de Next.js (o nativo)
 * @returns IP del cliente como string, o 'unknown' si no se puede determinar
 */
export function getClientIP(req: Request): string {
  // x-forwarded-for puede contener múltiples IPs separadas por coma:
  // "client_ip, proxy1_ip, proxy2_ip" — tomamos solo la primera (el cliente real)
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const ip = forwarded.split(',')[0].trim();
    // Sanitización básica: solo caracteres válidos en una IP (IPv4/IPv6)
    if (/^[\d.:a-fA-F]+$/.test(ip)) return ip;
  }

  const realIp = req.headers.get('x-real-ip');
  if (realIp && /^[\d.:a-fA-F]+$/.test(realIp.trim())) {
    return realIp.trim();
  }

  return 'unknown';
}
