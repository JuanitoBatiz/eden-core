'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  Clock, 
  ChefHat, 
  CheckCircle, 
  Check,
  XCircle, 
  ArrowLeft, 
  MessageCircle, 
  ShoppingBag,
  Phone,
  HelpCircle,
  FileText,
  Salad,
  Sparkles,
  Utensils,
  CupSoda,
  Bike,
  ShieldCheck,
  Award,
  QrCode,
  Camera
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

interface Order {
  id: string;
  created_at: string;
  customer_name: string;
  customer_phone: string;
  items: any[];
  total: number;
  notes?: string;
  status: string;
  service_type?: string;
  delivery_address?: string;
  /** Tarifa de envío cotizada por caja. NULL = pendiente. */
  delivery_fee?: number | null;
  /** true cuando la caja ha confirmado la tarifa */
  delivery_fee_confirmed?: boolean;
  loyverse_receipt_number?: string;
  payment_status?: string;
  payment_method?: string;
  rejection_reason?: string;
}

interface ProgressStep {
  id: string;
  label: string;
  state: 'completed' | 'active' | 'pending';
}

const getOrderProgressSteps = (order: Order): ProgressStep[] => {
  if (order.status === 'cancelled') {
    return [{ id: 'cancelled', label: 'Pedido Cancelado', state: 'active' }];
  }

  const isDelivery = order.service_type === 'delivery';
  const requiresOnlinePayment = order.status === 'awaiting_payment' || order.payment_status === 'pending_payment' || order.payment_status === 'payment_submitted' || order.payment_status === 'payment_approved' || (order as any).payment_method === 'transferencia' || (order as any).payment_method === 'spei' || (order as any).payment_method === 'tarjeta';

  // Base stages
  const steps: ProgressStep[] = [];

  // Step 1: Recibido / Revisión
  const isReceived = order.status === 'received';
  steps.push({
    id: 'received',
    label: 'Recibido',
    state: isReceived ? 'active' : 'completed'
  });

  // Step 2 (conditional): Confirmación de Pago si es online / transferencia
  if (requiresOnlinePayment) {
    const isPaymentActive = order.status === 'awaiting_payment' || order.payment_status === 'pending_payment' || order.payment_status === 'payment_submitted';
    steps.push({
      id: 'payment',
      label: 'Validar Pago',
      state: isReceived ? 'pending' : isPaymentActive ? 'active' : 'completed'
    });
  }

  // Step 3: Preparación
  const isPrep = order.status === 'in_preparation';
  const isAfterPrep = order.status === 'ready' || order.status === 'in_transit' || order.status === 'delivered';
  steps.push({
    id: 'prep',
    label: 'Preparando',
    state: isPrep ? 'active' : isAfterPrep ? 'completed' : 'pending'
  });

  // Step 4: Listo / En camino
  if (isDelivery) {
    const isTransit = order.status === 'in_transit' || order.status === 'ready';
    const isDelivered = order.status === 'delivered';
    steps.push({
      id: 'transit',
      label: 'En Camino',
      state: isTransit ? 'active' : isDelivered ? 'completed' : 'pending'
    });
    steps.push({
      id: 'delivered',
      label: 'Entregado',
      state: isDelivered ? 'active' : 'pending'
    });
  } else {
    const isReady = order.status === 'ready';
    const isDelivered = order.status === 'delivered';
    const readyLabel = order.service_type === 'dine_in' ? 'Listo en Mesa' : 'Listo para Recoger';
    steps.push({
      id: 'ready',
      label: readyLabel,
      state: isReady ? 'active' : isDelivered ? 'completed' : 'pending'
    });
    steps.push({
      id: 'delivered',
      label: order.service_type === 'dine_in' ? 'Servido' : 'Entregado',
      state: isDelivered ? 'active' : 'pending'
    });
  }

  return steps;
};

export default function OrderStatusPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Bank Config state
  const [bankConfig, setBankConfig] = useState<any>(null);
  const [bankError, setBankError] = useState('');
  const [copied, setCopied] = useState(false);
  const [showSyncMessage, setShowSyncMessage] = useState(true);

  // Upload state
  const [showUpload, setShowUpload] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [showThankYou, setShowThankYou] = useState(false);
  const [dynamicStep, setDynamicStep] = useState(0);

  // Helper universal de copiado (funciona en HTTP LAN móvil y dispara vibración háptica)
  const handleCopyClabe = (text: string) => {
    if (!text) return;
    if (typeof window !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate([40, 30, 40]); } catch(e) {}
    }
    const onSuccess = () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(onSuccess).catch(() => fallbackCopy(text, onSuccess));
    } else {
      fallbackCopy(text, onSuccess);
    }
  };

  const fallbackCopy = (text: string, onSuccess: () => void) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.top = "-99999px";
    textArea.style.left = "-99999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      onSuccess();
    } catch (err) {
      console.error('Error copiando:', err);
      alert('CLABE para transferir:\n' + text);
    }
    document.body.removeChild(textArea);
  };

  // Rotación dinámica UX para dar sensación de actividad en vivo (tipo DiDi / Uber)
  useEffect(() => {
    if (!order) return;
    // Also animate while waiting for delivery fee confirmation
    if (order.status === 'received' || order.status === 'in_preparation' ||
        (order.service_type === 'delivery' && !order.delivery_fee_confirmed)) {
      const interval = setInterval(() => {
        setDynamicStep(prev => (prev + 1) % 4);
      }, 6500);
      return () => clearInterval(interval);
    } else {
      setDynamicStep(0);
    }
  }, [order?.status, order?.delivery_fee_confirmed]);

  // Obtiene los detalles de la orden. credentials:'include' envía la cookie httpOnly automáticamente.
  const fetchOrder = async () => {
    try {
      // 1. Refresh silencioso para asegurar que el access_token en cookie esté vigente
      const authRes = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
      if (!authRes.ok) {
        setError('No estás autenticado. Por favor inicia sesión.');
        setLoading(false);
        return;
      }

      // 2. Fetch de la orden — la cookie renovada viaja automáticamente
      const res = await fetch(`/api/orders/${id}`, { credentials: 'include' });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'No pudimos cargar los detalles del pedido.');
        setLoading(false);
        return;
      }

      setOrder(data.order);
      setLoading(false);
    } catch (e) {
      console.error('Error fetching order:', e);
      setError('Error al conectar con el servidor.');
      setLoading(false);
    }
  };

  const fetchBankConfig = async () => {
    try {
      const res = await fetch('/api/bank-config');
      const data = await res.json();
      if (res.ok) {
        setBankConfig(data.config);
      } else {
        setBankError(data.error || 'Configuración bancaria no disponible.');
      }
    } catch (e) {
      setBankError('Error al cargar datos bancarios.');
    }
  };

  useEffect(() => {
    if (!id) return;
    fetchOrder();
    fetchBankConfig();

    // SIEMPRE activamos un intervalo de polling cada 3.5 segundos en segundo plano.
    // Esto garantiza 100% que cualquier cambio de estado o asignación de tarifa en cocina se actualice
    // instantáneamente en la pantalla del cliente sin tener que refrescar la página manualmente,
    // independientemente de si Realtime o WebSocket están habilitados en Supabase.
    const pollingInterval = setInterval(fetchOrder, 3500);

    let channel: any = null;
    if (isSupabaseConfigured && supabase) {
      try {
        channel = supabase
          .channel(`order-status-${id}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'orders',
              filter: `id=eq.${id}`
            },
            (payload) => {
              console.log('Realtime order update received:', payload.new);
              setOrder(payload.new as Order);
            }
          )
          .subscribe();
      } catch (wsErr) {
        console.warn('WebSocket error:', wsErr);
      }
    }

    return () => {
      if (channel && supabase) {
        try { supabase.removeChannel(channel); } catch(e) {}
      }
      clearInterval(pollingInterval);
    };
  }, [id]);

  useEffect(() => {
    if (order && !order.loyverse_receipt_number) {
      const timer = setTimeout(() => {
        setShowSyncMessage(false);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [order?.loyverse_receipt_number]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError('');
    const file = e.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      setPreviewUrl(null);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadError('El archivo es demasiado grande (máximo 5MB).');
      return;
    }
    const validTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      setUploadError('Formato no válido. Usa JPG, PNG o PDF.');
      return;
    }

    setSelectedFile(file);
    if (file.type.startsWith('image/')) {
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setPreviewUrl(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setUploadError('');

    try {
      // Renovar cookie de access_token por si expiró durante los minutos de transferencia
      await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });

      const formData = new FormData();
      formData.append('file', selectedFile);

      const res = await fetch(`/api/orders/${id}/proof`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      const data = await res.json();
      
      if (!res.ok) {
        if (res.status === 401) {
          setUploadError('Sesión caducada. Por favor recarga la página o vuelve a ingresar.');
        } else {
          setUploadError(data.error || 'Error al subir el comprobante.');
        }
        setUploading(false);
        return;
      }

      // Success
      setUploading(false);
      setShowUpload(false);
      fetchOrder(); // refresh order state to get 'payment_submitted'

    } catch (err) {
      console.error(err);
      setUploadError('Error de red al subir el comprobante.');
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '15px' }}>
        <div className="status-animation-ring active" style={{ width: '60px', height: '60px' }}></div>
        <p style={{ fontFamily: 'var(--font-serif)', fontSize: '1.2rem', color: 'var(--color-green-dark)' }}>
          Cargando tu orden...
        </p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="container" style={{ padding: '60px 20px', textAlign: 'center' }}>
        <XCircle size={60} color="#c62828" style={{ margin: '0 auto 20px auto' }} />
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', marginBottom: '15px' }}>Hubo un error</h2>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: '30px' }}>{error || 'El pedido solicitado no existe.'}</p>
        <button className="cart-icon-btn" onClick={() => router.push('/')} style={{ margin: '0 auto' }}>
          <ArrowLeft size={18} />
          <span>Volver al Menú</span>
        </button>
      </div>
    );
  }

  // Visual layout configurations based on current status
  const getStatusConfig = () => {
    // Special case: delivery order waiting for fee quote
    if (order.service_type === 'delivery' && !order.delivery_fee_confirmed &&
        order.status !== 'cancelled' && order.status !== 'delivered') {
      return {
        titleText: 'Calculando costo de envío',
        description: 'Estamos revisando tu dirección y calculando el costo de envío a tu zona. Te notificaremos en cuanto esté confirmado.',
        colorClass: 'en_revision',
        icon: <Bike key="delivery-pending" size={48} color="#f59e0b" />,
        animationClass: 'active'
      };
    }

    switch (order.status) {
      case 'received': {
        const receivedTitles = [
          'Recibiendo orden en cocina...',
          'Revisando ingredientes frescos',
          'Asignando chef de barra',
          'Confirmando especificaciones...'
        ];
        const receivedIcons = [
          <Clock key="0" size={48} color="#f57f17" />,
          <Salad key="1" size={48} color="#f57f17" />,
          <ChefHat key="2" size={48} color="#f57f17" />,
          <Sparkles key="3" size={48} color="#f57f17" />
        ];
        const receivedDescs = [
          'Conectando con la estación principal de ensaladas y jugos naturales.',
          'Verificando calidad y disponibilidad de tus vegetales recién cortados.',
          'Nuestro chef está leyendo tus notas de personalización exactas.',
          'Hay alguien prestándole total atención a tu pedido. En breve confirmamos.'
        ];
        return {
          titleText: receivedTitles[dynamicStep] || 'Pedido en Revisión',
          description: receivedDescs[dynamicStep] || 'Tu orden fue enviada a cocina.',
          colorClass: 'en_revision',
          icon: receivedIcons[dynamicStep] || <Clock size={48} color="#f57f17" />,
          animationClass: 'active'
        };
      }
      case 'awaiting_payment':
        return {
          titleText: '¡Ingredientes Confirmados!',
          description: 'Tenemos todo listo. Elige tu método de pago para que cocina comience a preparar tu orden.',
          colorClass: 'en_revision',
          icon: <CheckCircle size={48} color="#f57f17" />,
          animationClass: 'active'
        };
      case 'in_preparation': {
        const prepTitles = [
          'Desinfectando vegetales',
          'Mezclando ingredientes',
          'Prensando jugos al momento',
          'Empacando tu pedido'
        ];
        const prepIcons = [
          <ShieldCheck key="0" size={48} color="var(--color-green-dark)" />,
          <Utensils key="1" size={48} color="var(--color-green-dark)" />,
          <CupSoda key="2" size={48} color="var(--color-green-dark)" />,
          <Sparkles key="3" size={48} color="var(--color-green-dark)" />
        ];
        const prepDescs = [
          'Lavamos tus hojas verdes con estrictos estándares de grado alimenticio.',
          'Integrando proteínas calientes, toppings artesanales y aderezos caseros.',
          'Extracción de fruta fresca en frío para conservar todas sus vitaminas.',
          'Colocando cubiertos ecológicos y sellando tu paquete con total frescura.'
        ];
        return {
          titleText: prepTitles[dynamicStep] || 'Preparando tu orden',
          description: prepDescs[dynamicStep] || 'Nuestro equipo prepara tu orden con cuidado.',
          colorClass: 'preparando',
          icon: prepIcons[dynamicStep] || <ChefHat size={48} color="var(--color-green-dark)" />,
          animationClass: 'active'
        };
      }
      case 'ready':
        return {
          titleText: order.service_type === 'delivery' ? 'Orden Lista y Empacada' : '¡Tu orden está lista!',
          description: order.service_type === 'delivery' ? 'Tu paquete está sellado y esperando al repartidor.' : 'Puedes pasar a recoger tu pedido en mostrador.',
          colorClass: 'listo',
          icon: <CheckCircle size={48} color="#2e7d32" />,
          animationClass: order.service_type === 'delivery' ? 'active' : ''
        };
      case 'in_transit':
        return {
          titleText: 'Tu pedido va en camino',
          description: 'Nuestro repartidor se dirige a la dirección indicada.',
          colorClass: 'listo',
          icon: <Bike size={48} color="#0284c7" />,
          animationClass: 'active'
        };
      case 'delivered':
        return {
          titleText: 'Pedido Entregado',
          description: 'Tu pedido fue entregado exitosamente. ¡Que lo disfrutes!',
          colorClass: 'listo',
          icon: <CheckCircle size={48} color="#2e7d32" />,
          animationClass: ''
        };
      case 'cancelled':
      default:
        return {
          titleText: 'Pedido Cancelado',
          description: 'Tuvimos que anular tu pedido. Te contactaremos por WhatsApp para ofrecerte una alternativa.',
          colorClass: 'cancelado',
          icon: <XCircle size={48} color="#c62828" />,
          animationClass: ''
        };
    }
  };

  const statusConfig = getStatusConfig();
  const formattedDate = new Date(order.created_at).toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <>
      {/* HEADER */}
      <header className="header">
        <div className="container header-content">
          <div className="logo-container" style={{ cursor: 'pointer' }} onClick={() => router.push('/')}>
            <img src="/images/logo_eden2.png" alt="Edén Logo" className="logo-img" />
            <div className="logo-text">EDÉN</div>
          </div>
          
          <button className="cart-icon-btn" onClick={() => router.push('/')} style={{ background: 'none', border: '1px solid var(--color-green-dark)', color: 'var(--color-green-dark)' }}>
            <ArrowLeft size={16} />
            <span>Ver el Menú</span>
          </button>
        </div>
      </header>

      <main className="container" style={{ padding: '20px 0 60px 0' }}>
        <div className="status-container">
          <div className="status-header">
            <span className={`status-badge-tracking ${statusConfig.colorClass}`}>
              {order.service_type === 'delivery' && !order.delivery_fee_confirmed
                ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Bike size={16} /> Cotizando Envío a Domicilio</span>
                : order.status === 'received' ? 'En Revisión'
                : order.status === 'awaiting_payment' ? 'Esperando Pago'
                : order.status === 'in_preparation' ? 'Preparando'
                : order.status === 'delivered' ? 'Listo para Entregar'
                : order.status === 'cancelled' ? 'Cancelado'
                : 'En Proceso'}
            </span>
            
            {order.status !== 'cancelled' && (
              <div className="order-progress-container">
                {getOrderProgressSteps(order).map((step, idx, arr) => (
                  <React.Fragment key={step.id}>
                    <div className={`order-progress-step ${step.state}`}>
                      <div className="order-progress-icon">
                        {step.state === 'completed' ? (
                          <Check size={15} strokeWidth={3} />
                        ) : step.state === 'active' ? (
                          <div className="order-progress-dot" />
                        ) : (
                          <span>{idx + 1}</span>
                        )}
                      </div>
                      <span className="order-progress-label">{step.label}</span>
                    </div>
                    {idx < arr.length - 1 && (
                      <div className={`order-progress-connector ${step.state === 'completed' ? 'completed' : ''}`} />
                    )}
                  </React.Fragment>
                ))}
              </div>
            )}

            <div key={statusConfig.titleText} style={{ animation: 'fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1)' }}>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2.2rem', marginTop: '15px', color: 'var(--color-green-dark)', textAlign: 'center' }}>
                {statusConfig.titleText}
              </h1>
              <p style={{ color: 'var(--color-text-muted)', marginTop: '10px', fontSize: '1rem', lineHeight: '1.5', textAlign: 'center' }}>
                {statusConfig.description}
              </p>
            </div>

            {/* Screenshot Notice */}
            {order.status !== 'cancelled' && (
              <div style={{
                marginTop: '24px',
                padding: '16px 20px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '14px',
                textAlign: 'left',
                boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
              }}>
                <div style={{ 
                  width: '42px', height: '42px', borderRadius: '12px', 
                  backgroundColor: '#e2e8f0', display: 'flex', 
                  alignItems: 'center', justifyContent: 'center', flexShrink: 0 
                }}>
                  <Camera size={20} color="#475569" />
                </div>
                <div>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '0.95rem', color: 'var(--color-green-dark)', fontWeight: 700 }}>
                    ¡Hola {order.customer_name.split(' ')[0]}!
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-main)', lineHeight: '1.4' }}>
                    {order.service_type === 'delivery' 
                      ? 'Te sugerimos tomar screenshot de esta pantalla para tener a la mano tu número de orden cuando llegue nuestro repartidor.'
                      : order.notes?.includes('[COMER EN LOCAL]')
                        ? 'Por favor toma screenshot de esta pantalla y muéstrala en caja o a nuestro equipo para llevarte tu comida a la mesa.'
                        : 'Por favor toma screenshot de esta pantalla y muéstrala al llegar a caja para entregarte tu pedido de inmediato.'
                    }
                  </p>
                </div>
              </div>
            )}

            {/* Recordatorio / Anuncio de Envío a Domicilio ("Otro Estado") */}
            {order.service_type === 'delivery' && (
              <div style={{
                marginTop: '16px',
                padding: '16px 20px',
                backgroundColor: !order.delivery_fee_confirmed ? '#fffbeb' : '#ecfdf5',
                border: `2px solid ${!order.delivery_fee_confirmed ? '#f59e0b' : '#10b981'}`,
                borderRadius: '18px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '14px',
                textAlign: 'left',
                boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
                animation: 'fadeIn 0.5s ease'
              }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  backgroundColor: !order.delivery_fee_confirmed ? '#fef3c7' : '#d1fae5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Bike size={24} color={!order.delivery_fee_confirmed ? '#d97706' : '#059669'} />
                </div>
                <div>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', color: !order.delivery_fee_confirmed ? '#92400e' : '#065f46', fontFamily: 'var(--font-serif)', fontWeight: 700 }}>
                    {!order.delivery_fee_confirmed 
                      ? 'Estado de Envío: Asignando Tarifa por Cocina' 
                      : 'Tarifa de Envío Confirmada por Cocina'}
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.92rem', color: !order.delivery_fee_confirmed ? '#b45309' : '#047857', lineHeight: 1.5 }}>
                    {!order.delivery_fee_confirmed
                      ? 'Has seleccionado envío a domicilio. En cocina están revisando tu dirección para asignarte el precio exacto de envío. En cuanto la confirmen, tu total y estado se actualizarán automáticamente aquí.'
                      : `El costo de envío asignado para tu zona es de $${order.delivery_fee || 0} pesos. Tu repartidor saldrá en cuanto el pedido esté empaquetado.`}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="status-visual">
            <div className={`status-animation-ring ${statusConfig.animationClass} ${statusConfig.colorClass}`}>
              {statusConfig.icon}
            </div>
          </div>

          <div style={{ padding: '15px', backgroundColor: 'var(--color-cream-dark)', borderRadius: '15px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.9rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 600 }}>Ticket POS:</span>
              <span style={{ fontWeight: 700, color: 'var(--color-terracotta)' }}>
                {order.loyverse_receipt_number 
                  ? order.loyverse_receipt_number 
                  : showSyncMessage 
                    ? 'Sincronizando...' 
                    : 'Recibido correctamente'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 600 }}>Hora del Pedido:</span>
              <span>{formattedDate} hs</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 600 }}>Cliente:</span>
              <span>{order.customer_name}</span>
            </div>
          </div>

          {order.status === 'cancelled' && (
            <a 
              href={`https://wa.me/525635830014?text=Hola,%20tuve%20un%20inconveniente%20con%20mi%20pedido%20Ed%C3%A9n%20#${order.id.slice(-4).toUpperCase()}`}
              target="_blank"
              rel="noopener noreferrer"
              className="whatsapp-btn"
            >
              <MessageCircle size={20} />
              <span>Contactar por WhatsApp</span>
            </a>
          )}

          {/* PAYMENT CHOICES */}
          {order.status === 'awaiting_payment' && order.payment_status === 'pending_payment' && (
            <div style={{ marginTop: '30px', padding: '28px 22px', backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', animation: 'fadeIn 0.5s ease', boxSizing: 'border-box' }}>
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <h3 style={{ fontSize: '1.3rem', color: 'var(--color-green-dark)', margin: '0 0 8px 0', fontFamily: 'var(--font-serif)', fontWeight: 700 }}>Elige tu método de pago</h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: '1.5' }}>Tu pedido está listo para prepararse. Confirma cómo deseas pagar:</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <button 
                  onClick={async () => {
                    if (!confirm('¿Confirmas que pagarás en la caja física? Comenzaremos a preparar tu pedido de inmediato.')) return;
                    try {
                      setUploading(true);
                      await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
                      const res = await fetch(`/api/orders/${id}/pay-physical`, { method: 'PATCH', credentials: 'include' });
                      if (res.ok) {
                        fetchOrder();
                      } else {
                        alert('Error al actualizar el método de pago.');
                      }
                    } catch (e) {
                      alert('Error de conexión.');
                    } finally {
                      setUploading(false);
                    }
                  }}
                  disabled={uploading}
                  style={{ width: '100%', padding: '16px 18px', backgroundColor: 'var(--color-green-dark)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 700, fontSize: '1rem', cursor: uploading ? 'not-allowed' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', boxShadow: '0 4px 10px rgba(18,39,28,0.12)', transition: 'all 0.2s' }}
                >
                  <ShoppingBag size={18} style={{ flexShrink: 0 }} />
                  <span>Pagar en Físico (Efectivo / Tarjeta)</span>
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '2px 0' }}>
                  <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(0,0,0,0.08)' }}></div>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>o vía transferencia</span>
                  <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(0,0,0,0.08)' }}></div>
                </div>

                <div style={{ border: '1px solid rgba(0,0,0,0.08)', borderRadius: '14px', overflow: 'hidden', backgroundColor: '#fafaf9' }}>
                  <div style={{ padding: '15px 18px', backgroundColor: 'rgba(0,0,0,0.02)', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                    <FileText color="var(--color-terracotta)" size={18} style={{ flexShrink: 0 }} />
                    <h4 style={{ fontSize: '1.02rem', color: 'var(--color-green-dark)', margin: 0, fontWeight: 700 }}>Transferencia Bancaria</h4>
                  </div>
                  <div style={{ padding: '18px', backgroundColor: 'white' }}>
                    {!showUpload ? (
                      <>
                        {bankError ? (
                          <div style={{ fontSize: '0.85rem', color: '#b91c1c', backgroundColor: '#fef2f2', padding: '10px', borderRadius: '8px' }}>
                            {bankError}
                          </div>
                        ) : bankConfig ? (
                          <div style={{ fontSize: '0.9rem', color: '#334155', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                              <span style={{ color: 'var(--color-text-muted)' }}>Banco:</span>
                              <strong style={{ color: 'var(--color-text-dark)', textAlign: 'right' }}>{bankConfig.bank_name}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                              <span style={{ color: 'var(--color-text-muted)' }}>Titular:</span>
                              <strong style={{ color: 'var(--color-text-dark)', textAlign: 'right' }}>{bankConfig.account_holder}</strong>
                            </div>
                            
                            {/* CLABE VERTICAL STACKED - ZERO MUTILATION */}
                            <div style={{ backgroundColor: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '8px', boxSizing: 'border-box' }}>
                              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>CLABE Interbancaria (18 dígitos)</span>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                <span style={{ fontFamily: 'monospace', fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-green-dark)', letterSpacing: '1px', wordBreak: 'break-all' }}>
                                  {bankConfig.clabe}
                                </span>
                                <button 
                                  onClick={() => handleCopyClabe(bankConfig.clabe)}
                                  style={{ padding: '8px 14px', fontSize: '0.78rem', backgroundColor: copied ? '#dcfce7' : 'var(--color-ochre)', color: copied ? '#166534' : 'var(--color-text-dark)', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, transition: 'all 0.2s', flexShrink: 0, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                                >
                                  {copied ? '✓ Copiada' : 'Copiar CLABE'}
                                </button>
                              </div>
                            </div>
                            
                            <button 
                              style={{ marginTop: '4px', width: '100%', padding: '15px', backgroundColor: 'var(--color-terracotta)', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', boxShadow: '0 4px 10px rgba(194,89,63,0.18)', transition: 'all 0.2s' }}
                              onClick={() => setShowUpload(true)}
                            >
                              Ya transferí, subir comprobante
                            </button>
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.85rem', color: '#6b7280', display: 'flex', justifyContent: 'center', padding: '10px' }}>
                            <div className="status-animation-ring active" style={{ width: '20px', height: '20px', borderWidth: '2px' }}></div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div style={{ animation: 'fadeIn 0.3s ease' }}>
                        <p style={{ fontSize: '0.9rem', color: '#4b5563', marginBottom: '15px' }}>
                          Sube una captura de tu transferencia (JPG/PNG/PDF).
                        </p>

                        <input 
                          type="file" 
                          accept="image/jpeg,image/png,application/pdf"
                          onChange={handleFileChange}
                          disabled={uploading}
                          style={{ marginBottom: '15px', fontSize: '0.9rem', width: '100%' }}
                        />

                        {previewUrl && (
                          <div style={{ marginBottom: '15px', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                            <img src={previewUrl} alt="Preview" style={{ width: '100%', maxHeight: '200px', objectFit: 'contain' }} />
                          </div>
                        )}
                        {selectedFile && !previewUrl && (
                          <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#e5e7eb', borderRadius: '8px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <FileText size={16} /> {selectedFile.name}
                          </div>
                        )}

                        {uploadError && (
                          <div style={{ fontSize: '0.85rem', color: '#b91c1c', marginBottom: '15px', fontWeight: 600 }}>
                            {uploadError}
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button 
                            onClick={() => setShowUpload(false)}
                            disabled={uploading}
                            style={{ flex: 1, padding: '12px', backgroundColor: '#e5e7eb', color: '#374151', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
                          >
                            Atrás
                          </button>
                          <button 
                            onClick={handleUpload}
                            disabled={!selectedFile || uploading}
                            style={{ flex: 2, padding: '12px', backgroundColor: 'var(--color-terracotta)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: !selectedFile || uploading ? 'not-allowed' : 'pointer', opacity: !selectedFile || uploading ? 0.6 : 1 }}
                          >
                            {uploading ? 'Subiendo...' : 'Enviar'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {order.payment_status === 'payment_submitted' && order.status !== 'cancelled' && (
            <div style={{ marginTop: '25px', padding: '15px', border: '1px solid #bbf7d0', backgroundColor: '#f0fdf4', borderRadius: '15px', textAlign: 'left', display: 'flex', gap: '10px' }}>
              <CheckCircle color="#16a34a" style={{ flexShrink: 0 }} />
              <div>
                <strong style={{ color: '#16a34a', display: 'block' }}>Comprobante recibido</strong>
                <span style={{ fontSize: '0.85rem', color: '#15803d' }}>
                  Tu pedido está en revisión y comenzaremos a prepararlo en breve.
                </span>
              </div>
            </div>
          )}

          {((order.status === 'ready' && order.service_type === 'pickup') || order.status === 'in_transit' || order.status === 'delivered') && !showThankYou && (
            <div style={{ marginTop: '25px', padding: '15px', border: '1px solid #c8e6c9', backgroundColor: '#e8f5e9', borderRadius: '15px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <CheckCircle color="#2e7d32" style={{ flexShrink: 0 }} />
                <div>
                  <strong style={{ color: '#2e7d32', display: 'block' }}>¡Paso final!</strong>
                  <span style={{ fontSize: '0.85rem', color: '#1b5e20' }}>
                    {order.service_type === 'delivery' ? 
                      'Recibe tu pedido en tu domicilio y disfrútalo.' :
                      `Acércate a la caja, menciona tu nombre: ${order.customer_name} o ticket ${order.loyverse_receipt_number}, realiza tu pago (efectivo o terminal) y llévate tu comida recién preparada.`
                    }
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setShowThankYou(true)}
                style={{ width: '100%', padding: '12px', backgroundColor: '#2e7d32', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }}
              >
                Pedido Recibido
              </button>
            </div>
          )}

          {showThankYou && (
            <div style={{ marginTop: '28px', padding: '36px 24px', backgroundColor: 'var(--color-cream-light)', borderRadius: '24px', border: '1px solid var(--color-ochre-light)', textAlign: 'center', boxShadow: '0 12px 35px rgba(46, 44, 41, 0.06)', animation: 'fadeIn 0.4s ease' }}>
              <div style={{ width: '56px', height: '56px', backgroundColor: 'var(--color-ochre-light)', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '0 auto 16px auto', color: 'var(--color-green-dark)' }}>
                <Award size={28} strokeWidth={1.5} />
              </div>

              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', color: 'var(--color-green-dark)', margin: '0 0 8px 0', fontWeight: 700 }}>
                ¡Gracias por tu compra!
              </h2>
              <p style={{ fontSize: '0.95rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: '1.5' }}>
                Tu pedido ha sido confirmado y está siendo preparado con ingredientes frescos.
              </p>

              <div style={{ margin: '26px 0', padding: '24px 20px', backgroundColor: '#ffffff', borderRadius: '18px', border: '1px solid var(--color-cream-dark)', boxShadow: '0 4px 15px rgba(46, 44, 41, 0.03)' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--color-terracotta)', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>
                  <Sparkles size={14} /> Membresía EdenPass
                </div>
                <div style={{ fontSize: '3.2rem', fontWeight: 800, color: 'var(--color-green-dark)', fontFamily: 'var(--font-serif)', margin: '6px 0 2px 0', letterSpacing: '-1px' }}>
                  +{Math.floor(order.total * 0.1)} <span style={{ fontSize: '1.25rem', fontFamily: 'var(--font-sans)', fontWeight: 600, color: 'var(--color-ochre)' }}>pts</span>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                  Acumulados automáticamente en tu pase digital
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  onClick={() => router.push('/perfil')}
                  style={{ flex: 1, padding: '14px 16px', backgroundColor: 'var(--color-green-dark)', color: '#ffffff', border: 'none', borderRadius: '14px', fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s', boxShadow: '0 6px 16px rgba(30, 51, 41, 0.12)' }}
                >
                  <QrCode size={18} /> Ver mi EdenPass
                </button>
                <button 
                  onClick={() => router.push('/')}
                  style={{ flex: 1, padding: '14px 16px', backgroundColor: 'transparent', color: 'var(--color-text-dark)', border: '1px solid var(--color-ochre)', borderRadius: '14px', fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer', transition: 'all 0.2s' }}
                >
                  Volver al Menú
                </button>
              </div>
            </div>
          )}

          <div className="status-details">
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', borderBottom: '1px solid var(--color-ochre-light)', paddingBottom: '8px', color: 'var(--color-green-dark)' }}>
              Detalle del Pedido
            </h3>
            
            <div className="status-items-list">
              {order.items.map((item, index) => (
                <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', fontSize: '0.9rem', padding: '8px 0', borderBottom: '1px dashed var(--color-ochre-light)' }}>
                  <div>
                    <span style={{ fontWeight: 700 }}>{item.quantity}x</span> {item.name} {item.size && `(${item.size})`}
                    {item.customizations && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                        {item.customizations.proteins?.length > 0 && <div>• Prot: {item.customizations.proteins.join(', ')}</div>}
                        {item.customizations.toppings?.length > 0 && <div>• Toppings: {item.customizations.toppings.join(', ')}</div>}
                        {item.customizations.seedsAndNuts?.length > 0 && <div>• Semillas/Frutos: {item.customizations.seedsAndNuts.join(', ')}</div>}
                        {item.customizations.dressings?.length > 0 && <div>• Aderezo: {item.customizations.dressings.join(', ')}</div>}
                        {item.customizations.flavors?.length > 0 && <div>• Sabor: {item.customizations.flavors.join(', ')}</div>}
                        {item.customizations.extras?.length > 0 && (() => {
                          const omissions = item.customizations.extras.filter((x: any) => typeof x === 'string' && x.toLowerCase().startsWith('sin '));
                          const otherExtras = item.customizations.extras.filter((x: any) => !(typeof x === 'string' && x.toLowerCase().startsWith('sin ')));
                          return (
                            <>
                              {omissions.length > 0 && <div style={{ color: 'var(--color-terracotta)', fontWeight: 700 }}>• EXCLUSIONES: {omissions.join(', ')}</div>}
                              {otherExtras.length > 0 && <div>• Opciones/Extras: {otherExtras.join(', ')}</div>}
                            </>
                          );
                        })()}
                        {Object.entries(item.customizations).map(([key, val]: [string, any]) => {
                          if (['proteins', 'toppings', 'seedsAndNuts', 'dressings', 'flavors', 'extras'].includes(key)) return null;
                          if (Array.isArray(val) && val.length > 0) {
                            return <div key={key}>• {key.charAt(0).toUpperCase() + key.slice(1)}: {val.join(', ')}</div>;
                          }
                          if (typeof val === 'string' && val.trim() !== '') {
                            return <div key={key}>• {key.charAt(0).toUpperCase() + key.slice(1)}: {val}</div>;
                          }
                          return null;
                        })}
                      </div>
                    )}
                  </div>
                  <span style={{ fontWeight: 600 }}>${item.price * item.quantity}</span>
                </div>
              ))}
            </div>

            {order.notes && (
              <div style={{ marginTop: '15px', padding: '12px', backgroundColor: 'rgba(192, 90, 62, 0.05)', borderLeft: '3px solid var(--color-terracotta)', borderRadius: '0 8px 8px 0', fontSize: '0.85rem' }}>
                <strong>Notas de cocina:</strong> "{order.notes}"
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: 700, marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed var(--color-ochre-light)', color: 'var(--color-green-dark)' }}>
              <span>Subtotal</span>
              <span>${order.total}</span>
            </div>

            {order.service_type === 'delivery' && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', fontWeight: 600, marginTop: '6px', color: order.delivery_fee_confirmed ? '#059669' : '#92400e' }}>
                <span>Costo de envío</span>
                <span>
                  {order.delivery_fee_confirmed
                    ? `$${order.delivery_fee ?? 0}`
                    : <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Clock size={14} /> Por definir</span>}
                </span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.15rem', fontWeight: 800, marginTop: '10px', paddingTop: '10px', borderTop: '2px solid var(--color-ochre-light)', color: 'var(--color-green-dark)' }}>
              <span>Total</span>
              <span>
                {order.service_type === 'delivery' && !order.delivery_fee_confirmed
                  ? <span style={{ fontSize: '0.9rem', color: '#92400e', fontStyle: 'italic' }}>Pendiente de cotización</span>
                  : `$${order.total + (order.service_type === 'delivery' ? (order.delivery_fee ?? 0) : 0)}`
                }
              </span>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
