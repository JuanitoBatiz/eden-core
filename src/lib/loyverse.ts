const LOYVERSE_API_URL = 'https://api.loyverse.com/v1.0';
const LOYVERSE_ACCESS_TOKEN = process.env.LOYVERSE_ACCESS_TOKEN || '';
const LOYVERSE_STORE_ID = process.env.LOYVERSE_STORE_ID || '';
const LOYVERSE_GENERIC_VARIANT_ID = process.env.LOYVERSE_GENERIC_VARIANT_ID || '';

export const isLoyverseConfigured = !!(LOYVERSE_ACCESS_TOKEN && LOYVERSE_STORE_ID && LOYVERSE_GENERIC_VARIANT_ID);

export interface LoyverseItem {
  variant_id?: string;
  name: string;
  quantity: number;
  price: number;
}

export interface LoyverseReceiptPayload {
  store_id: string;
  customer_id?: string;
  note?: string;
  line_items: Array<{
    variant_id?: string;
    quantity: number;
    price: number;
    name?: string; // Standard API uses variant_id but we can send names for custom items if supported
  }>;
  payments: Array<{
    payment_type_id?: string;
    type?: 'CASH' | 'CARD' | 'OTHER';
    amount: number;
  }>;
}

let cachedCashPaymentTypeId: string | null = null;

async function getCashPaymentTypeId(): Promise<string | null> {
  if (cachedCashPaymentTypeId) {
    return cachedCashPaymentTypeId;
  }
  if (!isLoyverseConfigured) {
    return null;
  }
  try {
    const res = await fetch(`${LOYVERSE_API_URL}/payment_types`, {
      headers: {
        'Authorization': `Bearer ${LOYVERSE_ACCESS_TOKEN}`
      }
    });

    if (!res.ok) {
      console.error('Error fetching Loyverse payment types:', res.status);
      return null;
    }

    const data = await res.json();
    const cashPT = data.payment_types?.find((p: any) => p.type === 'CASH') || data.payment_types?.[0];
    if (cashPT) {
      cachedCashPaymentTypeId = cashPT.id;
      return cashPT.id;
    }
    return null;
  } catch (err) {
    console.error('Failed to get cash payment type ID from Loyverse:', err);
    return null;
  }
}

/**
 * Creates a receipt in Loyverse POS.
 * Since this is paid at the counter, it records the order as unpaid/pending payment
 * using a generic payment type or Cash to trigger it in Loyverse KDS.
 */
export async function createLoyverseReceipt(order: {
  id: string;
  customer_id?: string;
  customer_name: string;
  customer_phone: string;
  items: any[];
  total: number;
  notes?: string;
  service_type?: string;
  delivery_address?: string;
  payment_method?: string;
  payment_status?: string;
}) {
  const formatItemCustomizations = (item: any): string[] => {
    const parts: string[] = [];
    if (item.variant || item.size) parts.push(`Opción: ${item.variant || item.size}`);

    if (item.customizations && typeof item.customizations === 'object') {
      const cust = item.customizations;
      if (cust.proteins?.length > 0) parts.push(`Prot: ${cust.proteins.join(', ')}`);
      if (cust.toppings?.length > 0) parts.push(`Top: ${cust.toppings.join(', ')}`);
      if (cust.seedsAndNuts?.length > 0) parts.push(`Semillas: ${cust.seedsAndNuts.join(', ')}`);
      if (cust.dressings?.length > 0) parts.push(`Aderezo: ${cust.dressings.join(', ')}`);
      if (cust.flavors?.length > 0) parts.push(`Sabor: ${cust.flavors.join(', ')}`);

      // Separar exclusiones ("Sin ...") de otros extras u opciones
      if (cust.extras?.length > 0) {
        const omissions = cust.extras.filter((x: any) => typeof x === 'string' && x.toLowerCase().startsWith('sin '));
        const otherExtras = cust.extras.filter((x: any) => !(typeof x === 'string' && x.toLowerCase().startsWith('sin ')));
        if (omissions.length > 0) parts.push(`EXCLUSIONES: ${omissions.join(', ')}`);
        if (otherExtras.length > 0) parts.push(`Opciones/Extras: ${otherExtras.join(', ')}`);
      }

      // Incluir cualquier otro grupo de modificadores dinámico de Supabase
      const standardKeys = ['proteins', 'toppings', 'seedsAndNuts', 'dressings', 'flavors', 'extras'];
      Object.entries(cust).forEach(([key, val]) => {
        if (!standardKeys.includes(key)) {
          if (Array.isArray(val) && val.length > 0) {
            const label = key.charAt(0).toUpperCase() + key.slice(1);
            parts.push(`${label}: ${val.join(', ')}`);
          } else if (typeof val === 'string' && val.trim() !== '') {
            const label = key.charAt(0).toUpperCase() + key.slice(1);
            parts.push(`${label}: ${val}`);
          }
        }
      });
    }

    if (item.notes) {
      parts.push(`Nota: ${item.notes}`);
    }
    return parts;
  };

  const lineItems = order.items.map(item => {
    const parts = formatItemCustomizations(item);
    const itemNote = parts.length > 0 ? parts.join(' | ') : undefined;
    let cleanItemNote = itemNote;
    if (cleanItemNote && cleanItemNote.length > 255) {
      cleanItemNote = cleanItemNote.slice(0, 252) + '...';
    }

    return {
      variant_id: item.variantId || item.variant || LOYVERSE_GENERIC_VARIANT_ID,
      quantity: item.quantity,
      price: item.price,
      line_note: cleanItemNote,
      note: cleanItemNote
    };
  });

  // Formatear el Tipo de Servicio para el Ticket de Cocina / POS de Loyverse
  let serviceTypeText = '[PARA RECOGER EN SUCURSAL]';
  if (order.service_type === 'delivery') {
    serviceTypeText = `[ENVÍO] Dir: ${order.delivery_address || 'No especificada'}`;
  } else if (order.service_type === 'dine_in' || order.service_type === 'local' || order.service_type === 'comer_local') {
    serviceTypeText = '[COMER EN LOCAL (MESA)]';
  }

  // Formatear el Método de Pago para el Ticket de Cocina / POS de Loyverse
  let paymentText = '[COBRAR EN CAJA / EFECTIVO]';
  if (order.payment_method === 'transferencia' || order.payment_status === 'payment_approved') {
    paymentText = '[YA PAGADO WEB / SPEI]';
  }

  let fullNoteText = `${serviceTypeText} | ${paymentText}\nPedido Web #${order.id.slice(-4).toUpperCase()} | Cliente: ${order.customer_name} (${order.customer_phone})\nNotas: ${order.notes || 'Ninguna'}`;

  // Seguridad por límite de API Loyverse (máximo 255 caracteres en la nota general del recibo)
  if (fullNoteText.length > 255) {
    fullNoteText = fullNoteText.slice(0, 252) + '...';
  }

  if (!isLoyverseConfigured) {
    console.warn('⚠️ [LOYVERSE DIAGNOSTIC] Falta configuración para conectar con Loyverse real. Estado de variables:', {
      has_token: !!LOYVERSE_ACCESS_TOKEN,
      has_store_id: !!LOYVERSE_STORE_ID,
      has_generic_variant: !!LOYVERSE_GENERIC_VARIANT_ID
    });
    console.warn('⚠️ [LOYVERSE DIAGNOSTIC] Entrando en MOCK MODE. Se generará un ticket simulado y NO se enviará nada a la App de Loyverse.');

    const mockPayload: any = {
      store_id: LOYVERSE_STORE_ID,
      note: fullNoteText,
      line_items: lineItems,
      payments: [
        {
          type: 'OTHER' as const,
          amount: order.total
        }
      ]
    };
    if (order.customer_id) {
      mockPayload.customer_id = order.customer_id;
    }
    console.log('[MOCK LOYVERSE] Creando recibo en Loyverse:', JSON.stringify(mockPayload, null, 2));
    // Return a mock Loyverse receipt ID and number
    return {
      receipt_id: `loyverse_rec_${Math.random().toString(36).substring(2, 11)}`,
      receipt_number: `T-${Math.floor(1000 + Math.random() * 9000)}`
    };
  }

  try {
    let payments: any[] = [];
    if (order.payment_method === 'transferencia' || order.payment_method === 'spei' || order.payment_status === 'payment_approved') {
      // Para transferencias / SPEI ya pagados, registramos como OTHER para no descuadrar el corte de caja física de efectivo en Loyverse
      payments = [{ type: 'OTHER' as const, amount: order.total }];
    } else if (order.payment_method === 'tarjeta') {
      payments = [{ type: 'CARD' as const, amount: order.total }];
    } else {
      const paymentTypeId = await getCashPaymentTypeId();
      payments = paymentTypeId
        ? [{ payment_type_id: paymentTypeId, amount: order.total }]
        : [{ type: 'CASH' as const, amount: order.total }];
    }

    const payload: LoyverseReceiptPayload = {
      store_id: LOYVERSE_STORE_ID,
      note: fullNoteText,
      line_items: lineItems,
      payments: payments
    };
    if (order.customer_id) {
      payload.customer_id = order.customer_id;
    }

    console.log('📡 [LOYVERSE DIAGNOSTIC] Enviando petición POST a Loyverse (/receipts)...');
    console.log('📦 [LOYVERSE DIAGNOSTIC] URL:', `${LOYVERSE_API_URL}/receipts`);
    console.log('📦 [LOYVERSE DIAGNOSTIC] Payload:', JSON.stringify(payload, null, 2));

    const res = await fetch(`${LOYVERSE_API_URL}/receipts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOYVERSE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      const errorMsg = `Loyverse API error [HTTP ${res.status} ${res.statusText}]: ${errText}`;
      console.error('❌ [LOYVERSE DIAGNOSTIC ERROR] El servidor de Loyverse rechazó el recibo:', errorMsg);
      throw new Error(errorMsg);
    }

    const data = await res.json();
    console.log('✅ [LOYVERSE DIAGNOSTIC SUCCESS] Recibo creado exitosamente en Loyverse:', data);
    return {
      receipt_id: data.id || data.receipt_id || data.receipt_number,
      receipt_number: data.receipt_number
    };
  } catch (error: any) {
    console.error('❌ [LOYVERSE DIAGNOSTIC EXCEPTION] Excepción capturada en createLoyverseReceipt:', error?.message || error);
    // If the API call fails in production, log it but return mock or let the system proceed
    throw error;
  }
}

/**
 * Refunds / voids a receipt in Loyverse POS.
 * Used when the administrator cancels the order.
 */
export async function refundLoyverseReceipt(receiptId: string) {
  if (!isLoyverseConfigured) {
    console.log(`[MOCK LOYVERSE] Reembolsando recibo ${receiptId} en Loyverse`);
    return true;
  }

  try {
    console.log(`📡 [LOYVERSE DIAGNOSTIC] Reembolsando recibo ${receiptId} en Loyverse...`);
    // First, fetch the receipt to get its details for the refund
    const fetchRes = await fetch(`${LOYVERSE_API_URL}/receipts/${receiptId}`, {
      headers: {
        'Authorization': `Bearer ${LOYVERSE_ACCESS_TOKEN}`
      }
    });

    if (!fetchRes.ok) {
      const errText = await fetchRes.text();
      const errorMsg = `Loyverse API error consultando recibo para reembolso [HTTP ${fetchRes.status}]: ${errText}`;
      console.error('❌ [LOYVERSE DIAGNOSTIC ERROR]', errorMsg);
      throw new Error(errorMsg);
    }

    const receipt = await fetchRes.json();

    // Prepare refund payload targeting original item IDs
    const refundPayload = {
      line_items: receipt.line_items.map((item: any) => ({
        id: item.id,
        quantity: item.quantity
      }))
    };

    const res = await fetch(`${LOYVERSE_API_URL}/receipts/${receiptId}/refund`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOYVERSE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(refundPayload)
    });

    if (!res.ok) {
      const errText = await res.text();
      const errorMsg = `Loyverse API refund error [HTTP ${res.status}]: ${errText}`;
      console.error('❌ [LOYVERSE DIAGNOSTIC ERROR] Fallo al reembolsar en Loyverse:', errorMsg);
      throw new Error(errorMsg);
    }

    console.log(`✅ [LOYVERSE DIAGNOSTIC SUCCESS] Recibo ${receiptId} reembolsado exitosamente.`);
    return true;
  } catch (error: any) {
    console.error('❌ [LOYVERSE DIAGNOSTIC EXCEPTION] Excepción al reembolsar recibo:', error?.message || error);
    throw error;
  }
}

/**
 * Creates a customer in Loyverse POS.
 * WARNING: The Loyverse API does not guarantee uniqueness by phone natively when creating via POST.
 * If duplicate prevention is strictly needed, a GET request to search by phone should be done first,
 * but currently the specification is to blindly attempt creation.
 */
export async function createLoyverseCustomer(name: string, phone: string): Promise<string> {
  if (!isLoyverseConfigured) {
    console.log(`[MOCK LOYVERSE] Creando cliente ${name} (${phone}) en Loyverse`);
    return `loyverse_cust_${Math.random().toString(36).substring(2, 11)}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 seconds timeout

  try {
    const payload = {
      name,
      phone_number: phone
    };

    console.log(`📡 [LOYVERSE DIAGNOSTIC] Creando cliente en Loyverse: ${name} (${phone})`);
    const res = await fetch(`${LOYVERSE_API_URL}/customers`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOYVERSE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errText = await res.text();
      const errorMsg = `Loyverse API error creating customer [HTTP ${res.status}]: ${errText}`;
      console.error('❌ [LOYVERSE DIAGNOSTIC ERROR] Fallo al crear cliente en Loyverse:', errorMsg);
      throw new Error(errorMsg);
    }

    const data = await res.json();
    const customerId = data.id || data.customer_id;
    console.log(`✅ [LOYVERSE DIAGNOSTIC SUCCESS] Cliente creado exitosamente en Loyverse con ID: ${customerId}`);
    return customerId;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      const timeoutMsg = 'Loyverse API request timed out after 10 seconds.';
      console.error('❌ [LOYVERSE DIAGNOSTIC TIMEOUT]', timeoutMsg);
      throw new Error(timeoutMsg);
    }
    console.error('❌ [LOYVERSE DIAGNOSTIC EXCEPTION] Error creando cliente en Loyverse:', error?.message || error);
    throw error;
  }
}
