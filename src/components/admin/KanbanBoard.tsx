import React, { useState } from 'react';
import { Clock, ChefHat, ClipboardList, MessageCircle, AlertCircle, PackageCheck, Bike, MapPin, Truck } from 'lucide-react';
import { Order } from '@/types/api-contracts';

interface KanbanBoardProps {
  pendingOrders: Order[];
  preparingOrders: Order[];
  readyOrders?: Order[];
  inTransitOrders?: Order[];
  updateStatus: (id: string, newStatus: string) => void;
  setDeliveryFee: (orderId: string, fee: number) => Promise<void>;
  getWhatsAppCancelLink: (order: Order) => string;
}

export default function KanbanBoard({ pendingOrders, preparingOrders, readyOrders = [], inTransitOrders = [], updateStatus, setDeliveryFee, getWhatsAppCancelLink }: KanbanBoardProps) {
  
  // Per-card delivery fee input state (keyed by order id)
  const [deliveryFeeInputs, setDeliveryFeeInputs] = useState<Record<string, string>>({});
  const [deliveryFeeLoading, setDeliveryFeeLoading] = useState<Record<string, boolean>>({});

  const getNextStatus = (order: Order) => {
    switch (order.status) {
      case 'received': return 'awaiting_payment';
      case 'awaiting_payment': return 'in_preparation';
      case 'in_preparation': return 'ready';
      case 'ready': return order.service_type === 'delivery' ? 'in_transit' : 'delivered';
      case 'in_transit': return 'delivered';
      default: return order.status;
    }
  };

  const getStatusButtonText = (order: Order) => {
    switch (order.status) {
      case 'received': return 'Confirmar Ingredientes';
      case 'awaiting_payment': return 'Validar Pago (Finanzas)';
      case 'in_preparation': return 'Marcar como Lista';
      case 'ready': return order.service_type === 'delivery' ? 'Enviar a Domicilio' : 'Entregada al Cliente';
      case 'in_transit': return 'Confirmar Recepción';
      default: return 'Avanzar';
    }
  };

  /** A delivery order needs fee confirmation before moving forward */
  const needsDeliveryFeeConfirmation = (order: Order) => {
    return order.service_type === 'delivery' && !order.delivery_fee_confirmed;
  };

  const handleConfirmFee = async (order: Order) => {
    const feeStr = deliveryFeeInputs[order.id] ?? '';
    const fee = parseFloat(feeStr);
    if (isNaN(fee) || fee < 0) {
      alert('Ingresa una tarifa de envío válida (número mayor o igual a 0).');
      return;
    }
    setDeliveryFeeLoading(prev => ({ ...prev, [order.id]: true }));
    try {
      await setDeliveryFee(order.id, fee);
    } finally {
      setDeliveryFeeLoading(prev => ({ ...prev, [order.id]: false }));
    }
  };

  const renderOrderCard = (order: Order, isPending: boolean = false) => {
    const pendingFee = needsDeliveryFeeConfirmation(order);
    const feeConfirmed = order.delivery_fee_confirmed;
    const feeInputVal = deliveryFeeInputs[order.id] ?? '';
    const feeLoading = deliveryFeeLoading[order.id] ?? false;

    return (
      <div 
        key={order.id} 
        className={`admin-order-card ${order.status}`}
        style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', boxSizing: 'border-box', overflow: 'hidden' }}
      >
        {/* HEADER META */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.05rem', color: 'var(--color-green-dark)' }}>
              Orden #{order.id.slice(-4).toUpperCase()}
            </span>
            <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
              {new Date(order.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          
          <div style={{ fontSize: '0.85rem', color: 'var(--color-text-dark)', lineHeight: '1.3' }}>
            <strong>{order.customer_name}</strong>
            <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', display: 'block' }}>Tel: {order.customer_phone}</span>
          </div>
        </div>

        {/* BADGES & POS TICKET */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: order.service_type === 'delivery' ? '#0284c7' : '#059669', backgroundColor: order.service_type === 'delivery' ? '#e0f2fe' : '#d1fae5', padding: '3px 8px', borderRadius: '12px' }}>
            {order.service_type === 'delivery' ? 'A Domicilio' : 'Para Recoger'}
          </span>
          {/* Delivery fee badge */}
          {order.service_type === 'delivery' && (
            <span style={{ 
              fontSize: '0.75rem', fontWeight: 600, padding: '3px 8px', borderRadius: '12px',
              color: feeConfirmed ? '#166534' : '#92400e',
              backgroundColor: feeConfirmed ? '#dcfce7' : '#fef3c7'
            }}>
              {feeConfirmed
                ? `Envío: $${order.delivery_fee ?? 0}`
                : '⏳ Tarifa Pendiente'}
            </span>
          )}
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-ochre-dark)', backgroundColor: 'var(--color-ochre-light)', padding: '3px 8px', borderRadius: '12px' }}>
            Ticket POS: {order.loyverse_receipt_number || '⏳ Pendiente'}
          </span>
        </div>

        {/* ADDRESS IF DELIVERY */}
        {order.service_type === 'delivery' && order.delivery_address && (
          <div style={{ fontSize: '0.78rem', color: '#4b5563', backgroundColor: 'rgba(2, 132, 199, 0.06)', padding: '8px 10px', borderRadius: '8px', border: '1px solid rgba(2, 132, 199, 0.15)', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
            <MapPin size={14} color="#0284c7" style={{ flexShrink: 0, marginTop: '2px' }} />
            <span style={{ wordBreak: 'break-word', lineHeight: '1.3' }}>{order.delivery_address}</span>
          </div>
        )}

        {/* DELIVERY FEE PANEL — only for delivery orders with pending fee */}
        {order.service_type === 'delivery' && pendingFee && (
          <div style={{ 
            backgroundColor: '#fffbeb', border: '1px solid #f59e0b', borderRadius: '10px', 
            padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 700, color: '#92400e' }}>
              <Truck size={14} />
              <span>Cotizar costo de envío</span>
            </div>
            <p style={{ fontSize: '0.75rem', color: '#78350f', margin: 0, lineHeight: '1.4' }}>
              Revisa la dirección e ingresa la tarifa antes de confirmar la orden.
            </p>
            <div style={{ display: 'flex', gap: '6px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: '#92400e', fontWeight: 700, fontSize: '0.9rem' }}>$</span>
                <input
                  type="number"
                  min="0"
                  step="5"
                  placeholder="0"
                  value={feeInputVal}
                  onChange={e => setDeliveryFeeInputs(prev => ({ ...prev, [order.id]: e.target.value }))}
                  style={{ 
                    width: '100%', padding: '8px 8px 8px 22px', border: '1px solid #f59e0b', borderRadius: '6px', 
                    fontSize: '0.9rem', fontWeight: 700, backgroundColor: '#fff', 
                    boxSizing: 'border-box', outline: 'none'
                  }}
                />
              </div>
              <button
                onClick={() => handleConfirmFee(order)}
                disabled={feeLoading || feeInputVal === ''}
                style={{ 
                  padding: '8px 12px', backgroundColor: feeLoading ? '#d1d5db' : '#f59e0b', color: '#1c1917', 
                  border: 'none', borderRadius: '6px', fontWeight: 700, fontSize: '0.8rem', 
                  cursor: feeLoading || feeInputVal === '' ? 'not-allowed' : 'pointer',
                  flexShrink: 0, transition: 'all 0.15s'
                }}
              >
                {feeLoading ? '...' : 'Confirmar'}
              </button>
            </div>
          </div>
        )}

        {/* ITEMS BREAKDOWN */}
        <div style={{ padding: '10px 12px', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
          {isPending && (
            <div style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-terracotta)', marginBottom: '8px', display: 'flex', gap: '6px', alignItems: 'center' }}>
              <ClipboardList size={14} />
              <span>Por Preparar</span>
            </div>
          )}
          {order.items.map((item, idx) => (
            <div key={idx} style={{ fontSize: '0.85rem', marginBottom: idx < order.items.length - 1 ? '8px' : '0', borderBottom: idx < order.items.length - 1 ? '1px dashed rgba(0,0,0,0.08)' : 'none', paddingBottom: idx < order.items.length - 1 ? '6px' : '0' }}>
              <div style={{ color: 'var(--color-text-dark)' }}>
                <strong style={{ color: 'var(--color-green-dark)' }}>{item.quantity}x</strong> {item.name} {item.variant && <span style={{ fontWeight: 500 }}>({item.variant})</span>}
              </div>
              {item.customizations && (
                <div style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', marginLeft: '14px', marginTop: '3px', lineHeight: '1.3' }}>
                  {item.customizations.proteins?.length > 0 && <div>• Prot: {item.customizations.proteins.join(', ')}</div>}
                  {item.customizations.toppings?.length > 0 && <div>• Toppings: {item.customizations.toppings.join(', ')}</div>}
                  {item.customizations.seedsAndNuts?.length > 0 && <div>• Semillas: {item.customizations.seedsAndNuts.join(', ')}</div>}
                  {item.customizations.dressings?.length > 0 && <div>• Aderezo: {item.customizations.dressings.join(', ')}</div>}
                  {item.customizations.flavors?.length > 0 && <div>• Sabor: {item.customizations.flavors.join(', ')}</div>}
                  {item.customizations.extras?.length > 0 && <div>• Extras: {item.customizations.extras.join(', ')}</div>}
                </div>
              )}
            </div>
          ))}
          
          {order.notes && (
            <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px solid rgba(0,0,0,0.06)', fontSize: '0.78rem', color: 'var(--color-terracotta)', fontStyle: 'italic' }}>
              <AlertCircle size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
              <strong>Notas:</strong> "{order.notes}"
            </div>
          )}
        </div>

        {/* FOOTER ACTIONS & TOTAL */}
        <div style={{ marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Subtotal productos:</span>
            <span style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-green-dark)' }}>${order.total}</span>
          </div>
          {order.service_type === 'delivery' && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Costo envío:</span>
              <span style={{ fontSize: '0.95rem', fontWeight: 700, color: feeConfirmed ? '#059669' : '#f59e0b' }}>
                {feeConfirmed ? `$${order.delivery_fee ?? 0}` : 'Por definir'}
              </span>
            </div>
          )}
          {order.service_type === 'delivery' && feeConfirmed && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '6px', borderTop: '1px dashed rgba(0,0,0,0.1)' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--color-green-dark)', fontWeight: 700 }}>Total a cobrar:</span>
              <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-green-dark)' }}>
                ${(order.total + (order.delivery_fee ?? 0))}
              </span>
            </div>
          )}

          {/* Block advance button if delivery fee not confirmed yet */}
          {pendingFee ? (
            <button 
              disabled
              style={{ width: '100%', padding: '10px', fontSize: '0.85rem', borderRadius: '8px', textAlign: 'center', backgroundColor: '#f3f4f6', color: '#9ca3af', border: '1px dashed #d1d5db', cursor: 'not-allowed' }}
            >
              ⚠ Confirma la tarifa de envío primero
            </button>
          ) : (
            <button 
              className="admin-btn admin-btn-accept" 
              style={{ width: '100%', padding: '10px', fontSize: '0.85rem', borderRadius: '8px', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }} 
              onClick={() => updateStatus(order.id, getNextStatus(order))}
            >
              {getStatusButtonText(order)}
            </button>
          )}

          {isPending && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button 
                className="admin-btn admin-btn-cancel" 
                style={{ width: '100%', padding: '8px 4px', fontSize: '0.75rem', borderRadius: '8px', margin: 0 }} 
                onClick={() => updateStatus(order.id, 'cancelled')}
              >
                Rechazar
              </button>
              <a 
                href={getWhatsAppCancelLink(order)} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="admin-btn"
                style={{ width: '100%', padding: '8px 4px', fontSize: '0.75rem', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', backgroundColor: '#e0f2f1', color: '#00796b', boxSizing: 'border-box', textDecoration: 'none' }}
              >
                <MessageCircle size={13} />
                <span>WhatsApp</span>
              </a>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', width: '100%', alignItems: 'start', paddingBottom: '20px' }}>
      
      {/* COLUMN 1: REVISIÓN */}
      <div className="admin-panel-section" style={{ width: '100%', borderTop: '4px solid var(--color-terracotta)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}>
          <Clock color="var(--color-terracotta)" />
          <h2 style={{ fontSize: '1.2rem', color: 'var(--color-green-dark)' }}>Recibidos ({pendingOrders.length})</h2>
        </div>
        <div className="admin-orders-list">
          {pendingOrders.map(o => renderOrderCard(o, true))}
        </div>
      </div>

      {/* COLUMN 2: PREPARANDO */}
      <div className="admin-panel-section" style={{ width: '100%', borderTop: '4px solid var(--color-green-dark)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}>
          <ChefHat color="var(--color-green-dark)" />
          <h2 style={{ fontSize: '1.2rem', color: 'var(--color-green-dark)' }}>Preparando ({preparingOrders.length})</h2>
        </div>
        <div className="admin-orders-list">
          {preparingOrders.map(o => renderOrderCard(o, false))}
        </div>
      </div>

      {/* COLUMN 3: LISTAS */}
      <div className="admin-panel-section" style={{ width: '100%', borderTop: '4px solid var(--color-ochre)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}>
          <PackageCheck color="var(--color-ochre)" />
          <h2 style={{ fontSize: '1.2rem', color: 'var(--color-green-dark)' }}>Listas ({readyOrders.length})</h2>
        </div>
        <div className="admin-orders-list">
          {readyOrders.map(o => renderOrderCard(o, false))}
        </div>
      </div>

      {/* COLUMN 4: EN CAMINO */}
      <div className="admin-panel-section" style={{ width: '100%', borderTop: '4px solid #0284c7' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}>
          <Bike color="#0284c7" />
          <h2 style={{ fontSize: '1.2rem', color: 'var(--color-green-dark)' }}>En Camino ({inTransitOrders.length})</h2>
        </div>
        <div className="admin-orders-list">
          {inTransitOrders.map(o => renderOrderCard(o, false))}
        </div>
      </div>

    </div>
  );
}
