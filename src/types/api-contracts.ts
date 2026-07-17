/**
 * Contratos de API compartidos entre el Frontend y el Backend
 * Esto previene mismatches de nombres de variables y asegura que los payloads sean idénticos.
 */

export interface BankConfigCreateRequest {
  bank_name: string;
  account_holder: string;
  clabe: string;
}

export interface SmsRequest {
  phone: string;
  name?: string;
}

export interface VerifyOtpRequest {
  phone: string;
  code: string;
  name?: string;
}

export interface OrderItemRequest {
  id: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
  variant?: string;
  size?: string;
  customizations?: any;
}

export interface OrderCreateRequest {
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  items: OrderItemRequest[];
  notes?: string;
  service_type?: 'pickup' | 'delivery';
  delivery_address?: string;
}

export interface RedeemBenefitRequest {
  benefit_id: string;
  order_id?: string;
}

export interface QrValidateRequest {
  token: string;
}

export interface OrderStatusUpdateRequest {
  status: 'received' | 'in_preparation' | 'ready' | 'in_transit' | 'delivered' | 'cancelled' | 'awaiting_payment';
}

export interface OrderRejectPaymentRequest {
  reason: string;
}

export interface Order {
  id: string;
  created_at: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  items: OrderItemRequest[];
  total: number;
  notes?: string;
  service_type: 'pickup' | 'delivery';
  delivery_address?: string;
  /** Tarifa de envío cotizada por caja/cocina. NULL = pendiente de cotizar. */
  delivery_fee?: number | null;
  /** true cuando la caja/cocina ha confirmado la tarifa de envío */
  delivery_fee_confirmed?: boolean;
  status: 'received' | 'in_preparation' | 'ready' | 'in_transit' | 'delivered' | 'cancelled' | 'awaiting_payment';
  payment_status: 'pending_payment' | 'payment_submitted' | 'payment_approved' | 'payment_rejected';
  payment_method?: string;
  proof_url?: string;
  rejection_reason?: string;
  refund_status?: 'none' | 'pending' | 'completed';
  refund_proof_url?: string;
  loyverse_receipt_id?: string;
  loyverse_receipt_number?: string;
}

export interface User {
  id: string;
  phone: string;
  name: string;
  email?: string;
  role: string;
  active: boolean;
  points: number;
  created_at: string;
  loyverse_customer_id?: string;
  loyalty_tier?: string;
  loyalty_points?: number;
}

export interface ProductVariant {
  id: string;
  name: string;
  price: number;
  display_order: number;
}

export interface ProductModifier {
  id: string;
  name: string;
  display_order: number;
}

export interface ProductModifierGroup {
  id: string;
  name: string;
  min_selection?: number;
  max_selection: number;
  modifiers?: ProductModifier[];
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  base_price: number;
  image_url?: string;
  category_id?: string;
  available: boolean;
  display_order: number;
  variants?: ProductVariant[];
  modifier_groups?: ProductModifierGroup[];
  loyverse_item_id?: string;
}

export interface LoyaltyBenefit {
  id: string;
  name: string;
  description?: string;
  points_cost: number;
  type: string;
  value?: number;
  is_active: boolean;
}
