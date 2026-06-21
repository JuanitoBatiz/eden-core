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
  customizations?: any;
}

export interface OrderCreateRequest {
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  items: OrderItemRequest[];
  notes?: string;
  service_type?: string;
}

export interface RedeemBenefitRequest {
  benefit_id: string;
  order_id?: string;
}

export interface QrValidateRequest {
  token: string;
}

export interface OrderStatusUpdateRequest {
  status: 'received' | 'in_preparation' | 'delivered' | 'cancelled';
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
  status: 'received' | 'in_preparation' | 'delivered' | 'cancelled';
  payment_status: 'pending_payment' | 'payment_submitted' | 'payment_approved' | 'payment_rejected';
  proof_url?: string;
  rejection_reason?: string;
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
