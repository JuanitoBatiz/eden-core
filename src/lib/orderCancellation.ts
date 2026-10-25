// Reglas de cancelación por parte del cliente. Fuente única para API y UI.
//
// Ventana permitida (decisión del dueño): solo ANTES de preparación.
//   status ∈ {received, awaiting_payment} y payment_status = pending_payment.
// En esa ventana no existe recibo en Loyverse, ni boleto de rifa, ni pago aprobado.

export const CUSTOMER_CANCELLABLE_STATUSES = ['received', 'awaiting_payment'] as const;

export const CUSTOMER_CANCEL_REASONS = {
  equivocacion: 'Me equivoqué de platillo',
  ya_no_lo_quiero: 'Ya no lo quiero',
  tardanza: 'Tardó mucho',
  otro: 'Otro',
} as const;

export type CustomerCancelReason = keyof typeof CUSTOMER_CANCEL_REASONS;

export function isCustomerCancelReason(value: unknown): value is CustomerCancelReason {
  return typeof value === 'string' && value in CUSTOMER_CANCEL_REASONS;
}

interface CancellableOrderState {
  status: string;
  payment_status?: string;
}

export function isCustomerCancellable(order: CancellableOrderState): boolean {
  return (
    (CUSTOMER_CANCELLABLE_STATUSES as readonly string[]).includes(order.status) &&
    order.payment_status === 'pending_payment'
  );
}

/** Mensaje para el cliente cuando el pedido ya no se puede cancelar/modificar desde la web. */
export function customerCancelBlockedMessage(
  order: CancellableOrderState,
  action: 'cancelar' | 'modificar' = 'cancelar'
): string {
  if (order.status === 'cancelled') return 'Este pedido ya estaba cancelado.';
  if (order.payment_status === 'payment_submitted') {
    return 'Ya enviaste tu comprobante de pago. Para cambiarlo o cancelarlo, contacta a caja por WhatsApp.';
  }
  return `Tu pedido ya está en preparación y no se puede ${action} desde la web. Contacta a caja por WhatsApp.`;
}

/** Motivos que el personal (cajero/owner) elige al cancelar desde el Kanban. */
export const STAFF_CANCEL_REASONS = {
  agotado: 'Ingrediente agotado',
  cliente_pidio: 'El cliente lo pidió (WhatsApp / en caja)',
  error_captura: 'Error al capturar el pedido',
  no_show: 'El cliente no llegó / no contesta',
  otro: 'Otro',
} as const;

export type StaffCancelReason = keyof typeof STAFF_CANCEL_REASONS;

export function isStaffCancelReason(value: unknown): value is StaffCancelReason {
  return typeof value === 'string' && value in STAFF_CANCEL_REASONS;
}

/** Valor que se guarda en orders.cancel_reason: clave del motivo (+ nota libre opcional). */
export function buildCancelReason(reason: string, note?: string): string {
  const cleanNote = (note ?? '').trim().slice(0, 200);
  return cleanNote ? `${reason}: ${cleanNote}` : reason;
}

const REASON_LABELS: Record<string, string> = {
  ...STAFF_CANCEL_REASONS,
  ...CUSTOMER_CANCEL_REASONS,
  modified: 'Pedido modificado por el cliente',
};

/** Texto legible de orders.cancel_reason ("clave" o "clave: nota"), para mostrar en pantalla. */
export function describeCancelReason(stored?: string | null): string {
  if (!stored) return 'Sin motivo registrado';
  const idx = stored.indexOf(':');
  const key = (idx === -1 ? stored : stored.slice(0, idx)).trim();
  const note = idx === -1 ? '' : stored.slice(idx + 1).trim();
  const label = REASON_LABELS[key] ?? stored;
  return note && REASON_LABELS[key] ? `${label} — ${note}` : label;
}

export const CANCELLED_BY_LABELS: Record<string, string> = {
  customer: 'Cliente',
  staff: 'Caja',
  pos: 'Loyverse POS',
  system: 'Sistema',
};
