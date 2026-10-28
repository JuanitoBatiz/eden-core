'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
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
  QrCode,
  Maximize2
} from 'lucide-react';
import { MenuItem, MenuCategory, CATEGORIES as fallbackCategories, MENU_ITEMS as fallbackMenuItems, SALAD_OPTIONS as fallbackSaladOptions } from '@/lib/menuData';
import { SmsRequest, VerifyOtpRequest, OrderCreateRequest, DeliveryQuote } from '@/types/api-contracts';
import ProductImage from '@/components/ProductImage';
import { QRCodeSVG } from 'qrcode.react';
import DeliveryAddressSelector from '@/components/DeliveryAddressSelector';
import ScrollRevealItem from '@/components/ScrollRevealItem';
import BalloonIcon from '@/components/BalloonIcon';
import SiteNav, { NavTarget } from '@/components/site/SiteNav';
import { EdenMark, Monstera, LeafShadows, Tagline, cutoutFor } from '@/components/site/brand';
import { MARK_LEAF } from '@/components/site/edenPaths';
import { useCurtain } from '@/components/site/Curtain';
import { useScrollFx } from '@/components/site/useScrollFx';

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

function MenuContent() {
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
  const [isSendingSms, setIsSendingSms] = useState(false);
  const [resendCount, setResendCount] = useState(0);


  useEffect(() => {
    let timer: any = null;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // Abrir modal de login si la URL incluye ?login=1 (e.g., redireccionado desde /rifa)
  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams.get('login') === '1') {
      setIsAuthOpen(true);
    }
  }, [searchParams]);

  // Service Type State
  const [serviceType, setServiceType] = useState<'pickup' | 'delivery' | 'dine_in'>('pickup');
  // Modo "Modificar pedido": el pedido nuevo reemplazará (y cancelará) a este al enviarse
  const [editingOrder, setEditingOrder] = useState<{ id: string; short: string } | null>(null);
  // Delivery GPS State (solo activo cuando serviceType === 'delivery')
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryCoords, setDeliveryCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [deliveryQuote, setDeliveryQuote] = useState<DeliveryQuote | null>(null);

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

  // Lock body scroll when a modal is open to prevent double scrollbars and background scrolling
  useEffect(() => {
    if (isCartOpen || selectedProduct !== null || isAuthOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [isCartOpen, selectedProduct, isAuthOpen]);


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

  // Modificar pedido: /orden/[id] deja el carrito cargado y 'eden_edit_order' con los datos del original
  useEffect(() => {
    try {
      const raw = localStorage.getItem('eden_edit_order');
      if (!raw) return;
      const edit = JSON.parse(raw);
      if (!edit?.id || typeof edit.id !== 'string') { localStorage.removeItem('eden_edit_order'); return; }
      setEditingOrder({ id: edit.id, short: String(edit.short || '') });
      if (edit.service_type === 'delivery' || edit.service_type === 'dine_in' || edit.service_type === 'pickup') {
        setServiceType(edit.service_type);
      }
      setIsCartOpen(true);
    } catch (e) {
      try { localStorage.removeItem('eden_edit_order'); } catch (e2) { }
    }
  }, []);

  const discardOrderEdit = () => {
    try { localStorage.removeItem('eden_edit_order'); } catch (e) { }
    setEditingOrder(null);
    saveCart([]);
    setErrorMsg('');
  };

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
        return { proteins: 2, toppings: 6, seeds: 4, dressings: 2 };
      }
      return { proteins: 1, toppings: 4, seeds: 2, dressings: 2 };
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

  const OTP_VALID_MS = 9 * 60 * 1000; // el código de Twilio Verify dura 10 min
  const OTP_COOLDOWN_S = 45;
  const MAX_RESENDS = 2;

  const handleSendSmsCode = async () => {
    if (isSendingSms) return; // evita doble tap / doble envío
    setErrorMsg('');
    if (!customerName.trim() || !customerPhone.trim() || customerPhone.length !== 10) {
      setErrorMsg('Por favor ingresa tu nombre y un celular de 10 dígitos.');
      return;
    }

    // Si ya se envió un código a ESTE mismo número hace poco (ej. "Corregir nombre" y volver),
    // no se pide otro SMS: se regresa directo a la captura del código ya enviado.
    try {
      const raw = sessionStorage.getItem('eden_otp_sent');
      if (raw) {
        const last = JSON.parse(raw);
        const age = Date.now() - (last.sentAt || 0);
        if (last.phone === customerPhone && age < OTP_VALID_MS) {
          setSmsSent(true);
          setResendCooldown(Math.max(0, OTP_COOLDOWN_S - Math.floor(age / 1000)));
          return;
        }
      }
    } catch (e) { }

    setIsSendingSms(true);
    try {
      // 1. Verificar si el celular ya existe con otro nombre
      const checkRes = await fetch('/api/auth/check-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: customerPhone })
      });
      
      if (checkRes.ok) {
        const checkData = await checkRes.json();
        const currentNameLower = customerName.trim().toLowerCase();
        
        if (checkData.exists && checkData.nameHash) {
          // Validamos si el nombre ingresado coincide con el de la BD, usando el hash
          const currentNameHash = btoa(unescape(encodeURIComponent(currentNameLower)));
          
          if (currentNameHash !== checkData.nameHash) {
            const proceed = window.confirm(`El número de celular ${customerPhone} ya está registrado a nombre de "${checkData.name}".\n\n¿Deseas continuar e iniciar sesión en esta cuenta?`);
            if (!proceed) {
              return; // Cancelar flujo
            }
            // NOTA: No sobreescribimos customerName aquí con checkData.name porque está ofuscado.
            // El backend simplemente ignorará el nombre enviado y usará el real del usuario existente.
          }
        }
      }

      // 2. Enviar SMS
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

      try {
        sessionStorage.setItem('eden_otp_sent', JSON.stringify({ phone: customerPhone, sentAt: Date.now() }));
      } catch (e) { }
      setResendCount(0);
      setResendCooldown(OTP_COOLDOWN_S);
      setSmsSent(true);
      if (data.code) {
        // Developer simulation: save code to show banner
        setSentCode(data.code);
      }
    } catch (e) {
      console.error(e);
      setErrorMsg('Ocurrió un error de red. Intenta de nuevo.');
    } finally {
      setIsSendingSms(false);
    }
  };

  const handleResendSmsCode = async () => {
    if (resendCooldown > 0 || isSendingSms) return;
    if (resendCount >= MAX_RESENDS) {
      setErrorMsg('Ya reenviamos tu código. Revisa que tu número sea correcto o inténtalo de nuevo en unos minutos.');
      return;
    }
    setErrorMsg('');
    setCodeResentNotice(false);
    setIsSendingSms(true);

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

      if (data.deduped) {
        // El servidor ya había enviado un código hace instantes: no se envió otro SMS.
        setResendCooldown(OTP_COOLDOWN_S);
        return;
      }

      try {
        sessionStorage.setItem('eden_otp_sent', JSON.stringify({ phone: customerPhone, sentAt: Date.now() }));
      } catch (e) { }
      setResendCount(c => c + 1);
      setResendCooldown(OTP_COOLDOWN_S);
      setCodeResentNotice(true);
      if (data.code) {
        setSentCode(data.code);
      }
      setTimeout(() => setCodeResentNotice(false), 6000);
    } catch (e) {
      console.error(e);
      setErrorMsg('Ocurrió un error de red al reenviar el código.');
    } finally {
      setIsSendingSms(false);
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
        if (data.code === 'wrong_code') {
          setSmsCode(['', '', '', '', '', '']);
          setTimeout(() => document.getElementById('otp-input-0')?.focus(), 0);
        } else if (data.code === 'expired' || data.code === 'max_attempts') {
          // El código ya no sirve: permitir pedir uno nuevo (el servidor aplica sus límites)
          try { sessionStorage.removeItem('eden_otp_sent'); } catch (e) { }
          setResendCount(0);
          setResendCooldown(0);
          setSmsCode(['', '', '', '', '', '']);
        }
        return;
      }

      try { sessionStorage.removeItem('eden_otp_sent'); } catch (e) { }

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
        ...(editingOrder ? { replaces_order_id: editingOrder.id } : {}),
        service_type: serviceType === 'dine_in' ? 'pickup' : serviceType,
        delivery_address: serviceType === 'delivery' ? deliveryAddress : undefined,
        // Campos GPS — solo se envían para delivery
        ...(serviceType === 'delivery' && deliveryCoords ? {
          delivery_lat: deliveryCoords.lat,
          delivery_lng: deliveryCoords.lng,
          delivery_zone_id: deliveryQuote?.zone?.id,
        } : {}),
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

      if (res.status === 409 && data.error === 'order_not_modifiable') {
        // El pedido original ya no se puede modificar (entró a preparación o se envió comprobante).
        // Se sale del modo edición para no reenviar con el mismo id; el carrito se conserva.
        try { localStorage.removeItem('eden_edit_order'); } catch (e) { }
        const blockedShort = editingOrder?.short;
        setEditingOrder(null);
        setErrorMsg(`${data.message || 'Tu pedido ya no se puede modificar.'} Tu pedido original #${blockedShort ?? ''} sigue vigente. Si envías este carrito ahora se creará un pedido NUEVO adicional.`);
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
      try { localStorage.removeItem('eden_edit_order'); } catch (e) { }
      setEditingOrder(null);
      saveCart([]);
      setDeliveryCoords(null);
      setDeliveryQuote(null);
      setDeliveryAddress('');
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

  // ════════════════════════════════════════════════════
  // CAPA VISUAL (rediseño): navegación con cortina, animaciones por scroll
  // ════════════════════════════════════════════════════
  const { go } = useCurtain();
  const [activeNav, setActiveNav] = useState<NavTarget>('inicio');
  useScrollFx([!!menuData]);

  const jumpTo = (id: string, extraOffset = 0) => {
    const el = document.getElementById(id);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - extraOffset;
    window.scrollTo({ top: Math.max(0, top), behavior: 'auto' });
  };

  const navigate = (target: NavTarget) => {
    switch (target) {
      case 'inicio':
        go({ word: 'EDÉN', action: () => window.scrollTo({ top: 0, behavior: 'auto' }) });
        break;
      case 'menu':
        go({ word: 'MENÚ', action: () => jumpTo('menu', 64) });
        break;
      case 'arma':
        go({ word: 'TU ENSALADA', action: () => jumpTo('arma', 40) });
        break;
      case 'pass':
        go({ word: 'EDÉN PASS', action: () => jumpTo('pass', 40) });
        break;
      case 'rifa':
        go({ word: 'RIFA', route: true, action: () => router.push('/rifa') });
        break;
      case 'perfil':
        go({ word: 'MI PERFIL', route: true, action: () => router.push('/perfil') });
        break;
    }
  };

  const goToCategory = (catId: string, withCurtain = true) => {
    setActiveCategory(catId);
    const doJump = () => jumpTo(`section-${catId}`, 150);
    const cat = (menuData?.CATEGORIES || []).find((c: any) => c.id === catId);
    if (withCurtain) go({ word: (cat?.name || 'MENÚ').toUpperCase(), action: doJump });
    else {
      const el = document.getElementById(`section-${catId}`);
      if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 150, behavior: 'smooth' });
    }
  };

  // Sección activa para resaltar el nav
  useEffect(() => {
    const ids: NavTarget[] = ['inicio', 'arma', 'menu', 'pass'];
    const onScroll = () => {
      let current: NavTarget = 'inicio';
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= window.innerHeight * 0.4) current = id;
      }
      setActiveNav(current);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [menuData]);

  // Enlaces con #menu / #pass desde otras páginas o códigos QR
  useEffect(() => {
    if (!menuData) return;
    const h = window.location.hash.replace('#', '');
    if (h && ['menu', 'arma', 'pass', 'favoritos'].includes(h)) {
      setTimeout(() => jumpTo(h, 64), 60);
    }
  }, [menuData]);

  if (menuError) {
    return (
      <div className="container" style={{ textAlign: 'center', padding: '100px 20px', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        <h2>No pudimos cargar el menú 😔</h2>
        <p style={{ marginBottom: '20px' }}>Por favor intenta de nuevo.</p>
        <button className="add-btn" style={{ padding: '10px 20px' }} onClick={() => window.location.reload()}>Reintentar</button>
      </div>
    );
  }

  const { CATEGORIES, MENU_ITEMS, SALAD_OPTIONS } = menuData || { CATEGORIES: [] as MenuCategory[], MENU_ITEMS: [] as MenuItem[], SALAD_OPTIONS: null as any };

  if (SALAD_OPTIONS && SALAD_OPTIONS.toppings) {
    if (!SALAD_OPTIONS.toppings.some((t: any) => t.id === 'aguacate' || t.name?.toLowerCase() === 'aguacate')) {
      SALAD_OPTIONS.toppings.unshift({ id: 'aguacate', name: 'Aguacate' });
    }
    if (!SALAD_OPTIONS.toppings.some((t: any) => t.id === 'granos-de-elote' || t.name?.toLowerCase().includes('elote'))) {
      SALAD_OPTIONS.toppings.splice(1, 0, { id: 'granos-de-elote', name: 'Granos de Elote' });
    }
  }

  // ── Datos derivados del menú real para la landing ──
  const isSaladProduct = (p: any) => p?.category === 'ensaladas' || p?.category === '299824bb-ede2-47ed-bf0e-b5fd9548af73' || p?.name?.toLowerCase().includes('ensalada');
  const saladProduct: any = MENU_ITEMS.find((p: any) => isSaladProduct(p)) || null;
  const saladPrices: Record<string, number> = saladProduct?.prices || {};
  const saladFrom = saladProduct
    ? (Object.values(saladPrices).length ? Math.min(...(Object.values(saladPrices) as number[])) : saladProduct.price)
    : 95;
  const sizeEntries = Object.entries(saladPrices) as [string, number][];
  const favorites: any[] = CATEGORIES.flatMap((c: any) => {
    const its = MENU_ITEMS.filter((i: any) => i.category === c.id && i.image)
      .sort((a: any, b: any) => (cutoutFor(b.image) ? 1 : 0) - (cutoutFor(a.image) ? 1 : 0));
    return its.slice(0, isSaladProduct(its[0]) ? 1 : 2);
  }).slice(0, 8);
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = calculateSubtotal();
  const estPoints = Math.floor(cartTotal * 0.03);
  const imageFor = (id: string) => (MENU_ITEMS.find((m: any) => m.id === id) as any)?.image as string | undefined;
  const bandWords: string[] = CATEGORIES.length
    ? CATEGORIES.map((c: any) => c.name)
    : ['Ensaladas', 'Jugos', 'Smoothies', 'Bowls', 'Wraps y Sándwiches'];
  const TIERS = [
    { name: 'Estándar', pts: 0 },
    { name: 'Plata', pts: 40 },
    { name: 'Oro', pts: 90 },
    { name: 'Diamante', pts: 140 },
  ];

  const renderWords = (text: string, className = '') => (
    <p className={className} data-words="" data-split="1">
      {text.split(' ').map((w, i) => (
        <React.Fragment key={i}>
          <span className="ed-w">{w}</span>{' '}
        </React.Fragment>
      ))}
    </p>
  );

  const renderFigure = (product: any, priority = false) => {
    const cut = cutoutFor(product.image);
    return cut ? (
      <div className="ed-fig ed-fig--cut" data-img={cut.split('/').pop()?.replace('.webp', '')}>
        <span className="ed-fig-disc" />
        <img src={cut} alt={product.name} loading={priority ? 'eager' : 'lazy'} />
      </div>
    ) : (
      <div className="ed-fig ed-fig--photo">
        <ProductImage src={product.image} alt={product.name} className="product-img" priority={priority} />
      </div>
    );
  };

  return (
    <div className="ed-site">
      <SiteNav
        active={activeNav}
        cartCount={cartCount}
        onCart={() => setIsCartOpen(true)}
        onNavigate={navigate}
        categories={CATEGORIES.map((c: any) => ({ id: c.id, name: c.name }))}
        onCategory={(id) => goToCategory(id)}
      />

      {/* ═════════════ HERO ═════════════ */}
      <section id="inicio" className="ed-hero" data-progress="exit">
        <div className="ed-hero-bg" />
        <LeafShadows />
        <div className="ed-hero-leaves" aria-hidden="true">
          <Monstera v={0} className="ed-hleaf hl1" />
          <Monstera v={2} className="ed-hleaf hl2" />
          <Monstera v={1} className="ed-hleaf hl3" />
          <Monstera v={0} className="ed-hleaf hl4" />
        </div>

        <div className="ed-hero-grid">
          <div className="ed-hero-copy">
            <h1 className="ed-hero-title">
              <EdenMark animated />
            </h1>
            <div className="ed-in ed-hero-tagwrap" style={{ ['--d' as string]: '0.9s' } as React.CSSProperties}>
              <Tagline className="ed-hero-tag" />
            </div>
            <p className="ed-hero-lead ed-in" style={{ ['--d' as string]: '1s' } as React.CSSProperties}>
              Ensaladas que armas a tu gusto, jugos naturales y bowls para empezar bien el día. Pide en línea y recoge, come aquí o recíbelo en casa.
            </p>
            <div className="ed-hero-ctas ed-in" style={{ ['--d' as string]: '1.1s' } as React.CSSProperties}>
              <button className="ed-btn ed-btn--solid" onClick={() => navigate('menu')}>
                <span>Ordenar ahora</span>
                <ArrowRight size={18} />
              </button>
              <button className="ed-btn ed-btn--ghost" onClick={() => navigate('arma')}>
                <span>Arma tu ensalada</span>
              </button>
            </div>
            <ul className="ed-hero-services ed-in" style={{ ['--d' as string]: '1.2s' } as React.CSSProperties}>
              <li><ShoppingBag size={15} /> Recoger</li>
              <li><Utensils size={15} /> Comer aquí</li>
              <li><Bike size={15} /> Envío</li>
            </ul>
          </div>

          <div className="ed-hero-stage">
            <div className="ed-stage-disc" />
            <svg className="ed-stage-ring" viewBox="0 0 200 200" aria-hidden="true">
              <defs>
                <path id="ed-ring-path" d="M100,100 m-86,0 a86,86 0 1,1 172,0 a86,86 0 1,1 -172,0" />
              </defs>
              <text>
                <textPath href="#ed-ring-path">LO ESENCIAL ES NATURAL • EDÉN • LO ESENCIAL ES NATURAL • EDÉN •</textPath>
              </text>
            </svg>
            <img className="ed-stage-main" src="/images/cut/ensalada.webp" alt="Ensalada Edén con pechuga empanizada, aguacate y jitomate cherry" />
            <img className="ed-float f1" src="/images/cut/jugo_natural.webp" alt="" aria-hidden="true" />
            <img className="ed-float f2" src="/images/cut/bowl_avena.webp" alt="" aria-hidden="true" />
            <img className="ed-float f3" src="/images/cut/smoothie_clasico.webp" alt="" aria-hidden="true" />
            <button className="ed-burst" onClick={() => saladProduct ? handleAddToCartClick(saladProduct) : navigate('menu')} aria-label={`Ensaladas desde $${saladFrom}`}>
              <span>Desde</span>
              <b>${saladFrom}</b>
            </button>
          </div>
        </div>

        <div className="ed-hero-foot">
          <button className="ed-scroll-cue" onClick={() => jumpTo('esencia', 0)}>
            <span className="ed-scroll-line" /> Desliza
          </button>
        </div>
      </section>

      {/* ═════════════ BANDAS ═════════════ */}
      <div className="ed-bands" aria-hidden="true">
        <div className="ed-band ed-band--a">
          <div className="ed-band-track">
            {[0, 1].map((k) => (
              <div className="ed-band-seq" key={k}>
                {bandWords.concat(bandWords).map((w, i) => (
                  <span key={i}>{w} <i>✦</i></span>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="ed-band ed-band--b">
          <div className="ed-band-track">
            {[0, 1].map((k) => (
              <div className="ed-band-seq" key={k}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <span key={i}>Lo esencial es natural <i>✦</i></span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═════════════ ESENCIA ═════════════ */}
      <section id="esencia" className="ed-essence" data-progress="">
        <svg className="ed-essence-leaf" viewBox="520 450 690 660" aria-hidden="true">
          <path d={MARK_LEAF} />
        </svg>
        <div className="ed-wrap">
          <div className="ed-eyebrow" data-reveal="">Nuestra esencia</div>
          {renderWords('En Edén comer bien no tiene que ser complicado: ingredientes frescos, recetas hechas al momento y un lugar con higiene, orden y sabor artesanal.', 'ed-essence-text')}
          <div className="ed-pillars">
            {[
              { n: '01', t: 'A tu manera', d: 'Tú eliges proteína, toppings, semillas y aderezo. Nosotros la armamos al momento.', img: '/images/cut/ensalada.webp' },
              { n: '02', t: 'Jugos naturales', d: 'Naranja, mandarina, sandía, verde y más. Combina dos frutas en un jugo mixto.', img: '/images/cut/jugo_mixto.webp' },
              { n: '03', t: 'Para todo el día', d: 'Bowls de avena y yogurt, wraps, sándwiches y smoothies para cualquier antojo.', img: '/images/cut/hotcakes.webp' },
            ].map((p, i) => (
              <article key={p.n} className="ed-pillar" data-reveal="" style={{ ['--i' as string]: i } as React.CSSProperties}>
                <span className="ed-pillar-n">{p.n}</span>
                <h3>{p.t}</h3>
                <p>{p.d}</p>
                <img src={p.img} alt="" aria-hidden="true" loading="lazy" />
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ═════════════ ARMA TU ENSALADA ═════════════ */}
      <section id="arma" className="ed-build">
        <LeafShadows className="ed-shadows--soft" />
        <div className="ed-wrap ed-build-grid">
          <div className="ed-build-intro">
            <div className="ed-eyebrow" data-reveal="">Tú ensalada, tú estilo</div>
            <h2 className="ed-h2" data-reveal="">Arma tu<br /><em>ensalada</em></h2>
            <p className="ed-lead" data-reveal="">Elige el tamaño y combina a tu gusto. Si quieres más, cada extra se suma al momento.</p>
            <div className="ed-sizes" data-reveal="">
              {(sizeEntries.length ? sizeEntries : [['Chica', 95], ['Grande', 150]] as [string, number][]).map(([size, price]) => {
                const big = /grand/i.test(size);
                return (
                  <div key={size} className={`ed-size ${big ? 'is-big' : ''}`}>
                    <div className="ed-size-top">
                      <span className="ed-size-name">{size}</span>
                      <span className="ed-size-price">${price}</span>
                    </div>
                    <ul>
                      <li>{big ? '2 proteínas' : '1 proteína'}</li>
                      <li>Base de lechuga</li>
                      <li>{big ? '6 toppings' : '4 toppings'}</li>
                      <li>{big ? '4 semillas o frutos secos' : '2 semillas o frutos secos'}</li>
                      <li>Aderezo a elegir</li>
                    </ul>
                  </div>
                );
              })}
            </div>
            <div className="ed-extras" data-reveal="">
              <span>Extras</span> Proteína +$30 · Topping +$15 · Aderezo +$15 · Frutos secos +$15
            </div>
            <button
              className="ed-btn ed-btn--solid ed-build-cta"
              data-reveal=""
              onClick={() => (saladProduct ? handleAddToCartClick(saladProduct) : navigate('menu'))}
            >
              <span>Crear mi ensalada</span>
              <ArrowRight size={18} />
            </button>
          </div>

          <div className="ed-steps">
            {[
              { n: '01', t: 'Proteína', list: SALAD_OPTIONS?.proteins || [], img: '/images/cut/ensalada.webp' },
              { n: '02', t: 'Toppings', list: (SALAD_OPTIONS?.toppings || []).filter((t: any) => !/pl[aá]tano/i.test(t.name)), img: '/images/cut/coctel.webp' },
              { n: '03', t: 'Semillas y frutos secos', list: SALAD_OPTIONS?.seedsAndNuts || [], img: '/images/cut/yogurt.webp' },
              { n: '04', t: 'Aderezo', list: SALAD_OPTIONS?.dressings || [], img: '/images/cut/rafaello.webp' },
            ].map((s, i) => (
              <article key={s.n} className="ed-step" style={{ ['--i' as string]: i } as React.CSSProperties}>
                <div className="ed-step-head">
                  <span className="ed-step-n">{s.n}</span>
                  <h3>{s.t}</h3>
                </div>
                <div className="ed-step-chips">
                  {s.list.length
                    ? s.list.map((o: any) => (
                        <span key={o.id} className={o.disabled ? 'is-off' : ''}>{o.name.replace(/\s*\(Agotado\)/i, '')}</span>
                      ))
                    : Array.from({ length: 6 }).map((_, k) => <span key={k} className="is-skel">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>)}
                </div>
                <img className="ed-step-img" src={s.img} alt="" aria-hidden="true" loading="lazy" />
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ═════════════ FAVORITOS (carrusel anclado) ═════════════ */}
      {favorites.length > 0 && (
        <section id="favoritos" className="ed-favs" data-progress="pin" style={{ ['--n' as string]: favorites.length } as React.CSSProperties}>
          <div className="ed-favs-sticky">
            <div className="ed-wrap ed-favs-head">
              <h2 className="ed-h2 ed-h2--light">Favoritos<br /><em>de la casa</em></h2>
              <p>Una probadita de cada categoría. Desliza y agrégalos directo a tu pedido.</p>
            </div>
            <div className="ed-rail">
              {favorites.map((p: any, i: number) => {
                const cat = CATEGORIES.find((c: any) => c.id === p.category);
                const from = p.prices ? Math.min(...(Object.values(p.prices) as number[])) : p.price;
                return (
                  <article key={p.id} className="ed-fav" style={{ ['--i' as string]: i } as React.CSSProperties}>
                    <span className="ed-fav-cat">{cat?.name}</span>
                    {renderFigure(p)}
                    <h3>{p.name}</h3>
                    {p.description && <p>{p.description}</p>}
                    <div className="ed-fav-foot">
                      <span className="ed-fav-price">{p.prices ? <small>desde</small> : null}${from}</span>
                      <button className="ed-add" onClick={() => handleAddToCartClick(p)} aria-label={`Agregar ${p.name}`}>
                        <Plus size={18} />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
            <div className="ed-favs-progress"><span /></div>
          </div>
        </section>
      )}

      {/* ═════════════ CIFRAS (del menú real) ═════════════ */}
      {menuData && (
        <div className="ed-wrap">
          <div className="ed-facts">
            <div className="ed-fact" data-reveal=""><b data-count={MENU_ITEMS.length}>{MENU_ITEMS.length}</b><span>opciones en el menú</span></div>
            <div className="ed-fact" data-reveal=""><b data-count={CATEGORIES.length}>{CATEGORIES.length}</b><span>categorías</span></div>
            <div className="ed-fact" data-reveal=""><b data-count={SALAD_OPTIONS?.dressings?.length || 0}>{SALAD_OPTIONS?.dressings?.length || 0}</b><span>aderezos para tu ensalada</span></div>
            <div className="ed-fact" data-reveal=""><b data-count={saladFrom} data-prefix="$">${saladFrom}</b><span>ensaladas desde</span></div>
          </div>
        </div>
      )}

      {/* ═════════════ MENÚ COMPLETO ═════════════ */}
      <section id="menu" className="ed-menu">
        <div className="ed-wrap ed-menu-head">
          <div className="ed-eyebrow" data-reveal="">¿Ya se te antojó?</div>
          <h2 className="ed-menu-title" data-progress="">
            <span>Menú</span>
          </h2>
          <p className="ed-menu-note">
            <Info size={15} /> Fotografías e imágenes de referencia y con fines ilustrativos.
          </p>
        </div>

        {/* Barra de categorías fija */}
        <nav className={`ed-cats ${isNavVisible ? '' : 'is-top'}`} aria-label="Categorías del menú">
          <ul className="ed-cats-list">
            {CATEGORIES.map((category: any) => (
              <li key={category.id}>
                <button
                  className={`ed-cat ${activeCategory === category.id ? 'is-active' : ''}`}
                  data-category={category.id}
                  onClick={() => goToCategory(category.id, false)}
                >
                  <span className="ed-cat-ico">{getCategoryIcon(category.name)}</span>
                  <span>{category.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ed-wrap">
          {!menuData && (
            <div className="ed-grid">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="ed-card is-skel">
                  <div className="ed-fig" />
                  <div className="ed-card-body"><span /><span /><span /></div>
                </div>
              ))}
            </div>
          )}

          {CATEGORIES.map((cat: any, catIdx: number) => {
            const items = MENU_ITEMS.filter((item: any) => item.category === cat.id);
            if (items.length === 0) return null;
            const isBottled = cat.id === 'embotellada' || cat.name?.toLowerCase().includes('embotellad');

            return (
              <section key={cat.id} id={`section-${cat.id}`} className="menu-section ed-msec">
                <div className="ed-msec-head" data-reveal="">
                  <span className="ed-msec-n">{String(catIdx + 1).padStart(2, '0')}</span>
                  <h3 className="ed-msec-title">{cat.name}</h3>
                  <span className="ed-msec-line" />
                  <span className="ed-msec-count">{items.length} {items.length === 1 ? 'opción' : 'opciones'}</span>
                </div>

                {isBottled ? (
                  <div className="ed-bottled">
                    {items.map((product: any, idx: number) => (
                      <div key={product.id} className="ed-bottle" data-reveal="" style={{ ['--i' as string]: idx % 3 } as React.CSSProperties}>
                        <div>
                          <h4>{product.name}</h4>
                          {product.description && <p>{product.description}</p>}
                        </div>
                        <div className="ed-bottle-act">
                          <span>${product.price}</span>
                          <button className="ed-add" onClick={() => handleAddToCartClick(product)} aria-label={`Agregar ${product.name}`}>
                            <Plus size={18} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="ed-grid">
                    {items.map((product: any, itemIdx: number) => {
                      const isSaladItem = isSaladProduct(product) || cat.id === 'ensaladas' || cat.name?.toLowerCase().includes('ensalada');
                      const lowerName = (product.name || '').toLowerCase();
                      let badge: { text: string; icon: React.ReactNode } | null = null;
                      if (lowerName.includes('edén') || lowerName.includes('eden')) badge = { text: 'Receta de la casa', icon: <Crown size={13} /> };
                      else if (itemIdx === 0) badge = isSaladItem ? { text: 'Favorito del chef', icon: <ChefHat size={13} /> } : { text: 'Destacado Edén', icon: <Sparkles size={13} /> };
                      else if (lowerName.includes('verde') || lowerName.includes('detox')) badge = { text: 'Detox natural', icon: <Leaf size={13} /> };

                      return (
                        <article
                          key={product.id}
                          className={`ed-card ${itemIdx === 0 && items.length > 2 ? 'is-feature' : ''}`}
                          data-reveal=""
                          style={{ ['--i' as string]: itemIdx % 3 } as React.CSSProperties}
                        >
                          <button className="ed-card-media" onClick={() => handleAddToCartClick(product)} aria-label={`${isSaladItem ? 'Crear' : 'Agregar'} ${product.name}`}>
                            {renderFigure(product, catIdx === 0 && itemIdx < 3)}
                            {badge && (
                              <span className="ed-badge">{badge.icon}<span>{badge.text}</span></span>
                            )}
                          </button>
                          <div className="ed-card-body">
                            <h4 className="ed-card-name">{product.name}</h4>
                            {product.description && <p className="ed-card-desc">{product.description}</p>}
                            <div className="ed-card-foot">
                              {product.prices ? (
                                <div className="ed-prices">
                                  {Object.entries(product.prices).map(([sizeName, priceVal]) => (
                                    <span key={sizeName}><small>{sizeName}</small>${priceVal as number}</span>
                                  ))}
                                </div>
                              ) : (
                                <span className="ed-price">${product.price}</span>
                              )}
                              <button className="ed-btn ed-btn--sm" onClick={() => handleAddToCartClick(product)}>
                                <Plus size={16} />
                                <span>{isSaladItem ? 'Crear' : product.customizable ? 'Personalizar' : 'Agregar'}</span>
                              </button>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </section>

      {/* ═════════════ EDÉN PASS ═════════════ */}
      <section id="pass" className="ed-pass" data-progress="">
        <Monstera v={2} className="ed-pass-leaf" />
        <div className="ed-wrap ed-pass-grid">
          <div className="ed-pass-copy">
            <div className="ed-eyebrow ed-eyebrow--gold" data-reveal="">Programa de lealtad</div>
            <h2 className="ed-h2 ed-h2--light" data-reveal="">Edén <em>Pass</em></h2>
            <p className="ed-lead ed-lead--light" data-reveal="">
              Tu credencial de socio. Cada pedido suma puntos y los canjeas por recompensas mostrando tu QR en caja.
            </p>
            <ol className="ed-pass-how" data-reveal="">
              <li><b>1</b><span>Pide en línea o en mostrador con tu número</span></li>
              <li><b>2</b><span>Acumula 3 puntos por cada $100 de compra</span></li>
              <li><b>3</b><span>Sube de nivel y desbloquea premios</span></li>
            </ol>
            <div className="ed-tiers" data-reveal="">
              {TIERS.map((t, i) => (
                <div key={t.name} className={`ed-tier t${i}`}>
                  <span className="ed-tier-gem" />
                  <b>{t.name}</b>
                  <small>{t.pts === 0 ? 'Al unirte' : `${t.pts} pts`}</small>
                </div>
              ))}
            </div>
            <button className="ed-btn ed-btn--gold" data-reveal="" onClick={() => navigate('perfil')}>
              <span>{isAuthenticated ? 'Ver mi Edén Pass' : 'Activar mi Edén Pass'}</span>
              <ArrowRight size={18} />
            </button>
          </div>

          <div className="ed-pass-card-wrap" data-reveal="">
            <div
              className="ed-pass-card"
              onPointerMove={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                e.currentTarget.style.setProperty('--rx', `${((e.clientY - r.top) / r.height - 0.5) * -14}deg`);
                e.currentTarget.style.setProperty('--ry', `${((e.clientX - r.left) / r.width - 0.5) * 18}deg`);
              }}
              onPointerLeave={(e) => {
                e.currentTarget.style.setProperty('--rx', '0deg');
                e.currentTarget.style.setProperty('--ry', '0deg');
              }}
            >
              <span className="ed-pass-sheen" />
              <div className="ed-pass-card-top">
                <EdenMark leaf={false} className="ed-pass-mark" />
                <span className="ed-pass-chip"><Crown size={13} /> Socio</span>
              </div>
              <div className="ed-pass-card-mid">
                <div className="ed-pass-qr" aria-hidden="true">
                  <QRCodeSVG value="Edén · Lo esencial es natural" size={120} level="L" bgColor="transparent" fgColor="#112217" style={{ width: '100%', height: '100%' }} />
                </div>
                <div>
                  <small>Edén Pass</small>
                  <b>{isAuthenticated && customerName ? customerName : 'Tu nombre aquí'}</b>
                  <span>QR dinámico en tu perfil</span>
                </div>
              </div>
              <div className="ed-pass-card-foot">
                <span>Lo esencial es natural</span>
                <span>Otumba · Edo. Méx.</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═════════════ RIFA ═════════════ */}
      <div className="ed-wrap">
        <Link href="/rifa" className="ed-raffle" data-reveal="" aria-label="Ver dinámica de la rifa de vuelos en globo"
          onClick={(e) => { if (!e.metaKey && !e.ctrlKey) { e.preventDefault(); navigate('rifa'); } }}>
          <div className="ed-raffle-balloon"><BalloonIcon size={64} /></div>
          <div className="ed-raffle-text">
            <span className="ed-eyebrow">Dinámica especial</span>
            <h3>Gana un vuelo en globo para dos personas</h3>
            <p>Compra $200 o más = 1 oportunidad para ganar</p>
          </div>
          <span className="ed-raffle-go"><ArrowRight size={22} /></span>
        </Link>
      </div>

      {/* ═════════════ AYUDA ═════════════ */}
      <div className="ed-wrap">
        <section className="ed-help" data-reveal="">
          <div>
            <h3>¿Tienes algún problema o duda con tu pedido?</h3>
            <p>Escríbenos directamente a WhatsApp y te atenderemos con mucho gusto.</p>
          </div>
          <a href="https://wa.me/525635830014" target="_blank" rel="noopener noreferrer" className="ed-btn ed-btn--wa">
            <MessageSquare size={18} />
            <span>WhatsApp</span>
          </a>
        </section>
      </div>

      {/* ═════════════ FOOTER ═════════════ */}
      <footer className="ed-footer">
        <div className="ed-wrap">
          <EdenMark className="ed-footer-mark" />
          <Tagline className="ed-footer-tag" />
          <div className="ed-footer-row">
            <p>Higiene, orden y sabor artesanal en Otumba, Estado de México.</p>
            <div className="ed-footer-social">
              <a href="https://www.instagram.com/edenensaladas?igsh=OHZpZGFsZm5vc2hk" target="_blank" rel="noopener noreferrer" aria-label="Instagram de Edén">Instagram</a>
              <a href="https://www.facebook.com/share/18cVG24wEM/?mibextid=wwXIfr" target="_blank" rel="noopener noreferrer" aria-label="Facebook de Edén">Facebook</a>
              <a href="https://wa.me/525635830014" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp de Edén">WhatsApp</a>
            </div>
          </div>
          <div className="ed-footer-base">
            <span>© 2026 Edén. Todos los derechos reservados.</span>
            <a href="https://hummingxbi.com" target="_blank" rel="noopener noreferrer" className="ed-credit">
              <span>Powered by</span>
              <img src="/images/logoclaro.webp" alt="HummingX BI" />
            </a>
          </div>
        </div>
      </footer>
      {/* CUSTOMIZER MODAL */}
      {selectedProduct && (
        <div className="modal-overlay ed-sheet-overlay" onClick={() => setSelectedProduct(null)}>
          <div className="modal-content ed-sheet" onClick={e => e.stopPropagation()}>
            <span className="ed-cart-grab" aria-hidden="true" />
            <div className="modal-header">
              <div className="ed-sheet-thumb" aria-hidden="true">
                {cutoutFor(selectedProduct.image) ? <img src={cutoutFor(selectedProduct.image) as string} alt="" /> : selectedProduct.image ? <img src={selectedProduct.image} alt="" className="is-photo" /> : null}
              </div>
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
                          <label key={topping.id} className="option-card-label" style={{ opacity: topping.disabled ? 0.5 : 1, cursor: topping.disabled ? 'not-allowed' : 'pointer' }}>
                            <input
                              type="checkbox"
                              className="option-card-input"
                              checked={selectedToppings.includes(topping.id)}
                              onChange={() => toggleOption(topping.id, selectedToppings, setSelectedToppings, constraints.toppings)}
                              disabled={topping.disabled}
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
                        <label key={topping.id} className="option-card-label" style={{ opacity: topping.disabled ? 0.5 : 1, cursor: topping.disabled ? 'not-allowed' : 'pointer' }}>
                          <input
                            type="checkbox"
                            className="option-card-input"
                            checked={selectedToppings.includes(topping.id)}
                            disabled={topping.disabled}
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
                  omissions = ['Sin cebolla', 'Sin aguacate', 'Sin mayonesa', 'Sin frijoles', 'Sin jitomate', 'Sin lechuga', 'Sin chile'];
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
        <div className="modal-overlay ed-cart-overlay" onClick={() => setIsCartOpen(false)}>
          <div className="cart-drawer ed-cart" onClick={e => e.stopPropagation()}>
            <span className="ed-cart-grab" aria-hidden="true" />
            <div className="ed-cart-head">
              <div>
                <span className="ed-eyebrow">Tu pedido</span>
                <h2>{cartCount > 0 ? `${cartCount} ${cartCount === 1 ? 'producto' : 'productos'}` : 'Carrito'}</h2>
              </div>
              <button className="ed-close" onClick={() => setIsCartOpen(false)} aria-label="Cerrar carrito">
                <X size={20} />
              </button>
            </div>

            {editingOrder && (
              <div className="ed-cart-edit">
                <div style={{ flex: 1, lineHeight: 1.35 }}>
                  <strong>Estás modificando tu pedido #{editingOrder.short}.</strong> Al confirmarlo, reemplazará al anterior.
                </div>
                <button onClick={discardOrderEdit}>Descartar cambios</button>
              </div>
            )}

            <div className="ed-cart-body">
              {cart.length === 0 ? (
                <div className="ed-cart-empty">
                  <div className="ed-cart-empty-art">
                    <Monstera v={0} className="ed-cart-empty-leaf" />
                    <img src="/images/cut/ensalada.webp" alt="" aria-hidden="true" />
                  </div>
                  <h3>Tu carrito está vacío</h3>
                  <p>Navega en el menú y agrega tus ensaladas o jugos favoritos.</p>
                  <button className="ed-btn ed-btn--solid" onClick={() => { setIsCartOpen(false); navigate('menu'); }}>
                    <span>Ver el menú</span>
                    <ArrowRight size={18} />
                  </button>
                </div>
              ) : (
                <ul className="ed-cart-list">
                  {cart.map((item: any) => {
                    const img = imageFor(item.id);
                    const cut = cutoutFor(img);
                    return (
                      <li key={item.cartId} className="ed-cart-item">
                        <div className="ed-cart-thumb">
                          {cut ? <img src={cut} alt="" /> : img ? <img src={img} alt="" className="is-photo" /> : <Utensils size={22} />}
                        </div>
                        <div className="ed-cart-info">
                          <div className="ed-cart-line">
                            <span className="ed-cart-name">{item.name} {item.size && <em>{item.size}</em>}</span>
                            <span className="ed-cart-price">${item.price * item.quantity}</span>
                          </div>

                          {item.customizations && (
                            <div className="ed-cart-custom">
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
                                    {omissions.length > 0 && <div className="is-omit"><strong>Exclusiones:</strong> {omissions.join(', ')}</div>}
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
                          {item.notes && <div className="ed-cart-note">“{item.notes}”</div>}

                          <div className="ed-qty">
                            <button onClick={() => updateQuantity(item.cartId, -1)} aria-label={item.quantity === 1 ? 'Quitar del carrito' : 'Quitar uno'}>
                              <Minus size={15} />
                            </button>
                            <span>{item.quantity}</span>
                            <button onClick={() => updateQuantity(item.cartId, 1)} aria-label="Agregar uno">
                              <Plus size={15} />
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {cart.length > 0 && (
              <div className="ed-cart-foot">
                <div className="ed-service">
                  <label className="ed-service-title">¿Dónde disfrutarás tu pedido?</label>
                  <div className={`ed-seg s-${serviceType}`}>
                    <span className="ed-seg-pill" aria-hidden="true" />
                    <button className={serviceType === 'pickup' ? 'is-on' : ''} onClick={() => setServiceType('pickup')} type="button">
                      <ShoppingBag size={17} />
                      <span>Recoger</span>
                    </button>
                    <button className={serviceType === 'dine_in' ? 'is-on' : ''} onClick={() => setServiceType('dine_in')} type="button">
                      <Utensils size={17} />
                      <span>Aquí</span>
                    </button>
                    <button className={serviceType === 'delivery' ? 'is-on' : ''} onClick={() => setServiceType('delivery')} type="button">
                      <Bike size={17} />
                      <span>Envío</span>
                    </button>
                  </div>

                  {serviceType === 'delivery' && (
                    <DeliveryAddressSelector
                      isAuthenticated={isAuthenticated}
                      confirmedAddress={deliveryAddress || null}
                      confirmedQuote={deliveryQuote}
                      onAddressConfirmed={({ address, lat, lng, quote }) => {
                        setDeliveryAddress(address);
                        setDeliveryCoords({ lat, lng });
                        setDeliveryQuote(quote);
                        setErrorMsg('');
                      }}
                      onClear={() => {
                        setDeliveryAddress('');
                        setDeliveryCoords(null);
                        setDeliveryQuote(null);
                      }}
                    />
                  )}
                </div>

                <div className="ed-cart-points">
                  <span className="ed-cart-points-ico"><Crown size={15} /></span>
                  <span>
                    Con este pedido sumas aprox. <b>{estPoints} {estPoints === 1 ? 'punto' : 'puntos'}</b> en tu Edén Pass
                  </span>
                </div>

                {errorMsg && !isAuthOpen && (
                  <div className="ed-cart-error">{errorMsg}</div>
                )}
                <div className="ed-cart-total">
                  <span>Total</span>
                  <b>${cartTotal}</b>
                </div>
                <button
                  className="checkout-btn ed-checkout"
                  onClick={() => {
                    if (serviceType === 'delivery' && !deliveryCoords) {
                      setErrorMsg('Por favor selecciona tu dirección de entrega y calcula el costo de envío.');
                      return;
                    }
                    if (serviceType === 'delivery' && !deliveryQuote?.in_range) {
                      setErrorMsg('La dirección seleccionada está fuera de nuestra zona de entrega.');
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
                <button className="ed-cart-more" onClick={() => setIsCartOpen(false)}>Seguir agregando</button>
              </div>
            )}
          </div>
        </div>
      )}
      {/* AUTH & MINI REGISTRATION MODAL */}
      {/* AUTH & MINI REGISTRATION MODAL (2-Step Compact Sheet) */}
      {isAuthOpen && (
        <div className="modal-overlay ed-auth-overlay" onClick={() => setIsAuthOpen(false)} style={{ overscrollBehavior: 'contain' }}>
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
                    disabled={isSendingSms}
                  >
                    <span>
                      {isSendingSms
                        ? 'Enviando código...'
                        : customerPhone.length === 10
                          ? `Enviar código a ${customerPhone.slice(0, 2)} ${customerPhone.slice(2, 6)} ${customerPhone.slice(6)}`
                          : 'Continuar al SMS'}
                    </span>
                    <ArrowRight size={18} />
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '6px' }}>
                  <div className="sms-code-container" style={{ margin: '8px auto 4px auto', display: 'flex', gap: '6px', justifyContent: 'center', width: '100%' }}>
                    {smsCode.map((digit, index) => (
                      <input
                        key={index}
                        id={`otp-input-${index}`}
                        type="text"
                        maxLength={1}
                        className="sms-code-input"
                        style={{ width: '40px', height: '46px', fontSize: '1.25rem', borderRadius: '12px', fontWeight: 700, textAlign: 'center' }}
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
                      disabled={resendCooldown > 0 || isSendingSms || resendCount >= MAX_RESENDS}
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
                        : resendCount >= MAX_RESENDS
                          ? 'Revisa tu número o intenta en unos minutos'
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
        <button
          className={`ed-active-order ${cart.length > 0 ? 'has-bar' : ''}`}
          onClick={() => router.push(`/orden/${activeOrders[0].id}`)}
        >
          <span className="pulse-dot ed-active-dot" />
          <span>Ver orden activa</span>
          <ChevronRight size={18} />
        </button>
      )}

      {/* BARRA FLOTANTE DEL CARRITO (móvil) */}
      {cart.length > 0 && !isCartOpen && !selectedProduct && !isAuthOpen && (
        <button className="ed-cartbar" onClick={() => setIsCartOpen(true)}>
          <span className="ed-cartbar-count">{cartCount}</span>
          <span className="ed-cartbar-label">Ver mi pedido</span>
          <span className="ed-cartbar-total">${cartTotal}</span>
        </button>
      )}
    </div>
  );
}

/** Intro de entrada (solo CSS: funciona desde el primer pintado y no bloquea la carga). */
function EdenIntro() {
  return (
    <div className="ed-intro" aria-hidden="true">
      <script
        dangerouslySetInnerHTML={{
          __html: "try{if(sessionStorage.getItem('eden_intro')){document.documentElement.classList.add('ed-seen')}else{sessionStorage.setItem('eden_intro','1')}}catch(e){}",
        }}
      />
      <EdenMark leaf={false} className="ed-intro-mark" />
      <span className="ed-intro-tag">Lo esencial es natural</span>
    </div>
  );
}

export default function MenuPage() {
  return (
    <>
      <EdenIntro />
      <React.Suspense fallback={<div className="ed-boot" />}>
        <MenuContent />
      </React.Suspense>
    </>
  );
}
