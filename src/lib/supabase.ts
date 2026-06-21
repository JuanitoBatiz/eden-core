/**
 * =============================================================================
 * CONVENCIÓN DE USO DE CLIENTES SUPABASE — LEER ANTES DE MODIFICAR
 * =============================================================================
 *
 * Este módulo expone DOS clientes distintos con propósitos diferentes:
 *
 * ① supabase (cliente ANON — usa NEXT_PUBLIC_SUPABASE_ANON_KEY)
 *    → Respeta el RLS (Row Level Security) de Supabase
 *    → SOLO usar para operaciones que deben respetar políticas públicas
 *    → Ejemplo CORRECTO: GET /api/menu — lectura pública del catálogo
 *    → Ejemplo INCORRECTO: crear una orden, leer usuarios, subir archivos
 *
 * ② createAdminClient() (cliente SERVICE_ROLE — usa SUPABASE_SERVICE_ROLE_KEY)
 *    → BYPASEA el RLS completamente — actúa como superusuario de DB
 *    → Usar en TODOS los endpoints que ya están protegidos por requireRole()
 *      o verifyAccessToken(). En esos casos, TU middleware ya garantiza
 *      la autorización — no necesitas que RLS lo duplique.
 *    → Ejemplo CORRECTO: POST /api/orders, GET /api/admin/users, cualquier
 *      operación dentro de un endpoint que ya verificó el JWT
 *    → NUNCA exponer este cliente al browser ni usarlo sin auth previa
 *
 * REGLA SIMPLE: Si el endpoint empieza con requireRole() o verifyAccessToken(),
 * usa createAdminClient(). Si es un endpoint público sin auth, usa supabase anon.
 * =============================================================================
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

/** Cliente ANON — solo para lecturas públicas que respetan RLS */
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

/**
 * Crea un cliente con privilegios de service_role que bypasea RLS.
 * Llamar dentro de cada handler de API (no a nivel de módulo) para
 * garantizar que las variables de entorno estén disponibles.
 * Lanza Error si faltan las variables de entorno necesarias.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) {
    throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en las variables de entorno.');
  }
  return createClient(url, key);
}


// Next.js pattern to prevent hot-reload from resetting the database in development
const globalForMockDb = global as unknown as { 
  serverMockUsers: any[];
  serverMockOtpSessions: any[];
};

if (!globalForMockDb.serverMockUsers) {
  globalForMockDb.serverMockUsers = [];
}
if (!globalForMockDb.serverMockOtpSessions) {
  globalForMockDb.serverMockOtpSessions = [];
}

export const serverMockUsers = globalForMockDb.serverMockUsers;
export const serverMockOtpSessions = globalForMockDb.serverMockOtpSessions;

// Mock Realtime Database for testing without Supabase credentials
class MockDatabase {
  private listeners: { [key: string]: Function[] } = {};

  constructor() {
    if (typeof window !== 'undefined') {
      // Initialize mock orders if not present
      if (!localStorage.getItem('eden_mock_orders')) {
        localStorage.setItem('eden_mock_orders', JSON.stringify([]));
      }
      
      // Listen to storage events to simulate realtime between tabs
      window.addEventListener('storage', (e) => {
        if (e.key === 'eden_mock_orders') {
          this.trigger('orders_changed', JSON.parse(e.newValue || '[]'));
        }
      });
    }
  }

  getOrders(): any[] {
    if (typeof window === 'undefined') return [];
    return JSON.parse(localStorage.getItem('eden_mock_orders') || '[]');
  }

  saveOrders(orders: any[]) {
    if (typeof window === 'undefined') return;
    localStorage.setItem('eden_mock_orders', JSON.stringify(orders));
    this.trigger('orders_changed', orders);
  }

  createOrder(order: any): any {
    const orders = this.getOrders();
    const newOrder = {
      id: Math.random().toString(36).substring(2, 11),
      created_at: new Date().toISOString(),
      status: 'en_revision',
      ...order
    };
    orders.push(newOrder);
    this.saveOrders(orders);
    return newOrder;
  }

  updateOrder(id: string, updates: any): any {
    const orders = this.getOrders();
    const index = orders.findIndex(o => o.id === id);
    if (index !== -1) {
      orders[index] = { ...orders[index], ...updates };
      this.saveOrders(orders);
      return orders[index];
    }
    return null;
  }

  subscribe(event: string, callback: Function) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
    
    // Return unsubscribe function
    return () => {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    };
  }

  private trigger(event: string, data: any) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data));
    }
  }
}

export const mockDb = typeof window !== 'undefined' ? new MockDatabase() : null;
