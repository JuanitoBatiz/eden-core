// DEPRECATED: migrado a Supabase, ver /api/menu. 
// Eliminar tras confirmar estabilidad en producción.

export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number; // Base price or single price
  prices?: { [size: string]: number }; // For multi-size items
  image: string;
  image_orientation?: 'vertical' | 'horizontal' | 'square';
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
  { id: 'ensaladas', name: 'Ensaladas', icon: 'salad' },
  { id: 'burritos-sandwiches', name: 'Wraps y Sándwiches', icon: 'sandwich' },
  { id: 'jugos', name: 'Jugos', icon: 'juice' },
  { id: 'smoothies', name: 'Smoothies e Infusiones', icon: 'smoothie' },
  { id: 'bowls', name: 'Bowls y Postres', icon: 'bowl' },
  { id: 'embotellada', name: 'Embotellados', icon: 'bottle' }
];

export const SALAD_OPTIONS = {
  proteins: [
    { id: 'pechuga-asada', name: 'Pechuga Asada' },
    { id: 'pechuga-empanizada', name: 'Pechuga Empanizada' },
    { id: 'atun', name: 'Atún' },
    { id: 'huevo-duro', name: 'Huevo Duro' }
  ],
  toppings: [
    { id: 'aguacate', name: 'Aguacate' },
    { id: 'granos-de-elote', name: 'Granos de Elote' },
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
    id: 'ensalada',
    name: 'Ensalada',
    description: 'Nuestra deliciosa ensalada fresca. Una cama de hojas crujientes coronada con la proteína de tu elección, deliciosos toppings de temporada, semillas y tu aderezo favorito. Arma tu combinación perfecta en tamaño Chica o Grande.',
    price: 95,
    prices: { 'Chica': 95, 'Grande': 150 },
    image: '/images/ensalada.webp',
    image_orientation: 'square',
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
    image: '/images/jugo_natural.webp',
    image_orientation: 'vertical',
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
    image: '/images/jugo_mixto.webp',
    image_orientation: 'vertical',
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
    image: '/images/smoothie_deluxe.webp',
    image_orientation: 'vertical',
    category: 'smoothies',
    customizable: true,
    flavors: ['Aguacate', 'Zanahoria', 'Mandarina', 'Piña', 'Carambola', 'Kiwi']
  },
  {
    id: 'smoothies-clasicos',
    name: 'Smoothies Clásicos',
    description: 'Los favoritos de siempre, preparados al punto de nieve con la fruta más fresca de la estación. Helados, dulces y naturalmente deliciosos.',
    price: 70,
    prices: { 'Chico': 70, 'Grande': 80 },
    image: '/images/smoothie_clasico.webp',
    image_orientation: 'vertical',
    category: 'smoothies',
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
    image: '/images/infusion.webp',
    image_orientation: 'vertical',
    category: 'smoothies',
    customizable: true,
    flavors: ['Negro-Durazno', 'Frutos rojos', 'Matcha-Sencha', 'Hierbabuena-Menta', 'Manzana-Canela', 'Manzanilla-Aloe Vera']
  },

  // --- WRAPS Y SANDWICHES ---
  {
    id: 'burrito-pollo',
    name: 'Burrito de Pollo',
    description: 'Un envuelto calientito y saciador. Jugosa pechuga de pollo, cama de vegetales crujientes, frijolitos y un toque de nuestro aderezo chipotle de la casa.',
    price: 85,
    image: '/images/burrito.webp',
    image_orientation: 'horizontal',
    category: 'burritos-sandwiches',
    customizable: true
  },
  {
    id: 'sandwich',
    name: 'Sándwich',
    description: 'Sándwich en pan artesanal tostado con vegetales frescos y aderezo. Elige tu especialidad y tipo de pan.',
    price: 75,
    image: '/images/sandwich.webp',
    image_orientation: 'horizontal',
    category: 'burritos-sandwiches',
    customizable: true
  },
  {
    id: 'torta',
    name: 'Torta',
    description: 'Deliciosa torta calientita con queso fundido, vegetales frescos y aderezo. Elige tu especialidad.',
    price: 75,
    image: '/images/torta.webp',
    image_orientation: 'horizontal',
    category: 'burritos-sandwiches',
    customizable: true
  },
  {
    id: 'rollito-pollo',
    name: 'Rollitos Vietnamitas de Pollo',
    description: 'Orden de 2 rollitos. Nuestra joya oriental. Frescos bocados envueltos en delicado papel de arroz, crujientes por dentro y perfectos para remojar en nuestra salsa secreta.',
    price: 95,
    image: '/images/rollito1.webp',
    image_orientation: 'horizontal',
    category: 'burritos-sandwiches',
    customizable: true
  },
  {
    id: 'rollito-tsurimi',
    name: 'Rollitos Vietnamitas de Tsurimi',
    description: 'Orden de 2 rollitos. Una experiencia fresca y exótica. Tsurimi desmenuzado con toques orientales, verduras crocantes y envueltos artesanalmente al momento.',
    price: 90,
    image: '/images/rollito2.webp',
    image_orientation: 'horizontal',
    category: 'burritos-sandwiches',
    customizable: true
  },
  {
    id: 'rollito-mixto',
    name: 'Rollitos Vietnamitas Mixtos',
    description: 'Orden de 2 rollitos (uno de pollo y uno de tsurimi). Una combinación perfecta envuelta artesanalmente en delicado papel de arroz con verduras crocantes.',
    price: 95,
    image: '/images/rollito3.webp',
    image_orientation: 'horizontal',
    category: 'burritos-sandwiches',
    customizable: true
  },
  {
    id: 'ciabatta',
    name: 'Ciabatta',
    description: 'Sándwich artesanal en crujiente pan ciabatta horneado, relleno con ingredientes frescos de calidad premium.',
    price: 95,
    image: '/images/ciabatta.webp',
    image_orientation: 'horizontal',
    category: 'burritos-sandwiches',
    customizable: true
  },

  // --- BOWLS Y POSTRES ---
  {
    id: 'bowl-avena',
    name: 'Bowl de Avena',
    description: 'El desayuno perfecto o postre sin culpa. Base de avena cremosa, endulzada naturalmente y coronada con fruta fresca y crujientes semillas a tu elección.',
    price: 60,
    image: '/images/bowl_avena.webp',
    image_orientation: 'square',
    category: 'bowls',
    customizable: true
  },
  {
    id: 'bowl-yogurt',
    name: 'Bowl de Yogurt',
    description: 'Cremoso, fresco y lleno de probióticos. Una base de yogurt natural acompañada de la mejor selección de frutas de temporada y semillas tostadas.',
    price: 65,
    image: '/images/yogurt.webp',
    image_orientation: 'square',
    category: 'bowls',
    customizable: true
  },
  {
    id: 'coctel-fruta',
    name: 'Cóctel de Frutas',
    description: 'La frescura de la estación en un solo plato. Fruta recién picada, naturalmente dulce y perfecta para un antojo ligero a cualquier hora.',
    price: 65,
    image: '/images/coctel.webp',
    image_orientation: 'square',
    category: 'bowls'
  },
  {
    id: 'bowl-rafaello',
    name: 'Bowl Rafaello',
    description: 'Especialidad de la casa con un sabor exquisito y reconfortante. Preparado con ingredientes selectos y toque artesanal.',
    price: 95,
    image: '/images/rafaello.webp',
    image_orientation: 'square',
    category: 'bowls'
  },
  {
    id: 'hotcakes-avena',
    name: 'Hotcakes de Avena',
    description: 'Esponjosos y saludables hotcakes elaborados con base de avena. Un postre o desayuno nutritivo lleno de sabor.',
    price: 85,
    image: '/images/hotcakes.webp',
    image_orientation: 'square',
    category: 'bowls'
  },

  // --- EMBOTELLADOS ---
  {
    id: 'agua-botella',
    name: 'Botella de Agua 600ml',
    price: 20,
    image: '/images/infusion.webp',
    image_orientation: 'vertical',
    category: 'embotellada'
  },
  {
    id: 'cafe',
    name: 'Café',
    price: 35,
    image: '/images/infusion.webp',
    image_orientation: 'vertical',
    category: 'embotellada'
  }
];
