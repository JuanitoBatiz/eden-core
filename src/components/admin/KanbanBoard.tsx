import React from 'react';
import { Clock, ChefHat, ClipboardList, MessageCircle, AlertCircle } from 'lucide-react';
import { Order } from '@/types/api-contracts';

interface KanbanBoardProps {
  pendingOrders: Order[];
  preparingOrders: Order[];
  updateStatus: (id: string, newStatus: 'in_preparation' | 'delivered' | 'cancelled') => void;
  getWhatsAppCancelLink: (order: Order) => string;
}

export default function KanbanBoard({ pendingOrders, preparingOrders, updateStatus, getWhatsAppCancelLink }: KanbanBoardProps) {
  return (
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
                        <strong>{item.quantity}x {item.name}</strong> {item.variant && `(${item.variant})`}
                        {item.customizations && (
                          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginLeft: '12px', marginTop: '2px' }}>
                            {item.customizations.proteins?.length > 0 && <div>• Prot: {item.customizations.proteins.join(', ')}</div>}
                            {item.customizations.toppings?.length > 0 && <div>• Toppings: {item.customizations.toppings.join(', ')}</div>}
                            {item.customizations.seedsAndNuts?.length > 0 && <div>• Semillas/Frutos: {item.customizations.seedsAndNuts.join(', ')}</div>}
                            {item.customizations.dressings?.length > 0 && <div>• Aderezo: {item.customizations.dressings.join(', ')}</div>}
                            {item.customizations.flavors?.length > 0 && <div>• Sabor: {item.customizations.flavors.join(', ')}</div>}
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
                        <strong>{item.quantity}x {item.name}</strong> {item.variant && `(${item.variant})`}
                        {item.customizations && (
                          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginLeft: '12px' }}>
                            {item.customizations.proteins?.length > 0 && <span>Prot: {item.customizations.proteins.join(', ')} | </span>}
                            {item.customizations.toppings?.length > 0 && <span>Toppings: {item.customizations.toppings.join(', ')} | </span>}
                            {item.customizations.seedsAndNuts?.length > 0 && <span>Semillas: {item.customizations.seedsAndNuts.join(', ')} | </span>}
                            {item.customizations.dressings?.length > 0 && <span>Aderezo: {item.customizations.dressings.join(', ')} | </span>}
                            {item.customizations.flavors?.length > 0 && <span>Sabor: {item.customizations.flavors.join(', ')}</span>}
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
    </div>
  );
}
