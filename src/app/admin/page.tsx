'use client';

import React, { useState, useEffect } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import MenuManager from '@/components/admin/MenuManager';
import UsersManager from '@/components/admin/UsersManager';
import BankConfigManager from '@/components/admin/BankConfigManager';
import { 
  Check, 
  X, 
  Clock, 
  ChefHat, 
  AlertCircle, 
  MessageCircle, 
  RefreshCw, 
  Unlock,
  ClipboardList,
  ScanLine,
  Search,
  UserCircle,
  Award,
  Users,
  Landmark
} from 'lucide-react';
import KitchenKanban from '@/components/admin/KitchenKanban';
import Image from 'next/image';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { QrValidateRequest, RedeemBenefitRequest, OrderRejectPaymentRequest, OrderStatusUpdateRequest } from '@/types/api-contracts';

interface Order {
  id: string;
  created_at: string;
  customer_name: string;
  customer_phone: string;
  items: any[];
  total: number;
  notes?: string;
  status: 'received' | 'in_preparation' | 'delivered' | 'cancelled';
  loyverse_receipt_number?: string;
}

export default function AdminPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const { can, loading: permsLoading } = usePermissions();

  // Financial Tab State
  const [activeTab, setActiveTab] = useState<'cocina' | 'finanzas' | 'edenpass' | 'menu' | 'usuarios' | 'banco'>('cocina');
  const [pendingPayments, setPendingPayments] = useState<any[]>([]);
  const [selectedProofUrl, setSelectedProofUrl] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [activeFinancialOrder, setActiveFinancialOrder] = useState<string | null>(null);

  // EdenPass Tab State
  const [customerProfile, setCustomerProfile] = useState<any>(null);
  const [loyaltyBenefits, setLoyaltyBenefits] = useState<any[]>([]);
  const [phoneSearchQuery, setPhoneSearchQuery] = useState('');
  const [edenPassError, setEdenPassError] = useState<string | null>(null);
  const [scannerActive, setScannerActive] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState(false);

  // Auth: verificar sesión via cookie httpOnly (refresh silencioso)
  useEffect(() => {
    const initAuth = async () => {
      try {
        // credentials:'include' envía la cookie refresh_token automáticamente
        const res = await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include'
        });
        if (!res.ok) {
          window.location.href = '/?login=true';
        }
        // El nuevo access_token queda en cookie httpOnly — no necesitamos leerlo
      } catch (e) {
        window.location.href = '/?login=true';
      } finally {
        setAuthChecked(true);
      }
    };
    initAuth();
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    window.location.href = '/';
  };

  // Fetch active orders — credentials:'include' envía cookie httpOnly automáticamente
  const fetchOrders = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/orders', { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setOrders(data.orders);
      }
    } catch (e) {
      console.error('Error fetching admin orders:', e);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const fetchPendingPayments = async () => {
    try {
      const res = await fetch('/api/orders/pending-payment', { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setPendingPayments(data.pendingPayments);
      }
    } catch (e) {
      console.error('Error fetching pending payments:', e);
    }
  };

  // Setup Polling
  useEffect(() => {
    if (!authChecked) return;
    
    fetchOrders();
    fetchPendingPayments();

    const interval = setInterval(() => {
      fetchOrders();
      fetchPendingPayments();
    }, 4000); // 4 seconds polling

    return () => clearInterval(interval);
  }, [authChecked]);

  // Load Loyalty Benefits
  useEffect(() => {
    if (activeTab === 'edenpass') {
      fetch('/api/benefits', { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setLoyaltyBenefits(data.benefits);
          }
        })
        .catch(console.error);
    }
  }, [activeTab]);

  // QR Scanner Initialization
  useEffect(() => {
    if (activeTab === 'edenpass' && scannerActive) {
      const scanner = new Html5QrcodeScanner(
        "reader",
        { fps: 10, qrbox: { width: 250, height: 250 }, rememberLastUsedCamera: true },
        false
      );

      scanner.render((decodedText) => {
        scanner.clear();
        setScannerActive(false);
        validateQR(decodedText);
      }, (err) => {
        // Ignore errors during scanning (e.g. no QR detected yet)
      });

      return () => {
        scanner.clear().catch(console.error);
      };
    }
  }, [activeTab, scannerActive]);

  const validateQR = async (token: string) => {
    setEdenPassError(null);
    setCustomerProfile(null);
    try {
      const payload: QrValidateRequest = { token };
      const res = await fetch('/api/qr/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCustomerProfile(data.customer);
      } else {
        setEdenPassError(data.error || 'Error validando código QR');
      }
    } catch (e) {
      setEdenPassError('Error de red al validar QR');
    }
  };

  const searchPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneSearchQuery) return;
    setEdenPassError(null);
    setCustomerProfile(null);
    try {
      let formattedPhone = phoneSearchQuery;
      if (!formattedPhone.startsWith('52') && formattedPhone.length === 10) {
        formattedPhone = '52' + formattedPhone;
      }
      const res = await fetch(`/api/customers?phone=${formattedPhone}`, {
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCustomerProfile(data.customer);
      } else {
        setEdenPassError(data.error || 'Cliente no encontrado');
      }
    } catch (e) {
      setEdenPassError('Error de red al buscar cliente');
    }
  };

  const redeemBenefit = async (benefitId: string, benefitName: string) => {
    if (!customerProfile) return;
    if (!confirm(`¿Confirmas el canje de "${benefitName}" para ${customerProfile.name}?`)) return;
    
    setIsRedeeming(true);
    try {
      const payload: RedeemBenefitRequest = { benefit_id: benefitId };
      const res = await fetch(`/api/customers/${customerProfile.user_id}/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        // Refresh customer points dynamically by searching again
        if (phoneSearchQuery) searchPhone(new Event('submit') as any);
        else setCustomerProfile(null); // Or just nullify to scan again
      } else {
        alert(data.error || 'Error al canjear beneficio');
      }
    } catch (e) {
      alert('Error de red al intentar canjear');
    } finally {
      setIsRedeeming(false);
    }
  };

  // View Proof
  const viewProof = async (id: string) => {
    setActiveFinancialOrder(id);
    setSelectedProofUrl(null);
    setRejectReason('');
    
    try {
      const res = await fetch(`/api/orders/${id}/proof`, {
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok && data.signedUrl) {
        setSelectedProofUrl(data.signedUrl);
      } else {
        alert(data.error || 'Error al obtener comprobante.');
      }
    } catch (e) {
      console.error(e);
      alert('Error de red al obtener comprobante.');
    }
  };

  // Approve Payment
  const approvePayment = async (id: string) => {
    try {
      const res = await fetch(`/api/orders/${id}/approve-payment`, {
        method: 'PATCH',
        credentials: 'include'
      });
      if (res.ok) {
        setPendingPayments(prev => prev.filter(p => p.id !== id));
        fetchOrders(); // Update kitchen kanban automatically
        if (activeFinancialOrder === id) {
          setActiveFinancialOrder(null);
          setSelectedProofUrl(null);
        }
      } else {
        const errorData = await res.json();
        alert(errorData.error || 'Error al aprobar el pago.');
      }
    } catch (e) {
      console.error(e);
      alert('Error de red al aprobar.');
    }
  };

  // Reject Payment
  const rejectPayment = async (id: string) => {
    if (!rejectReason.trim()) {
      alert('Debes ingresar un motivo de rechazo.');
      return;
    }
    try {
      const payload: OrderRejectPaymentRequest = { reason: rejectReason };
      const res = await fetch(`/api/orders/${id}/reject-payment`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setPendingPayments(prev => prev.filter(p => p.id !== id));
        setRejectReason('');
        if (activeFinancialOrder === id) {
          setActiveFinancialOrder(null);
          setSelectedProofUrl(null);
        }
      } else {
        const errorData = await res.json();
        alert(errorData.error || 'Error al rechazar el pago.');
      }
    } catch (e) {
      console.error(e);
      alert('Error de red al rechazar.');
    }
  };

  // Update order status via PATCH API
  const updateStatus = async (id: string, newStatus: 'in_preparation' | 'delivered' | 'cancelled') => {
    try {
      const payload: OrderStatusUpdateRequest = { status: newStatus as any };
      const res = await fetch(`/api/orders/${id}/status`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        // Optimistic UI update
        setOrders(prev => prev.map(o => o.id === id ? { ...o, status: newStatus } : o).filter(o => o.status !== 'delivered' && o.status !== 'cancelled'));
      } else {
        const errorData = await res.json();
        alert(errorData.error || 'Error al actualizar el estado.');
      }
    } catch (error) {
      console.error('Error updating order status:', error);
    }
  };

  // Generate WhatsApp Message Link for cancellation
  const getWhatsAppCancelLink = (order: Order) => {
    const formattedPhone = order.customer_phone.startsWith('52') ? order.customer_phone : `52${order.customer_phone}`;
    const text = encodeURIComponent(
      `Hola ${order.customer_name}, vimos tu pedido de Edén (Ticket ${order.loyverse_receipt_number || ''}) pero nos quedamos sin un ingrediente. ¿Te lo cambiamos por otra opción o prefieres cancelar el pedido?`
    );
    return `https://wa.me/${formattedPhone}?text=${text}`;
  };

  // Redirección del lado del cliente por si layout falla
  useEffect(() => {
    if (!permsLoading && !can('can_view_all_orders')) {
      window.location.href = '/?unauthorized=true';
    }
  }, [can, permsLoading]);

  if (!authChecked || permsLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', padding: '20px' }}>
        <div className="status-animation-ring active" style={{ width: '50px', height: '50px' }}></div>
      </div>
    );
  }

  // Double check prevent render
  if (!can('can_view_all_orders')) return null;

  const pendingOrders = orders.filter(o => o.status === 'received');
  const preparingOrders = orders.filter(o => o.status === 'in_preparation');

  return (
    <>
      {/* HEADER */}
      <header className="header">
        <div className="container header-content">
          <div className="logo-container">
            <img src="/logo.png" alt="Edén Logo" className="logo-img" />
            <div className="logo-text">
              EDÉN PANEL
              <span className="logo-sub">caja y cocina</span>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button 
              className="cart-icon-btn" 
              onClick={() => fetchOrders(accessToken)} 
              style={{ background: 'none', border: '1px solid var(--color-ochre)', color: 'var(--color-text-dark)', display: 'flex', gap: '4px' }}
              disabled={isRefreshing}
            >
              <RefreshCw size={16} className={isRefreshing ? 'spin-icon' : ''} />
              <span>Sincronizar</span>
            </button>
            <button className="cart-icon-btn" onClick={handleLogout} style={{ backgroundColor: 'var(--color-terracotta)' }}>
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="container" style={{ padding: '40px 0 60px 0' }}>
        <div className="admin-header">
          <div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2.2rem', color: 'var(--color-green-dark)' }}>
              Monitoreo de Órdenes Web
            </h1>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
              Gestiona los pedidos de los clientes en tiempo real. Se sincronizan directamente con Loyverse POS.
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '20px', fontSize: '0.9rem', backgroundColor: 'var(--color-cream-light)', padding: '10px 20px', borderRadius: '15px', border: '1px solid var(--color-ochre-light)' }}>
            <div>
              <span style={{ fontWeight: 600 }}>Pendientes Pago: </span>
              <strong style={{ color: 'var(--color-terracotta)', fontSize: '1.1rem' }}>{pendingPayments.length}</strong>
            </div>
            <div style={{ width: '1px', backgroundColor: 'var(--color-ochre)' }}></div>
            <div>
              <span style={{ fontWeight: 600 }}>Cocina - Revisión: </span>
              <strong style={{ color: 'var(--color-terracotta)', fontSize: '1.1rem' }}>{pendingOrders.length}</strong>
            </div>
            <div style={{ width: '1px', backgroundColor: 'var(--color-ochre)' }}></div>
            <div>
              <span style={{ fontWeight: 600 }}>Cocina - Preparando: </span>
              <strong style={{ color: 'var(--color-green-dark)', fontSize: '1.1rem' }}>{preparingOrders.length}</strong>
            </div>
          </div>
        </div>

        {/* TABS */}
        <div style={{ display: 'flex', gap: '20px', borderBottom: '2px solid #e5e7eb', marginBottom: '30px', paddingBottom: '10px' }}>
          <button 
            onClick={() => setActiveTab('cocina')}
            style={{ padding: '10px 20px', background: 'none', border: 'none', borderBottom: activeTab === 'cocina' ? '3px solid var(--color-green-dark)' : '3px solid transparent', fontWeight: activeTab === 'cocina' ? 700 : 500, fontSize: '1.1rem', color: activeTab === 'cocina' ? 'var(--color-green-dark)' : '#6b7280', cursor: 'pointer', transition: 'all 0.2s' }}
          >
            Vista Operativa (Cocina)
          </button>
          <button 
            onClick={() => setActiveTab('finanzas')}
            style={{ padding: '10px 20px', background: 'none', border: 'none', borderBottom: activeTab === 'finanzas' ? '3px solid var(--color-terracotta)' : '3px solid transparent', fontWeight: activeTab === 'finanzas' ? 700 : 500, fontSize: '1.1rem', color: activeTab === 'finanzas' ? 'var(--color-terracotta)' : '#6b7280', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s' }}
          >
            Validación Financiera
            {pendingPayments.length > 0 && (
              <span style={{ backgroundColor: 'var(--color-terracotta)', color: 'white', borderRadius: '50%', padding: '2px 8px', fontSize: '0.8rem', fontWeight: 700 }}>
                {pendingPayments.length}
              </span>
            )}
          </button>
          
          {can('can_scan_qr') && (
            <button 
              onClick={() => setActiveTab('edenpass')}
              style={{ padding: '10px 20px', background: 'none', border: 'none', borderBottom: activeTab === 'edenpass' ? '3px solid #8b5cf6' : '3px solid transparent', fontWeight: activeTab === 'edenpass' ? 700 : 500, fontSize: '1.1rem', color: activeTab === 'edenpass' ? '#8b5cf6' : '#6b7280', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s' }}
            >
              <ScanLine size={20} />
              EdenPass (Lealtad)
            </button>
          )}
          {can('can_manage_menu') && (
            <button 
              onClick={() => setActiveTab('menu')}
              style={{ padding: '10px 20px', background: 'none', border: 'none', borderBottom: activeTab === 'menu' ? '3px solid #047857' : '3px solid transparent', fontWeight: activeTab === 'menu' ? 700 : 500, fontSize: '1.1rem', color: activeTab === 'menu' ? '#047857' : '#6b7280', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s' }}
            >
              <ClipboardList size={20} />
              Menú
            </button>
          )}
          {can('can_manage_users') && (
            <button 
              onClick={() => setActiveTab('usuarios')}
              style={{ padding: '10px 20px', background: 'none', border: 'none', borderBottom: activeTab === 'usuarios' ? '3px solid #b91c1c' : '3px solid transparent', fontWeight: activeTab === 'usuarios' ? 700 : 500, fontSize: '1.1rem', color: activeTab === 'usuarios' ? '#b91c1c' : '#6b7280', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s' }}
            >
              <Users size={20} />
              Usuarios
            </button>
          )}
          {can('can_configure_bank') && (
            <button 
              onClick={() => setActiveTab('banco')}
              style={{ padding: '10px 20px', background: 'none', border: 'none', borderBottom: activeTab === 'banco' ? '3px solid #1d4ed8' : '3px solid transparent', fontWeight: activeTab === 'banco' ? 700 : 500, fontSize: '1.1rem', color: activeTab === 'banco' ? '#1d4ed8' : '#6b7280', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s' }}
            >
              <Landmark size={20} />
              Banco
            </button>
          )}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div className="status-animation-ring active" style={{ margin: '0 auto 20px auto', width: '50px', height: '50px' }}></div>
            <p>Cargando pedidos activos...</p>
          </div>
          <>
            {activeTab === 'cocina' && (
              <div className="admin-grid">
            {/* COLUMN 1: ORDERS LIST */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
              
              {/* ORDERS EN REVISIÓN */}
              <div className="admin-panel-section" style={{ borderLeft: '5px solid var(--color-terracotta)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}>
                  <Clock color="var(--color-terracotta)" />
                  <h2 style={{ fontSize: '1.4rem', color: 'var(--color-green-dark)' }}>Pedidos Recibidos (En Revisión)</h2>
                </div>

                {pendingOrders.length === 0 ? (
                  <p style={{ color: 'var(--color-text-muted)', fontStyle: 'italic', padding: '20px 0' }}>
                    No hay nuevos pedidos en espera. ¡Todo al día!
                  </p>
                ) : (
                  <div className="admin-orders-list">
                    {pendingOrders.map(order => (
                      <div key={order.id} className="admin-order-card en_revision">
                        <div className="admin-order-header">
                          <div className="admin-order-meta">
                            <span className="admin-order-id">Orden #{order.id.slice(-4).toUpperCase()}</span>
                            <span className="admin-order-client">
                              Cliente: <strong>{order.customer_name}</strong> | Tel: {order.customer_phone}
                            </span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                              Recibido: {new Date(order.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span style={{ fontWeight: 700, color: 'var(--color-terracotta)', fontSize: '0.9rem' }}>
                              Loyverse Ticket: {order.loyverse_receipt_number || 'Enviando...'}
                            </span>
                          </div>
                        </div>

                        {/* ITEMS BREAKDOWN */}
                        <div style={{ margin: '12px 0', padding: '12px', backgroundColor: 'var(--color-cream-dark)', borderRadius: '8px' }}>
                          <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '8px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <ClipboardList size={14} />
                            <span>Productos a preparar</span>
                          </h4>
                          {order.items.map((item, idx) => (
                            <div key={idx} style={{ fontSize: '0.9rem', marginBottom: '8px', borderBottom: idx < order.items.length - 1 ? '1px dashed rgba(0,0,0,0.05)' : 'none', paddingBottom: '4px' }}>
                              <strong>{item.quantity}x {item.name}</strong> {item.size && `(${item.size})`}
                              {item.customizations && (
                                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginLeft: '12px', marginTop: '2px' }}>
                                  {item.customizations.proteins.length > 0 && <div>• Prot: {item.customizations.proteins.join(', ')}</div>}
                                  {item.customizations.toppings.length > 0 && <div>• Toppings: {item.customizations.toppings.join(', ')}</div>}
                                  {item.customizations.seedsAndNuts.length > 0 && <div>• Semillas/Frutos: {item.customizations.seedsAndNuts.join(', ')}</div>}
                                  {item.customizations.dressings.length > 0 && <div>• Aderezo: {item.customizations.dressings.join(', ')}</div>}
                                  {item.customizations.flavors && item.customizations.flavors.length > 0 && <div>• Sabor: {item.customizations.flavors.join(', ')}</div>}
                                </div>
                              )}
                            </div>
                          ))}
                          
                          {order.notes && (
                            <div style={{ marginTop: '10px', fontSize: '0.8rem', borderLeft: '2px solid var(--color-terracotta)', paddingLeft: '8px', color: 'var(--color-terracotta)' }}>
                              <strong>Notas:</strong> "{order.notes}"
                            </div>
                          )}
                        </div>

                        <div className="admin-order-actions">
                          <button className="admin-btn admin-btn-accept" onClick={() => updateStatus(order.id, 'in_preparation')}>
                            Aceptar Pedido
                          </button>
                          <button className="admin-btn admin-btn-cancel" onClick={() => updateStatus(order.id, 'cancelled')}>
                            Rechazar / Falta Ingrediente
                          </button>
                          <a 
                            href={getWhatsAppCancelLink(order)} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="admin-btn"
                            style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#e0f2f1', color: '#00796b' }}
                          >
                            <MessageCircle size={14} />
                            <span>Mandar WhatsApp</span>
                          </a>
                          <span style={{ marginLeft: 'auto', fontWeight: 700, color: 'var(--color-green-dark)' }}>
                            Total: ${order.total}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ORDERS PREPARANDO */}
              <div className="admin-panel-section" style={{ borderLeft: '5px solid var(--color-green-dark)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}>
                  <ChefHat color="var(--color-green-dark)" />
                  <h2 style={{ fontSize: '1.4rem', color: 'var(--color-green-dark)' }}>Pedidos en Cocina (Preparando)</h2>
                </div>

                {preparingOrders.length === 0 ? (
                  <p style={{ color: 'var(--color-text-muted)', fontStyle: 'italic', padding: '20px 0' }}>
                    No hay pedidos en preparación actualmente.
                  </p>
                ) : (
                  <div className="admin-orders-list">
                    {preparingOrders.map(order => (
                      <div key={order.id} className="admin-order-card preparando">
                        <div className="admin-order-header">
                          <div className="admin-order-meta">
                            <span className="admin-order-id">Orden #{order.id.slice(-4).toUpperCase()}</span>
                            <span className="admin-order-client">
                              Cliente: <strong>{order.customer_name}</strong> | Tel: {order.customer_phone}
                            </span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                              En preparación...
                            </span>
                            <span style={{ fontWeight: 700, color: 'var(--color-green-dark)', fontSize: '0.9rem' }}>
                              Ticket: {order.loyverse_receipt_number}
                            </span>
                          </div>
                        </div>

                        {/* ITEMS BREAKDOWN */}
                        <div style={{ margin: '12px 0', padding: '12px', backgroundColor: 'var(--color-cream-dark)', borderRadius: '8px' }}>
                          {order.items.map((item, idx) => (
                            <div key={idx} style={{ fontSize: '0.9rem', marginBottom: '6px' }}>
                              <strong>{item.quantity}x {item.name}</strong> {item.size && `(${item.size})`}
                              {item.customizations && (
                                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginLeft: '12px' }}>
                                  {item.customizations.proteins.length > 0 && <span>Prot: {item.customizations.proteins.join(', ')} | </span>}
                                  {item.customizations.toppings.length > 0 && <span>Toppings: {item.customizations.toppings.join(', ')} | </span>}
                                  {item.customizations.seedsAndNuts.length > 0 && <span>Semillas: {item.customizations.seedsAndNuts.join(', ')} | </span>}
                                  {item.customizations.dressings.length > 0 && <span>Aderezo: {item.customizations.dressings.join(', ')} | </span>}
                                  {item.customizations.flavors && item.customizations.flavors.length > 0 && <span>Sabor: {item.customizations.flavors.join(', ')}</span>}
                                </div>
                              )}
                            </div>
                          ))}
                          {order.notes && (
                            <div style={{ marginTop: '10px', fontSize: '0.8rem', color: 'var(--color-terracotta)' }}>
                              <strong>Notas:</strong> "{order.notes}"
                            </div>
                          )}
                        </div>

                        <div className="admin-order-actions">
                          <button className="admin-btn admin-btn-ready" onClick={() => updateStatus(order.id, 'delivered')}>
                            Marcar como Listo / Notificar Cliente
                          </button>
                          <button className="admin-btn admin-btn-cancel" onClick={() => updateStatus(order.id, 'cancelled')}>
                            Cancelar Pedido
                          </button>
                          <span style={{ marginLeft: 'auto', fontWeight: 700, color: 'var(--color-green-dark)' }}>
                            Total: ${order.total}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* COLUMN 2: OPERATIONS INFO & SETTINGS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="admin-panel-section">
                <h3 style={{ fontSize: '1.2rem', marginBottom: '12px', color: 'var(--color-green-dark)' }}>Guía de Operaciones</h3>
                <ul style={{ paddingLeft: '18px', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '10px', color: 'var(--color-text-dark)' }}>
                  <li>
                    <strong>Paso 1:</strong> El cliente hace el pedido. Aparecerá en **En Revisión** y viajará automáticamente a la impresora/KDS de Loyverse.
                  </li>
                  <li>
                    <strong>Paso 2:</strong> Verifica los ingredientes físicos en tu cocina.
                  </li>
                  <li>
                    <strong>Paso 3 (Aceptar):</strong> Si tienes todo, presiona **Aceptar Pedido**. El cliente verá "Preparando Orden" en su celular en tiempo real.
                  </li>
                  <li>
                    <strong>Paso 3 (Rechazar):</strong> Si falta algún ingrediente crucial (ej. espinaca), presiona **Rechazar**. Se reembolsará el ticket en Loyverse de inmediato y podrás mandarles un mensaje pre-llenado de WhatsApp en un clic.
                  </li>
                  <li>
                    <strong>Paso 4:</strong> Una vez lista la comida, presiona **Marcar como Listo**. El cliente recibirá la alerta de recoger y realizar su cobro en la caja física.
                  </li>
                </ul>
              </div>

              <div className="admin-panel-section" style={{ backgroundColor: 'var(--color-ochre-light)', borderColor: 'var(--color-ochre)' }}>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '8px', color: 'var(--color-green-dark)' }}>
                  <AlertCircle size={18} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom' }} />
                  Información Técnica
                </h3>
                <p style={{ fontSize: '0.8rem', lineHeight: '1.4' }}>
                  El sistema está operando en <strong>Modo Sincronizado Completo</strong>. Si hay variables de Supabase configuradas, actualizará mediante WebSockets. De lo contrario, opera en modo de sondeo optimizado localmente para garantizar el servicio continuo.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'finanzas' && (
            <div style={{ display: 'flex', gap: '30px', alignItems: 'flex-start' }}>
              {/* Lista */}
              <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '15px', maxHeight: '70vh', overflowY: 'auto', paddingRight: '10px' }}>
                <h3 style={{ color: 'var(--color-text-dark)', marginBottom: '5px' }}>Comprobantes Pendientes</h3>
                 {pendingPayments.map(p => (
                   <div key={p.id} onClick={() => viewProof(p.id)} style={{ padding: '15px', border: activeFinancialOrder === p.id ? '2px solid var(--color-terracotta)' : '1px solid #e5e7eb', borderRadius: '10px', cursor: 'pointer', backgroundColor: activeFinancialOrder === p.id ? '#fff5f5' : 'white', transition: 'all 0.2s' }}>
                      <div style={{ fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
                        <span>Orden #{p.id.slice(-4).toUpperCase()}</span>
                        <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>{new Date(p.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#4b5563', marginTop: '4px' }}>{p.customer_name} | {p.customer_phone}</div>
                      <div style={{ fontWeight: 700, color: 'var(--color-green-dark)', marginTop: '8px' }}>${p.total}</div>
                   </div>
                 ))}
                 {pendingPayments.length === 0 && (
                   <div style={{ backgroundColor: '#f9fafb', padding: '30px', borderRadius: '15px', textAlign: 'center', color: '#6b7280', fontStyle: 'italic', border: '1px dashed #d1d5db' }}>
                     No hay comprobantes pendientes de validación.
                   </div>
                 )}
              </div>
              
              {/* Detalle */}
              <div style={{ flex: '2', backgroundColor: '#f9fafb', borderRadius: '15px', padding: '30px', border: '1px solid #e5e7eb', minHeight: '60vh' }}>
                 {!activeFinancialOrder ? (
                   <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#6b7280' }}>
                     <ClipboardList size={48} color="#d1d5db" style={{ marginBottom: '15px' }} />
                     <p>Selecciona una orden de la lista para revisar su comprobante.</p>
                   </div>
                 ) : (
                   <div>
                      <h3 style={{ marginBottom: '20px', color: 'var(--color-green-dark)' }}>Revisando Comprobante</h3>
                      {!selectedProofUrl ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '50px' }}>
                          <div className="status-animation-ring active" style={{ width: '40px', height: '40px' }}></div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                          <div style={{ border: '1px solid #d1d5db', borderRadius: '10px', overflow: 'hidden', backgroundColor: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px', padding: '10px' }}>
                            {selectedProofUrl.split('?')[0].toLowerCase().endsWith('.pdf') ? (
                              <iframe src={selectedProofUrl} style={{ width: '100%', height: '500px', border: 'none' }} title="Comprobante" />
                            ) : (
                              <a href={selectedProofUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'block', cursor: 'zoom-in' }}>
                                <img src={selectedProofUrl} alt="Comprobante" style={{ maxWidth: '100%', maxHeight: '500px', objectFit: 'contain' }} />
                              </a>
                            )}
                          </div>
                          
                           {/* Esta protección es solo de experiencia de usuario, la autorización real ocurre en el backend vía requireRole() */}
                           {can('can_approve_payments') ? (
                             <div style={{ display: 'flex', gap: '15px', alignItems: 'stretch' }}>
                               <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                 <input 
                                   type="text" 
                                   placeholder="Motivo (obligatorio si rechazas)" 
                                   value={rejectReason}
                                   onChange={(e) => setRejectReason(e.target.value)}
                                   style={{ padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', width: '100%', fontSize: '0.9rem' }}
                                 />
                                 <button onClick={() => rejectPayment(activeFinancialOrder)} style={{ backgroundColor: '#ef4444', color: 'white', padding: '12px', borderRadius: '8px', border: 'none', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                   <X size={18} /> Rechazar Pago
                                 </button>
                               </div>
                               <button onClick={() => approvePayment(activeFinancialOrder)} style={{ flex: 1, backgroundColor: 'var(--color-green-dark)', color: 'white', padding: '12px', borderRadius: '8px', border: 'none', fontWeight: 700, fontSize: '1.1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                                 <Check size={24} /> Aprobar Pago
                               </button>
                             </div>
                           ) : (
                             <div style={{ padding: '15px', backgroundColor: '#fef3c7', color: '#92400e', borderRadius: '8px', textAlign: 'center' }}>
                               No tienes permisos para aprobar pagos.
                             </div>
                           )}
                        </div>
                      )}
                   </div>
                 )}
              </div>
            </div>
          )}

          {activeTab === 'edenpass' && (
            <div style={{ display: 'flex', gap: '30px', alignItems: 'flex-start' }}>
              
              {/* ESCÁNER Y BÚSQUEDA */}
              <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '15px', border: '1px solid #e5e7eb' }}>
                  <h3 style={{ color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}>
                    <ScanLine size={20} /> Escáner de Código QR
                  </h3>
                  
                  {scannerActive ? (
                    <div id="reader" style={{ width: '100%', overflow: 'hidden', borderRadius: '8px' }}></div>
                  ) : (
                    <button 
                      onClick={() => setScannerActive(true)}
                      style={{ width: '100%', padding: '15px', backgroundColor: '#f3f4f6', border: '2px dashed #d1d5db', borderRadius: '10px', color: '#4b5563', fontWeight: 600, cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                    >
                      <ScanLine size={20} /> Iniciar Cámara
                    </button>
                  )}
                  
                  {edenPassError && (
                    <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#ef4444', borderRadius: '8px', fontSize: '0.9rem', textAlign: 'center' }}>
                      {edenPassError}
                    </div>
                  )}
                </div>

                <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '15px', border: '1px solid #e5e7eb' }}>
                  <h3 style={{ color: '#4b5563', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px', fontSize: '1rem' }}>
                    <Search size={18} /> Búsqueda Manual
                  </h3>
                  <form onSubmit={searchPhone} style={{ display: 'flex', gap: '10px' }}>
                    <input 
                      type="tel" 
                      placeholder="Teléfono (ej. 52...)" 
                      value={phoneSearchQuery}
                      onChange={(e) => setPhoneSearchQuery(e.target.value)}
                      style={{ flex: '1', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px' }}
                    />
                    <button type="submit" style={{ padding: '10px 15px', backgroundColor: '#4b5563', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                      Buscar
                    </button>
                  </form>
                </div>
              </div>

              {/* PERFIL Y BENEFICIOS */}
              <div style={{ flex: '2', backgroundColor: '#f9fafb', borderRadius: '15px', padding: '30px', border: '1px solid #e5e7eb', minHeight: '60vh' }}>
                {!customerProfile ? (
                   <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af' }}>
                     <UserCircle size={64} style={{ marginBottom: '15px', opacity: 0.5 }} />
                     <p>Escanea un código QR o busca un teléfono para ver el perfil.</p>
                   </div>
                ) : (
                  <div className="animate-fade-in">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '30px', borderBottom: '1px solid #e5e7eb', paddingBottom: '20px' }}>
                      <div>
                        <h2 style={{ fontSize: '2rem', color: '#111827', fontWeight: 800, marginBottom: '5px' }}>{customerProfile.name}</h2>
                        <div style={{ color: '#6b7280', fontSize: '1rem' }}>{customerProfile.phone}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.9rem', color: '#6b7280', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '1px' }}>{customerProfile.loyalty_tier}</div>
                        <div style={{ fontSize: '2.5rem', color: '#8b5cf6', fontWeight: 900, lineHeight: '1' }}>{customerProfile.loyalty_points} <span style={{ fontSize: '1rem', color: '#9ca3af', fontWeight: 600 }}>pts</span></div>
                      </div>
                    </div>

                    <h3 style={{ fontSize: '1.2rem', color: '#374151', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Award size={20} color="#8b5cf6" /> Recompensas Disponibles
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '15px' }}>
                      {loyaltyBenefits.length === 0 ? (
                        <div style={{ gridColumn: '1 / -1', padding: '20px', backgroundColor: '#f3f4f6', borderRadius: '10px', textAlign: 'center', color: '#6b7280' }}>
                          No hay beneficios configurados en el sistema.
                        </div>
                      ) : (
                        loyaltyBenefits.map(benefit => {
                          const canAfford = customerProfile.loyalty_points >= benefit.points_required;
                          return (
                            <div key={benefit.id} style={{ border: `1px solid ${canAfford ? '#8b5cf6' : '#e5e7eb'}`, borderRadius: '12px', padding: '15px', backgroundColor: 'white', opacity: benefit.active ? 1 : 0.6, position: 'relative', overflow: 'hidden' }}>
                              {!canAfford && (
                                <div style={{ position: 'absolute', top: 0, right: 0, backgroundColor: '#f3f4f6', color: '#6b7280', fontSize: '0.75rem', padding: '2px 8px', borderBottomLeftRadius: '8px', fontWeight: 600 }}>
                                  Faltan {benefit.points_required - customerProfile.loyalty_points} pts
                                </div>
                              )}
                              <h4 style={{ fontSize: '1.1rem', color: canAfford ? '#111827' : '#9ca3af', fontWeight: 700, marginBottom: '5px' }}>{benefit.name}</h4>
                              <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '15px', minHeight: '40px' }}>{benefit.description}</p>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontWeight: 800, color: canAfford ? '#8b5cf6' : '#9ca3af' }}>{benefit.points_required} pts</span>
                                <button 
                                  disabled={!canAfford || !benefit.active || isRedeeming}
                                  onClick={() => redeemBenefit(benefit.id, benefit.name)}
                                  style={{ padding: '8px 15px', borderRadius: '6px', backgroundColor: canAfford && benefit.active ? '#8b5cf6' : '#e5e7eb', color: canAfford && benefit.active ? 'white' : '#9ca3af', border: 'none', fontWeight: 600, cursor: canAfford && benefit.active ? 'pointer' : 'not-allowed' }}
                                >
                                  Canjear
                                </button>
                              </div>
                            </div>
                          );
                </ul>
              </div>

              <div className="admin-panel-section" style={{ backgroundColor: 'var(--color-ochre-light)', borderColor: 'var(--color-ochre)' }}>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '8px', color: 'var(--color-green-dark)' }}>
                  <AlertCircle size={18} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom' }} />
                  Información Técnica
                </h3>
                <p style={{ fontSize: '0.8rem', lineHeight: '1.4' }}>
                  El sistema está operando en <strong>Modo Sincronizado Completo</strong>. Si hay variables de Supabase configuradas, actualizará mediante WebSockets. De lo contrario, opera en modo de sondeo optimizado localmente para garantizar el servicio continuo.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'finanzas' && (
            <div style={{ display: 'flex', gap: '30px', alignItems: 'flex-start' }}>
              {/* Lista */}
              <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '15px', maxHeight: '70vh', overflowY: 'auto', paddingRight: '10px' }}>
                <h3 style={{ color: 'var(--color-text-dark)', marginBottom: '5px' }}>Comprobantes Pendientes</h3>
                 {pendingPayments.map(p => (
                   <div key={p.id} onClick={() => viewProof(p.id)} style={{ padding: '15px', border: activeFinancialOrder === p.id ? '2px solid var(--color-terracotta)' : '1px solid #e5e7eb', borderRadius: '10px', cursor: 'pointer', backgroundColor: activeFinancialOrder === p.id ? '#fff5f5' : 'white', transition: 'all 0.2s' }}>
                      <div style={{ fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
                        <span>Orden #{p.id.slice(-4).toUpperCase()}</span>
                        <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>{new Date(p.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#4b5563', marginTop: '4px' }}>{p.customer_name} | {p.customer_phone}</div>
                      <div style={{ fontWeight: 700, color: 'var(--color-green-dark)', marginTop: '8px' }}>${p.total}</div>
                   </div>
                 ))}
                 {pendingPayments.length === 0 && (
                   <div style={{ backgroundColor: '#f9fafb', padding: '30px', borderRadius: '15px', textAlign: 'center', color: '#6b7280', fontStyle: 'italic', border: '1px dashed #d1d5db' }}>
                     No hay comprobantes pendientes de validación.
                   </div>
                 )}
              </div>
              
              {/* Detalle */}
              <div style={{ flex: '2', backgroundColor: '#f9fafb', borderRadius: '15px', padding: '30px', border: '1px solid #e5e7eb', minHeight: '60vh' }}>
                 {!activeFinancialOrder ? (
                   <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#6b7280' }}>
                     <ClipboardList size={48} color="#d1d5db" style={{ marginBottom: '15px' }} />
                     <p>Selecciona una orden de la lista para revisar su comprobante.</p>
                   </div>
                 ) : (
                   <div>
                      <h3 style={{ marginBottom: '20px', color: 'var(--color-green-dark)' }}>Revisando Comprobante</h3>
                      {!selectedProofUrl ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '50px' }}>
                          <div className="status-animation-ring active" style={{ width: '40px', height: '40px' }}></div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                          <div style={{ border: '1px solid #d1d5db', borderRadius: '10px', overflow: 'hidden', backgroundColor: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px', padding: '10px' }}>
                            {selectedProofUrl.split('?')[0].toLowerCase().endsWith('.pdf') ? (
                              <iframe src={selectedProofUrl} style={{ width: '100%', height: '500px', border: 'none' }} title="Comprobante" />
                            ) : (
                              <a href={selectedProofUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'block', cursor: 'zoom-in' }}>
                                <img src={selectedProofUrl} alt="Comprobante" style={{ maxWidth: '100%', maxHeight: '500px', objectFit: 'contain' }} />
                              </a>
                            )}
                          </div>
                          
                           {/* Esta protección es solo de experiencia de usuario, la autorización real ocurre en el backend vía requireRole() */}
                           {can('can_approve_payments') ? (
                             <div style={{ display: 'flex', gap: '15px', alignItems: 'stretch' }}>
                               <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                 <input 
                                   type="text" 
                                   placeholder="Motivo (obligatorio si rechazas)" 
                                   value={rejectReason}
                                   onChange={(e) => setRejectReason(e.target.value)}
                                   style={{ padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', width: '100%', fontSize: '0.9rem' }}
                                 />
                                 <button onClick={() => rejectPayment(activeFinancialOrder)} style={{ backgroundColor: '#ef4444', color: 'white', padding: '12px', borderRadius: '8px', border: 'none', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                   <X size={18} /> Rechazar Pago
                                 </button>
                               </div>
                               <button onClick={() => approvePayment(activeFinancialOrder)} style={{ flex: 1, backgroundColor: 'var(--color-green-dark)', color: 'white', padding: '12px', borderRadius: '8px', border: 'none', fontWeight: 700, fontSize: '1.1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                                 <Check size={24} /> Aprobar Pago
                               </button>
                             </div>
                           ) : (
                             <div style={{ padding: '15px', backgroundColor: '#fef3c7', color: '#92400e', borderRadius: '8px', textAlign: 'center' }}>
                               No tienes permisos para aprobar pagos.
                             </div>
                           )}
                        </div>
                      )}
                   </div>
                 )}
              </div>
            </div>
          )}

          {activeTab === 'edenpass' && (
            <div style={{ display: 'flex', gap: '30px', alignItems: 'flex-start' }}>
              
              {/* ESCÁNER Y BÚSQUEDA */}
              <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '15px', border: '1px solid #e5e7eb' }}>
                  <h3 style={{ color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}>
                    <ScanLine size={20} /> Escáner de Código QR
                  </h3>
                  
                  {scannerActive ? (
                    <div id="reader" style={{ width: '100%', overflow: 'hidden', borderRadius: '8px' }}></div>
                  ) : (
                    <button 
                      onClick={() => setScannerActive(true)}
                      style={{ width: '100%', padding: '15px', backgroundColor: '#f3f4f6', border: '2px dashed #d1d5db', borderRadius: '10px', color: '#4b5563', fontWeight: 600, cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                    >
                      <ScanLine size={20} /> Iniciar Cámara
                    </button>
                  )}
                  
                  {edenPassError && (
                    <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#ef4444', borderRadius: '8px', fontSize: '0.9rem', textAlign: 'center' }}>
                      {edenPassError}
                    </div>
                  )}
                </div>

                <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '15px', border: '1px solid #e5e7eb' }}>
                  <h3 style={{ color: '#4b5563', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px', fontSize: '1rem' }}>
                    <Search size={18} /> Búsqueda Manual
                  </h3>
                  <form onSubmit={searchPhone} style={{ display: 'flex', gap: '10px' }}>
                    <input 
                      type="tel" 
                      placeholder="Teléfono (ej. 52...)" 
                      value={phoneSearchQuery}
                      onChange={(e) => setPhoneSearchQuery(e.target.value)}
                      style={{ flex: '1', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px' }}
                    />
                    <button type="submit" style={{ padding: '10px 15px', backgroundColor: '#4b5563', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                      Buscar
                    </button>
                  </form>
                </div>
              </div>

              {/* PERFIL Y BENEFICIOS */}
              <div style={{ flex: '2', backgroundColor: '#f9fafb', borderRadius: '15px', padding: '30px', border: '1px solid #e5e7eb', minHeight: '60vh' }}>
                {!customerProfile ? (
                   <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af' }}>
                     <UserCircle size={64} style={{ marginBottom: '15px', opacity: 0.5 }} />
                     <p>Escanea un código QR o busca un teléfono para ver el perfil.</p>
                   </div>
                ) : (
                  <div className="animate-fade-in">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '30px', borderBottom: '1px solid #e5e7eb', paddingBottom: '20px' }}>
                      <div>
                        <h2 style={{ fontSize: '2rem', color: '#111827', fontWeight: 800, marginBottom: '5px' }}>{customerProfile.name}</h2>
                        <div style={{ color: '#6b7280', fontSize: '1rem' }}>{customerProfile.phone}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.9rem', color: '#6b7280', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '1px' }}>{customerProfile.loyalty_tier}</div>
                        <div style={{ fontSize: '2.5rem', color: '#8b5cf6', fontWeight: 900, lineHeight: '1' }}>{customerProfile.loyalty_points} <span style={{ fontSize: '1rem', color: '#9ca3af', fontWeight: 600 }}>pts</span></div>
                      </div>
                    </div>

                    <h3 style={{ fontSize: '1.2rem', color: '#374151', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Award size={20} color="#8b5cf6" /> Recompensas Disponibles
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '15px' }}>
                      {loyaltyBenefits.length === 0 ? (
                        <div style={{ gridColumn: '1 / -1', padding: '20px', backgroundColor: '#f3f4f6', borderRadius: '10px', textAlign: 'center', color: '#6b7280' }}>
                          No hay beneficios configurados en el sistema.
                        </div>
                      ) : (
                        loyaltyBenefits.map(benefit => {
                          const canAfford = customerProfile.loyalty_points >= benefit.points_required;
                          return (
                            <div key={benefit.id} style={{ border: `1px solid ${canAfford ? '#8b5cf6' : '#e5e7eb'}`, borderRadius: '12px', padding: '15px', backgroundColor: 'white', opacity: benefit.active ? 1 : 0.6, position: 'relative', overflow: 'hidden' }}>
                              {!canAfford && (
                                <div style={{ position: 'absolute', top: 0, right: 0, backgroundColor: '#f3f4f6', color: '#6b7280', fontSize: '0.75rem', padding: '2px 8px', borderBottomLeftRadius: '8px', fontWeight: 600 }}>
                                  Faltan {benefit.points_required - customerProfile.loyalty_points} pts
                                </div>
                              )}
                              <h4 style={{ fontSize: '1.1rem', color: canAfford ? '#111827' : '#9ca3af', fontWeight: 700, marginBottom: '5px' }}>{benefit.name}</h4>
                              <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '15px', minHeight: '40px' }}>{benefit.description}</p>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontWeight: 800, color: canAfford ? '#8b5cf6' : '#9ca3af' }}>{benefit.points_required} pts</span>
                                <button 
                                  disabled={!canAfford || !benefit.active || isRedeeming}
                                  onClick={() => redeemBenefit(benefit.id, benefit.name)}
                                  style={{ padding: '8px 15px', borderRadius: '6px', backgroundColor: canAfford && benefit.active ? '#8b5cf6' : '#e5e7eb', color: canAfford && benefit.active ? 'white' : '#9ca3af', border: 'none', fontWeight: 600, cursor: canAfford && benefit.active ? 'pointer' : 'not-allowed' }}
                                >
                                  Canjear
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'menu' && (
            <MenuManager accessToken={accessToken} />
          )}

          {activeTab === 'usuarios' && (
            <UsersManager accessToken={accessToken} />
          )}

          {activeTab === 'banco' && (
            <BankConfigManager accessToken={accessToken} />
          )}
        </>
      </main>
    </>
  );
}
