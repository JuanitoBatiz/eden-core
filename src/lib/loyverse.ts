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

    return {
      variant_id: item.variantId || item.variant || LOYVERSE_GENERIC_VARIANT_ID,
      quantity: item.quantity,
      price: item.price,
      note: itemNote
    };
  });

  const itemsText = order.items.map(item => {
    let details = `${item.quantity}x ${item.name}${item.size ? ` (${item.size})` : ''}`;
    const parts = formatItemCustomizations(item);
    if (parts.length > 0) {
      details += `\n   [${parts.join(' | ')}]`;
    }
    return details;
  }).join('\n');

  // Formatear el Tipo de Servicio para el Ticket de Cocina / POS de Loyverse
  let serviceTypeText = '[PARA RECOGER EN SUCURSAL]';
  if (order.service_type === 'delivery') {
    serviceTypeText = `[ENVÍO A DOMICILIO]\n   DIRECCIÓN: ${order.delivery_address || 'No especificada'}`;
  } else if (order.service_type === 'dine_in' || order.service_type === 'local' || order.service_type === 'comer_local') {
    serviceTypeText = '[PARA COMER EN LOCAL (MESA)]';
  }

  // Formatear el Método de Pago para el Ticket de Cocina / POS de Loyverse
  let paymentText = '[PAGO EN EFECTIVO / TARJETA AL RECIBIR (COBRAR EN CAJA)]';
  if (order.payment_method === 'transferencia' || order.payment_status === 'payment_approved') {
    paymentText = '[TRANSFERENCIA BANCARIA / SPEI - YA PAGADO EN WEB]';
  }

  const headerNote = `========================================\nTIPO DE SERVICIO:\n${serviceTypeText}\n\n${paymentText}\n========================================\n\n`;
  const fullNoteText = `${headerNote}Pedido Web #${order.id.slice(-4).toUpperCase()}\nCliente: ${order.customer_name} (${order.customer_phone})\n\nDETALLE:\n${itemsText}\n\nNotas Generales: ${order.notes || 'Ninguna'}`;

  if (!isLoyverseConfigured) {
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
      throw new Error(`Loyverse API error: ${res.status} - ${errText}`);
    }

    const data = await res.json();
    return {
      receipt_id: data.id || data.receipt_id || data.receipt_number,
      receipt_number: data.receipt_number
    };
  } catch (error) {
    console.error('Error creating Loyverse receipt:', error);
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
    // First, fetch the receipt to get its details for the refund
    const fetchRes = await fetch(`${LOYVERSE_API_URL}/receipts/${receiptId}`, {
      headers: {
        'Authorization': `Bearer ${LOYVERSE_ACCESS_TOKEN}`
      }
    });

    if (!fetchRes.ok) {
      throw new Error(`Failed to fetch Loyverse receipt for refund: ${fetchRes.status}`);
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
      throw new Error(`Loyverse API refund error: ${res.status} - ${errText}`);
    }

    return true;
  } catch (error) {
    console.error('Error refunding Loyverse receipt:', error);
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
      throw new Error(`Loyverse API error creating customer: ${res.status} - ${errText}`);
    }

    const data = await res.json();
    return data.id || data.customer_id; // Return whichever the API provides as ID
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Loyverse API request timed out after 10 seconds.');
    }
    console.error('Error creating Loyverse customer:', error);
    throw error;
  }
}
