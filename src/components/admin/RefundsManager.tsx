import React, { useState, useEffect } from 'react';
import { RefreshCw, ClipboardList, CheckCircle, UploadCloud, MessageCircle, Info } from 'lucide-react';
import { Order } from '@/types/api-contracts';

export default function RefundsManager() {
  const [pendingRefunds, setPendingRefunds] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [refundFile, setRefundFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchRefunds = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/admin/refunds');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al obtener reembolsos pendientes');
      setPendingRefunds(data.pendingRefunds || []);
      // Si la orden seleccionada ya no está, deseleccionar
      if (selectedOrder && !(data.pendingRefunds || []).find((o: any) => o.id === selectedOrder.id)) {
        setSelectedOrder(null);
        setRefundFile(null);
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRefunds();
  }, []);

  const handleWhatsApp = (order: Order) => {
    // Numeros en Mexico, limpiar formato
    let phone = order.customer_phone.replace(/\D/g, '');
    if (phone.length === 10) phone = '52' + phone;
    
    const text = encodeURIComponent(
      `Hola ${order.customer_name}, tuvimos que cancelar tu orden #${order.id.slice(-4).toUpperCase()} en Edén. Por favor proporciónanos tu número de cuenta o CLABE para procesar la devolución de tu dinero ($${order.total}).`
    );
    window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
  };

  const handleSubmitRefund = async () => {
    if (!selectedOrder || !refundFile) return;

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const formData = new FormData();
      formData.append('orderId', selectedOrder.id);
      formData.append('file', refundFile);

      const res = await fetch('/api/admin/refunds/complete', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al procesar el reembolso');

      // Éxito, recargar lista
      setSelectedOrder(null);
      setRefundFile(null);
      await fetchRefunds();

    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {errorMsg && (
        <div style={{ backgroundColor: '#fee2e2', color: '#dc2626', padding: '15px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Info size={20} />
          <span>{errorMsg}</span>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ color: 'var(--color-green-dark)', margin: 0 }}>Reembolsos Pendientes</h2>
        <button 
          onClick={fetchRefunds} 
          disabled={loading}
          style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '8px 15px', borderRadius: '20px', border: '1px solid var(--color-ochre)', background: 'white', cursor: loading ? 'not-allowed' : 'pointer' }}
        >
          <RefreshCw size={16} className={loading ? 'spin-icon' : ''} /> Actualizar
        </button>
      </div>

      <div className="admin-finance-container" style={{ display: 'flex', gap: '30px', alignItems: 'flex-start' }}>
        {/* Lista */}
        <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '15px', maxHeight: '70vh', overflowY: 'auto', paddingRight: '10px' }}>
          {loading && pendingRefunds.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--color-text-muted)' }}>Cargando...</div>
          ) : pendingRefunds.length === 0 ? (
            <div style={{ backgroundColor: 'var(--color-cream-light)', padding: '30px', borderRadius: '15px', textAlign: 'center', color: 'var(--color-text-muted)', fontStyle: 'italic', border: '1px dashed var(--color-cream-dark)' }}>
              No hay reembolsos pendientes en este momento.
            </div>
          ) : (
            pendingRefunds.map(order => (
              <div 
                key={order.id} 
                onClick={() => { setSelectedOrder(order); setRefundFile(null); setErrorMsg(''); }} 
                style={{ 
                  padding: '15px', 
                  border: selectedOrder?.id === order.id ? '2px solid #8b5cf6' : '1px solid var(--color-cream-dark)', 
                  borderRadius: '10px', 
                  cursor: 'pointer', 
                  backgroundColor: selectedOrder?.id === order.id ? '#f3f0ff' : 'white', 
                  transition: 'all 0.2s' 
                }}
              >
                <div style={{ fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--color-text-dark)' }}>Orden #{order.id.slice(-4).toUpperCase()}</span>
                  <span style={{ color: '#8b5cf6', backgroundColor: '#eedeef', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 600 }}>Pendiente</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                  {new Date(order.created_at).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--color-text-dark)', marginTop: '4px' }}>{order.customer_name} | {order.customer_phone}</div>
                <div style={{ fontWeight: 700, color: 'var(--color-terracotta)', marginTop: '8px' }}>Monto a devolver: ${order.total}</div>
              </div>
            ))
          )}
        </div>

        {/* Detalle */}
        <div style={{ flex: '2', backgroundColor: 'var(--color-cream-light)', borderRadius: '15px', padding: '30px', border: '1px solid var(--color-cream-dark)', minHeight: '60vh' }}>
          {!selectedOrder ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-muted)' }}>
              <ClipboardList size={48} color="var(--color-cream-dark)" style={{ marginBottom: '15px' }} />
              <p>Selecciona un reembolso de la lista para procesarlo.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <h3 style={{ margin: 0, color: 'var(--color-green-dark)' }}>Procesar Reembolso</h3>
              
              <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', border: '1px solid var(--color-ochre-light)' }}>
                <div style={{ marginBottom: '15px' }}>
                  <strong style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>Cliente</strong>
                  <span style={{ fontSize: '1.1rem', color: 'var(--color-text-dark)' }}>{selectedOrder.customer_name}</span>
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <strong style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>Teléfono</strong>
                  <span style={{ fontSize: '1.1rem', color: 'var(--color-text-dark)' }}>{selectedOrder.customer_phone}</span>
                </div>
                <div>
                  <strong style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>Monto a Reembolsar</strong>
                  <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-terracotta)' }}>${selectedOrder.total}</span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '10px' }}>
                <h4 style={{ margin: 0, color: 'var(--color-text-dark)' }}>Paso 1: Contactar al Cliente</h4>
                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>Solicítale su número de cuenta o CLABE para realizar la transferencia.</p>
                <button 
                  onClick={() => handleWhatsApp(selectedOrder)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '12px', backgroundColor: '#25D366', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}
                >
                  <MessageCircle size={20} />
                  Contactar por WhatsApp
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px', borderTop: '1px solid var(--color-cream-dark)', paddingTop: '20px' }}>
                <h4 style={{ margin: 0, color: 'var(--color-text-dark)' }}>Paso 2: Subir Comprobante</h4>
                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>Una vez realizada la transferencia desde tu banco, sube la captura de pantalla para cerrar este reembolso.</p>
                
                <input 
                  type="file" 
                  accept="image/jpeg, image/png, application/pdf"
                  onChange={(e) => setRefundFile(e.target.files?.[0] || null)}
                  style={{ padding: '10px', border: '1px solid var(--color-ochre-light)', borderRadius: '8px', backgroundColor: 'white' }}
                />

                <button 
                  onClick={handleSubmitRefund}
                  disabled={!refundFile || isSubmitting}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '12px', backgroundColor: (!refundFile || isSubmitting) ? '#ccc' : 'var(--color-green-dark)', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 700, cursor: (!refundFile || isSubmitting) ? 'not-allowed' : 'pointer', marginTop: '10px' }}
                >
                  {isSubmitting ? (
                    <><RefreshCw size={20} className="spin-icon" /> Procesando...</>
                  ) : (
                    <><CheckCircle size={20} /> Marcar como Reembolsado</>
                  )}
                </button>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
