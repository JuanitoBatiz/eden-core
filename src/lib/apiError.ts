import { NextResponse } from 'next/server';

/**
 * Sanitiza errores para evitar exponer detalles internos (ej. base de datos, stack traces) al cliente.
 * El error real se loguea en el servidor para facilitar la depuración.
 *
 * @param error El objeto de error capturado.
 * @param context Mensaje de contexto para el log (ej. 'Fetch proof URL error').
 * @param fallbackMessage Mensaje genérico seguro que se enviará al cliente.
 * @param status Código de estado HTTP a retornar.
 */
export function sanitizeError(
  error: any,
  context: string,
  fallbackMessage: string = 'No pudimos procesar tu solicitud, intenta de nuevo.',
  status: number = 500
) {
  // 1. Loguear el error real y completo en el servidor
  console.error(`[API Error] ${context}:`, error);

  // 2. Retornar solo el mensaje genérico al cliente
  return NextResponse.json(
    { error: fallbackMessage },
    { status }
  );
}
