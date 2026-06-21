import React from 'react';
import { ClipboardList, Check, X } from 'lucide-react';
import { Order } from '@/types/api-contracts';

interface FinanceApprovalProps {
  pendingPayments: Order[];
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
  activeFinancialOrder,
  selectedProofUrl,
  rejectReason,
  canApprovePayments,
  setRejectReason,
  viewProof,
  approvePayment,
  rejectPayment
}: FinanceApprovalProps) {
  return (
    <div className="admin-finance-container" style={{ display: 'flex', gap: '30px', alignItems: 'flex-start' }}>
      {/* Lista */}
      <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '15px', maxHeight: '70vh', overflowY: 'auto', paddingRight: '10px' }}>
        <h3 style={{ color: 'var(--color-text-dark)', marginBottom: '5px' }}>Comprobantes Pendientes</h3>
          {pendingPayments.map(p => (
            <div key={p.id} onClick={() => viewProof(p.id)} style={{ padding: '15px', border: activeFinancialOrder === p.id ? '2px solid var(--color-terracotta)' : '1px solid var(--color-cream-dark)', borderRadius: '10px', cursor: 'pointer', backgroundColor: activeFinancialOrder === p.id ? 'var(--color-ochre-light)' : 'white', transition: 'all 0.2s' }}>
              <div style={{ fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-dark)' }}>Orden #{p.id.slice(-4).toUpperCase()}</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{new Date(p.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--color-text-dark)', marginTop: '4px' }}>{p.customer_name} | {p.customer_phone}</div>
              <div style={{ fontWeight: 700, color: 'var(--color-green-dark)', marginTop: '8px' }}>${p.total}</div>
            </div>
          ))}
          {pendingPayments.length === 0 && (
            <div style={{ backgroundColor: 'var(--color-cream-light)', padding: '30px', borderRadius: '15px', textAlign: 'center', color: 'var(--color-text-muted)', fontStyle: 'italic', border: '1px dashed var(--color-cream-dark)' }}>
              No hay comprobantes pendientes de validación.
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
                  
                    {canApprovePayments ? (
                      <div style={{ display: 'flex', gap: '15px', alignItems: 'stretch' }}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <input 
                            type="text" 
                            placeholder="Motivo (obligatorio si rechazas)" 
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--color-cream-dark)', width: '100%', fontSize: '0.9rem', color: 'var(--color-text-dark)' }}
                          />
                          <button onClick={() => rejectPayment(activeFinancialOrder)} style={{ backgroundColor: 'var(--color-terracotta)', color: 'white', padding: '12px', borderRadius: '8px', border: 'none', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                            <X size={18} /> Rechazar Pago
                          </button>
                        </div>
                        <button onClick={() => approvePayment(activeFinancialOrder)} style={{ flex: 1, backgroundColor: 'var(--color-green-dark)', color: 'white', padding: '12px', borderRadius: '8px', border: 'none', fontWeight: 700, fontSize: '1.1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                          <Check size={24} /> Aprobar Pago
                        </button>
                      </div>
                    ) : (
                      <div style={{ padding: '15px', backgroundColor: 'var(--color-ochre-light)', color: 'var(--color-ochre)', borderRadius: '8px', textAlign: 'center' }}>
                        No tienes permisos para aprobar pagos.
                      </div>
                    )}
                </div>
              )}
            </div>
          )}
      </div>
    </div>
  );
}
