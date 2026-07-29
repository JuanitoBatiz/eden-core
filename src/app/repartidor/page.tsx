'use client';

/**
 * /repartidor — Panel del Repartidor
 * ====================================
 * Vista tipo "Uber" para el cajero que lleva los pedidos a domicilio.
 * Muestra solo pedidos de delivery en estado: en_preparación, listo, en_tránsito.
 * Permite:
 *   - Ver dirección + botón "Abrir en Maps" de un toque
 *   - Avanzar el estado del pedido directamente
 *   - Llamar al cliente directamente
 *   - Auto-refrescar cada 30s con Supabase Realtime como fallback
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Bike, Phone, MapPin, CheckCircle2, Clock, PackageCheck,
  RefreshCw, ExternalLink, Navigation, ChefHat, User,
  LogOut, Loader2, Package
} from 'lucide-react';

interface DeliveryOrder {
  id: string;
  customer_name: string;
  customer_phone: string;
  delivery_address?: string;
  delivery_lat?: number | null;
  delivery_lng?: number | null;
  delivery_distance_km?: number | null;
  delivery_fee?: number | null;
  delivery_fee_confirmed?: boolean;
  status: string;
  total: number;
  created_at: string;
  items: any[];
  notes?: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  in_preparation: { label: 'En preparación', color: '#1B3B2B', bg: '#d1fae5', icon: ChefHat },
  ready:          { label: 'Listo para enviar', color: '#d97706', bg: '#fef3c7', icon: PackageCheck },
  in_transit:     { label: 'En camino', color: '#0284c7', bg: '#e0f2fe', icon: Bike },
};

const NEXT_STATUS: Record<string, string> = {
  in_preparation: 'ready',
  ready:          'in_transit',
  in_transit:     'delivered',
};

const NEXT_LABEL: Record<string, string> = {
  in_preparation: 'Marcar como Lista ✓',
  ready:          'Salir a entregar 🛵',
  in_transit:     'Confirmar entrega ✓',
};

// Genera el deep-link a Google Maps con navegación vuelta al restaurante
const buildMapsNavUrl = (order: DeliveryOrder): string => {
  if (order.delivery_lat && order.delivery_lng) {
    return `https://www.google.com/maps/search/?api=1&query=${order.delivery_lat},${order.delivery_lng}`;
  }
  if (order.delivery_address) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(order.delivery_address)}&travelmode=driving`;
  }
  return '';
};

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

const formatElapsed = (iso: string): string => {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
};

export default function RepartidorPage() {
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<DeliveryOrder | null>(null);
  const [elapsed, setElapsed] = useState<Record<string, string>>({});
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchOrders = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setIsRefreshing(true);

    try {
      const res = await fetch('/api/orders/delivery', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const newOrders: DeliveryOrder[] = data.orders ?? [];
        setOrders(newOrders);
        setLastRefresh(new Date());
        // Si el orden seleccionado fue actualizado, refrescar modal
        setSelectedOrder(prev => {
          if (!prev) return prev;
          const updated = newOrders.find(o => o.id === prev.id);
          return updated ?? null;
        });
      }
    } catch (err) {
      console.error('Error fetching delivery orders:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Carga inicial + poll cada 30s
  const isFetchingRef = useRef(false);
  
  useEffect(() => {
    fetchOrders();
    intervalRef.current = setInterval(() => {
      if (!isFetchingRef.current) {
        isFetchingRef.current = true;
        fetchOrders(true).finally(() => { isFetchingRef.current = false; });
      }
    }, 30000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchOrders]);

  // Temporizador de tiempo transcurrido (actualiza cada minuto)
  useEffect(() => {
    const tick = () => {
      setElapsed(
        Object.fromEntries(orders.map(o => [o.id, formatElapsed(o.created_at)]))
      );
    };
    tick();
    const t = setInterval(tick, 60000);
    return () => clearInterval(t);
  }, [orders]);

  const handleAdvanceStatus = async (order: DeliveryOrder) => {
    const next = NEXT_STATUS[order.status];
    if (!next) return;

    setUpdatingId(order.id);
    try {
      const res = await fetch(`/api/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: next }),
      });

      if (res.ok) {
        if (next === 'delivered') {
          // Quitar de la lista si ya fue entregada
          setOrders(prev => prev.filter(o => o.id !== order.id));
          setSelectedOrder(null);
        } else {
          setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: next } : o));
          setSelectedOrder(prev => prev?.id === order.id ? { ...prev, status: next } : prev);
        }
      }
    } catch (err) {
      console.error('Error updating order status:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={styles.loadingScreen}>
        <Loader2 size={32} color="#1B3B2B" style={{ animation: 'spin 1s linear infinite' }} />
        <span style={{ color: '#1B3B2B', fontWeight: 600, marginTop: '12px' }}>Cargando pedidos...</span>
      </div>
    );
  }

  // ── Modal detalle de orden ───────────────────────────────────────────────────
  const renderModal = () => {
    if (!selectedOrder) return null;
    const order = selectedOrder;
    const cfg = STATUS_CONFIG[order.status];
    const mapsUrl = buildMapsNavUrl(order);
    const next = NEXT_STATUS[order.status];

    return (
      <div style={styles.modalOverlay} onClick={e => { if (e.target === e.currentTarget) setSelectedOrder(null); }}>
        <div style={styles.modal}>

          {/* Header */}
          <div style={{ ...styles.modalHeader, borderLeft: `5px solid ${cfg?.color ?? '#1B3B2B'}` }}>
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1.5px', color: cfg?.color, marginBottom: '2px' }}>
                {cfg?.label ?? order.status}
              </div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: '1.4rem', fontWeight: 900, color: '#1B3B2B', lineHeight: 1 }}>
                Orden #{order.id.slice(-4).toUpperCase()}
              </div>
            </div>
            <button onClick={() => setSelectedOrder(null)} style={styles.closeBtn}>✕</button>
          </div>

          {/* Body */}
          <div style={styles.modalBody}>

            {/* Cliente */}
            <div style={styles.infoRow}>
              <User size={15} color="#6b7280" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#1B3B2B' }}>{order.customer_name}</div>
                <div style={{ fontSize: '0.82rem', color: '#6b7280' }}>Pedido a las {formatTime(order.created_at)} · {elapsed[order.id] ?? ''}</div>
              </div>
              <a href={`tel:${order.customer_phone}`} style={styles.callBtn}>
                <Phone size={16} /> Llamar
              </a>
            </div>

            {/* Dirección + mapa */}
            {order.delivery_address && (
              <div style={styles.addressCard}>
                <div style={{ display: 'flex', gap: '8px', padding: '12px 14px' }}>
                  <MapPin size={16} color="#0284c7" style={{ flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: '0.92rem', color: '#1e40af', lineHeight: 1.4, fontWeight: 600 }}>
                    {order.delivery_address}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', backgroundColor: '#dbeafe', borderTop: '1px solid #bfdbfe' }}>
                  <span style={{ fontSize: '0.8rem', color: '#1d4ed8', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Navigation size={13} />
                    {order.delivery_distance_km != null ? `${order.delivery_distance_km} km` : 'Ver ruta'}
                  </span>
                  {mapsUrl && (
                    <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={styles.mapsBtn}>
                      <ExternalLink size={13} /> Abrir en Maps
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Tarifa */}
            {order.delivery_fee != null && (
              <div style={styles.feeRow}>
                <Bike size={14} color="#0284c7" />
                <span>Tarifa de envío: <strong>${order.delivery_fee}</strong></span>
                <span style={{ marginLeft: 'auto', color: '#6b7280', fontSize: '0.78rem' }}>
                  Total con envío: <strong style={{ color: '#1B3B2B' }}>${order.total + order.delivery_fee}</strong>
                </span>
              </div>
            )}

            {/* Productos */}
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#6b7280', marginBottom: '8px' }}>
                {order.items.length} producto{order.items.length !== 1 ? 's' : ''}
              </div>
              {order.items.map((item: any, idx: number) => (
                <div key={idx} style={styles.itemRow}>
                  <span style={{ fontWeight: 900, color: '#1B3B2B', fontSize: '0.9rem', flexShrink: 0 }}>{item.quantity}×</span>
                  <span style={{ flex: 1, fontSize: '0.88rem', fontWeight: 600 }}>
                    {item.name}
                    {item.size && <span style={{ color: '#6b7280', fontWeight: 400 }}> · {item.size}</span>}
                  </span>
                  <span style={{ fontSize: '0.84rem', fontWeight: 700 }}>${(item.price * item.quantity).toFixed(0)}</span>
                </div>
              ))}
            </div>

            {/* Notas */}
            {order.notes && (
              <div style={styles.notesBox}>
                <span style={{ fontSize: '0.84rem', fontStyle: 'italic', color: '#78350f' }}>"{order.notes}"</span>
              </div>
            )}

          </div>

          {/* Footer: avanzar estado */}
          {next && (
            <div style={styles.modalFooter}>
              <button
                onClick={() => handleAdvanceStatus(order)}
                disabled={updatingId === order.id}
                style={{
                  ...styles.advanceBtn,
                  ...(order.status === 'in_transit' ? styles.advanceBtnGreen : {}),
                  ...(updatingId === order.id ? styles.advanceBtnDisabled : {}),
                }}
              >
                {updatingId === order.id
                  ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Actualizando...</>
                  : <><CheckCircle2 size={16} /> {NEXT_LABEL[order.status]}</>}
              </button>
            </div>
          )}

        </div>
      </div>
    );
  };

  // ── Vista principal ──────────────────────────────────────────────────────────
  const inTransit = orders.filter(o => o.status === 'in_transit');
  const ready = orders.filter(o => o.status === 'ready');
  const preparing = orders.filter(o => o.status === 'in_preparation');

  return (
    <div style={styles.page}>
      {renderModal()}

      {/* Header */}
      <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={styles.logoBadge}>
            <Bike size={20} color="#ffffff" />
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: '1.2rem', color: '#1B3B2B', lineHeight: 1 }}>Repartidor</div>
            <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: '1px' }}>
              {lastRefresh.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
              {isRefreshing && <span style={{ marginLeft: 6, color: '#0284c7' }}>actualizando…</span>}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => fetchOrders(true)} style={styles.refreshBtn} title="Actualizar">
            <RefreshCw size={16} style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
          </button>
          <a href="/admin" style={styles.backBtn} title="Volver al admin">
            <LogOut size={16} />
          </a>
        </div>
      </div>

      {/* Resumen de contadores */}
      <div style={styles.countersRow}>
        {[
          { label: 'En camino', count: inTransit.length, color: '#0284c7', bg: '#e0f2fe' },
          { label: 'Para enviar', count: ready.length, color: '#d97706', bg: '#fef3c7' },
          { label: 'Preparando', count: preparing.length, color: '#1B3B2B', bg: '#d1fae5' },
        ].map(({ label, count, color, bg }) => (
          <div key={label} style={{ ...styles.counterChip, backgroundColor: bg }}>
            <span style={{ fontWeight: 900, fontSize: '1.3rem', color }}>{count}</span>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color, textAlign: 'center', lineHeight: 1.2 }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Lista vacía */}
      {orders.length === 0 && (
        <div style={styles.emptyState}>
          <Package size={40} color="#9ca3af" />
          <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#6b7280', marginTop: '12px' }}>Sin pedidos activos</div>
          <div style={{ fontSize: '0.85rem', color: '#9ca3af', marginTop: '4px' }}>Los pedidos de domicilio aparecerán aquí cuando estén listos</div>
        </div>
      )}

      {/* Secciones de pedidos */}
      {[
        { title: '🛵 En camino', orders: inTransit, color: '#0284c7' },
        { title: '📦 Para enviar', orders: ready, color: '#d97706' },
        { title: '👨‍🍳 Preparando', orders: preparing, color: '#1B3B2B' },
      ].map(({ title, orders: sectionOrders, color }) => {
        if (sectionOrders.length === 0) return null;
        return (
          <div key={title} style={{ marginBottom: '8px' }}>
            <div style={{ ...styles.sectionTitle, color }}>
              {title} <span style={styles.sectionCount}>{sectionOrders.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {sectionOrders.map(order => {
                const mapsUrl = buildMapsNavUrl(order);
                const cfg = STATUS_CONFIG[order.status];
                const isUpdating = updatingId === order.id;

                return (
                  <div
                    key={order.id}
                    style={{ ...styles.orderCard, borderLeft: `4px solid ${cfg?.color ?? color}` }}
                    onClick={() => setSelectedOrder(order)}
                  >
                    {/* Card header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div>
                        <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 900, fontSize: '1rem', color: '#1B3B2B' }}>
                          #{order.id.slice(-4).toUpperCase()}
                          <span style={{ ...styles.statusChip, backgroundColor: cfg?.bg, color: cfg?.color }}>
                            {cfg?.label ?? order.status}
                          </span>
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#374151', marginTop: '2px' }}>
                          {order.customer_name}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.72rem', color: '#9ca3af', fontWeight: 600 }}>{elapsed[order.id] ?? ''}</div>
                        <div style={{ fontWeight: 800, color: '#1B3B2B', fontSize: '0.95rem' }}>${order.total}</div>
                      </div>
                    </div>

                    {/* Dirección */}
                    {order.delivery_address && (
                      <div style={styles.addressMini}>
                        <MapPin size={12} color="#0284c7" style={{ flexShrink: 0 }} />
                        <span style={{ fontSize: '0.82rem', color: '#1e40af', flex: 1, lineHeight: 1.3 }}>
                          {order.delivery_address}
                        </span>
                        {order.delivery_distance_km != null && (
                          <span style={styles.distanceChip}>{order.delivery_distance_km} km</span>
                        )}
                      </div>
                    )}

                    {/* Botones de acción */}
                    <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }} onClick={e => e.stopPropagation()}>
                      {mapsUrl && (
                        <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={styles.mapsCardBtn}>
                          <Navigation size={14} /> Maps
                        </a>
                      )}
                      <a href={`tel:${order.customer_phone}`} style={styles.callCardBtn}>
                        <Phone size={14} />
                      </a>
                      {NEXT_STATUS[order.status] && (
                        <button
                          onClick={() => handleAdvanceStatus(order)}
                          disabled={isUpdating}
                          style={{
                            ...styles.advanceCardBtn,
                            ...(order.status === 'in_transit' ? { backgroundColor: '#16a34a' } : {}),
                            ...(isUpdating ? { opacity: 0.6, cursor: 'not-allowed' } : {}),
                          }}
                        >
                          {isUpdating
                            ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                            : <CheckCircle2 size={13} />}
                          {NEXT_LABEL[order.status]}
                        </button>
                      )}
                    </div>

                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <div style={{ height: '32px' }} />
    </div>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#f1f5f9',
    fontFamily: 'var(--font-sans)',
    padding: '0',
    maxWidth: '480px',
    margin: '0 auto',
  },
  loadingScreen: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    backgroundColor: '#f1f5f9',
  },
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 50,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 16px',
    backgroundColor: '#ffffff',
    borderBottom: '1.5px solid #e2e8f0',
    boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
  },
  logoBadge: {
    width: '40px',
    height: '40px',
    borderRadius: '12px',
    backgroundColor: '#1B3B2B',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshBtn: {
    background: '#f1f5f9',
    border: 'none',
    borderRadius: '10px',
    padding: '9px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    color: '#374151',
  },
  backBtn: {
    background: '#f1f5f9',
    border: 'none',
    borderRadius: '10px',
    padding: '9px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    color: '#374151',
    textDecoration: 'none',
  },
  countersRow: {
    display: 'flex',
    gap: '10px',
    padding: '14px 16px',
  },
  counterChip: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '3px',
    padding: '12px 8px',
    borderRadius: '14px',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '60px 20px',
    textAlign: 'center',
  },
  sectionTitle: {
    fontWeight: 800,
    fontSize: '0.82rem',
    textTransform: 'uppercase',
    letterSpacing: '0.8px',
    padding: '8px 16px 4px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  sectionCount: {
    backgroundColor: 'currentColor',
    color: '#fff',
    borderRadius: '20px',
    padding: '1px 7px',
    fontSize: '0.75rem',
    fontWeight: 900,
    opacity: 0.9,
  },
  orderCard: {
    backgroundColor: '#ffffff',
    borderRadius: '14px',
    padding: '14px 14px 12px',
    margin: '0 12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    cursor: 'pointer',
  },
  statusChip: {
    display: 'inline-flex',
    alignItems: 'center',
    marginLeft: '8px',
    padding: '2px 8px',
    borderRadius: '20px',
    fontSize: '0.7rem',
    fontWeight: 700,
  },
  addressMini: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '6px',
    backgroundColor: '#eff6ff',
    padding: '7px 10px',
    borderRadius: '8px',
    border: '1px solid #bfdbfe',
  },
  distanceChip: {
    backgroundColor: '#dbeafe',
    color: '#1d4ed8',
    borderRadius: '20px',
    padding: '2px 8px',
    fontSize: '0.7rem',
    fontWeight: 800,
    flexShrink: 0,
  },
  mapsCardBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    backgroundColor: '#1d4ed8',
    color: '#ffffff',
    padding: '8px 14px',
    borderRadius: '10px',
    fontWeight: 700,
    fontSize: '0.82rem',
    textDecoration: 'none',
    flexShrink: 0,
  },
  callCardBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d1fae5',
    color: '#065f46',
    padding: '8px 12px',
    borderRadius: '10px',
    textDecoration: 'none',
    flexShrink: 0,
  },
  advanceCardBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '5px',
    backgroundColor: '#0284c7',
    color: '#ffffff',
    border: 'none',
    padding: '9px 12px',
    borderRadius: '10px',
    fontWeight: 700,
    fontSize: '0.82rem',
    cursor: 'pointer',
  },
  // Modal
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 200,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    padding: '16px',
  },
  modal: {
    backgroundColor: '#ffffff',
    borderRadius: '20px 20px 16px 16px',
    width: '100%',
    maxWidth: '480px',
    maxHeight: '90vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 -4px 30px rgba(0,0,0,0.15)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '18px 18px 14px',
    borderBottom: '1px solid #f1f5f9',
  },
  closeBtn: {
    background: '#f1f5f9',
    border: 'none',
    borderRadius: '50%',
    width: '32px',
    height: '32px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    color: '#6b7280',
  },
  modalBody: {
    overflowY: 'auto',
    padding: '14px 18px',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  infoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  callBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    backgroundColor: '#d1fae5',
    color: '#065f46',
    padding: '8px 14px',
    borderRadius: '10px',
    fontWeight: 700,
    fontSize: '0.84rem',
    textDecoration: 'none',
    flexShrink: 0,
  },
  addressCard: {
    borderRadius: '12px',
    overflow: 'hidden',
    border: '1.5px solid #bfdbfe',
  },
  feeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '7px',
    backgroundColor: '#f0f9ff',
    padding: '8px 12px',
    borderRadius: '10px',
    fontSize: '0.85rem',
    color: '#1e40af',
    fontWeight: 600,
    border: '1px solid #bfdbfe',
  },
  itemRow: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
    padding: '7px 10px',
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
    marginBottom: '4px',
    border: '1px solid #f1f5f9',
  },
  notesBox: {
    backgroundColor: '#fffbeb',
    border: '1px solid #fed7aa',
    borderRadius: '8px',
    padding: '9px 12px',
  },
  modalFooter: {
    padding: '12px 18px 18px',
    borderTop: '1px solid #f1f5f9',
  },
  advanceBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    backgroundColor: '#0284c7',
    color: '#ffffff',
    border: 'none',
    padding: '14px',
    borderRadius: '14px',
    fontWeight: 800,
    fontSize: '0.95rem',
    cursor: 'pointer',
  },
  advanceBtnGreen: { backgroundColor: '#16a34a' },
  advanceBtnDisabled: { opacity: 0.6, cursor: 'not-allowed' },
  mapsBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    backgroundColor: '#1d4ed8',
    color: '#ffffff',
    padding: '5px 12px',
    borderRadius: '20px',
    fontSize: '0.78rem',
    fontWeight: 800,
    textDecoration: 'none',
    flexShrink: 0,
  },
};
