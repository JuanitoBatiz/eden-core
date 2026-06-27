// DEPRECATED: migrado a Supabase, ver /api/menu. 
// Eliminar tras confirmar estabilidad en producción.

export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number; // Base price or single price
  prices?: { [size: string]: number }; // For multi-size items
  image: string;
  category: string;
  customizable?: boolean;
  flavors?: string[];
  maxFlavors?: number;
}

export interface MenuCategory {
  id: string;
  name: string;
  icon: string;
}

export const CATEGORIES: MenuCategory[] = [
  { id: 'ensaladas', name: 'Ensaladas', icon: '🥗' },
  { id: 'jugos', name: 'Jugos y Smoothies', icon: '🍹' },
  { id: 'infusiones', name: 'Infusiones', icon: '🍵' },
  { id: 'burritos-sandwiches', name: 'Wraps y Sándwiches', icon: '🌯' },
  { id: 'bowls', name: 'Bowls y Cocteles', icon: '🥣' },
  { id: 'embotellada', name: 'Embotellados', icon: '🥤' }
];

export const SALAD_OPTIONS = {
  proteins: [
    { id: 'pechuga-asada', name: 'Pechuga Asada' },
    { id: 'pechuga-empanizada', name: 'Pechuga Empanizada' },
    { id: 'atun', name: 'Atún' },
    { id: 'huevo-duro', name: 'Huevo Duro' }
  ],
  toppings: [
    { id: 'mango', name: 'Mango' },
    { id: 'uva', name: 'Uva' },
    { id: 'crutones', name: 'Crutones' },
    { id: 'fresa', name: 'Fresa' },
    { id: 'frambuesa', name: 'Frambuesa' },
    { id: 'platano', name: 'Plátano' },
    { id: 'blueberry', name: 'Blueberry' },
    { id: 'tomate-cherry', name: 'Tomate Cherry' },
    { id: 'queso-panela', name: 'Queso Panela' },
    { id: 'vegetales-hervidos', name: 'Brócoli y Zanahoria Hervida' },
    { id: 'pasta', name: 'Pasta' },
    { id: 'pina', name: 'Piña' },
    { id: 'kiwi', name: 'Kiwi' }
  ],
  seedsAndNuts: [
    { id: 'almendra', name: 'Almendra' },
    { id: 'pasas', name: 'Pasas' },
    { id: 'nuez', name: 'Nuez' },
    { id: 'coco-rayado', name: 'Coco Rayado' },
    { id: 'arandano', name: 'Arándano' },
    { id: 'semillas-girasol', name: 'Semillas de Girasol' },
    { id: 'granola', name: 'Granola' },
    { id: 'chia', name: 'Chía' }
  ],
  dressings: [
    { id: 'mostaza-miel', name: 'Mostaza Miel' },
    { id: 'cilantro', name: 'Cilantro' },
    { id: 'chipotle', name: 'Chipotle' },
    { id: 'miel', name: 'Miel' },
    { id: 'bbq', name: 'BBQ' },
    { id: 'ranch', name: 'Ranch' },
    { id: 'mango-habanero', name: 'Mango Habanero' }
  ],
  extras: [
    { id: 'extra-topping', name: 'Topping Extra', price: 15 },
    { id: 'extra-protein', name: 'Proteína Extra', price: 30 },
    { id: 'extra-seed', name: 'Semillas/Frutos Secos Extra', price: 15 }
  ]
};

export const MENU_ITEMS: MenuItem[] = [
  // --- ENSALADAS ---
  {
    id: 'ensalada-chica',
    name: 'Ensalada Chica',
    description: 'Nuestra porción ideal. Una cama de hojas crujientes coronada con la proteína de tu elección, deliciosos toppings de temporada, semillas y tu aderezo favorito.',
    price: 95,
    image: '/images/salad_bowl.png',
    category: 'ensaladas',
    customizable: true
  },
  {
    id: 'ensalada-grande',
    name: 'Ensalada Grande',
    description: 'Para el antojo en serio. Abundante mix de vegetales frescos con doble porción de proteína, generosos toppings artesanales y nuestra selección de semillas tostadas.',
    price: 150,
    image: '/images/salad_bowl.png',
    category: 'ensaladas',
    customizable: true
  },

  // --- JUGOS ---
  {
    id: 'jugos-clasicos',
    name: 'Jugos Naturales',
    description: 'Exprimidos al momento para conservar todas sus vitaminas. Un boost de energía pura y refrescante con frutas selectas de temporada.',
    price: 70,
    prices: { 'Chico': 70, 'Grande': 80 },
    image: '/images/cold_pressed_juice.png',
    category: 'jugos',
    customizable: true,
    flavors: ['Mandarina', 'Naranja', 'Sandía', 'Verde', 'Pepino', 'Limonada']
  },
  {
    id: 'jugo-mixto',
    name: 'Jugo Mixto',
    description: 'Tu combinación perfecta. Fusionamos tus dos frutas favoritas en un jugo 100% natural, preparado al instante para refrescar tu día.',
    price: 80,
    prices: { 'Chico': 80, 'Grande': 90 },
    image: '/images/cold_pressed_juice.png',
    category: 'jugos',
    customizable: true,
    flavors: ['Mandarina', 'Naranja', 'Sandía', 'Piña', 'Mango', 'Plátano', 'Fresa', 'Kiwi'],
    maxFlavors: 2
  },
  {
    id: 'smoothies-deluxe',
    name: 'Smoothies Deluxe',
    description: 'Nuestra línea exótica. Textura extra cremosa y combinaciones únicas llenas de antioxidantes. El equilibrio perfecto entre salud y un sabor espectacular.',
    price: 80,
    prices: { 'Chico': 80, 'Grande': 90 },
    image: '/images/fruit_smoothie.png',
    category: 'jugos',
    customizable: true,
    flavors: ['Aguacate', 'Zanahoria', 'Mandarina', 'Piña', 'Carambola', 'Kiwi']
  },
  {
    id: 'smoothies-clasicos',
    name: 'Smoothies Clásicos',
    description: 'Los favoritos de siempre, preparados al punto de nieve con la fruta más fresca de la estación. Helados, dulces y naturalmente deliciosos.',
    price: 70,
    prices: { 'Chico': 70, 'Grande': 80 },
    image: '/images/fruit_smoothie.png',
    category: 'jugos',
    customizable: true,
    flavors: ['Mango', 'Sandía', 'Naranja', 'Plátano', 'Fresa']
  },

  // --- INFUSIONES ---
  {
    id: 'infusiones-premium',
    name: 'Infusión Premium',
    description: 'Tés helados y mezclas herbales preparadas artesanalmente. Refrescantes, aromáticas y el maridaje perfecto para tus alimentos.',
    price: 55,
    prices: { 'Chico': 55, 'Grande': 65 },
    image: '/images/cold_pressed_juice.png', // Fallback to glass or we can styled it beautifully
    category: 'infusiones',
    customizable: true,
    flavors: ['Negro-Durazno', 'Frutos rojos', 'Matcha-Sencha', 'Hierbabuena-Menta', 'Manzana-Canela', 'Manzanilla-Aloe Vera']
  },

  // --- WRAPS Y SANDWICHES ---
  {
    id: 'burrito-pollo',
    name: 'Burrito de Pollo',
    description: 'Un envuelto calientito y saciador. Jugosa pechuga de pollo, cama de vegetales crujientes, frijolitos y un toque de nuestro aderezo chipotle de la casa.',
    price: 75,
    image: '/images/chicken_wrap.png',
    category: 'burritos-sandwiches'
  },
  {
    id: 'sandwich-pollo',
    name: 'Sándwich / Torta de Pollo',
    description: 'Clásico, reconfortante y lleno de sabor. Pollo perfectamente sazonado entre rebanadas de pan artesanal tostado, vegetales frescos y aderezo.',
    price: 75,
    image: '/images/chicken_wrap.png',
    category: 'burritos-sandwiches'
  },
  {
    id: 'sandwich-pavo',
    name: 'Sándwich / Torta de Jamón de Pavo',
    description: 'Ligero pero delicioso. Finas rebanadas de pavo premium con queso fundido y una cama de vegetales frescos en nuestro pan de la casa.',
    price: 65,
    image: '/images/chicken_wrap.png',
    category: 'burritos-sandwiches'
  },
  {
    id: 'rollito-pollo',
    name: 'Rollitos Vietnamitas de Pollo',
    description: 'Nuestra joya oriental. Frescos bocados envueltos en delicado papel de arroz, crujientes por dentro y perfectos para remojar en nuestra salsa secreta.',
    price: 95,
    image: '/images/chicken_wrap.png',
    category: 'burritos-sandwiches'
  },
  {
    id: 'rollito-tsurimi',
    name: 'Rollitos Vietnamitas de Tsurimi',
    description: 'Una experiencia fresca y exótica. Tsurimi desmenuzado con toques orientales, verduras crocantes y envueltos artesanalmente al momento.',
    price: 90,
    image: '/images/chicken_wrap.png',
    category: 'burritos-sandwiches'
  },

  // --- BOWLS ---
  {
    id: 'bowl-avena',
    name: 'Bowl de Avena',
    description: 'El desayuno perfecto o postre sin culpa. Base de avena cremosa, endulzada naturalmente y coronada con fruta fresca y crujientes semillas a tu elección.',
    price: 60,
    image: '/images/salad_bowl.png',
    category: 'bowls',
    customizable: true
  },
  {
    id: 'bowl-yogurt',
    name: 'Bowl de Yogurt',
    description: 'Cremoso, fresco y lleno de probióticos. Una base de yogurt natural acompañada de la mejor selección de frutas de temporada y semillas tostadas.',
    price: 55,
    image: '/images/salad_bowl.png',
    category: 'bowls',
    customizable: true
  },
  {
    id: 'coctel-fruta',
    name: 'Cóctel de Frutas',
    description: 'La frescura de la estación en un solo plato. Fruta recién picada, naturalmente dulce y perfecta para un antojo ligero a cualquier hora.',
    price: 65,
    image: '/images/salad_bowl.png',
    category: 'bowls'
  },

  // --- EMBOTELLADOS ---
  {
    id: 'agua-botella',
    name: 'Botella de Agua 600ml',
    price: 20,
    image: '/images/cold_pressed_juice.png',
    category: 'embotellada'
  },
  {
    id: 'electrolit',
    name: 'Electrolit',
    price: 25,
    image: '/images/cold_pressed_juice.png',
    category: 'embotellada',
    customizable: true,
    flavors: ['Coco', 'Uva', 'Fresa', 'Mora Azul', 'Limón']
  },
  {
    id: 'refresco-cero',
    name: 'Refresco Cero Azúcar',
    price: 25,
    image: '/images/cold_pressed_juice.png',
    category: 'embotellada',
    customizable: true,
    flavors: ['Coca-Cola Sin Azúcar', 'Sprite Zero', 'Sidral Mundet Sin Azúcar']
  }
];
