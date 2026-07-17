import React, { useState } from 'react';
import {
  Clock, ChefHat, PackageCheck, Bike,
  ClipboardList, MessageCircle, AlertCircle, MapPin,
  Truck, X, Phone, ChevronRight, CreditCard, Hourglass, CheckCircle2
} from 'lucide-react';
import { Order } from '@/types/api-contracts';

interface KanbanBoardProps {
  pendingOrders: Order[];
  awaitingPaymentOrders?: Order[];
  preparingOrders: Order[];
  readyOrders?: Order[];
  inTransitOrders?: Order[];
  newOrderIds?: Set<string>;
  updateStatus: (id: string, newStatus: string) => void;
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
  newOrderIds = new Set(),
  updateStatus,
  setDeliveryFee,
  getWhatsAppCancelLink,
}: KanbanBoardProps) {

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [deliveryFeeInputs, setDeliveryFeeInputs] = useState<Record<string, string>>({});
  const [deliveryFeeLoading, setDeliveryFeeLoading] = useState<Record<string, boolean>>({});

  const ordersByColumn: Record<string, Order[]> = {
    received:         pendingOrders,
    awaiting_payment: awaitingPaymentOrders,
    in_preparation:   preparingOrders,
    ready:            readyOrders,
    in_transit:       inTransitOrders,
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

  const handleConfirmFee = async (order: Order) => {
    const fee = parseFloat(deliveryFeeInputs[order.id] ?? '');
    if (isNaN(fee) || fee < 0) { alert('Ingresa una tarifa válida.'); return; }
    setDeliveryFeeLoading(prev => ({ ...prev, [order.id]: true }));
    try {
      await setDeliveryFee(order.id, fee);
      if (selectedOrder?.id === order.id) {
        setSelectedOrder(prev => prev ? { ...prev, delivery_fee: fee, delivery_fee_confirmed: true } : prev);
      }
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
        style={{ borderLeft: `4px solid ${colColor}`, cursor: isAwaitingPayment ? 'default' : 'pointer' }}
        onClick={() => !isAwaitingPayment && setSelectedOrder(order)}
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
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              <span style={{
                fontSize: '0.72rem', fontWeight: 700, padding: '2px 7px', borderRadius: '20px',
                color: order.service_type === 'delivery' ? '#0369a1' : '#065f46',
                backgroundColor: order.service_type === 'delivery' ? '#e0f2fe' : '#d1fae5',
              }}>
                {order.service_type === 'delivery' ? '🛵' : '🏠'} {order.service_type === 'delivery' ? 'Domicilio' : 'Recoger'}
              </span>
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

            {/* Address */}
            {order.service_type === 'delivery' && order.delivery_address && (
              <div className="kanban-modal-section">
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', backgroundColor: '#eff6ff', padding: '10px 12px', borderRadius: '10px' }}>
                  <MapPin size={15} color="#0284c7" style={{ flexShrink: 0, marginTop: '1px' }} />
                  <span style={{ fontSize: '0.88rem', color: '#1e40af', lineHeight: '1.4' }}>{order.delivery_address}</span>
                </div>
              </div>
            )}

            {/* Delivery fee */}
            {order.service_type === 'delivery' && pendingFee && (
              <div className="kanban-modal-section">
                <div style={{ backgroundColor: '#fffbeb', border: '1px solid #f59e0b', borderRadius: '10px', padding: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: '#92400e', marginBottom: '8px', fontSize: '0.85rem' }}>
                    <Truck size={15} /> Cotizar envío
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#92400e', fontWeight: 700 }}>$</span>
                      <input
                        type="number" min="0" step="5" placeholder="0"
                        value={feeInputVal}
                        onChange={e => setDeliveryFeeInputs(prev => ({ ...prev, [order.id]: e.target.value }))}
                        style={{ width: '100%', padding: '9px 9px 9px 26px', border: '1.5px solid #f59e0b', borderRadius: '8px', fontSize: '0.95rem', fontWeight: 700, boxSizing: 'border-box', outline: 'none' }}
                      />
                    </div>
                    <button
                      onClick={() => handleConfirmFee(order)}
                      disabled={feeLoading || feeInputVal === ''}
                      style={{ padding: '9px 16px', backgroundColor: feeLoading ? '#d1d5db' : '#f59e0b', color: '#1c1917', border: 'none', borderRadius: '8px', fontWeight: 800, fontSize: '0.85rem', cursor: feeLoading || feeInputVal === '' ? 'not-allowed' : 'pointer', flexShrink: 0 }}
                    >
                      {feeLoading ? '…' : 'Confirmar'}
                    </button>
                  </div>
                </div>
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
                  {order.service_type === 'delivery' && feeConfirmed ? 'Total (con envío)' : 'Total productos'}
                </span>
                <span style={{ fontWeight: 900, fontSize: '1.2rem', color: 'var(--color-green-dark)' }}>
                  ${order.service_type === 'delivery' && feeConfirmed ? (order.total + (order.delivery_fee ?? 0)) : order.total}
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
            {isPending && (
              <>
                <button
                  className="admin-btn admin-btn-cancel"
                  style={{ padding: '13px 16px', fontSize: '0.85rem', borderRadius: '10px', fontWeight: 700 }}
                  onClick={() => { updateStatus(order.id, 'cancelled'); setSelectedOrder(null); }}
                >
                  Rechazar
                </button>
                <a
                  href={getWhatsAppCancelLink(order)}
                  target="_blank" rel="noopener noreferrer"
                  style={{ padding: '13px 14px', borderRadius: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px', backgroundColor: '#d1fae5', color: '#065f46', textDecoration: 'none', fontSize: '0.85rem', flexShrink: 0 }}
                >
                  <MessageCircle size={15} />
                </a>
              </>
            )}
          </div>

        </div>
      </div>
    );
  };

  // ── KANBAN COLUMNS ──────────────────────────────────────────────────────────
  return (
    <>
      {renderModal()}
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
    </>
  );
}
