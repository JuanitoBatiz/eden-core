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
  Utensils
} from 'lucide-react';
import { MenuItem, MenuCategory, CATEGORIES as fallbackCategories, MENU_ITEMS as fallbackMenuItems, SALAD_OPTIONS as fallbackSaladOptions } from '@/lib/menuData';
import { SmsRequest, VerifyOtpRequest, OrderCreateRequest } from '@/types/api-contracts';
import ProductImage from '@/components/ProductImage';

// Helper local icon
function getCategoryIcon(name: string) {
  switch (name) {
    case 'Ensaladas': return <Salad size={20} />;
    case 'Jugos':
    case 'Jugos y Smoothies': return <CupSoda size={20} />;
    case 'Smoothies': return <CupSoda size={20} />;
    case 'Infusiones': return <Coffee size={20} />;
    case 'Wraps y Sándwiches': return <Sandwich size={20} />;
    case 'Bowls y Postres':
    case 'Bowls y Cocteles': return <Soup size={20} />;
    case 'Embotellados': return <GlassWater size={20} />;
    default: return null;
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
  const [selectedOmissions, setSelectedOmissions] = useState<string[]>([]);
  const [customNotes, setCustomNotes] = useState('');

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

  // Silent Auth Check on Mount
  useEffect(() => {
    fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
      .then(res => {
        if (res.ok) return res.json();
        throw new Error('No valid session');
      })
      .then(data => {
        if (data.success && data.user) {
          setIsAuthenticated(true);
          if (data.user.name) setCustomerName(data.user.name);
          if (data.user.phone) setCustomerPhone(data.user.phone);
        }
      })
      .catch(() => {
        // Not authenticated, do nothing
      });
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
        if (data.CATEGORIES?.length > 0) {
          setActiveCategory(data.CATEGORIES[0].id);
        }
      })
      .catch(err => {
        console.error('Menu fetch failed or timed out, loading fallback:', err);
        const fallback = {
          CATEGORIES: fallbackCategories,
          MENU_ITEMS: fallbackMenuItems,
          SALAD_OPTIONS: fallbackSaladOptions
        };
        setMenuData(fallback);
        if (fallback.CATEGORIES?.length > 0) {
          setActiveCategory(fallback.CATEGORIES[0].id);
        }
      });

    return () => clearTimeout(timeoutId);
  }, []);

  // Scroll direction listener to show/hide header unificado (instant response)
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
    setSelectedOmissions([]);
    setCustomNotes('');

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
    const price = selectedProduct.prices
      ? selectedProduct.prices[customSize]
      : selectedProduct.price;

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

    const itemPrice = price + extraPrice;

    const isSandwich = selectedProduct.id === 'sandwich-pavo' || selectedProduct.id === 'sandwich-pollo' || selectedProduct.name?.includes('Sándwich / Torta');

    // Construct customizable labels
    const customizations = {
      proteins: selectedProteins.map((p: any) => SALAD_OPTIONS.proteins.find((item: any) => item.id === p)?.name || p),
      toppings: selectedToppings.map((t: any) => SALAD_OPTIONS.toppings.find((item: any) => item.id === t)?.name || t),
      seedsAndNuts: selectedSeeds.map((s: any) => SALAD_OPTIONS.seedsAndNuts.find((item: any) => item.id === s)?.name || s),
      dressings: selectedDressings.map((d: any) => SALAD_OPTIONS.dressings.find((item: any) => item.id === d)?.name || d),
      extras: [
        ...selectedExtras,
        ...(isSandwich && selectedBread ? [selectedBread] : []),
        ...selectedOmissions
      ],
      flavors: selectedFlavors
    };

    const cartItem: CartItem = {
      cartId: selectedProduct.id + '_' + Date.now(),
      id: selectedProduct.id,
      name: selectedProduct.name,
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

      // Éxito: la cookie httpOnly ya está seteada, enviar orden directamente
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
        let errorText = "⚠️ Cambios en disponibilidad:\n";
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

  return (
    <>
      <div className={`sticky-header-container ${isNavVisible ? 'visible' : 'hidden'}`}>
        {/* HEADER */}
        <header className="header">
          <div className="container header-content">
            <div className="logo-container">
              <img src="logo.png" alt="Edén Logo" className="logo-img" />
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

      {/* MAIN CONTAINER */}
      <main className="container" style={{ paddingTop: '180px' }}>
        {/* HERO */}
        <section className="hero">
          <h1 className="hero-title">Deliciosa barra de ensaladas y jugos naturales</h1>
          <p className="hero-desc">
            Sabor natural y servicio ágil. Arma tu pedido en línea, acumula puntos con EdenPass y disfruta tu comida en sucursal o recíbela en la puerta de tu casa.
          </p>
          <p style={{ marginTop: '10px', fontSize: '0.8rem', color: 'var(--color-green-dark)', opacity: 0.65, fontStyle: 'italic', fontWeight: 500 }}>
            * Imágenes con fines ilustrativos y de referencia visual.
          </p>
        </section>

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
                  {items.map((product: any) => (
                    <div key={product.id} className="bottled-card">
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
                  ))}
                </div>
              ) : (
                <div className="products-grid">
                  {items.map((product: any) => {
                    const isSaladItem = cat.id === 'ensaladas' || cat.id === '299824bb-ede2-47ed-bf0e-b5fd9548af73' || cat.name?.toLowerCase().includes('ensalada') || product.category === 'ensaladas' || product.category === '299824bb-ede2-47ed-bf0e-b5fd9548af73' || product.name?.toLowerCase().includes('ensalada');
                    return (
                      <div key={product.id} className="product-card">
                        <div className="product-img-container">
                          <ProductImage src={product.image} alt={product.name} className="product-img" />
                        </div>
                        <div className="product-info">
                          <h3 className="product-name">{product.name}</h3>
                          {product.description && <p className="product-desc">{product.description}</p>}
                          <div className="product-footer">
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
                              <span className="product-price">${product.price}</span>
                            )}
                            <button className="add-btn" onClick={() => handleAddToCartClick(product)}>
                              <Plus size={16} />
                              <span>{isSaladItem ? 'Crea tu ensalada' : product.customizable ? 'Personalizar' : 'Agregar'}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </main>

      {/* FOOTER */}
      <footer style={{ backgroundColor: 'var(--color-green-dark)', color: 'var(--color-cream-light)', padding: '40px 0', marginTop: '60px', borderTop: '4px solid var(--color-ochre)' }}>
        <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px', textAlign: 'center' }}>
          <img src="/images/logo_eden2.png" alt="Edén Logo" style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: '#fff', padding: '5px' }} />
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
          </div>

          <div style={{ fontSize: '0.8rem', opacity: 0.6, marginTop: '15px' }}>
            © 2026 Edén. Todos los derechos reservados.
          </div>

          {/* WATERMARK */}
          <div style={{ marginTop: '30px', display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: 0.7, transition: 'opacity 0.3s', paddingBottom: '20px' }} onMouseOver={e => e.currentTarget.style.opacity = '1'} onMouseOut={e => e.currentTarget.style.opacity = '0.7'}>
            <a href="https://hummingxbi.com" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textDecoration: 'none', color: 'inherit' }}>
              <span style={{ fontSize: '0.7rem', letterSpacing: '2px', marginBottom: '8px', color: 'var(--color-cream-light)' }}> PRODUCED BY </span>
              <img src="/images/logoclaro.png" alt="HummingX BI" style={{ height: '26px', width: '26px', borderRadius: '50%', objectFit: 'cover' }} />
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
                <h2>{selectedProduct.name}</h2>
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
                    {Object.keys(selectedProduct.prices).map((size: any) => (
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
                          <span className="option-card-extra-price">${selectedProduct.prices?.[size]}</span>
                        </div>
                      </label>
                    ))}
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
                      {SALAD_OPTIONS.proteins.map((protein: any) => (
                        <label key={protein.id} className="option-card-label">
                          <input
                            type="checkbox"
                            className="option-card-input"
                            checked={selectedProteins.includes(protein.id)}
                            onChange={() => toggleOption(protein.id, selectedProteins, setSelectedProteins, constraints.proteins)}
                          />
                          <div className="option-card-content">
                            <span>{protein.name}</span>
                            {selectedProteins.length >= constraints.proteins && !selectedProteins.includes(protein.id) && (
                              <span className="option-card-extra-price">+$30</span>
                            )}
                          </div>
                        </label>
                      ))}
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
                      {SALAD_OPTIONS.toppings.map((topping: any) => (
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
              {selectedProduct.flavors && (
                <div className="option-group">
                  <div className="option-group-title">
                    <span>Sabor a elegir</span>
                    {selectedProduct.maxFlavors && selectedProduct.maxFlavors > 1 ? (
                      <span className="option-group-limit">Hasta {selectedProduct.maxFlavors} sabores</span>
                    ) : (
                      <span className="option-group-limit">Obligatorio</span>
                    )}
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '10px' }}>
                    {selectedProduct.maxFlavors && selectedProduct.maxFlavors > 1
                      ? `Elige hasta ${selectedProduct.maxFlavors} sabores combinados.`
                      : 'Selecciona el sabor para tu bebida.'}
                  </p>
                  <div className="option-grid">
                    {selectedProduct.flavors.map((flavor: any) => {
                      const isChecked = selectedFlavors.includes(flavor);
                      return (
                        <label key={flavor} className="option-card-label">
                          <input
                            type={selectedProduct.maxFlavors && selectedProduct.maxFlavors > 1 ? "checkbox" : "radio"}
                            name="flavor"
                            className="option-card-input"
                            checked={isChecked}
                            onChange={() => {
                              const max = selectedProduct.maxFlavors || 1;
                              if (isChecked) {
                                setSelectedFlavors(selectedFlavors.filter((f: any) => f !== flavor));
                              } else {
                                if (max === 1) {
                                  setSelectedFlavors([flavor]);
                                } else if (selectedFlavors.length < max) {
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
              )}

              {/* Bread Selector for Sandwiches */}
              {(selectedProduct.id === 'sandwich-pavo' || selectedProduct.id === 'sandwich-pollo' || selectedProduct.name?.includes('Sándwich / Torta')) && (
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
                } else if (selectedProduct.id === 'sandwich-pavo' || selectedProduct.id === 'sandwich-pollo' || selectedProduct.name?.includes('Sándwich / Torta')) {
                  omissions = ['Sin cebolla', 'Sin aguacate', 'Sin mayonesa', 'Sin frijoles', 'Sin jitomate', 'Sin col', 'Sin chile'];
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
                  placeholder={
                    selectedProduct.category === 'jugos' ||
                      selectedProduct.category === 'smoothies' ||
                      selectedProduct.category === 'infusiones' ||
                      selectedProduct.category === 'embotellada'
                      ? "Ej: sin hielo, con popote, sin azúcar, etc..."
                      : "Ej: sin aderezo, aderezo aparte, sin cebolla, etc..."
                  }
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
                    const price = selectedProduct.prices ? selectedProduct.prices[customSize] : selectedProduct.price;
                    let extra = 0;
                    const isEnsalada = selectedProduct.category === 'ensaladas' || selectedProduct.category === '299824bb-ede2-47ed-bf0e-b5fd9548af73' || menuData?.CATEGORIES?.find((c: any) => c.id === selectedProduct.category)?.name === 'Ensaladas' || selectedProduct.name?.toLowerCase().includes('ensalada');
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
                  <div className="cart-empty-icon">🥗</div>
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
                            {item.customizations.proteins.length > 0 && (
                              <div><strong>Proteínas:</strong> {item.customizations.proteins.join(', ')}</div>
                            )}
                            {item.customizations.toppings.length > 0 && (
                              <div><strong>Toppings:</strong> {item.customizations.toppings.join(', ')}</div>
                            )}
                            {item.customizations.seedsAndNuts.length > 0 && (
                              <div><strong>Semillas/Frutos:</strong> {item.customizations.seedsAndNuts.join(', ')}</div>
                            )}
                            {item.customizations.dressings.length > 0 && (
                              <div><strong>Aderezo:</strong> {item.customizations.dressings.join(', ')}</div>
                            )}
                            {item.customizations.flavors && item.customizations.flavors.length > 0 && (
                              <div><strong>Sabor:</strong> {item.customizations.flavors.join(', ')}</div>
                            )}
                            {item.customizations.extras && item.customizations.extras.length > 0 && (
                              <div><strong>Opciones:</strong> {item.customizations.extras.join(', ')}</div>
                            )}
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
                      <span>Llevar</span>
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
      {isAuthOpen && (
        <div className="modal-overlay" onClick={() => setIsAuthOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '460px', padding: '32px 28px', borderRadius: '28px', border: '2px solid rgba(212, 163, 115, 0.3)', boxShadow: '0 24px 48px rgba(34, 60, 43, 0.12)' }}>
            <div className="modal-header" style={{ borderBottom: 'none', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '14px', background: 'linear-gradient(135deg, var(--color-green-dark) 0%, #15261b 100%)', color: 'var(--color-ochre)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 16px rgba(34, 60, 43, 0.2)' }}>
                  <Sparkles size={22} />
                </div>
                <div>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '2.5px', color: 'var(--color-terracotta)', textTransform: 'uppercase', display: 'block' }}>EDENPASS INSTITUCIONAL</span>
                  <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.65rem', color: 'var(--color-green-dark)', margin: 0, fontWeight: 700 }}>Tu Orden en Cocina</h2>
                </div>
              </div>
              <button className="close-btn" onClick={() => setIsAuthOpen(false)} style={{ backgroundColor: 'rgba(0,0,0,0.04)', borderRadius: '50%', width: '36px', height: '36px' }}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body" style={{ paddingTop: '8px' }}>
              <p style={{ fontSize: '0.94rem', color: 'var(--color-text-main)', opacity: 0.85, lineHeight: 1.55, marginBottom: '22px' }}>
                Verifica tu número para enlazar tu pedido con la comanda de cocina y acumular recompensas reales.
              </p>

              {errorMsg && (
                <div style={{ backgroundColor: '#ffebee', color: '#c62828', padding: '12px', borderRadius: '10px', fontSize: '0.85rem', marginBottom: '15px', fontWeight: 600, whiteSpace: 'pre-wrap' }}>
                  {errorMsg}
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Nombre Completo</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ej. Brandon Chavez"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  disabled={smsSent}
                />
              </div>

              {!smsSent ? (
                <div className="form-group" style={{ marginTop: '15px' }}>
                  <label className="form-label">Número de Celular (EdenPass)</label>
                  <input
                    type="tel"
                    maxLength={10}
                    className="form-input"
                    placeholder="10 dígitos (ej. 6237591105)"
                    value={customerPhone}
                    onChange={e => setCustomerPhone(e.target.value.replace(/\D/g, ''))}
                  />

                  <button
                    className="checkout-btn"
                    style={{ marginTop: '20px' }}
                    onClick={handleSendSmsCode}
                  >
                    Enviar Código de Verificación
                  </button>
                </div>
              ) : (
                <div style={{ marginTop: '20px' }}>
                  <label className="form-label" style={{ textAlign: 'center', display: 'block' }}>Código de Verificación SMS</label>
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>
                    Enviamos un SMS al {customerPhone}
                  </p>

                  <div className="sms-code-container">
                    {smsCode.map((digit, index) => (
                      <input
                        key={index}
                        id={`otp-input-${index}`}
                        type="text"
                        maxLength={1}
                        className="sms-code-input"
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
                    <div className="sms-code-preview-banner">
                      <strong>📱 Modo de Desarrollo:</strong> Ingresa el código generado: <strong>{sentCode}</strong> o <strong>123456</strong>
                    </div>
                  )}

                  <button
                    className="checkout-btn"
                    style={{ marginTop: '20px' }}
                    disabled={isVerifying}
                    onClick={handleVerifySmsCode}
                  >
                    {isSubmittingOrder ? 'Procesando Pedido...' : 'Verificar y Enviar Orden'}
                  </button>

                  <button
                    style={{ background: 'none', border: 'none', color: 'var(--color-terracotta)', fontWeight: '600', display: 'block', margin: '15px auto 0 auto', cursor: 'pointer' }}
                    onClick={() => {
                      setSmsSent(false);
                      setSmsCode(['', '', '', '', '', '']);
                    }}
                  >
                    Regresar / Corregir Celular
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
