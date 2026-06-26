import dotenv from 'dotenv';
import path from 'path';

// Cargar variables desde .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const LOYVERSE_TOKEN = process.env.LOYVERSE_ACCESS_TOKEN || '';
const LOYVERSE_API = 'https://api.loyverse.com/v1.0';

if (!LOYVERSE_TOKEN) {
  console.error('❌ Error: No se encontró LOYVERSE_ACCESS_TOKEN en las variables de entorno.');
  process.exit(1);
}

async function fetchLoyverse(endpoint: string) {
  const res = await fetch(`${LOYVERSE_API}/${endpoint}`, {
    headers: { 'Authorization': `Bearer ${LOYVERSE_TOKEN}` }
  });
  if (!res.ok) {
    throw new Error(`Error en API Loyverse (${endpoint}): ${res.status}`);
  }
  return res.json();
}

async function extractInsights() {
  console.log('🔍 Extrayendo inteligencia de negocio desde servidores de Loyverse...\n');

  try {
    // 1. Tiendas
    const storesData = await fetchLoyverse('stores');
    const store = storesData.stores?.[0] || {};

    // 2. Categorías
    const categoriesData = await fetchLoyverse('categories');
    const categories: any[] = categoriesData.categories || [];

    // 3. Tipos de pago
    const paymentTypesData = await fetchLoyverse('payment_types');
    const paymentTypes: any[] = paymentTypesData.payment_types || [];

    // 4. Artículos (con paginación)
    const items: any[] = [];
    let cursor: string | null = null;
    do {
      const url: string = cursor ? `items?cursor=${cursor}` : 'items';
      const data = await fetchLoyverse(url);
      items.push(...data.items);
      cursor = data.cursor;
    } while (cursor);

    // Análisis estadístico
    const totalItems = items.length;
    let itemsWithoutCategory = 0;
    let totalVariants = 0;
    const itemsByCategory: Record<string, number> = {};
    const sampleItems: string[] = [];

    items.forEach((item, index) => {
      totalVariants += item.variants?.length || 1;
      if (!item.category_id) {
        itemsWithoutCategory++;
      } else {
        const catName = categories.find(c => c.id === item.category_id)?.name || 'Categoría Desconocida';
        itemsByCategory[catName] = (itemsByCategory[catName] || 0) + 1;
      }
      if (index < 6) sampleItems.push(item.item_name);
    });

    console.log('========================================================');
    console.log('📊 RADIOGRAFÍA EJECUTIVA DEL PUNTO DE VENTA (LOYVERSE)');
    console.log('========================================================\n');
    console.log(`🏬 Tienda Registrada:  "${store.name || 'Edén'}"`);
    console.log(`📍 Dirección POS:      ${store.address || 'No especificada en tablet'}`);
    console.log(`💳 Formas de cobro:    ${paymentTypes.map(p => p.name).join(', ')}\n`);

    console.log(`📦 TOTAL DE ARTÍCULOS: ${totalItems} productos creados`);
    console.log(`🔢 TOTAL DE VARIANTES: ${totalVariants} opciones de precio/tamaño`);
    console.log(`⚠️ SIN CATEGORÍA:      ${itemsWithoutCategory} artículos sueltos en el limbo (${Math.round((itemsWithoutCategory/totalItems)*100)}% del menú)\n`);

    console.log('📁 DISTRIBUCIÓN POR CATEGORÍAS EN SU TABLET:');
    if (categories.length === 0) {
      console.log('  ❌ No tiene ninguna categoría creada. Todo está mezclado.');
    } else {
      categories.forEach(c => {
        const count = itemsByCategory[c.name] || 0;
        console.log(`  - [${c.name}]: ${count} artículos`);
      });
    }

    console.log(`\n🔎 Ejemplos de nombres tal cual están en su terminal:`);
    console.log(`  "${sampleItems.join('", "')}" ... y 55 más.\n`);

    console.log('========================================================');
    console.log('💡 DATOS WOW PARA DECIRLE AL CLIENTE:');
    console.log(`1. "Sé que en tu tablet tienes registrados exactamente ${totalItems} productos."`);
    console.log(`2. "El ${Math.round((itemsWithoutCategory/totalItems)*100)}% de tus productos (${itemsWithoutCategory} artículos) están huérfanos sin categoría."`);
    console.log(`3. "Tienes dadas de alta formas de cobro como: ${paymentTypes.map(p => p.name).slice(0,2).join(' y ')}."`);
    console.log('========================================================\n');

  } catch (error) {
    console.error('❌ Error extrayendo datos:', error);
  }
}

extractInsights();
