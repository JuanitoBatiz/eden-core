'use client';

import React, { useState, useEffect } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import MenuManager from '@/components/admin/MenuManager';
import UsersManager from '@/components/admin/UsersManager';
import BankConfigManager from '@/components/admin/BankConfigManager';
import RefundsManager from '@/components/admin/RefundsManager';
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
import KanbanBoard from '@/components/admin/KanbanBoard';
import FinanceApproval from '@/components/admin/FinanceApproval';
import EdenPassScanner from '@/components/admin/EdenPassScanner';
import Image from 'next/image';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { QrValidateRequest, RedeemBenefitRequest, OrderRejectPaymentRequest, OrderStatusUpdateRequest, Order } from '@/types/api-contracts';

export default function AdminPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const { can, loading: permsLoading } = usePermissions();

  // Financial Tab State
  const [activeTab, setActiveTab] = useState<'cocina' | 'finanzas' | 'reembolsos' | 'edenpass' | 'menu' | 'usuarios' | 'banco'>('cocina');
  const [pendingPayments, setPendingPayments] = useState<Order[]>([]);
  const [auditOrders, setAuditOrders] = useState<Order[]>([]);
  const [activeFinancialOrder, setActiveFinancialOrder] = useState<string | null>(null);
  const [selectedProofUrl, setSelectedProofUrl] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

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

  // Handle 401s universally
  const handleUnauthorized = (status: number) => {
    if (status === 401) {
      window.location.href = '/?login=true';
      return true;
    }
    return false;
  };

  // Fetch active orders
  const fetchOrders = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/orders', { credentials: 'include' });
      if (handleUnauthorized(res.status)) return;
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
      if (handleUnauthorized(res.status)) return;
      const data = await res.json();
      if (res.ok) {
        setPendingPayments(data.pendingPayments);
      }
    } catch (e) {
      console.error('Error fetching pending payments:', e);
    }
  };

  const fetchAuditOrders = async () => {
    try {
      const res = await fetch('/api/admin/finances/audit', { credentials: 'include' });
      if (handleUnauthorized(res.status)) return;
      const data = await res.json();
      if (res.ok) {
        setAuditOrders(data.auditOrders);
      }
    } catch (e) {
      console.error('Error fetching audit orders:', e);
    }
  };

  const cleanupOldProofs = async () => {
    try {
      await fetch('/api/admin/finances/cleanup', { method: 'DELETE', credentials: 'include' });
    } catch (e) {
      console.error('Error running cleanup:', e);
    }
  };

  // Setup Polling
  useEffect(() => {
    if (!authChecked) return;
    
    fetchOrders();
    fetchPendingPayments();
    fetchAuditOrders();
    cleanupOldProofs();

    let isMounted = true;
    let timerId: NodeJS.Timeout;

    const poll = async () => {
      if (!isMounted) return;
      try {
        await Promise.all([
          fetchOrders(),
          fetchPendingPayments(),
          fetchAuditOrders()
        ]);
      } catch (error) {
        console.error('Error during polling:', error);
      } finally {
        if (isMounted) {
          timerId = setTimeout(poll, 4000);
        }
      }
    };

    poll();

    return () => {
      isMounted = false;
      clearTimeout(timerId);
    };
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
        setPendingPayments(prev => prev.filter((p: any) => p.id !== id));
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
        setPendingPayments(prev => prev.filter((p: any) => p.id !== id));
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
  const updateStatus = async (id: string, newStatus: string) => {
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
        setOrders(prev => prev.map((o: any) => o.id === id ? { ...o, status: newStatus } : o).filter((o: any) => o.status !== 'delivered' && o.status !== 'cancelled'));
      } else {
        const errorData = await res.json();
        alert(errorData.error || 'Error al actualizar el estado.');
      }
    } catch (error) {
      console.error('Error updating order status:', error);
    }
  };

  // Confirm delivery fee (cashier/admin quotes shipping cost manually)
  const handleSetDeliveryFee = async (orderId: string, fee: number): Promise<void> => {
    try {
      const res = await fetch(`/api/orders/${orderId}/delivery-fee`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ delivery_fee: fee })
      });

      if (res.ok) {
        // Optimistic update: mark fee as confirmed in local state
        setOrders(prev => prev.map((o: any) =>
          o.id === orderId
            ? { ...o, delivery_fee: fee, delivery_fee_confirmed: true }
            : o
        ));
      } else {
        const errorData = await res.json();
        alert(errorData.error || 'Error al confirmar la tarifa de envío.');
      }
    } catch (error) {
      console.error('Error setting delivery fee:', error);
      alert('Error de red al confirmar la tarifa.');
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

  const pendingOrders = orders.filter((o: any) => o.status === 'received');
  const preparingOrders = orders.filter((o: any) => o.status === 'in_preparation');
  const readyOrders = orders.filter((o: any) => o.status === 'ready');
  const inTransitOrders = orders.filter((o: any) => o.status === 'in_transit');

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
              onClick={() => fetchOrders()} 
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

      <main className="container" style={{ paddingTop: '40px', paddingBottom: '60px' }}>
        <div className="admin-header">
          <div>
            <h1 className="admin-page-title" style={{ fontFamily: 'var(--font-serif)', color: 'var(--color-green-dark)' }}>
              Monitoreo de Órdenes Web
            </h1>
            <p className="admin-page-subtitle" style={{ color: 'var(--color-text-muted)' }}>
              Gestiona los pedidos de los clientes en tiempo real. Se sincronizan directamente con Loyverse POS.
            </p>
          </div>
          
          <div className="admin-header-stats">
            <div>
              <span style={{ fontWeight: 600 }}>Pendientes Pago: </span>
              <strong style={{ color: 'var(--color-terracotta)', fontSize: '1.1rem' }}>{pendingPayments.length}</strong>
            </div>
            <div className="divider" style={{ width: '1px', backgroundColor: 'var(--color-ochre)', height: '20px' }}></div>
            <div>
              <span style={{ fontWeight: 600 }}>Cocina - Revisión: </span>
              <strong style={{ color: 'var(--color-terracotta)', fontSize: '1.1rem' }}>{pendingOrders.length}</strong>
            </div>
            <div className="divider" style={{ width: '1px', backgroundColor: 'var(--color-ochre)', height: '20px' }}></div>
            <div>
              <span style={{ fontWeight: 600 }}>Cocina - Preparando: </span>
              <strong style={{ color: 'var(--color-green-dark)', fontSize: '1.1rem' }}>{preparingOrders.length}</strong>
            </div>
            <div className="divider" style={{ width: '1px', backgroundColor: 'var(--color-ochre)', height: '20px' }}></div>
            <div>
              <span style={{ fontWeight: 600 }}>Listas / En Camino: </span>
              <strong style={{ color: '#0284c7', fontSize: '1.1rem' }}>{readyOrders.length + inTransitOrders.length}</strong>
            </div>
          </div>
        </div>

        {/* TABS */}
        <div className="admin-tabs">
          <button 
            onClick={() => setActiveTab('cocina')}
            className={`admin-tab-btn ${activeTab === 'cocina' ? 'active active-cocina' : ''}`}
          >
            Vista Operativa (Cocina)
          </button>
          <button 
            onClick={() => setActiveTab('finanzas')}
            className={`admin-tab-btn ${activeTab === 'finanzas' ? 'active active-finanzas' : ''}`}
          >
            Validación Financiera
            {pendingPayments.length > 0 && (
              <span style={{ backgroundColor: 'var(--color-terracotta)', color: 'white', borderRadius: '50%', padding: '2px 8px', fontSize: '0.8rem', fontWeight: 700 }}>
                {pendingPayments.length}
              </span>
            )}
          </button>
          
          <button 
            onClick={() => setActiveTab('reembolsos')}
            className={`admin-tab-btn ${activeTab === 'reembolsos' ? 'active active-finanzas' : ''}`}
            style={activeTab === 'reembolsos' ? { borderColor: '#8b5cf6', color: '#8b5cf6' } : {}}
          >
            Reembolsos
          </button>
          
          {can('can_scan_qr') && (
            <button 
              onClick={() => setActiveTab('edenpass')}
              className={`admin-tab-btn ${activeTab === 'edenpass' ? 'active active-edenpass' : ''}`}
            >
              <ScanLine size={20} />
              EdenPass (Lealtad)
            </button>
          )}
          {can('can_manage_menu') && (
            <button 
              onClick={() => setActiveTab('menu')}
              className={`admin-tab-btn ${activeTab === 'menu' ? 'active active-menu' : ''}`}
            >
              <ClipboardList size={20} />
              Menú
            </button>
          )}
          {can('can_manage_users') && (
            <button 
              onClick={() => setActiveTab('usuarios')}
              className={`admin-tab-btn ${activeTab === 'usuarios' ? 'active active-usuarios' : ''}`}
            >
              <Users size={20} />
              Usuarios
            </button>
          )}
          {can('can_configure_bank') && (
            <button 
              onClick={() => setActiveTab('banco')}
              className={`admin-tab-btn ${activeTab === 'banco' ? 'active active-banco' : ''}`}
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
        ) : (
          <>
            {activeTab === 'cocina' && (
              <KanbanBoard 
                pendingOrders={pendingOrders}
                preparingOrders={preparingOrders}
                readyOrders={readyOrders}
                inTransitOrders={inTransitOrders}
                updateStatus={updateStatus}
                setDeliveryFee={handleSetDeliveryFee}
                getWhatsAppCancelLink={getWhatsAppCancelLink}
              />
            )}

            {activeTab === 'finanzas' && (
              <FinanceApproval 
                pendingPayments={pendingPayments}
                auditOrders={auditOrders}
                activeFinancialOrder={activeFinancialOrder}
                selectedProofUrl={selectedProofUrl}
                rejectReason={rejectReason}
                canApprovePayments={can('can_approve_payments')}
                setRejectReason={setRejectReason}
                viewProof={viewProof}
                approvePayment={approvePayment}
                rejectPayment={rejectPayment}
              />
            )}

            {activeTab === 'reembolsos' && (
              <RefundsManager />
            )}

            {activeTab === 'edenpass' && (
              <EdenPassScanner 
                scannerActive={scannerActive}
                setScannerActive={setScannerActive}
                phoneSearchQuery={phoneSearchQuery}
                setPhoneSearchQuery={setPhoneSearchQuery}
                searchPhone={searchPhone}
                edenPassError={edenPassError}
                customerProfile={customerProfile}
                loyaltyBenefits={loyaltyBenefits}
                isRedeeming={isRedeeming}
                redeemBenefit={redeemBenefit}
              />
            )}

            {activeTab === 'menu' && (
              <MenuManager accessToken={''} />
            )}

            {activeTab === 'usuarios' && (
              <UsersManager accessToken={''} />
            )}

            {activeTab === 'banco' && (
              <BankConfigManager accessToken={''} />
            )}
          </>
        )}
      </main>
    </>
  );
}
