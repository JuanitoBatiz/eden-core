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
  customer_name: string;
  customer_phone: string;
  items: any[];
  total: number;
  notes?: string;
}) {
  const lineItems = order.items.map(item => {
    return {
      variant_id: item.variantId || LOYVERSE_GENERIC_VARIANT_ID,
      quantity: item.quantity,
      price: item.price
    };
  });

  const itemsText = order.items.map(item => {
    let details = `${item.quantity}x ${item.name}${item.size ? ` (${item.size})` : ''}`;
    if (item.customizations) {
      const parts = [];
      if (item.customizations.proteins?.length > 0) parts.push(`Prot: ${item.customizations.proteins.join(', ')}`);
      if (item.customizations.toppings?.length > 0) parts.push(`Top: ${item.customizations.toppings.join(', ')}`);
      if (item.customizations.seedsAndNuts?.length > 0) parts.push(`Semillas: ${item.customizations.seedsAndNuts.join(', ')}`);
      if (item.customizations.dressings?.length > 0) parts.push(`Aderezo: ${item.customizations.dressings.join(', ')}`);
      if (item.customizations.flavors?.length > 0) parts.push(`Sabor: ${item.customizations.flavors.join(', ')}`);
      if (parts.length > 0) {
        details += `\n   [${parts.join(' | ')}]`;
      }
    }
    if (item.notes) {
      details += `\n   (Nota: ${item.notes})`;
    }
    return details;
  }).join('\n');

  if (!isLoyverseConfigured) {
    const mockPayload = {
      store_id: LOYVERSE_STORE_ID,
      note: `Pedido Web #${order.id.slice(-4).toUpperCase()}\nCliente: ${order.customer_name} (${order.customer_phone})\n\nDETALLE:\n${itemsText}\n\nNotas Generales: ${order.notes || 'Ninguna'}`,
      line_items: lineItems,
      payments: [
        {
          type: 'OTHER' as const,
          amount: order.total
        }
      ]
    };
    console.log('[MOCK LOYVERSE] Creando recibo en Loyverse:', JSON.stringify(mockPayload, null, 2));
    // Return a mock Loyverse receipt ID and number
    return {
      receipt_id: `loyverse_rec_${Math.random().toString(36).substring(2, 11)}`,
      receipt_number: `T-${Math.floor(1000 + Math.random() * 9000)}`
    };
  }

  try {
    const paymentTypeId = await getCashPaymentTypeId();
    const payments = paymentTypeId
      ? [{ payment_type_id: paymentTypeId, amount: order.total }]
      : [{ type: 'CASH' as const, amount: order.total }];

    const payload: LoyverseReceiptPayload = {
      store_id: LOYVERSE_STORE_ID,
      note: `Pedido Web #${order.id.slice(-4).toUpperCase()}\nCliente: ${order.customer_name} (${order.customer_phone})\n\nDETALLE:\n${itemsText}\n\nNotas Generales: ${order.notes || 'Ninguna'}`,
      line_items: lineItems,
      payments: payments
    };

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
      receipt_id: data.receipt_id,
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

    // Prepare refund payload
    const refundPayload = {
      store_id: LOYVERSE_STORE_ID,
      receipt_type: 'REFUND',
      refund_for_receipt_id: receiptId,
      line_items: receipt.line_items.map((item: any) => ({
        variant_id: item.variant_id,
        quantity: item.quantity,
        price: item.price
      })),
      payments: receipt.payments.map((payment: any) => {
        if (payment.payment_type_id) {
          return {
            payment_type_id: payment.payment_type_id,
            amount: -payment.amount
          };
        }
        return {
          type: payment.type || 'OTHER',
          amount: -payment.amount
        };
      })
    };

    const res = await fetch(`${LOYVERSE_API_URL}/receipts`, {
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
