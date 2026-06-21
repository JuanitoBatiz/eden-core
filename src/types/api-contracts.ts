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
