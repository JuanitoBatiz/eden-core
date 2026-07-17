'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  ShoppingBag,
  Plus,
  Minus,
  X,
  ChevronRight,
  Check,
  ArrowRight,
  MessageSquare,
  Sparkles,
  ChefHat,
  Leaf,
  Award,
  Crown,
  ShieldCheck,
  Info,
  Salad,
  CupSoda,
  Coffee,
  Sandwich,
  Soup,
  GlassWater,
  UserCircle,
  Store,
  Bike,
  Utensils,
  QrCode
} from 'lucide-react';
import { MenuItem, MenuCategory, CATEGORIES as fallbackCategories, MENU_ITEMS as fallbackMenuItems, SALAD_OPTIONS as fallbackSaladOptions } from '@/lib/menuData';
import { SmsRequest, VerifyOtpRequest, OrderCreateRequest } from '@/types/api-contracts';
import ProductImage from '@/components/ProductImage';
import ScrollRevealItem from '@/components/ScrollRevealItem';

// Helper local icon
function getCategoryIcon(name: string) {
  switch (name) {
    case 'Ensaladas': return <Salad size={20} />;
    case 'Jugos':
    case 'Jugos y Smoothies': return <CupSoda size={20} />;
    case 'Smoothies':
    case 'Smoothies e Infusiones': return <CupSoda size={20} />;
    case 'Infusiones': return <Coffee size={20} />;
    case 'Wraps y Sándwiches': return <Sandwich size={20} />;
    case 'Bowls y Postres':
    case 'Bowls y Cocteles': return <Soup size={20} />;
    case 'Embotellados': return <GlassWater size={20} />;
    default: return <Utensils size={20} />;
  }
}
interface CartItem {
  cartId: string; // Unique instance ID in cart
  id: string;
  name: string;
  price: number;
  size?: string;
  quantity: number;
  customizations?: {
    proteins: string[];
    toppings: string[];
    seedsAndNuts: string[];
    dressings: string[];
    extras: string[];
    flavors: string[];
  };
  notes?: string;
}



const getProductNotesPlaceholder = (product: MenuItem | null, categories: MenuCategory[] = []) => {
  if (!product) return "Ej: indicaciones especiales para preparación o empaque...";
  const cat = categories.find(c => c.id === product.category);
  const catName = cat?.name?.toLowerCase() || product.category?.toLowerCase() || '';
  const prodName = product.name?.toLowerCase() || '';

  if (catName.includes('smoothie') || catName.includes('jugo') || catName.includes('infusi') || catName.includes('bebida') || catName.includes('embotellada') || prodName.includes('smoothie') || prodName.includes('jugo') || prodName.includes('té') || prodName.includes('agua') || prodName.includes('licuado')) {
    return "Ej: sin hielo, con popote, menos dulce, sin azúcar, leche bien fría, etc...";
  }
  if (catName.includes('ensalada') || prodName.includes('ensalada')) {
    return "Ej: sin aderezo, aderezo aparte, sin cebolla, extra crujiente, etc...";
  }
  if (catName.includes('wrap') || catName.includes('sándwich') || catName.includes('sandwich') || catName.includes('burrito') || prodName.includes('sándwich') || prodName.includes('sandwich') || prodName.includes('torta') || prodName.includes('burrito') || prodName.includes('rollito') || prodName.includes('ciabatta')) {
    return "Ej: sin mayonesa, sin chile, pan bien tostado, sin cebolla, partido a la mitad, etc...";
  }
  if (catName.includes('bowl') || catName.includes('postre') || prodName.includes('bowl') || prodName.includes('avena') || prodName.includes('yogurt')) {
    return "Ej: miel aparte, sin plátano, extra canela, etc...";
  }
  return "Ej: indicaciones especiales para preparación o empaque...";
};

export default function MenuPage() {
  const router = useRouter();

  // Menu Data State
  const [menuData, setMenuData] = useState<{ CATEGORIES: MenuCategory[], MENU_ITEMS: MenuItem[], SALAD_OPTIONS: any } | null>(null);
  const [menuError, setMenuError] = useState(false);

  // Navigation and Scroll-hide Header
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [isNavVisible, setIsNavVisible] = useState(true);

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Customizer Modal State
  const [selectedProduct, setSelectedProduct] = useState<MenuItem | null>(null);
  const [customSize, setCustomSize] = useState<string>('Chico');
  const [selectedProteins, setSelectedProteins] = useState<string[]>([]);
  const [selectedToppings, setSelectedToppings] = useState<string[]>([]);
  const [selectedSeeds, setSelectedSeeds] = useState<string[]>([]);
  const [selectedDressings, setSelectedDressings] = useState<string[]>([]);
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
  const [selectedFlavors, setSelectedFlavors] = useState<string[]>([]);
  const [selectedBread, setSelectedBread] = useState<string>('Pan Blanco');
  const [selectedProteinOptions, setSelectedProteinOptions] = useState<string[]>(['Pechuga empanizada']);
  const [selectedOmissions, setSelectedOmissions] = useState<string[]>([]);
  const [customNotes, setCustomNotes] = useState('');
  const [isSmoothieMixto, setIsSmoothieMixto] = useState<boolean>(false);

  // Checkout & Auth Modal State
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authMethod, setAuthMethod] = useState<'phone' | 'google'>('phone');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [smsSent, setSmsSent] = useState(false);
  const [smsCode, setSmsCode] = useState(['', '', '', '', '', '']);
  const [sentCode, setSentCode] = useState(''); // Stores code returned by development API
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [codeResentNotice, setCodeResentNotice] = useState(false);

  useEffect(() => {
    let timer: any = null;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // Service Type State
  const [serviceType, setServiceType] = useState<'pickup' | 'delivery' | 'dine_in'>('pickup');
  const [deliveryAddress, setDeliveryAddress] = useState('');

  // Active Orders State (For floating banner)
  const [activeOrders, setActiveOrders] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/me/orders', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.active_orders?.length > 0) {
          setActiveOrders(data.active_orders);
        }
      })
      .catch(console.error);
  }, []);

  // Read cart from localStorage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem('eden_cart');
    if (savedCart) {
      try {
        const parsed = JSON.parse(savedCart);
        // Evitar error 500 al enviar IDs viejos (tipo 'ensalada-chica') en lugar de UUIDs de la nueva base de datos
        const isOldCart = parsed.some((item: any) => item.id && !item.id.includes('-'));
        if (isOldCart) {
          localStorage.removeItem('eden_cart');
          setCart([]);
        } else {
          setCart(parsed);
        }
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  // Silent Auth Check & Hybrid 30-Day Session Backup on Mount
  useEffect(() => {
    // 1. Restaurar al instante si existe sesión local con menos de 30 días exactos de inactividad
    try {
      const savedSession = localStorage.getItem('eden_user_session');
      if (savedSession) {
        const parsed = JSON.parse(savedSession);
        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
        if (parsed.lastActive && (Date.now() - parsed.lastActive) < thirtyDaysMs) {
          setIsAuthenticated(true);
          if (parsed.name) setCustomerName(parsed.name);
          if (parsed.phone) setCustomerPhone(parsed.phone);
        } else {
          localStorage.removeItem('eden_user_session');
        }
      }
    } catch (e) {
      console.error('Error al leer sesión local:', e);
    }

    const doRefresh = () => {
      fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
        .then(res => {
          if (res.ok) return res.json();
          // Refresh token caducado por completo (>30 días de inactividad real) — limpiar estado
          if (res.status === 401) {
            setIsAuthenticated(false);
            try { localStorage.removeItem('eden_user_session'); } catch (e) { }
          }
          throw new Error('No valid session');
        })
        .then(data => {
          if (data.success && data.user) {
            setIsAuthenticated(true);
            if (data.user.name) setCustomerName(data.user.name);
            if (data.user.phone) setCustomerPhone(data.user.phone);
            try {
              localStorage.setItem('eden_user_session', JSON.stringify({
                name: data.user.name || '',
                phone: data.user.phone || '',
                role: data.user.role || 'customer',
                lastActive: Date.now()
              }));
            } catch (e) { }
          }
        })
        .catch(() => {
          // Si hubo error de red, mantener sesión local si sigue dentro de la ventana de 30 días
        });
    };

    // Renovar al montar
    doRefresh();

    // Renovar cada 12 minutos para que el access_token nunca caduque mientras la pestaña esté abierta
    const refreshInterval = setInterval(doRefresh, 12 * 60 * 1000);
    return () => clearInterval(refreshInterval);
  }, []);

  // Fetch Menu from API (con temporizador de 8s y respaldo automático)
  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    fetch('/api/menu', { signal: controller.signal })
      .then(res => {
        clearTimeout(timeoutId);
        if (!res.ok) throw new Error('Error de red al cargar el menú');
        return res.json();
      })
      .then(data => {
        setMenuData(data);
      })
      .catch(err => {
        console.error('Menu fetch failed or timed out, loading fallback:', err);
        const fallback = {
          CATEGORIES: fallbackCategories,
          MENU_ITEMS: fallbackMenuItems,
          SALAD_OPTIONS: fallbackSaladOptions
        };
        setMenuData(fallback);
      });

    return () => clearTimeout(timeoutId);
  }, []);

  // Scroll direction listener to show/hide header unificado & update active category
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let lastScrollY = window.scrollY;

    const handleScroll = () => {
      const scrollY = window.scrollY;

      // Always show near the top of the page
      if (scrollY < 50) {
        setIsNavVisible(true);
      } else if (scrollY > lastScrollY) {
        setIsNavVisible(false);
      } else if (scrollY < lastScrollY) {
        setIsNavVisible(true);
      }

      // Active category detection on scroll
      if (scrollY < 350) {
        setActiveCategory('');
      } else {
        const sections = document.querySelectorAll('.menu-section');
        sections.forEach((sec) => {
          const rect = sec.getBoundingClientRect();
          if (rect.top <= 250 && rect.bottom >= 200) {
            const id = sec.id.replace('section-', '');
            if (id) setActiveCategory(id);
          }
        });
      }

      lastScrollY = scrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Save cart to localStorage
  const saveCart = (newCart: CartItem[]) => {
    setCart(newCart);
    localStorage.setItem('eden_cart', JSON.stringify(newCart));
  };

  // Get Limit Constraints for Customization
  const getConstraints = () => {
    if (!selectedProduct) return { proteins: 0, toppings: 0, seeds: 0, dressings: 1 };

    const isSalad = selectedProduct.category === 'ensaladas' || selectedProduct.category === '299824bb-ede2-47ed-bf0e-b5fd9548af73' || selectedProduct.name?.toLowerCase().includes('ensalada');
    if (isSalad) {
      if (customSize === 'Grande' || selectedProduct.name === 'Ensalada Grande') {
        return { proteins: 2, toppings: 6, seeds: 4, dressings: 1 };
      }
      return { proteins: 1, toppings: 4, seeds: 2, dressings: 1 };
    }
    if (selectedProduct.name === 'Bowl de Avena' || selectedProduct.name === 'Bowl de Yogurt') {
      return { proteins: 0, toppings: 2, seeds: 2, dressings: 0 };
    }
    return { proteins: 0, toppings: 0, seeds: 0, dressings: 0 };
  };

  // Add to Cart Logic
  const handleAddToCartClick = (product: MenuItem) => {
    setSelectedProduct(product);
    // Reset selection defaults
    const initialSize = product.prices ? (product.prices['Chica'] !== undefined ? 'Chica' : product.prices['Chico'] !== undefined ? 'Chico' : Object.keys(product.prices)[0]) : 'Chico';
    setCustomSize(initialSize);
    setSelectedProteins([]);
    setSelectedToppings([]);
    setSelectedSeeds([]);
    setSelectedDressings([]);
    setSelectedExtras([]);
    setSelectedFlavors([]);
    setSelectedBread('Pan Blanco');
    setSelectedProteinOptions([]);
    setSelectedOmissions([]);
    setCustomNotes('');
    setIsSmoothieMixto(false);

    // If product is not customizable, add directly to cart
    if (!product.customizable) {
      addToCartDirect(product);
      setSelectedProduct(null);
    }
  };

  const addToCartDirect = (product: MenuItem) => {
    const existingIndex = cart.findIndex(item => item.id === product.id && !item.size);
    if (existingIndex !== -1) {
      const newCart = [...cart];
      newCart[existingIndex].quantity += 1;
      saveCart(newCart);
    } else {
      const newCart = [...cart, {
        cartId: product.id + '_' + Date.now(),
        id: product.id,
        name: product.name,
        price: product.price,
        quantity: 1
      }];
      saveCart(newCart);
    }
    setIsCartOpen(true);
  };

  const handleConfirmCustomization = () => {
    if (!selectedProduct) return;

    // Build item details
    const isSmoothieClasico = Boolean(
      selectedProduct && (
        selectedProduct.id === 'smoothies-clasicos' ||
        selectedProduct.name?.toLowerCase().includes('smoothie clásico') ||
        selectedProduct.name?.toLowerCase().includes('smoothies clásicos') ||
        selectedProduct.name?.toLowerCase().includes('smoothie clasico') ||
        selectedProduct.name?.toLowerCase().includes('smoothies clasicos')
      )
    );
    const price = (isSmoothieClasico && isSmoothieMixto)
      ? (customSize === 'Chico' ? 80 : (customSize === 'Grande' ? 90 : 80))
      : (selectedProduct.prices ? selectedProduct.prices[customSize] : selectedProduct.price);

    // Calculate Extras addition
    let extraPrice = 0;
    // Overlimit extra protein
    const constraints = getConstraints();
    if (selectedProteins.length > constraints.proteins) {
      extraPrice += (selectedProteins.length - constraints.proteins) * 30;
    }
    // Overlimit extra toppings
    if (selectedToppings.length > constraints.toppings) {
      extraPrice += (selectedToppings.length - constraints.toppings) * 15;
    }
    // Overlimit extra seeds
    if (selectedSeeds.length > constraints.seeds) {
      extraPrice += (selectedSeeds.length - constraints.seeds) * 15;
    }
    // Overlimit extra dressings
    if (selectedDressings.length > constraints.dressings) {
      extraPrice += (selectedDressings.length - constraints.dressings) * 15;
    }

    const isSandwichOrTorta = selectedProduct.id === 'sandwich' || selectedProduct.id === 'torta' || selectedProduct.id === 'sandwich-pavo' || selectedProduct.id === 'sandwich-pollo' || selectedProduct.name?.includes('Sándwich') || selectedProduct.name?.includes('Torta');
    const isSandwichOnly = selectedProduct.id === 'sandwich' || selectedProduct.id === 'sandwich-pollo' || selectedProduct.id === 'sandwich-pavo' || (selectedProduct.name?.includes('Sándwich') && !selectedProduct.name?.includes('Torta'));

    const itemPrice = price + extraPrice;

    // Construct customizable labels
    const customizations = {
      proteins: selectedProteins.map((p: any) => SALAD_OPTIONS.proteins.find((item: any) => item.id === p)?.name || p),
      toppings: selectedToppings.map((t: any) => SALAD_OPTIONS.toppings.find((item: any) => item.id === t)?.name || t),
      seedsAndNuts: selectedSeeds.map((s: any) => SALAD_OPTIONS.seedsAndNuts.find((item: any) => item.id === s)?.name || s),
      dressings: selectedDressings.map((d: any) => SALAD_OPTIONS.dressings.find((item: any) => item.id === d)?.name || d),
      extras: [
        ...selectedExtras,
        ...(isSandwichOrTorta ? selectedProteinOptions : []),
        ...(isSandwichOnly && selectedBread ? [selectedBread] : []),
        ...selectedOmissions
      ],
      flavors: selectedFlavors
    };

    const cartItemName = (isSmoothieClasico && isSmoothieMixto) ? 'Smoothie Mixto' : selectedProduct.name;

    const cartItem: CartItem = {
      cartId: selectedProduct.id + '_' + Date.now(),
      id: selectedProduct.id,
      name: cartItemName,
      price: itemPrice,
      size: selectedProduct.prices ? customSize : undefined,
      quantity: 1,
      customizations,
      notes: customNotes
    };

    saveCart([...cart, cartItem]);
    setSelectedProduct(null);
    setIsCartOpen(true);
  };

  const updateQuantity = (cartId: string, delta: number) => {
    const index = cart.findIndex(item => item.cartId === cartId);
    if (index !== -1) {
      const newCart = [...cart];
      newCart[index].quantity += delta;
      if (newCart[index].quantity <= 0) {
        newCart.splice(index, 1);
      }
      saveCart(newCart);
    }
  };

  const calculateSubtotal = () => {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  // Auth / Checkout Flows
  const handleCheckoutClick = () => {
    if (isAuthenticated) {
      submitOrder();
    } else {
      setIsCartOpen(false);
      setIsAuthOpen(true);
    }
  };

  const handleSendSmsCode = async () => {
    setErrorMsg('');
    if (!customerName.trim() || !customerPhone.trim() || customerPhone.length !== 10) {
      setErrorMsg('Por favor ingresa tu nombre y un celular de 10 dígitos.');
      return;
    }

    try {
      const payload: SmsRequest = { phone: customerPhone, name: customerName };
      const res = await fetch('/api/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Error al enviar código SMS.');
        return;
      }

      setSmsSent(true);
      if (data.code) {
        // Developer simulation: save code to show banner
        setSentCode(data.code);
      }
    } catch (e) {
      console.error(e);
      setErrorMsg('Ocurrió un error de red. Intenta de nuevo.');
    }
  };

  const handleResendSmsCode = async () => {
    if (resendCooldown > 0) return;
    setErrorMsg('');
    setCodeResentNotice(false);

    try {
      const payload: SmsRequest = { phone: customerPhone, name: customerName };
      const res = await fetch('/api/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Error al reenviar código SMS.');
        return;
      }

      setResendCooldown(30);
      setCodeResentNotice(true);
      if (data.code) {
        setSentCode(data.code);
      }
      setTimeout(() => setCodeResentNotice(false), 6000);
    } catch (e) {
      console.error(e);
      setErrorMsg('Ocurrió un error de red al reenviar el código.');
    }
  };

  const handleVerifySmsCode = async () => {
    setErrorMsg('');
    const fullCode = smsCode.join('');
    if (fullCode.length !== 6) {
      setErrorMsg('Ingresa el código de 6 dígitos.');
      return;
    }

    setIsVerifying(true);

    try {
      const payload: VerifyOtpRequest = { phone: customerPhone, code: fullCode, name: customerName };
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',  // La cookie access_token queda seteada automáticamente por el servidor
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Código incorrecto o expirado.');
        setIsVerifying(false);
        return;
      }

      // Éxito: guardar sesión híbrida por 30 días y enviar orden
      try {
        localStorage.setItem('eden_user_session', JSON.stringify({
          name: data.user?.name || customerName,
          phone: data.user?.phone || customerPhone,
          role: data.user?.role || 'customer',
          lastActive: Date.now()
        }));
      } catch (e) { }

      await submitOrder();

    } catch (e) {
      console.error(e);
      setErrorMsg('Error de red al verificar el código.');
      setIsVerifying(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMsg('');
    if (!customerName.trim()) {
      setErrorMsg('Por favor ingresa tu nombre antes de continuar.');
      return;
    }
    setIsVerifying(true);
    // TODO: Integrar Google Auth real — actualmente deshabilitado
    setErrorMsg('Google Login no disponible aún. Usa verificación por SMS.');
    setIsVerifying(false);
  };

  // submitOrder usa credentials:'include' para que la cookie httpOnly viaje automáticamente
  const submitOrder = async () => {
    setErrorMsg('');
    setIsSubmittingOrder(true);
    try {
      let finalNotes = cart.map((item: any) => item.notes).filter(Boolean).join('; ');
      if (serviceType === 'dine_in') {
        finalNotes = `[COMER EN LOCAL] \n${finalNotes}`;
      }

      const payload: OrderCreateRequest = {
        customer_name: customerName,
        customer_phone: customerPhone,
        items: cart,
        notes: finalNotes,
        service_type: serviceType === 'dine_in' ? 'pickup' : serviceType,
        delivery_address: serviceType === 'delivery' ? deliveryAddress : undefined
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.status === 401) {
        setIsAuthenticated(false);
        setIsCartOpen(false);
        setIsAuthOpen(true);
        setErrorMsg('Tu sesión expiró. Por favor verifica tu número de nuevo.');
        setIsSubmittingOrder(false);
        setIsVerifying(false);
        return;
      }

      if (res.status === 409) {
        let errorText = "ATENCIÓN - Cambios en disponibilidad:\n";
        data.conflicts.forEach((c: any) => {
          errorText += `- ${c.product_name}: ${c.reason}\n`;
        });
        errorText += "\nPor favor, actualiza tu carrito e intenta de nuevo.";
        setErrorMsg(errorText);
        setIsSubmittingOrder(false);
        setIsVerifying(false);
        return;
      }

      if (!res.ok) {
        setErrorMsg(data.error || 'Ocurrió un error al procesar tu orden.');
        setIsSubmittingOrder(false);
        setIsVerifying(false);
        return;
      }

      // Éxito: limpiar carrito y redirigir al estado de la orden
      saveCart([]);
      setIsAuthOpen(false);
      router.push(`/orden/${data.order.id}`);

    } catch (err) {
      console.error(err);
      setErrorMsg('Error de red al procesar el pedido. Intenta de nuevo.');
      setIsSubmittingOrder(false);
      setIsVerifying(false);
    }
  };

  // Customizer checkbox toggle helper
  const toggleOption = (id: string, list: string[], setList: React.Dispatch<React.SetStateAction<string[]>>, limit: number) => {
    if (list.includes(id)) {
      setList(list.filter((item: any) => item !== id));
    } else {
      // If limit is reached, still allow adding (it will charge as extra) OR enforce hard caps.
      // Salad details say: Chica: 1 protein, 4 toppings, 2 seeds. If selected more, we count it as extra.
      // Let's allow selecting extras but warn or just let it calculate pricing on confirm.
      // We will allow adding and calculate extra costs.
      setList([...list, id]);
    }
  };

  const constraints = getConstraints();

  if (menuError) {
    return (
      <div className="container" style={{ textAlign: 'center', padding: '100px 20px', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        <h2>No pudimos cargar el menú 😔</h2>
        <p style={{ marginBottom: '20px' }}>Por favor intenta de nuevo.</p>
        <button className="add-btn" style={{ padding: '10px 20px' }} onClick={() => window.location.reload()}>Reintentar</button>
      </div>
    );
  }

  if (!menuData) {
    return (
      <div className="container" style={{ textAlign: 'center', padding: '100px 20px', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ width: '40px', height: '40px', border: '4px solid var(--color-green-light)', borderTopColor: 'var(--color-green-dark)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <p style={{ marginTop: '20px', color: 'var(--color-green-dark)', fontWeight: 600 }}>Cargando el menú fresco de hoy...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const { CATEGORIES, MENU_ITEMS, SALAD_OPTIONS } = menuData;

  if (SALAD_OPTIONS && SALAD_OPTIONS.toppings) {
    if (!SALAD_OPTIONS.toppings.some((t: any) => t.id === 'aguacate' || t.name?.toLowerCase() === 'aguacate')) {
      SALAD_OPTIONS.toppings.unshift({ id: 'aguacate', name: 'Aguacate' });
    }
    if (!SALAD_OPTIONS.toppings.some((t: any) => t.id === 'granos-de-elote' || t.name?.toLowerCase().includes('elote'))) {
      SALAD_OPTIONS.toppings.splice(1, 0, { id: 'granos-de-elote', name: 'Granos de Elote' });
    }
  }

  return (
    <>
      <div className={`sticky-header-container ${isNavVisible ? 'visible' : 'hidden'}`}>
        {/* HEADER */}
        <header className="header">
          <div className="container header-content">
            <div className="logo-container">
              <img src="/images/logo.webp" alt="Edén Logo" className="logo-img" />
              <div className="logo-text">EDÉN</div>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button onClick={() => router.push('/perfil')} style={{ padding: '6px', borderRadius: '50%', border: 'none', background: 'var(--color-cream-light)', cursor: 'pointer', color: 'var(--color-green-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Mi Perfil">
                <UserCircle size={22} />
              </button>
              <button className="cart-icon-btn" onClick={() => setIsCartOpen(true)}>
                <ShoppingBag size={20} />
                <span>Carrito</span>
                {cart.length > 0 && <span className="cart-count">{cart.reduce((s, i) => s + i.quantity, 0)}</span>}
              </button>
            </div>
          </div>
        </header>

        {/* CATEGORY BAR */}
        <nav className="category-nav">
          <ul className="category-list">
            {CATEGORIES.map((category: any) => (
              <li key={category.id}>
                <button
                  className={`category-btn ${activeCategory === category.id ? 'active' : ''}`}
                  data-category={category.id}
                  onClick={() => {
                    setActiveCategory(category.id);
                    const el = document.getElementById(`section-${category.id}`);
                    if (el) {
                      const headerOffset = 185;
                      const elementPosition = el.getBoundingClientRect().top;
                      const offsetPosition = elementPosition + window.scrollY - headerOffset;

                      window.scrollTo({
                        top: offsetPosition,
                        behavior: 'smooth'
                      });
                    }
                  }}
                >
                  <span className="category-icon-wrapper">
                    {getCategoryIcon(category.name)}
                  </span>
                  <span className="category-btn-text">{category.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {/* FULL-BLEED INMERSIVE HERO (100% DE LA PANTALLA, SIN MÁRGENES) */}
      <section className="hero-fullscreen-v1">
        <picture className="hero-v1-bg">
          <source media="(max-width: 768px)" srcSet="/images/hero_celular.webp" />
          <img src="/images/hero_desktop.webp" alt="Santuario Edén" />
        </picture>
        <div className="hero-v1-overlay"></div>
        <div className="hero-v1-content">
          <h1 className="hero-v1-title">Deliciosa barra de ensaladas y jugos naturales</h1>
          <p className="hero-v1-desc">
            Sabor natural y servicio ágil. Arma tu pedido en línea, acumula puntos con EdenPass y disfruta tu comida en sucursal o recíbela en la puerta de tu casa.
          </p>
          <button
            className="hero-cta-btn"
            onClick={() => {
              const el = document.querySelector('.menu-section');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            <span>Explorar el menú</span>
            <ArrowRight size={18} />
          </button>
        </div>
      </section>

      {/* MAIN CONTAINER FOR MENU SECTIONS */}
      <main className="container" style={{ paddingTop: '50px' }}>
        {/* DISCREET REFERENCE IMAGES NOTICE */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          padding: '10px 16px',
          backgroundColor: 'rgba(212, 163, 115, 0.12)',
          border: '1px solid rgba(212, 163, 115, 0.3)',
          borderRadius: '12px',
          color: 'var(--color-text-muted)',
          fontSize: '0.85rem',
          marginBottom: '35px',
          textAlign: 'center',
          maxWidth: '550px',
          margin: '0 auto 35px auto'
        }}>
          <Info size={18} style={{ flexShrink: 0, color: 'var(--color-ochre)' }} />
          <span><strong>Nota:</strong> Fotografías e imágenes de referencia y con fines ilustrativos.</span>
        </div>

        {/* MENU CATEGORIES SECTIONS */}
        {CATEGORIES.map((cat: any) => {
          const items = MENU_ITEMS.filter((item: any) => item.category === cat.id);
          if (items.length === 0) return null;

          return (
            <section key={cat.id} id={`section-${cat.id}`} className="menu-section">
              <div className="section-title-wrap">
                <h2 className="section-title">{cat.name}</h2>
                <div className="section-title-line"></div>
              </div>

              {cat.id === 'embotellada' || cat.name?.toLowerCase().includes('embotellad') ? (
                <div className="bottled-grid">
                  {items.map((product: any, idx: number) => (
                    <ScrollRevealItem key={product.id} staggerIndex={idx}>
                      <div className="bottled-card">
                        <div className="bottled-info">
                          <h3 className="bottled-name">{product.name}</h3>
                          {product.description && <p className="bottled-desc">{product.description}</p>}
                        </div>
                        <div className="bottled-action">
                          <span className="bottled-price">${product.price}</span>
                          <button className="bottled-add-btn" onClick={() => handleAddToCartClick(product)}>
                            <Plus size={16} />
                            <span>Agregar</span>
                          </button>
                        </div>
                      </div>
                    </ScrollRevealItem>
                  ))}
                </div>
              ) : (
                <div className="editorial-bento-grid">
                  {items.map((product: any, itemIdx: number) => {
                    const isSaladItem = cat.id === 'ensaladas' || cat.id === '299824bb-ede2-47ed-bf0e-b5fd9548af73' || cat.name?.toLowerCase().includes('ensalada') || product.category === 'ensaladas' || product.category === '299824bb-ede2-47ed-bf0e-b5fd9548af73' || product.name?.toLowerCase().includes('ensalada');

                    // Asignación de roles editoriales y jerarquía para el Bento Grid
                    let role = 'standard';
                    let badgeInfo: { text: string; icon: React.ReactNode } | null = null;
                    const lowerName = (product.name || '').toLowerCase();
                    if (lowerName.includes('edén') || lowerName.includes('eden')) {
                      badgeInfo = { text: 'Receta de la Casa', icon: <Crown size={14} className="badge-lucide-icon" /> };
                    } else if (itemIdx === 0) {
                      role = 'hero';
                      badgeInfo = isSaladItem
                        ? { text: 'Favorito del Chef', icon: <ChefHat size={14} className="badge-lucide-icon" /> }
                        : { text: 'Destacado Edén', icon: <Sparkles size={14} className="badge-lucide-icon" /> };
                    } else if (itemIdx === 1 && isSaladItem) {
                      badgeInfo = { text: '100% Orgánico', icon: <Leaf size={14} className="badge-lucide-icon" /> };
                    } else if (items.length >= 4 && (itemIdx === 3 || itemIdx === 6)) {
                      role = 'wide';
                      badgeInfo = { text: 'Selección de Temporada', icon: <Award size={14} className="badge-lucide-icon" /> };
                    } else if (lowerName.includes('verde') || lowerName.includes('detox')) {
                      badgeInfo = { text: 'Detox Natural', icon: <Leaf size={14} className="badge-lucide-icon" /> };
                    } else if (lowerName.includes('antioxidante') || lowerName.includes('berry')) {
                      badgeInfo = { text: 'Antioxidante Top', icon: <Sparkles size={14} className="badge-lucide-icon" /> };
                    }

                    return (
                      <ScrollRevealItem key={product.id} staggerIndex={itemIdx} className={`editorial-card role-${role} ${badgeInfo ? 'shimmer-card' : ''}`}>
                        <div className={`product-img-container orientation-${product.image_orientation || 'horizontal'}`}>
                          <ProductImage src={product.image} alt={product.name} className="product-img" priority={itemIdx < 4} />
                        </div>
                        <div className="editorial-info">
                          <div>
                            {badgeInfo && (
                              <span className="editorial-badge shimmer-badge">
                                {badgeInfo.icon}
                                <span>{badgeInfo.text}</span>
                              </span>
                            )}
                            <h3 className="editorial-name">{product.name}</h3>
                            {product.description && <p className="editorial-desc">{product.description}</p>}
                          </div>
                          <div className="editorial-footer">
                            {product.prices ? (
                              <div className="product-price-multi">
                                {Object.entries(product.prices).map(([sizeName, priceVal], idx, arr) => (
                                  <React.Fragment key={sizeName}>
                                    <span className="price-option"><span className="price-label">{sizeName}</span> ${priceVal as number}</span>
                                    {idx < arr.length - 1 && <span className="price-divider">|</span>}
                                  </React.Fragment>
                                ))}
                              </div>
                            ) : (
                              <span className="editorial-price">${product.price}</span>
                            )}
                            <button className="add-btn" onClick={() => handleAddToCartClick(product)}>
                              <Plus size={16} />
                              <span>{isSaladItem ? 'Crea tu ensalada' : product.customizable ? 'Personalizar' : 'Agregar'}</span>
                            </button>
                          </div>
                        </div>
                      </ScrollRevealItem>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}

        {/* AYUDA / WHATSAPP SUPPORT CARD */}
        <section style={{ marginTop: '50px', padding: '28px 20px', backgroundColor: '#ffffff', borderRadius: '20px', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 8px 30px rgba(0,0,0,0.05)', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#25D366', color: '#fff', marginBottom: '14px', boxShadow: '0 4px 14px rgba(37, 211, 102, 0.35)' }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            </svg>
          </div>
          <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem', color: 'var(--color-green-dark)', margin: '0 0 8px 0' }}>
            ¿Tienes algún problema o duda con tu pedido?
          </h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem', maxWidth: '520px', margin: '0 auto 20px auto', lineHeight: 1.6 }}>
            Estamos aquí para apoyarte en todo momento. Escríbenos directamente a WhatsApp y te atenderemos al instante con el mayor gusto.
          </p>
          <a
            href="https://wa.me/525635830014"
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', padding: '14px 28px', backgroundColor: '#25D366', color: '#ffffff', fontWeight: 600, fontSize: '1rem', borderRadius: '35px', textDecoration: 'none', transition: 'all 0.2s ease', boxShadow: '0 6px 18px rgba(37, 211, 102, 0.3)' }}
            onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 22px rgba(37, 211, 102, 0.45)'; }}
            onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 6px 18px rgba(37, 211, 102, 0.3)'; }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            </svg>
            <span>WhatsApp</span>
          </a>
        </section>
      </main>

      {/* FOOTER */}
      <footer style={{ backgroundColor: 'var(--color-green-dark)', color: 'var(--color-cream-light)', padding: '40px 0', marginTop: '60px', borderTop: '4px solid var(--color-ochre)' }}>
        <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px', textAlign: 'center' }}>
          <img src="/images/logo.webp" alt="Edén Logo" style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: '#fff', padding: '5px' }} />
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.8rem', color: 'var(--color-cream-light)' }}>Edén</h2>
          <p style={{ maxWidth: '400px', fontSize: '0.9rem', opacity: 0.8 }}>
            Higiene, orden y sabor artesanal en Otumba, Estado de México.
          </p>

          <div style={{ display: 'flex', gap: '20px', marginTop: '10px' }}>
            <a
              href="https://www.instagram.com/edenensaladas?igsh=OHZpZGFsZm5vc2hk"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--color-cream-light)', opacity: 0.85, transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '44px', height: '44px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}
              onMouseOver={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1.08)'; e.currentTarget.style.backgroundColor = 'var(--color-ochre)'; }}
              onMouseOut={(e) => { e.currentTarget.style.opacity = '0.85'; e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'; }}
              aria-label="Instagram de Edén"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
              </svg>
            </a>
            <a
              href="https://www.facebook.com/share/18cVG24wEM/?mibextid=wwXIfr"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--color-cream-light)', opacity: 0.85, transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '44px', height: '44px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}
              onMouseOver={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1.08)'; e.currentTarget.style.backgroundColor = 'var(--color-ochre)'; }}
              onMouseOut={(e) => { e.currentTarget.style.opacity = '0.85'; e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'; }}
              aria-label="Facebook de Edén"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
              </svg>
            </a>
            <a
              href="https://wa.me/525635830014"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--color-cream-light)', opacity: 0.85, transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '44px', height: '44px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}
              onMouseOver={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1.08)'; e.currentTarget.style.backgroundColor = '#25D366'; }}
              onMouseOut={(e) => { e.currentTarget.style.opacity = '0.85'; e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'; }}
              aria-label="WhatsApp de Edén Local"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
            </a>
          </div>

          <div style={{ fontSize: '0.8rem', opacity: 0.6, marginTop: '15px' }}>
            © 2026 Edén. Todos los derechos reservados.
          </div>

          {/* WATERMARK */}
          <div style={{ marginTop: '30px', display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: 0.7, transition: 'opacity 0.3s', paddingBottom: '20px' }} onMouseOver={e => e.currentTarget.style.opacity = '1'} onMouseOut={e => e.currentTarget.style.opacity = '0.7'}>
            <a href="https://hummingxbi.com" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textDecoration: 'none', color: 'inherit' }}>
              <span style={{ fontSize: '0.7rem', letterSpacing: '2px', marginBottom: '8px', color: 'var(--color-cream-light)' }}> PRODUCED BY </span>
              <img src="/images/logoclaro.webp" alt="HummingX BI" style={{ height: '26px', width: '26px', borderRadius: '50%', objectFit: 'cover' }} />
            </a>
          </div>
        </div>
      </footer>

      {/* CUSTOMIZER MODAL */}
      {selectedProduct && (
        <div className="modal-overlay" onClick={() => setSelectedProduct(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-wrap">
                <span className="modal-subtitle">
                  {selectedProduct.category === 'ensaladas' || selectedProduct.category === '299824bb-ede2-47ed-bf0e-b5fd9548af73' || menuData?.CATEGORIES?.find((c: any) => c.id === selectedProduct.category)?.name === 'Ensaladas' || selectedProduct.name?.toLowerCase().includes('ensalada')
                    ? 'CREA TU ENSALADA'
                    : 'PERSONALIZAR'}
                </span>
                <h2>
                  {(() => {
                    const isSmoothieClasico = Boolean(
                      selectedProduct && (
                        selectedProduct.id === 'smoothies-clasicos' ||
                        selectedProduct.name?.toLowerCase().includes('smoothie clásico') ||
                        selectedProduct.name?.toLowerCase().includes('smoothies clásicos') ||
                        selectedProduct.name?.toLowerCase().includes('smoothie clasico') ||
                        selectedProduct.name?.toLowerCase().includes('smoothies clasicos')
                      )
                    );
                    return (isSmoothieClasico && isSmoothieMixto) ? 'Smoothie Mixto' : selectedProduct.name;
                  })()}
                </h2>
              </div>
              <button className="close-btn" onClick={() => setSelectedProduct(null)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              {/* Size Selector for multi-size products */}
              {selectedProduct.prices && (
                <div className="option-group">
                  <div className="option-group-title">Tamaño del producto</div>
                  <div className="option-grid">
                    {Object.keys(selectedProduct.prices).map((size: any) => {
                      const isSmoothieClasico = Boolean(
                        selectedProduct && (
                          selectedProduct.id === 'smoothies-clasicos' ||
                          selectedProduct.name?.toLowerCase().includes('smoothie clásico') ||
                          selectedProduct.name?.toLowerCase().includes('smoothies clásicos') ||
                          selectedProduct.name?.toLowerCase().includes('smoothie clasico') ||
                          selectedProduct.name?.toLowerCase().includes('smoothies clasicos')
                        )
                      );
                      const displayPrice = (isSmoothieClasico && isSmoothieMixto)
                        ? (size === 'Chico' ? 80 : (size === 'Grande' ? 90 : 80))
                        : selectedProduct.prices?.[size];
                      return (
                        <label key={size} className="option-card-label">
                          <input
                            type="radio"
                            name="size"
                            className="option-card-input"
                            checked={customSize === size}
                            onChange={() => setCustomSize(size)}
                          />
                          <div className="option-card-content">
                            <span>{size}</span>
                            <span className="option-card-extra-price">${displayPrice}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Salads Options */}
              {(selectedProduct.category === 'ensaladas' || selectedProduct.category === '299824bb-ede2-47ed-bf0e-b5fd9548af73' || menuData?.CATEGORIES?.find((c: any) => c.id === selectedProduct.category)?.name === 'Ensaladas' || selectedProduct.name?.toLowerCase().includes('ensalada')) && (
                <>
                  {/* Proteins */}
                  <div className="option-group">
                    <div className="option-group-title">
                      <span>Proteínas a elegir (Mínimo 1)</span>
                      <span className="option-group-limit">Límite base: {constraints.proteins}</span>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '8px' }}>
                      (Adicionales tienen costo extra de +$30 c/u)
                    </p>
                    <div className="option-grid">
                      {SALAD_OPTIONS.proteins.map((protein: any) => {
                        const count = selectedProteins.filter((p: any) => p === protein.id).length;
                        const isSelected = count > 0;
                        return (
                          <div
                            key={protein.id}
                            onClick={() => {
                              if (!isSelected) {
                                setSelectedProteins([...selectedProteins, protein.id]);
                              }
                            }}
                            className="option-card-content"
                            style={{
                              cursor: 'pointer',
                              position: 'relative',
                              minHeight: isSelected ? '84px' : '64px',
                              padding: '14px 12px',
                              backgroundColor: isSelected ? 'rgba(192, 90, 62, 0.08)' : 'var(--color-white)',
                              borderColor: isSelected ? 'var(--color-terracotta)' : 'rgba(212, 163, 115, 0.3)',
                              color: isSelected ? 'var(--color-terracotta)' : 'var(--color-green-dark)',
                              fontWeight: isSelected ? 700 : 600,
                              boxShadow: isSelected ? '0 6px 18px rgba(192, 90, 62, 0.16)' : '0 2px 6px rgba(0, 0, 0, 0.02)',
                              transform: isSelected ? 'translateY(-2px)' : 'none',
                              transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'center',
                              alignItems: 'center',
                              borderRadius: '18px'
                            }}
                          >
                            <span>{protein.name}</span>
                            {!isSelected && selectedProteins.length >= constraints.proteins && (
                              <span className="option-card-extra-price" style={{ marginTop: '3px' }}>+$30</span>
                            )}

                            {isSelected && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '10px',
                                  marginTop: '10px',
                                  padding: '3px 8px',
                                  backgroundColor: 'var(--color-white)',
                                  border: '1.2px solid var(--color-terracotta)',
                                  borderRadius: '24px',
                                  boxShadow: '0 2px 8px rgba(192, 90, 62, 0.15)',
                                  transition: 'all 0.2s ease'
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const index = selectedProteins.indexOf(protein.id);
                                    if (index !== -1) {
                                      const next = [...selectedProteins];
                                      next.splice(index, 1);
                                      setSelectedProteins(next);
                                    }
                                  }}
                                  style={{
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '50%',
                                    border: 'none',
                                    backgroundColor: 'rgba(192, 90, 62, 0.12)',
                                    color: 'var(--color-terracotta)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease'
                                  }}
                                  title="Disminuir porción"
                                >
                                  <Minus size={13} strokeWidth={2.5} />
                                </button>

                                <span style={{
                                  fontSize: '0.8rem',
                                  fontWeight: 700,
                                  color: 'var(--color-terracotta)',
                                  minWidth: '54px',
                                  textAlign: 'center',
                                  letterSpacing: '0.2px'
                                }}>
                                  {count === 1 ? '1x' : '2x Doble'}
                                </span>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (count < 2) {
                                      setSelectedProteins([...selectedProteins, protein.id]);
                                    }
                                  }}
                                  disabled={count >= 2}
                                  style={{
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '50%',
                                    border: 'none',
                                    backgroundColor: count >= 2 ? 'rgba(0, 0, 0, 0.05)' : 'var(--color-terracotta)',
                                    color: count >= 2 ? 'var(--color-text-muted)' : '#ffffff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: count >= 2 ? 'default' : 'pointer',
                                    transition: 'all 0.15s ease',
                                    opacity: count >= 2 ? 0.35 : 1
                                  }}
                                  title={count >= 2 ? 'Límite máximo de porción alcanzado' : 'Añadir porción doble'}
                                >
                                  <Plus size={13} strokeWidth={2.5} />
                                </button>
                              </div>
                            )}

                            {isSelected && count === 1 && selectedProteins.length >= constraints.proteins && (
                              <span style={{ fontSize: '0.72rem', color: 'var(--color-terracotta)', fontWeight: 600, marginTop: '4px', opacity: 0.9 }}>
                                +$30 por doble
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Toppings */}
                  <div className="option-group">
                    <div className="option-group-title">
                      <span>Toppings a elegir (Mínimo 1)</span>
                      <span className="option-group-limit">Límite base: {constraints.toppings}</span>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '8px' }}>
                      (Adicionales tienen costo extra de +$15 c/u)
                    </p>
                    <div className="option-grid">
                      {SALAD_OPTIONS.toppings
                        .filter((t: any) => t.id !== 'platano' && t.name?.toLowerCase() !== 'plátano' && t.name?.toLowerCase() !== 'platano')
                        .map((topping: any) => (
                          <label key={topping.id} className="option-card-label">
                            <input
                              type="checkbox"
                              className="option-card-input"
                              checked={selectedToppings.includes(topping.id)}
                              onChange={() => toggleOption(topping.id, selectedToppings, setSelectedToppings, constraints.toppings)}
                            />
                            <div className="option-card-content">
                              <span>{topping.name}</span>
                              {selectedToppings.length >= constraints.toppings && !selectedToppings.includes(topping.id) && (
                                <span className="option-card-extra-price">+$15</span>
                              )}
                            </div>
                          </label>
                        ))}
                    </div>
                  </div>

                  {/* Seeds & Nuts */}
                  <div className="option-group">
                    <div className="option-group-title">
                      <span>Semillas y Frutos Secos</span>
                      <span className="option-group-limit">Límite base: {constraints.seeds}</span>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '8px' }}>
                      (Adicionales tienen costo extra de +$15 c/u)
                    </p>
                    <div className="option-grid">
                      {SALAD_OPTIONS.seedsAndNuts.map((seed: any) => (
                        <label key={seed.id} className="option-card-label">
                          <input
                            type="checkbox"
                            className="option-card-input"
                            checked={selectedSeeds.includes(seed.id)}
                            onChange={() => toggleOption(seed.id, selectedSeeds, setSelectedSeeds, constraints.seeds)}
                          />
                          <div className="option-card-content">
                            <span>{seed.name}</span>
                            {selectedSeeds.length >= constraints.seeds && !selectedSeeds.includes(seed.id) && (
                              <span className="option-card-extra-price">+$15</span>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Dressings */}
                  <div className="option-group">
                    <div className="option-group-title">
                      <span>Aderezos (Mínimo 1)</span>
                      <span className="option-group-limit">Límite base: {constraints.dressings}</span>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '8px' }}>
                      (Adicionales tienen costo extra de +$15 c/u)
                    </p>
                    <div className="option-grid">
                      {SALAD_OPTIONS.dressings.map((dressing: any) => (
                        <label key={dressing.id} className="option-card-label">
                          <input
                            type="checkbox"
                            className="option-card-input"
                            checked={selectedDressings.includes(dressing.id)}
                            onChange={() => toggleOption(dressing.id, selectedDressings, setSelectedDressings, constraints.dressings)}
                          />
                          <div className="option-card-content">
                            <span>{dressing.name}</span>
                            {selectedDressings.length >= constraints.dressings && !selectedDressings.includes(dressing.id) && (
                              <span className="option-card-extra-price">+$15</span>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Bowls Customizer (2 Fruits, 2 Seeds) */}
              {(selectedProduct.name === 'Bowl de Avena' || selectedProduct.name === 'Bowl de Yogurt') && (
                <>
                  <div className="option-group">
                    <div className="option-group-title">
                      <span>Frutas (Toppings) - Selecciona 2</span>
                    </div>
                    <div className="option-grid">
                      {SALAD_OPTIONS.toppings.filter((t: any) => ['mango', 'fresa', 'platano', 'uva', 'kiwi', 'pina', 'blueberry', 'frambuesa'].includes(t.id)).map((topping: any) => (
                        <label key={topping.id} className="option-card-label">
                          <input
                            type="checkbox"
                            className="option-card-input"
                            checked={selectedToppings.includes(topping.id)}
                            onChange={() => {
                              if (selectedToppings.includes(topping.id)) {
                                setSelectedToppings(selectedToppings.filter((x: any) => x !== topping.id));
                              } else if (selectedToppings.length < 2) {
                                setSelectedToppings([...selectedToppings, topping.id]);
                              }
                            }}
                          />
                          <div className="option-card-content">
                            <span>{topping.name}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="option-group">
                    <div className="option-group-title">
                      <span>Semillas y Granos - Selecciona 2</span>
                    </div>
                    <div className="option-grid">
                      {SALAD_OPTIONS.seedsAndNuts.map((seed: any) => (
                        <label key={seed.id} className="option-card-label">
                          <input
                            type="checkbox"
                            className="option-card-input"
                            checked={selectedSeeds.includes(seed.id)}
                            onChange={() => {
                              if (selectedSeeds.includes(seed.id)) {
                                setSelectedSeeds(selectedSeeds.filter((x: any) => x !== seed.id));
                              } else if (selectedSeeds.length < 2) {
                                setSelectedSeeds([...selectedSeeds, seed.id]);
                              }
                            }}
                          />
                          <div className="option-card-content">
                            <span>{seed.name}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Flavor Selector for Drinks & Infusions */}
              {selectedProduct.flavors && (() => {
                const isSmoothieClasico = Boolean(
                  selectedProduct && (
                    selectedProduct.id === 'smoothies-clasicos' ||
                    selectedProduct.name?.toLowerCase().includes('smoothie clásico') ||
                    selectedProduct.name?.toLowerCase().includes('smoothies clásicos') ||
                    selectedProduct.name?.toLowerCase().includes('smoothie clasico') ||
                    selectedProduct.name?.toLowerCase().includes('smoothies clasicos')
                  )
                );
                const effectiveMaxFlavors = (isSmoothieClasico && isSmoothieMixto) ? 2 : (selectedProduct.maxFlavors || 1);

                return (
                  <div className="option-group">
                    {isSmoothieClasico && (
                      <label
                        className="option-card-label"
                        style={{ marginBottom: '18px' }}
                      >
                        <input
                          type="checkbox"
                          className="option-card-input"
                          checked={isSmoothieMixto}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setIsSmoothieMixto(checked);
                            if (!checked && selectedFlavors.length > 1) {
                              setSelectedFlavors(selectedFlavors.slice(0, 1));
                            }
                          }}
                        />
                        <div
                          className="option-card-content"
                          style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            padding: '16px 20px',
                            minHeight: 'auto',
                            textAlign: 'left',
                            background: isSmoothieMixto ? 'rgba(192, 90, 62, 0.06)' : 'var(--color-white)',
                            borderColor: isSmoothieMixto ? 'var(--color-terracotta)' : 'rgba(212, 163, 115, 0.3)'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            <div
                              style={{
                                width: '38px',
                                height: '38px',
                                borderRadius: '12px',
                                backgroundColor: isSmoothieMixto ? 'var(--color-terracotta)' : 'rgba(212, 163, 115, 0.15)',
                                color: isSmoothieMixto ? '#ffffff' : 'var(--color-green-dark)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.25s ease'
                              }}
                            >
                              <Sparkles size={18} />
                            </div>
                            <div>
                              <div style={{ fontSize: '0.92rem', fontWeight: 700, color: isSmoothieMixto ? 'var(--color-terracotta)' : 'var(--color-green-dark)' }}>
                                Smoothie Mixto
                              </div>
                              <div style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--color-text-muted)', marginTop: '2px' }}>
                                Combina 2 de tus frutas favoritas
                              </div>
                            </div>
                          </div>
                          <div
                            style={{
                              width: '22px',
                              height: '22px',
                              borderRadius: '50%',
                              border: `2px solid ${isSmoothieMixto ? 'var(--color-terracotta)' : 'rgba(212, 163, 115, 0.4)'}`,
                              backgroundColor: isSmoothieMixto ? 'var(--color-terracotta)' : 'transparent',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#ffffff',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            {isSmoothieMixto && <Check size={13} strokeWidth={3} />}
                          </div>
                        </div>
                      </label>
                    )}

                    <div className="option-group-title">
                      <span>Sabor a elegir</span>
                      {effectiveMaxFlavors > 1 ? (
                        <span className="option-group-limit">Hasta {effectiveMaxFlavors} sabores</span>
                      ) : (
                        <span className="option-group-limit">Obligatorio</span>
                      )}
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '10px' }}>
                      {effectiveMaxFlavors > 1
                        ? `Elige hasta ${effectiveMaxFlavors} sabores combinados.`
                        : 'Selecciona el sabor para tu bebida.'}
                    </p>
                    <div className="option-grid">
                      {selectedProduct.flavors.map((flavor: any) => {
                        const isChecked = selectedFlavors.includes(flavor);
                        return (
                          <label key={flavor} className="option-card-label">
                            <input
                              type={effectiveMaxFlavors > 1 ? "checkbox" : "radio"}
                              name="flavor"
                              className="option-card-input"
                              checked={isChecked}
                              onChange={() => {
                                if (isChecked) {
                                  setSelectedFlavors(selectedFlavors.filter((f: any) => f !== flavor));
                                } else {
                                  if (effectiveMaxFlavors === 1) {
                                    setSelectedFlavors([flavor]);
                                  } else if (selectedFlavors.length < effectiveMaxFlavors) {
                                    setSelectedFlavors([...selectedFlavors, flavor]);
                                  }
                                }
                              }}
                            />
                            <div className="option-card-content">
                              <span>{flavor}</span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Especialidad / Proteína for Sandwiches & Tortas */}
              {(selectedProduct.id === 'sandwich' || selectedProduct.id === 'torta' || selectedProduct.id === 'sandwich-pavo' || selectedProduct.id === 'sandwich-pollo' || selectedProduct.name?.includes('Sándwich') || selectedProduct.name?.includes('Torta')) && (
                <div className="option-group">
                  <div className="option-group-title">
                    <span>Especialidad / Proteína (1 obligatorio)</span>
                    <span className="option-group-limit">Obligatorio</span>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '8px' }}>
                    (Selecciona 1 opción. Desmarca tu selección actual para cambiar de opción)
                  </p>
                  <div className="option-grid">
                    {[
                      { name: 'Pechuga empanizada' },
                      { name: 'Pechuga asada' },
                      { name: 'Jamón de pavo' }
                    ].map((prot) => {
                      const isChecked = selectedProteinOptions.includes(prot.name);
                      const isDisabled = selectedProteinOptions.length >= 1 && !isChecked;
                      return (
                        <label key={prot.name} className="option-card-label" style={{ opacity: isDisabled ? 0.45 : 1, cursor: isDisabled ? 'not-allowed' : 'pointer' }}>
                          <input
                            type="checkbox"
                            name="proteinOption"
                            className="option-card-input"
                            checked={isChecked}
                            disabled={isDisabled}
                            onChange={() => {
                              if (isChecked) {
                                setSelectedProteinOptions([]);
                              } else {
                                setSelectedProteinOptions([prot.name]);
                              }
                            }}
                          />
                          <div className="option-card-content" style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                            <span>{prot.name}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Bread Selector for Sandwiches */}
              {(selectedProduct.id === 'sandwich' || selectedProduct.id === 'sandwich-pollo' || selectedProduct.id === 'sandwich-pavo' || (selectedProduct.name?.includes('Sándwich') && !selectedProduct.name?.includes('Torta'))) && (
                <div className="option-group">
                  <div className="option-group-title">
                    <span>Tipo de Pan (1 obligatorio)</span>
                  </div>
                  <div className="option-grid">
                    {['Pan Blanco', 'Centeno', 'Multigrano'].map((bread) => (
                      <label key={bread} className="option-card-label">
                        <input
                          type="radio"
                          name="bread"
                          className="option-card-input"
                          checked={selectedBread === bread}
                          onChange={() => setSelectedBread(bread)}
                        />
                        <div className="option-card-content">
                          <span>{bread}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Omission Options */}
              {(() => {
                let omissions: string[] = [];
                if (selectedProduct.id === 'burrito-pollo' || selectedProduct.name?.includes('Burrito')) {
                  omissions = ['Sin aderezo', 'Sin zanahoria', 'Sin pepino', 'Sin frijoles', 'Sin chile', 'Sin aguacate'];
                } else if (selectedProduct.id === 'ciabatta' || selectedProduct.name?.includes('Ciabatta')) {
                  omissions = ['Sin espinaca', 'Sin guacamole', 'Sin queso', 'Sin mayonesa', 'Sin huevo', 'Sin jamón', 'Sin pepino'];
                } else if (selectedProduct.id === 'sandwich' || selectedProduct.id === 'torta' || selectedProduct.id === 'sandwich-pavo' || selectedProduct.id === 'sandwich-pollo' || selectedProduct.name?.includes('Sándwich') || selectedProduct.name?.includes('Torta')) {
                  omissions = ['Sin cebolla', 'Sin aguacate', 'Sin mayonesa', 'Sin frijoles', 'Sin jitomate', 'Sin col', 'Sin chile'];
                } else if (selectedProduct.id?.includes('rollito') || selectedProduct.name?.includes('Rollito') || selectedProduct.name?.includes('Rollo')) {
                  omissions = ['Sin aguacate', 'Sin espinaca', 'Sin pepino', 'Sin zanahoria'];
                }
                if (omissions.length === 0) return null;
                return (
                  <div className="option-group">
                    <div className="option-group-title">
                      <span>Omitir Ingredientes (Opcional)</span>
                    </div>
                    <div className="option-grid">
                      {omissions.map((omit) => {
                        const isChecked = selectedOmissions.includes(omit);
                        return (
                          <label key={omit} className="option-card-label">
                            <input
                              type="checkbox"
                              className="option-card-input"
                              checked={isChecked}
                              onChange={() => {
                                if (isChecked) {
                                  setSelectedOmissions(selectedOmissions.filter(o => o !== omit));
                                } else {
                                  setSelectedOmissions([...selectedOmissions, omit]);
                                }
                              }}
                            />
                            <div className="option-card-content">
                              <span>{omit}</span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Notes */}
              <div className="option-group" style={{ borderBottom: 'none', paddingBottom: 0 }}>
                <div className="option-group-title">Notas especiales para tu pedido</div>
                <textarea
                  className="notes-textarea"
                  placeholder={getProductNotesPlaceholder(selectedProduct, menuData?.CATEGORIES || [])}
                  value={customNotes}
                  onChange={e => setCustomNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="modal-footer">
              <div>
                <span className="modal-total-label">Subtotal</span>
                <div className="modal-total-price">
                  {/* Calculate dynamic price */}
                  ${(() => {
                    const isSmoothieClasico = Boolean(
                      selectedProduct && (
                        selectedProduct.id === 'smoothies-clasicos' ||
                        selectedProduct.name?.toLowerCase().includes('smoothie clásico') ||
                        selectedProduct.name?.toLowerCase().includes('smoothies clásicos') ||
                        selectedProduct.name?.toLowerCase().includes('smoothie clasico') ||
                        selectedProduct.name?.toLowerCase().includes('smoothies clasicos')
                      )
                    );
                    const price = (isSmoothieClasico && isSmoothieMixto)
                      ? (customSize === 'Chico' ? 80 : (customSize === 'Grande' ? 90 : 80))
                      : (selectedProduct.prices ? selectedProduct.prices[customSize] : selectedProduct.price);
                    let extra = 0;
                    const isEnsalada = selectedProduct.category === 'ensaladas' || selectedProduct.category === '299824bb-ede2-47ed-bf0e-b5fd9548af73' || menuData?.CATEGORIES?.find((c: any) => c.id === selectedProduct.category)?.name === 'Ensaladas' || selectedProduct.name?.toLowerCase().includes('ensalada');
                    const isSandwichOrTorta = selectedProduct.id === 'sandwich' || selectedProduct.id === 'torta' || selectedProduct.id === 'sandwich-pavo' || selectedProduct.id === 'sandwich-pollo' || selectedProduct.name?.includes('Sándwich') || selectedProduct.name?.includes('Torta');
                    if (isEnsalada) {
                      if (selectedProteins.length > constraints.proteins) {
                        extra += (selectedProteins.length - constraints.proteins) * 30;
                      }
                      if (selectedToppings.length > constraints.toppings) {
                        extra += (selectedToppings.length - constraints.toppings) * 15;
                      }
                      if (selectedSeeds.length > constraints.seeds) {
                        extra += (selectedSeeds.length - constraints.seeds) * 15;
                      }
                      if (selectedDressings.length > constraints.dressings) {
                        extra += (selectedDressings.length - constraints.dressings) * 15;
                      }
                    }
                    return price + extra;
                  })()}
                </div>
              </div>

              <button
                className="confirm-add-btn"
                onClick={handleConfirmCustomization}
                disabled={
                  ((selectedProduct.category === 'ensaladas' || selectedProduct.category === '299824bb-ede2-47ed-bf0e-b5fd9548af73' || menuData?.CATEGORIES?.find((c: any) => c.id === selectedProduct.category)?.name === 'Ensaladas' || selectedProduct.name?.toLowerCase().includes('ensalada')) && (selectedDressings.length === 0 || selectedProteins.length === 0 || selectedToppings.length === 0)) ||
                  ((selectedProduct.name === 'Bowl de Avena' || selectedProduct.name === 'Bowl de Yogurt') &&
                    (selectedToppings.length !== 2 || selectedSeeds.length !== 2)) ||
                  ((selectedProduct.id === 'sandwich' || selectedProduct.id === 'torta' || selectedProduct.id === 'sandwich-pavo' || selectedProduct.id === 'sandwich-pollo' || selectedProduct.name?.includes('Sándwich') || selectedProduct.name?.includes('Torta')) && selectedProteinOptions.length === 0) ||
                  (selectedProduct.flavors !== undefined && selectedFlavors.length === 0)
                }
              >
                Agregar al Carrito
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CART DRAWER */}
      {isCartOpen && (
        <div className="modal-overlay" onClick={() => setIsCartOpen(false)}>
          <div className="cart-drawer" onClick={e => e.stopPropagation()}>
            <div className="cart-header">
              <div className="cart-header-title">
                <ShoppingBag />
                <h2>Tu Pedido</h2>
              </div>
              <button className="close-btn" onClick={() => setIsCartOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="cart-body">
              {cart.length === 0 ? (
                <div className="cart-empty">
                  <div className="cart-empty-icon" style={{ display: 'flex', justifyContent: 'center', marginBottom: '15px' }}><ShoppingBag size={48} color="var(--color-ochre)" /></div>
                  <h3>Tu carrito está vacío</h3>
                  <p>Navega en el menú y agrega tus ensaladas o jugos favoritos.</p>
                </div>
              ) : (
                <div className="cart-items-list">
                  {cart.map((item: any) => (
                    <div key={item.cartId} className="cart-item">
                      <div className="cart-item-info">
                        <span className="cart-item-name">{item.name} {item.size && `(${item.size})`}</span>

                        {item.customizations && (
                          <div className="cart-item-customizations">
                            {item.customizations.proteins?.length > 0 && (
                              <div><strong>Proteínas:</strong> {item.customizations.proteins.join(', ')}</div>
                            )}
                            {item.customizations.toppings?.length > 0 && (
                              <div><strong>Toppings:</strong> {item.customizations.toppings.join(', ')}</div>
                            )}
                            {item.customizations.seedsAndNuts?.length > 0 && (
                              <div><strong>Semillas/Frutos:</strong> {item.customizations.seedsAndNuts.join(', ')}</div>
                            )}
                            {item.customizations.dressings?.length > 0 && (
                              <div><strong>Aderezo:</strong> {item.customizations.dressings.join(', ')}</div>
                            )}
                            {item.customizations.flavors?.length > 0 && (
                              <div><strong>Sabor:</strong> {item.customizations.flavors.join(', ')}</div>
                            )}
                            {item.customizations.extras?.length > 0 && (() => {
                              const omissions = item.customizations.extras.filter((x: any) => typeof x === 'string' && x.toLowerCase().startsWith('sin '));
                              const otherExtras = item.customizations.extras.filter((x: any) => !(typeof x === 'string' && x.toLowerCase().startsWith('sin ')));
                              return (
                                <>
                                  {omissions.length > 0 && <div style={{ color: 'var(--color-terracotta)', fontWeight: 700 }}><strong>Exclusiones:</strong> {omissions.join(', ')}</div>}
                                  {otherExtras.length > 0 && <div><strong>Opciones/Extras:</strong> {otherExtras.join(', ')}</div>}
                                </>
                              );
                            })()}
                            {Object.entries(item.customizations).map(([key, val]: [string, any]) => {
                              if (['proteins', 'toppings', 'seedsAndNuts', 'dressings', 'flavors', 'extras'].includes(key)) return null;
                              if (Array.isArray(val) && val.length > 0) {
                                return <div key={key}><strong>{key.charAt(0).toUpperCase() + key.slice(1)}:</strong> {val.join(', ')}</div>;
                              }
                              if (typeof val === 'string' && val.trim() !== '') {
                                return <div key={key}><strong>{key.charAt(0).toUpperCase() + key.slice(1)}:</strong> {val}</div>;
                              }
                              return null;
                            })}
                          </div>
                        )}
                        {item.notes && (
                          <div style={{ fontSize: '0.8rem', fontStyle: 'italic', marginTop: '6px', color: 'var(--color-terracotta)' }}>
                            "{item.notes}"
                          </div>
                        )}
                      </div>

                      <div className="cart-item-price-quantity">
                        <span className="cart-item-price">${item.price * item.quantity}</span>
                        <div className="quantity-controls">
                          <button className="quantity-btn" onClick={() => updateQuantity(item.cartId, -1)}>-</button>
                          <span className="quantity-value">{item.quantity}</span>
                          <button className="quantity-btn" onClick={() => updateQuantity(item.cartId, 1)}>+</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <div className="cart-footer">
                <div className="service-selector-container">
                  <label className="service-selector-title">¿Dónde disfrutarás tu pedido?</label>

                  <div className="service-selector-grid">
                    <button
                      className={`service-option-card ${serviceType === 'pickup' ? 'active' : ''}`}
                      onClick={() => setServiceType('pickup')}
                      type="button"
                    >
                      <ShoppingBag size={18} />
                      <span>Recoger</span>
                    </button>

                    <button
                      className={`service-option-card ${serviceType === 'dine_in' ? 'active' : ''}`}
                      onClick={() => setServiceType('dine_in')}
                      type="button"
                    >
                      <Utensils size={18} />
                      <span>Aquí</span>
                    </button>

                    <button
                      className={`service-option-card ${serviceType === 'delivery' ? 'active' : ''}`}
                      onClick={() => setServiceType('delivery')}
                      type="button"
                    >
                      <Bike size={18} />
                      <span>Envío</span>
                    </button>
                  </div>

                  {serviceType === 'delivery' && (
                    <div className="delivery-address-box">
                      <input
                        type="text"
                        className="delivery-address-input"
                        placeholder="Calle, núm., col. y referencias (ej. portón negro)..."
                        value={deliveryAddress}
                        onChange={e => setDeliveryAddress(e.target.value)}
                        autoFocus
                      />
                      <span className="delivery-hint"> Te lo llevamos caliente y fresco hasta tu puerta</span>
                      {/* Delivery fee notice */}
                      <div style={{
                        marginTop: '10px', padding: '10px 12px',
                        backgroundColor: '#fffbeb', border: '1px solid #f59e0b',
                        borderRadius: '8px', fontSize: '0.8rem', color: '#78350f',
                        display: 'flex', gap: '8px', alignItems: 'flex-start', lineHeight: '1.4'
                      }}>
                        <Bike size={14} style={{ flexShrink: 0, marginTop: '1px', color: '#f59e0b' }} />
                        <span>
                          <strong>Costo de envío por confirmar:</strong> Revisaremos tu dirección y te confirmaremos la tarifa antes de empezar a preparar tu pedido.
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {errorMsg && !isAuthOpen && (
                  <div style={{ backgroundColor: '#ffebee', color: '#c62828', padding: '10px', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '10px', fontWeight: 600, textAlign: 'center' }}>
                    {errorMsg}
                  </div>
                )}
                <div className="cart-totals-row">
                  <span>Total</span>
                  <span>${calculateSubtotal()}</span>
                </div>
                <button
                  className="checkout-btn"
                  onClick={() => {
                    if (serviceType === 'delivery' && !deliveryAddress.trim()) {
                      setErrorMsg('Por favor ingresa tu dirección de entrega para el pedido a domicilio.');
                      return;
                    }
                    setErrorMsg('');
                    handleCheckoutClick();
                  }}
                  disabled={isSubmittingOrder}
                >
                  <span>{isSubmittingOrder ? 'Procesando Pedido...' : 'Confirmar Pedido'}</span>
                  {!isSubmittingOrder && <ArrowRight size={18} />}
                </button>

              </div>
            )}
          </div>
        </div>
      )}

      {/* AUTH & MINI REGISTRATION MODAL */}
      {/* AUTH & MINI REGISTRATION MODAL (2-Step Compact Sheet) */}
      {isAuthOpen && (
        <div className="modal-overlay" onClick={() => setIsAuthOpen(false)} style={{ overscrollBehavior: 'contain' }}>
          <div
            className="modal-content"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '420px',
              width: '92%',
              padding: '28px 24px',
              borderRadius: '28px',
              border: '1px solid rgba(212, 163, 115, 0.3)',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.2)',
              backgroundColor: 'var(--color-white)',
              margin: 'auto',
              maxHeight: '86vh',
              overflowY: 'auto',
              overscrollBehavior: 'contain'
            }}
          >
            {/* Header Dinámico 2 Etapas */}
            <div className="modal-header" style={{ borderBottom: '1px solid rgba(212, 163, 115, 0.15)', paddingBottom: '18px', marginBottom: '20px', justifyContent: 'center', position: 'relative', background: 'transparent' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', textAlign: 'center' }}>
                <div style={{
                  width: '50px',
                  height: '50px',
                  borderRadius: '50%',
                  background: !smsSent ? 'var(--color-cream-light)' : '#d1fae5',
                  color: !smsSent ? 'var(--color-green-dark)' : '#047857',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(34, 60, 43, 0.08)'
                }}>
                  {!smsSent ? <Sparkles size={24} /> : <QrCode size={24} />}
                </div>
                <div>
                  <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem', color: 'var(--color-green-dark)', margin: '0 0 6px 0', fontWeight: 700 }}>
                    {!smsSent ? 'Datos de tu Pedido' : 'Verifica tu Número'}
                  </h2>
                  <span style={{ fontSize: '0.84rem', color: 'var(--color-text-muted)', lineHeight: '1.4', display: 'block', padding: '0 6px' }}>
                    {!smsSent
                      ? 'Ingresa tu nombre y celular para coordinar el pedido y acumular puntos Edén Pass.'
                      : `Enviamos un SMS de 6 dígitos al celular ${customerPhone}.`}
                  </span>
                </div>
              </div>
              <button className="close-btn" onClick={() => setIsAuthOpen(false)} style={{ position: 'absolute', top: '-6px', right: '-6px', backgroundColor: 'transparent', color: 'var(--color-text-muted)', width: '32px', height: '32px' }}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body" style={{ paddingTop: '0' }}>
              {errorMsg && (
                <div style={{ backgroundColor: '#fff1f2', color: '#be123c', padding: '12px 14px', borderRadius: '12px', fontSize: '0.83rem', marginBottom: '18px', fontWeight: 600, whiteSpace: 'pre-wrap', border: '1px solid #fecdd3' }}>
                  {errorMsg}
                </div>
              )}

              {!smsSent ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.83rem', fontWeight: 600, color: 'var(--color-green-dark)', marginBottom: '6px' }}>Nombre Completo</label>
                    <input
                      type="text"
                      className="form-input"
                      style={{ borderRadius: '12px', padding: '13px 16px', border: '1.5px solid #e2e8f0', backgroundColor: '#f8fafc', transition: 'all 0.2s', fontSize: '0.95rem' }}
                      placeholder="Ej. Brandon Chavez"
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.83rem', fontWeight: 600, color: 'var(--color-green-dark)', marginBottom: '6px' }}>Número de Celular</label>
                    <input
                      type="tel"
                      maxLength={10}
                      className="form-input"
                      style={{ borderRadius: '12px', padding: '13px 16px', border: '1.5px solid #e2e8f0', backgroundColor: '#f8fafc', transition: 'all 0.2s', fontSize: '0.95rem', letterSpacing: '1px' }}
                      placeholder="10 dígitos (ej. 6237591105)"
                      value={customerPhone}
                      onChange={e => setCustomerPhone(e.target.value.replace(/\D/g, ''))}
                    />
                  </div>

                  <button
                    className="checkout-btn"
                    style={{ marginTop: '12px', width: '100%', borderRadius: '14px', padding: '15px', fontSize: '0.98rem', fontWeight: 600, boxShadow: '0 6px 18px rgba(34, 60, 43, 0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    onClick={handleSendSmsCode}
                  >
                    <span>Continuar al SMS</span>
                    <ArrowRight size={18} />
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '6px' }}>
                  <div className="sms-code-container" style={{ margin: '8px auto 4px auto', gap: '8px' }}>
                    {smsCode.map((digit, index) => (
                      <input
                        key={index}
                        id={`otp-input-${index}`}
                        type="text"
                        maxLength={1}
                        className="sms-code-input"
                        style={{ width: '44px', height: '50px', fontSize: '1.25rem', borderRadius: '12px', fontWeight: 700 }}
                        value={digit}
                        onChange={e => {
                          const val = e.target.value;
                          if (/^[0-9]$/.test(val) || val === '') {
                            const nextCode = [...smsCode];
                            nextCode[index] = val;
                            setSmsCode(nextCode);
                            // Auto-focus next input
                            if (val !== '' && index < 5) {
                              document.getElementById(`otp-input-${index + 1}`)?.focus();
                            }
                          }
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Backspace' && smsCode[index] === '' && index > 0) {
                            document.getElementById(`otp-input-${index - 1}`)?.focus();
                          }
                        }}
                      />
                    ))}
                  </div>

                  {sentCode && (
                    <div className="sms-code-preview-banner" style={{ margin: '4px 0', fontSize: '0.8rem', padding: '10px 12px' }}>
                      <strong>Modo Local:</strong> Ingresa el código: <strong>{sentCode}</strong> o <strong>123456</strong>
                    </div>
                  )}

                  {codeResentNotice && (
                    <div style={{ backgroundColor: '#ecfdf5', color: '#047857', padding: '10px 14px', borderRadius: '10px', fontSize: '0.82rem', fontWeight: 600, textAlign: 'center', border: '1px solid #10b981' }}>
                      ✓ ¡Hemos reenviado el código SMS!
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <button
                      type="button"
                      disabled={resendCooldown > 0}
                      onClick={handleResendSmsCode}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: resendCooldown > 0 ? 'var(--color-text-muted)' : 'var(--color-green-dark)',
                        fontWeight: '600',
                        fontSize: '0.83rem',
                        cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer',
                        textDecoration: resendCooldown > 0 ? 'none' : 'underline'
                      }}
                    >
                      {resendCooldown > 0
                        ? `Reenviar código en ${resendCooldown}s`
                        : '¿No te llegó? Volver a enviar SMS'}
                    </button>
                  </div>

                  <button
                    className="checkout-btn"
                    style={{ marginTop: '8px', padding: '15px', borderRadius: '14px', fontSize: '0.98rem', fontWeight: 600, boxShadow: '0 6px 18px rgba(34, 60, 43, 0.16)' }}
                    disabled={isVerifying || isSubmittingOrder}
                    onClick={handleVerifySmsCode}
                  >
                    {isVerifying || isSubmittingOrder ? 'Verificando y Procesando...' : 'Verificar y Enviar Orden'}
                  </button>

                  <button
                    style={{ background: 'none', border: 'none', color: 'var(--color-terracotta)', fontWeight: '600', fontSize: '0.84rem', margin: '4px auto 0 auto', cursor: 'pointer' }}
                    onClick={() => {
                      setSmsSent(false);
                      setSmsCode(['', '', '', '', '', '']);
                    }}
                  >
                    ← Corregir Celular o Nombre
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ACTIVE ORDERS FLOATING BUTTON */}
      {activeOrders.length > 0 && !isCartOpen && !selectedProduct && !isAuthOpen && (
        <div
          onClick={() => router.push(`/orden/${activeOrders[0].id}`)}
          style={{
            position: 'fixed',
            bottom: '90px', // Above the cart button
            right: '20px',
            backgroundColor: 'var(--color-ochre)',
            color: 'var(--color-green-dark)',
            padding: '12px 20px',
            borderRadius: '30px',
            boxShadow: '0 8px 24px rgba(212, 163, 115, 0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            cursor: 'pointer',
            zIndex: 90,
            fontWeight: 700,
            fontSize: '0.95rem',
            animation: 'float 3s ease-in-out infinite',
            border: '2px solid rgba(255,255,255,0.2)'
          }}
        >
          <div style={{
            width: '10px',
            height: '10px',
            backgroundColor: '#27ae60',
            borderRadius: '50%',
            boxShadow: '0 0 8px #27ae60'
          }} className="pulse-dot"></div>
          <span>Ver Orden Activa</span>
          <ChevronRight size={18} />
        </div>
      )}
    </>
  );
}
