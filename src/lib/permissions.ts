// src/lib/permissions.ts

export type MinimumRole = 'customer' | 'cashier' | 'owner';

// Orden ascendente de privilegios
export const ROLE_HIERARCHY: MinimumRole[] = ['customer', 'cashier', 'owner'];

// Matriz de permisos documentada.
// Aunque el middleware/helper evalúa el string dinámicamente,
// esta matriz es la fuente de la verdad (single source of truth) documentada.
export const ROUTE_PERMISSIONS: Record<string, MinimumRole> = {
  // Configuración y Menú
  'POST /api/bank-config/admin': 'owner',
  'GET /api/admin/menu': 'owner',
  'POST /api/admin/categories': 'owner',
  'PATCH /api/admin/categories/:id': 'owner',
  'DELETE /api/admin/categories/:id': 'owner',
  'POST /api/admin/products': 'owner',
  'PATCH /api/admin/products/:id': 'owner',
  'DELETE /api/admin/products/:id': 'owner',
  'POST /api/admin/products/:id/variants': 'owner',
  'PATCH /api/admin/variants/:id': 'owner',
  'DELETE /api/admin/variants/:id': 'owner',
  'POST /api/admin/products/:id/modifier-groups': 'owner',
  'PATCH /api/admin/modifier-groups/:id': 'owner',
  'DELETE /api/admin/modifier-groups/:id': 'owner',
  'POST /api/admin/modifier-groups/:id/modifiers': 'owner',
  'PATCH /api/admin/modifiers/:id': 'owner',
  'DELETE /api/admin/modifiers/:id': 'owner',
  
  // Gestión de Usuarios
  'GET /api/admin/users': 'owner',
  'PATCH /api/admin/users/:id/role': 'owner',
  'PATCH /api/admin/users/:id/deactivate': 'owner',
  'PATCH /api/admin/users/:id/reactivate': 'owner',
  
  // Clientes y Lealtad
  'GET /api/customers': 'cashier',
  'POST /api/customers/:id/redeem': 'cashier',
  'POST /api/qr/validate': 'cashier',
  'GET /api/me/loyalty': 'customer',
  'GET /api/me/qr-token': 'customer',
  
  // Órdenes del Cliente
  'POST /api/orders': 'customer',
  'GET /api/orders/me': 'customer',
  'PATCH /api/orders/:id': 'customer', // Subir comprobante
  
  // Gestión de Órdenes y Finanzas (Caja)
  'GET /api/orders': 'cashier',
  'GET /api/orders/pending-payment': 'cashier',
  'PATCH /api/orders/:id/approve-payment': 'cashier',
  'PATCH /api/orders/:id/reject-payment': 'cashier',
  'GET /api/orders/:id/proof': 'cashier',
  'PATCH /api/orders/:id/status': 'cashier',
};

// Mapeo lógico de "Capacidades de UI" a "Rutas de Backend" reales
export const CAPABILITY_ROUTES = {
  can_configure_bank: 'POST /api/bank-config/admin',
  can_manage_menu: 'POST /api/admin/categories',
  can_manage_users: 'GET /api/admin/users',
  can_view_all_orders: 'GET /api/orders',
  can_approve_payments: 'PATCH /api/orders/:id/approve-payment',
  can_scan_qr: 'POST /api/qr/validate',
  can_search_customers: 'GET /api/customers',
  can_redeem_loyalty: 'POST /api/customers/:id/redeem',
} as const;

export type Capability = keyof typeof CAPABILITY_ROUTES;

/**
 * Deriva qué puede hacer un rol basándose en los permisos de backend.
 */
export function deriveCapabilities(userRole: MinimumRole): Record<Capability, boolean> {
  const capabilities = {} as Record<Capability, boolean>;
  const userIndex = ROLE_HIERARCHY.indexOf(userRole);

  for (const [capability, route] of Object.entries(CAPABILITY_ROUTES)) {
    const requiredRole = ROUTE_PERMISSIONS[route];
    const requiredIndex = ROLE_HIERARCHY.indexOf(requiredRole);
    // Si la jerarquía del usuario es mayor o igual a la requerida por el endpoint
    capabilities[capability as Capability] = userIndex >= requiredIndex;
  }
  
  return capabilities;
}
