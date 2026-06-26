import React, { useState } from 'react';
import { ClipboardList, Check, X, Shield, Clock } from 'lucide-react';
import { Order } from '@/types/api-contracts';

interface FinanceApprovalProps {
  pendingPayments: Order[];
  auditOrders: Order[];
  activeFinancialOrder: string | null;
  selectedProofUrl: string | null;
  rejectReason: string;
  canApprovePayments: boolean;
  setRejectReason: (reason: string) => void;
  viewProof: (id: string) => void;
  approvePayment: (id: string) => void;
  rejectPayment: (id: string) => void;
}

export default function FinanceApproval({
  pendingPayments,
  auditOrders,
  activeFinancialOrder,
  selectedProofUrl,
  rejectReason,
  canApprovePayments,
  setRejectReason,
  viewProof,
  approvePayment,
  rejectPayment
}: FinanceApprovalProps) {
  const [financeView, setFinanceView] = useState<'pending' | 'audit'>('pending');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleApprove = (id: string) => {
    if (isProcessing) return;
    setIsProcessing(true);
    approvePayment(id);
    setTimeout(() => setIsProcessing(false), 2000);
  };

  const handleReject = (id: string) => {
    if (isProcessing) return;
    setIsProcessing(true);
    rejectPayment(id);
    setTimeout(() => setIsProcessing(false), 2000);
  };

  const getStatusLabel = (status: string, payment_status: string) => {
    if (payment_status === 'payment_approved') return <span style={{ color: '#059669', backgroundColor: '#d1fae5', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 600 }}>Aprobado</span>;
    if (payment_status === 'payment_rejected' || status === 'cancelled') return <span style={{ color: '#dc2626', backgroundColor: '#fee2e2', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 600 }}>Rechazado</span>;
    return <span style={{ color: '#d97706', backgroundColor: '#fef3c7', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 600 }}>En Proceso</span>;
  };

  const listToRender = financeView === 'pending' ? pendingPayments : auditOrders;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Sub-tabs for Finance section */}
      <div style={{ display: 'flex', gap: '15px', borderBottom: '1px solid var(--color-cream-dark)', paddingBottom: '10px' }}>
        <button 
          onClick={() => setFinanceView('pending')}
          style={{ background: 'none', border: 'none', fontSize: '1rem', fontWeight: financeView === 'pending' ? 700 : 500, color: financeView === 'pending' ? 'var(--color-terracotta)' : 'var(--color-text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Clock size={18} /> Pendientes de Validación ({pendingPayments.length})
        </button>
        <button 
          onClick={() => setFinanceView('audit')}
          style={{ background: 'none', border: 'none', fontSize: '1rem', fontWeight: financeView === 'audit' ? 700 : 500, color: financeView === 'audit' ? 'var(--color-green-dark)' : 'var(--color-text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Shield size={18} /> Auditoría (Últimos 7 días)
        </button>
      </div>

      <div className="admin-finance-container" style={{ display: 'flex', gap: '30px', alignItems: 'flex-start' }}>
        {/* Lista */}
        <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '15px', maxHeight: '70vh', overflowY: 'auto', paddingRight: '10px' }}>
          <h3 style={{ color: 'var(--color-text-dark)', marginBottom: '5px' }}>
            {financeView === 'pending' ? 'Comprobantes Pendientes' : 'Historial de Comprobantes'}
          </h3>
            {listToRender.map(p => (
              <div key={p.id} onClick={() => viewProof(p.id)} style={{ padding: '15px', border: activeFinancialOrder === p.id ? `2px solid ${financeView === 'pending' ? 'var(--color-terracotta)' : 'var(--color-green-dark)'}` : '1px solid var(--color-cream-dark)', borderRadius: '10px', cursor: 'pointer', backgroundColor: activeFinancialOrder === p.id ? 'var(--color-ochre-light)' : 'white', transition: 'all 0.2s' }}>
                <div style={{ fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--color-text-dark)' }}>Orden #{p.id.slice(-4).toUpperCase()}</span>
                  {financeView === 'audit' && getStatusLabel(p.status, p.payment_status || '')}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                  {new Date(p.created_at).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--color-text-dark)', marginTop: '4px' }}>{p.customer_name} | {p.customer_phone}</div>
                <div style={{ fontWeight: 700, color: 'var(--color-green-dark)', marginTop: '8px' }}>${p.total}</div>
                {financeView === 'audit' && (p as any).rejection_reason && (
                  <div style={{ fontSize: '0.8rem', color: '#dc2626', marginTop: '6px', backgroundColor: '#fee2e2', padding: '4px', borderRadius: '4px' }}>
                    Motivo: {(p as any).rejection_reason}
                  </div>
                )}
              </div>
            ))}
            {listToRender.length === 0 && (
              <div style={{ backgroundColor: 'var(--color-cream-light)', padding: '30px', borderRadius: '15px', textAlign: 'center', color: 'var(--color-text-muted)', fontStyle: 'italic', border: '1px dashed var(--color-cream-dark)' }}>
                {financeView === 'pending' ? 'No hay comprobantes pendientes de validación.' : 'No hay comprobantes en los últimos 7 días.'}
              </div>
            )}
        </div>
      
      {/* Detalle */}
      <div style={{ flex: '2', backgroundColor: 'var(--color-cream-light)', borderRadius: '15px', padding: '30px', border: '1px solid var(--color-cream-dark)', minHeight: '60vh' }}>
          {!activeFinancialOrder ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-muted)' }}>
              <ClipboardList size={48} color="var(--color-cream-dark)" style={{ marginBottom: '15px' }} />
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
                  <div style={{ border: '1px solid var(--color-cream-dark)', borderRadius: '10px', overflow: 'hidden', backgroundColor: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px', padding: '10px' }}>
                    {selectedProofUrl.split('?')[0].toLowerCase().endsWith('.pdf') ? (
                      <iframe src={selectedProofUrl} style={{ width: '100%', height: '500px', border: 'none' }} title="Comprobante" />
                    ) : (
                      <a href={selectedProofUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'block', cursor: 'zoom-in' }}>
                        <img src={selectedProofUrl} alt="Comprobante" style={{ maxWidth: '100%', maxHeight: '500px', objectFit: 'contain' }} />
                      </a>
                    )}
                  </div>
                  
                  
                    {financeView === 'pending' && canApprovePayments && (
                      <div style={{ display: 'flex', gap: '15px', alignItems: 'stretch' }}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <input 
                            type="text" 
                            placeholder="Motivo (obligatorio si rechazas)" 
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--color-cream-dark)', width: '100%', fontSize: '0.9rem', color: 'var(--color-text-dark)' }}
                          />
                          <button disabled={isProcessing} onClick={() => handleReject(activeFinancialOrder)} style={{ backgroundColor: isProcessing ? 'var(--color-text-muted)' : 'var(--color-terracotta)', color: 'white', padding: '12px', borderRadius: '8px', border: 'none', fontWeight: 600, cursor: isProcessing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                            <X size={18} /> {isProcessing ? 'Procesando...' : 'Rechazar Pago'}
                          </button>
                        </div>
                        <button disabled={isProcessing} onClick={() => handleApprove(activeFinancialOrder)} style={{ flex: 1, backgroundColor: isProcessing ? 'var(--color-text-muted)' : 'var(--color-green-dark)', color: 'white', padding: '12px', borderRadius: '8px', border: 'none', fontWeight: 700, fontSize: '1.1rem', cursor: isProcessing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                          <Check size={24} /> {isProcessing ? 'Guardando...' : 'Aprobar Pago'}
                        </button>
                      </div>
                    )}
                    {financeView === 'pending' && !canApprovePayments && (
                      <div style={{ padding: '15px', backgroundColor: 'var(--color-ochre-light)', color: 'var(--color-ochre)', borderRadius: '8px', textAlign: 'center' }}>
                        No tienes permisos para aprobar pagos.
                      </div>
                    )}
                    {financeView === 'audit' && (
                      <div style={{ padding: '15px', backgroundColor: 'var(--color-cream-light)', color: 'var(--color-text-muted)', borderRadius: '8px', textAlign: 'center', fontStyle: 'italic', fontSize: '0.9rem' }}>
                        Estás en modo Auditoría. Solo visualización (Las imágenes se borran auto después de 7 días).
                      </div>
                    )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
