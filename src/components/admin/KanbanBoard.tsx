import React, { useState } from 'react';
import {
  Clock, ChefHat, PackageCheck, Bike,
  ClipboardList, MessageCircle, AlertCircle, MapPin,
  Truck, X, Phone, ChevronRight, CreditCard, Hourglass, CheckCircle2,
  ExternalLink, Navigation, RotateCcw
} from 'lucide-react';
import { Order } from '@/types/api-contracts';
import {
  STAFF_CANCEL_REASONS,
  StaffCancelReason,
  CANCELLED_BY_LABELS,
  describeCancelReason,
} from '@/lib/orderCancellation';

interface KanbanBoardProps {
  pendingOrders: Order[];
  awaitingPaymentOrders?: Order[];
  preparingOrders: Order[];
  readyOrders?: Order[];
  inTransitOrders?: Order[];
  cancelledOrders?: Order[];
  newOrderIds?: Set<string>;
  updateStatus: (id: string, newStatus: string, reason?: string, note?: string) => void;
  resetPayment: (id: string) => void;
  setDeliveryFee: (orderId: string, fee: number) => Promise<void>;
  getWhatsAppCancelLink: (order: Order) => string;
}

const COLUMN_CONFIGS = [
  { key: 'received',          label: 'Recibidos',      icon: Clock,         color: 'var(--color-terracotta)', accentBg: '#fef2f2' },
  { key: 'awaiting_payment',  label: 'Esperando Pago', icon: CreditCard,    color: '#7c3aed',                 accentBg: '#f5f3ff' },
  { key: 'in_preparation',    label: 'Preparando',     icon: ChefHat,       color: 'var(--color-green-dark)', accentBg: '#f0fdf4' },
  { key: 'ready',             label: 'Listas',         icon: PackageCheck,  color: 'var(--color-ochre)',      accentBg: '#fffbeb' },
  { key: 'in_transit',        label: 'En Camino',      icon: Bike,          color: '#0284c7',                 accentBg: '#f0f9ff' },
];

export default function KanbanBoard({
  pendingOrders,
  awaitingPaymentOrders = [],
  preparingOrders,
  readyOrders = [],
  inTransitOrders = [],
  cancelledOrders = [],
  newOrderIds = new Set(),
  updateStatus,
  resetPayment,
  setDeliveryFee,
  getWhatsAppCancelLink,
}: KanbanBoardProps) {

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [deliveryFeeInputs, setDeliveryFeeInputs] = useState<Record<string, string>>({});
  const [deliveryFeeLoading, setDeliveryFeeLoading] = useState<Record<string, boolean>>({});
  // Cancelación por el personal: diálogo con motivo obligatorio
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);
  const [cancelReasonKey, setCancelReasonKey] = useState<StaffCancelReason | ''>('');
  const [cancelNote, setCancelNote] = useState('');
  const [showCancelled, setShowCancelled] = useState(false);

  const openCancelDialog = (order: Order) => {
    setCancelReasonKey('');
    setCancelNote('');
    setCancelTarget(order);
  };

  const confirmCancel = () => {
    if (!cancelTarget || !cancelReasonKey) return;
    updateStatus(cancelTarget.id, 'cancelled', cancelReasonKey, cancelNote.trim() || undefined);
    setCancelTarget(null);
    setSelectedOrder(null);
  };

  const CANCELLABLE_STATUSES = ['received', 'awaiting_payment', 'in_preparation', 'ready', 'in_transit'];

  const ordersByColumn: Record<string, Order[]> = {
    received:         pendingOrders,
    awaiting_payment: awaitingPaymentOrders,
    in_preparation:   preparingOrders,
    ready:            readyOrders,
    in_transit:       inTransitOrders,
  };

  // Construye un deep-link a Google Maps con la dirección o coordenadas del pedido
  const buildMapsUrl = (order: Order): string => {
    const lat = (order as any).delivery_lat;
    const lng = (order as any).delivery_lng;
    if (lat && lng) {
      return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    }
    if (order.delivery_address) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.delivery_address)}`;
    }
    return '';
  };

  const getNextStatus = (order: Order) => {
    switch (order.status) {
      case 'received':         return 'awaiting_payment';
      case 'awaiting_payment': return 'in_preparation';
      case 'in_preparation':   return 'ready';
      case 'ready':            return order.service_type === 'delivery' ? 'in_transit' : 'delivered';
      case 'in_transit':       return 'delivered';
      default:                 return order.status;
    }
  };

  const getStatusButtonText = (order: Order) => {
    switch (order.status) {
      case 'received':         return 'Confirmar ingredientes';
      case 'awaiting_payment': return 'Pago recibido → Cocina';
      case 'in_preparation':   return 'Lista ✓';
      case 'ready':            return order.service_type === 'delivery' ? 'Enviar 🛵' : 'Entregada ✓';
      case 'in_transit':       return 'Confirmar recepción';
      default:                 return 'Avanzar';
    }
  };

  const needsDeliveryFeeConfirmation = (order: Order) =>
    order.service_type === 'delivery' && !order.delivery_fee_confirmed;

  // Permite sobrescribir la tarifa aunque ya esté auto-confirmada (manual override)
  const [showFeeOverride, setShowFeeOverride] = useState<Record<string, boolean>>({});

  const handleConfirmFee = async (order: Order) => {
    const fee = parseFloat(deliveryFeeInputs[order.id] ?? '');
    if (isNaN(fee) || fee < 0) { alert('Ingresa una tarifa válida (puede ser 0 si es sin costo).'); return; }
    setDeliveryFeeLoading(prev => ({ ...prev, [order.id]: true }));
    try {
      await setDeliveryFee(order.id, fee);
      if (selectedOrder?.id === order.id) {
        setSelectedOrder(prev => prev ? { ...prev, delivery_fee: fee, delivery_fee_confirmed: true } : prev);
      }
      setShowFeeOverride(prev => ({ ...prev, [order.id]: false }));
    } finally {
      setDeliveryFeeLoading(prev => ({ ...prev, [order.id]: false }));
    }
  };

  // ── COMPACT CARD ────────────────────────────────────────────────────────────
  const renderCard = (order: Order, colColor: string) => {
    const isNew = newOrderIds.has(order.id);
    const isAwaitingPayment = order.status === 'awaiting_payment';

    return (
      <div
        key={order.id}
        className={`kanban-card ${isAwaitingPayment ? 'kanban-card--waiting' : ''}`}
        style={{ borderLeft: `4px solid ${colColor}`, cursor: 'pointer' }}
        onClick={() => setSelectedOrder(order)}
      >
        {isNew && <span className="kanban-new-dot" style={{ backgroundColor: colColor }} />}

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <span style={{ fontFamily: 'var(--font-serif)', fontWeight: 800, fontSize: '1rem', color: 'var(--color-green-dark)' }}>
            #{order.id.slice(-4).toUpperCase()}
          </span>
          <span style={{ fontSize: '0.73rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
            {new Date(order.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--color-text-dark)', marginBottom: '8px' }}>
          {order.customer_name}
        </div>

        {/* Awaiting payment — special state */}
        {isAwaitingPayment ? (
          <div className="kanban-awaiting-banner">
            <Hourglass size={14} style={{ flexShrink: 0, animation: 'spin 3s linear infinite' }} />
            <span>Esperando método de pago del cliente…</span>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{
                fontSize: '0.72rem', fontWeight: 700, padding: '2px 7px', borderRadius: '20px',
                color: order.service_type === 'delivery' ? '#0369a1' : '#065f46',
                backgroundColor: order.service_type === 'delivery' ? '#e0f2fe' : '#d1fae5',
              }}>
                {order.service_type === 'delivery' ? '🛵' : '🏠'} {order.service_type === 'delivery' ? 'Domicilio' : 'Recoger'}
              </span>
              {/* Chip de distancia cuando la tenemos */}
              {order.service_type === 'delivery' && (order as any).delivery_distance_km != null && (
                <span style={{
                  fontSize: '0.68rem', fontWeight: 700, padding: '2px 6px', borderRadius: '20px',
                  color: '#0369a1', backgroundColor: '#dbeafe',
                }}>
                  {(order as any).delivery_distance_km} km
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-green-dark)' }}>${order.total}</span>
              <ChevronRight size={13} color="var(--color-text-muted)" />
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── MODAL ───────────────────────────────────────────────────────────────────
  const renderModal = () => {
    if (!selectedOrder) return null;
    const order = selectedOrder;
    const feeConfirmed = order.delivery_fee_confirmed;
    const pendingFee = needsDeliveryFeeConfirmation(order);
    const feeInputVal = deliveryFeeInputs[order.id] ?? '';
    const feeLoading = deliveryFeeLoading[order.id] ?? false;
    const isPending = order.status === 'received';
    const colCfg = COLUMN_CONFIGS.find(c => c.key === order.status);
    const colColor = colCfg?.color ?? 'var(--color-ochre)';

    return (
      <div className="kanban-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setSelectedOrder(null); }}>
        <div className="kanban-modal">

          {/* ── HEADER ── */}
          <div className="kanban-modal-header" style={{ borderBottom: `3px solid ${colColor}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: colCfg?.accentBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {colCfg && <colCfg.icon size={18} color={colColor} />}
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1.5px', color: colColor }}>{colCfg?.label}</div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-green-dark)', lineHeight: 1 }}>
                  Orden #{order.id.slice(-4).toUpperCase()}
                </div>
              </div>
            </div>
            <button onClick={() => setSelectedOrder(null)} style={{ background: '#f3f4f6', border: 'none', borderRadius: '50%', width: '34px', height: '34px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <X size={18} color="#6b7280" />
            </button>
          </div>

          {/* ── BODY ── */}
          <div className="kanban-modal-body">

            {/* Customer row */}
            <div className="kanban-modal-section" style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '120px' }}>
                <div className="kanban-modal-label">Cliente</div>
                <div style={{ fontWeight: 700, fontSize: '1rem' }}>{order.customer_name}</div>
              </div>
              <a href={`tel:${order.customer_phone}`} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#0284c7', fontWeight: 700, textDecoration: 'none', fontSize: '0.9rem', flexShrink: 0 }}>
                <Phone size={15} /> {order.customer_phone}
              </a>
              <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', flexShrink: 0 }}>
                {new Date(order.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>

            {/* Type + Payment badges */}
            <div className="kanban-modal-section" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span className="kanban-badge" style={{ color: order.service_type === 'delivery' ? '#0369a1' : '#065f46', backgroundColor: order.service_type === 'delivery' ? '#e0f2fe' : '#d1fae5' }}>
                {order.service_type === 'delivery' ? <><Bike size={12}/> Domicilio</> : <><MapPin size={12}/> Recoger</>}
              </span>
              {order.payment_method && (
                <span className="kanban-badge" style={{ color: '#7c3aed', backgroundColor: '#ede9fe' }}>
                  <CreditCard size={12} /> {order.payment_method === 'transferencia' ? 'SPEI' : order.payment_method}
                </span>
              )}
              {order.loyverse_receipt_number && (
                <span className="kanban-badge" style={{ color: 'var(--color-ochre-dark)', backgroundColor: 'var(--color-ochre-light)' }}>
                  POS {order.loyverse_receipt_number}
                </span>
              )}
            </div>

            {/* Address + Map link */}
            {order.service_type === 'delivery' && order.delivery_address && (
              <div className="kanban-modal-section">
                <div style={{ backgroundColor: '#eff6ff', borderRadius: '10px', overflow: 'hidden', border: '1.5px solid #bfdbfe' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', padding: '10px 12px' }}>
                    <MapPin size={15} color="#0284c7" style={{ flexShrink: 0, marginTop: '1px' }} />
                    <span style={{ fontSize: '0.88rem', color: '#1e40af', lineHeight: '1.4', flex: 1 }}>
                      {order.delivery_address}
                    </span>
                  </div>
                  {/* Fila de meta: distancia + botón mapa */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px', backgroundColor: '#dbeafe', borderTop: '1px solid #bfdbfe' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#1d4ed8', fontWeight: 700 }}>
                      <Navigation size={12} />
                      {(order as any).delivery_distance_km != null
                        ? `${(order as any).delivery_distance_km} km del restaurante`
                        : 'Distancia calculada al cotizar'}
                    </div>
                    {buildMapsUrl(order) && (
                      <a
                        href={buildMapsUrl(order)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'flex', alignItems: 'center', gap: '4px',
                          backgroundColor: '#1d4ed8', color: '#fff',
                          padding: '4px 10px', borderRadius: '20px',
                          fontSize: '0.74rem', fontWeight: 800, textDecoration: 'none',
                          flexShrink: 0,
                        }}
                      >
                        <ExternalLink size={11} /> Ver en mapa
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Delivery fee — auto-confirmed o pendiente */}
            {order.service_type === 'delivery' && (
              <div className="kanban-modal-section">
                {feeConfirmed && !showFeeOverride[order.id] ? (
                  // Fee auto-confirmada por el sistema
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f0fdf4', border: '1px solid #86efac', borderRadius: '10px', padding: '10px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CheckCircle2 size={15} color="#16a34a" />
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#166534' }}>
                        Envío: <strong>${order.delivery_fee}</strong>
                        <span style={{ fontWeight: 400, fontSize: '0.78rem', marginLeft: '4px', color: '#15803d' }}>(calculado automáticamente)</span>
                      </span>
                    </div>

                  </div>
                ) : (
                  // Entrada manual (pendiente o en override)
                  <div style={{ backgroundColor: pendingFee ? '#fffbeb' : '#fafafa', border: `1px solid ${pendingFee ? '#f59e0b' : '#e5e7eb'}`, borderRadius: '10px', padding: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: pendingFee ? '#92400e' : '#374151', marginBottom: '8px', fontSize: '0.85rem' }}>
                      <Truck size={15} />
                      {pendingFee ? 'Cotizar envío manualmente' : 'Cambiar tarifa de envío'}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <div style={{ position: 'relative', flex: 1 }}>
                        <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#92400e', fontWeight: 700 }}>$</span>
                        <input
                          type="number" min="0" step="5"
                          placeholder={feeConfirmed ? String(order.delivery_fee ?? 0) : '0'}
                          value={feeInputVal}
                          onChange={e => setDeliveryFeeInputs(prev => ({ ...prev, [order.id]: e.target.value }))}
                          style={{ width: '100%', padding: '9px 9px 9px 26px', border: `1.5px solid ${pendingFee ? '#f59e0b' : '#d1d5db'}`, borderRadius: '8px', fontSize: '0.95rem', fontWeight: 700, boxSizing: 'border-box', outline: 'none' }}
                        />
                      </div>
                      <button
                        onClick={() => handleConfirmFee(order)}
                        disabled={feeLoading || feeInputVal === ''}
                        style={{ padding: '9px 16px', backgroundColor: feeLoading || feeInputVal === '' ? '#d1d5db' : '#f59e0b', color: '#1c1917', border: 'none', borderRadius: '8px', fontWeight: 800, fontSize: '0.85rem', cursor: feeLoading || feeInputVal === '' ? 'not-allowed' : 'pointer', flexShrink: 0 }}
                      >
                        {feeLoading ? '…' : 'Confirmar'}
                      </button>
                      {!pendingFee && (
                        <button
                          onClick={() => setShowFeeOverride(prev => ({ ...prev, [order.id]: false }))}
                          style={{ padding: '9px', backgroundColor: '#f3f4f6', color: '#6b7280', border: 'none', borderRadius: '8px', cursor: 'pointer', flexShrink: 0 }}
                          title="Cancelar"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Items */}
            <div className="kanban-modal-section">
              <div className="kanban-modal-label" style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <ClipboardList size={13} /> {order.items.length} {order.items.length === 1 ? 'producto' : 'productos'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {order.items.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', backgroundColor: '#f9fafb', borderRadius: '8px', padding: '8px 10px', border: '1px solid #e5e7eb' }}>
                    <span style={{ fontWeight: 900, color: 'var(--color-green-dark)', fontSize: '0.95rem', flexShrink: 0 }}>{item.quantity}×</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--color-text-dark)' }}>
                        {item.name}{(item.size || item.variant) && <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}> · {item.size || item.variant}</span>}
                      </div>
                      {item.customizations && (() => {
                        const lines: string[] = [];
                        if (item.customizations.proteins?.length) lines.push(`Prot: ${item.customizations.proteins.join(', ')}`);
                        if (item.customizations.toppings?.length) lines.push(`Top: ${item.customizations.toppings.join(', ')}`);
                        if (item.customizations.seedsAndNuts?.length) lines.push(`Semillas: ${item.customizations.seedsAndNuts.join(', ')}`);
                        if (item.customizations.dressings?.length) lines.push(`Aderezo: ${item.customizations.dressings.join(', ')}`);
                        if (item.customizations.flavors?.length) lines.push(`Sabor: ${item.customizations.flavors.join(', ')}`);
                        const omissions = (item.customizations.extras ?? []).filter((x: any) => typeof x === 'string' && x.toLowerCase().startsWith('sin '));
                        const extras = (item.customizations.extras ?? []).filter((x: any) => !(typeof x === 'string' && x.toLowerCase().startsWith('sin ')));
                        if (omissions.length) lines.push(`❌ ${omissions.join(', ')}`);
                        if (extras.length) lines.push(`+ ${extras.join(', ')}`);
                        Object.entries(item.customizations).forEach(([k, v]: [string, any]) => {
                          if (['proteins','toppings','seedsAndNuts','dressings','flavors','extras'].includes(k)) return;
                          if (Array.isArray(v) && v.length) lines.push(`${k}: ${v.join(', ')}`);
                          else if (typeof v === 'string' && v.trim()) lines.push(`${k}: ${v}`);
                        });
                        return lines.length ? (
                          <div style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', marginTop: '2px', lineHeight: '1.4' }}>
                            {lines.join(' · ')}
                          </div>
                        ) : null;
                      })()}
                    </div>
                    <span style={{ fontWeight: 700, color: 'var(--color-text-dark)', fontSize: '0.85rem', flexShrink: 0 }}>${(item.price * item.quantity).toFixed(0)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            {order.notes && (
              <div className="kanban-modal-section">
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', backgroundColor: '#fff7ed', padding: '8px 10px', borderRadius: '8px', border: '1px solid #fed7aa' }}>
                  <AlertCircle size={14} color="var(--color-terracotta)" style={{ flexShrink: 0, marginTop: '1px' }} />
                  <span style={{ fontSize: '0.85rem', fontStyle: 'italic', color: 'var(--color-text-dark)' }}>"{order.notes}"</span>
                </div>
              </div>
            )}

            {/* Total */}
            <div className="kanban-modal-section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                  {order.service_type === 'delivery' && feeConfirmed ? 'Total (con envío)' : 'Total'}
                </span>
                <span style={{ fontWeight: 900, fontSize: '1.2rem', color: 'var(--color-green-dark)' }}>
                  ${order.total}
                  {order.service_type === 'delivery' && !feeConfirmed && (
                    <span style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: 600, marginLeft: '6px' }}>+ envío</span>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* ── FOOTER ── */}
          <div className="kanban-modal-footer">
            {pendingFee ? (
              <div style={{ flex: 1, textAlign: 'center', fontSize: '0.85rem', color: '#92400e', fontWeight: 600 }}>
                ⚠ Define la tarifa de envío primero
              </div>
            ) : (
              <button
                className="admin-btn admin-btn-accept"
                style={{ flex: 1, padding: '13px', fontSize: '0.95rem', borderRadius: '10px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                onClick={() => { updateStatus(order.id, getNextStatus(order)); setSelectedOrder(null); }}
              >
                <CheckCircle2 size={17} />
                {getStatusButtonText(order)}
              </button>
            )}
            {CANCELLABLE_STATUSES.includes(order.status) && (
              <button
                className="admin-btn admin-btn-cancel"
                style={{ padding: '13px 16px', fontSize: '0.85rem', borderRadius: '10px', fontWeight: 700 }}
                onClick={() => openCancelDialog(order)}
              >
                Cancelar pedido
              </button>
            )}
            {isPending && (
              <>
                <a
                  href={getWhatsAppCancelLink(order)}
                  target="_blank" rel="noopener noreferrer"
                  style={{ padding: '13px 14px', borderRadius: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px', backgroundColor: '#d1fae5', color: '#065f46', textDecoration: 'none', fontSize: '0.85rem', flexShrink: 0 }}
                >
                  <MessageCircle size={15} />
                </a>
              </>
            )}
            
            {order.status === 'awaiting_payment' && (
              <button
                className="admin-btn admin-btn-cancel"
                style={{ padding: '13px 16px', fontSize: '0.85rem', borderRadius: '10px', fontWeight: 700, backgroundColor: '#f59e0b', color: '#fff', border: 'none' }}
                onClick={() => { 
                  if (confirm('¿Quieres destrabar el pago para que el cliente vuelva a elegir su método?')) {
                    resetPayment(order.id);
                    setSelectedOrder(null);
                  }
                }}
              >
                Destrabar Pago
              </button>
            )}
          </div>

        </div>
      </div>
    );
  };

  // ── KANBAN COLUMNS ──────────────────────────────────────────────────────────
  // ── DIÁLOGO DE CANCELACIÓN ──────────────────────────────────────────────────
  const renderCancelDialog = () => {
    if (!cancelTarget) return null;
    const o = cancelTarget;
    const hasReceipt = !!o.loyverse_receipt_id;
    return (
      <div
        onClick={e => { if (e.target === e.currentTarget) setCancelTarget(null); }}
        style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 9500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
      >
        <div role="dialog" aria-modal="true" aria-label="Cancelar pedido" style={{ backgroundColor: '#fff', borderRadius: '16px', padding: '22px', width: '100%', maxWidth: '440px', boxSizing: 'border-box', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }}>
          <h3 style={{ margin: '0 0 4px 0', fontFamily: 'var(--font-serif)', fontSize: '1.3rem', color: 'var(--color-green-dark)' }}>
            Cancelar pedido #{o.id.slice(-4).toUpperCase()}
          </h3>
          <p style={{ margin: '0 0 14px 0', fontSize: '0.88rem', color: '#6b7280' }}>{o.customer_name} · ${o.total}</p>

          {hasReceipt && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', backgroundColor: '#fffbeb', border: '1px solid #fcd34d', color: '#92400e', borderRadius: '10px', padding: '10px 12px', fontSize: '0.84rem', marginBottom: '14px' }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
              <span>Este pedido ya tiene el recibo <strong>{o.loyverse_receipt_number || o.loyverse_receipt_id}</strong> en Loyverse. Al cancelar se <strong>anulará (reembolsará) ese recibo</strong> en la caja.</span>
            </div>
          )}
          {o.payment_status === 'payment_approved' && (
            <div style={{ fontSize: '0.84rem', color: '#92400e', marginBottom: '14px' }}>
              El pago estaba aprobado: el pedido quedará pendiente en la pestaña <strong>Reembolsos</strong>.
            </div>
          )}

          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151', marginBottom: '8px' }}>Motivo (obligatorio)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
            {(Object.entries(STAFF_CANCEL_REASONS) as [StaffCancelReason, string][]).map(([key, label]) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 12px', border: cancelReasonKey === key ? '1.5px solid var(--color-green-dark)' : '1.5px solid #e5e7eb', borderRadius: '10px', cursor: 'pointer', fontSize: '0.9rem', backgroundColor: cancelReasonKey === key ? '#f0fdf4' : '#fff' }}>
                <input type="radio" name="staff-cancel-reason" checked={cancelReasonKey === key} onChange={() => setCancelReasonKey(key)} />
                {label}
              </label>
            ))}
          </div>
          <textarea
            value={cancelNote}
            onChange={e => setCancelNote(e.target.value)}
            maxLength={200}
            rows={2}
            placeholder="Nota (opcional)"
            style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', border: '1.5px solid #e5e7eb', borderRadius: '10px', fontSize: '0.88rem', fontFamily: 'inherit', resize: 'none', marginBottom: '14px' }}
          />

          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => setCancelTarget(null)} style={{ flex: 1, padding: '12px', backgroundColor: '#e5e7eb', color: '#374151', border: 'none', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}>
              Volver
            </button>
            <button
              onClick={confirmCancel}
              disabled={!cancelReasonKey}
              style={{ flex: 1.4, padding: '12px', backgroundColor: '#b91c1c', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 700, cursor: cancelReasonKey ? 'pointer' : 'not-allowed', opacity: cancelReasonKey ? 1 : 0.5 }}
            >
              Sí, cancelar pedido
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ── CANCELADOS RECIENTES (trazabilidad: quién, cuándo y por qué) ─────────────
  const renderCancelledList = () => {
    if (cancelledOrders.length === 0) return null;
    return (
      <div style={{ marginTop: '24px', backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '14px', overflow: 'hidden' }}>
        <button
          onClick={() => setShowCancelled(v => !v)}
          aria-expanded={showCancelled}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: '0.92rem', color: '#991b1b' }}
        >
          <span>Cancelados en las últimas 24 h ({cancelledOrders.length})</span>
          <ChevronRight size={18} style={{ transform: showCancelled ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
        </button>
        {showCancelled && (
          <div style={{ borderTop: '1px solid #f3f4f6' }}>
            {[...cancelledOrders]
              .sort((a, b) => new Date(b.cancelled_at || b.created_at).getTime() - new Date(a.cancelled_at || a.created_at).getTime())
              .map(o => (
                <div key={o.id} style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', alignItems: 'baseline', padding: '10px 18px', borderBottom: '1px solid #f9fafb', fontSize: '0.85rem' }}>
                  <strong style={{ color: 'var(--color-green-dark)' }}>#{o.id.slice(-4).toUpperCase()}</strong>
                  <span>{o.customer_name}</span>
                  <span style={{ color: '#6b7280' }}>${o.total}</span>
                  <span style={{ color: '#6b7280' }}>
                    {new Date(o.cancelled_at || o.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span style={{ fontWeight: 700, color: '#991b1b' }}>
                    {o.cancelled_by ? CANCELLED_BY_LABELS[o.cancelled_by] : 'Sin registro'}
                  </span>
                  <span style={{ color: '#374151' }}>{describeCancelReason(o.cancel_reason)}</span>
                </div>
              ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {renderModal()}
      {renderCancelDialog()}
      <div className="kanban-board">
        {COLUMN_CONFIGS.map(col => {
          const colOrders = ordersByColumn[col.key] ?? [];
          const hasNew = colOrders.some(o => newOrderIds.has(o.id));
          const Icon = col.icon;

          return (
            <div key={col.key} className="kanban-column">
              <div className="kanban-col-header" style={{ borderTop: `4px solid ${col.color}`, backgroundColor: col.accentBg }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <Icon size={17} color={col.color} />
                  <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--color-green-dark)' }}>{col.label}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', backgroundColor: col.color, color: '#fff', borderRadius: '50%', width: '20px', height: '20px', fontSize: '0.72rem', fontWeight: 900 }}>
                    {colOrders.length}
                  </span>
                </div>
                {hasNew && <><span className="kanban-new-badge-dot" /><span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#dc2626' }}>NUEVO</span></>}
              </div>

              <div className="kanban-col-body">
                {colOrders.length === 0
                  ? <div style={{ textAlign: 'center', padding: '24px 10px', color: '#9ca3af', fontSize: '0.82rem' }}>Sin pedidos</div>
                  : colOrders.map(o => renderCard(o, col.color))
                }
              </div>
            </div>
          );
        })}
      </div>
      {renderCancelledList()}
    </>
  );
}
