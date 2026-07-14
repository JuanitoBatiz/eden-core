import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { CATEGORIES as staticCategories, MENU_ITEMS as staticMenuItems, SALAD_OPTIONS as staticSaladOptions } from '@/lib/menuData';

export const revalidate = 30; // 30 seconds cache

const slugify = (text: string) => text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, '-');

export async function GET() {
  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({
      CATEGORIES: staticCategories,
      MENU_ITEMS: staticMenuItems,
      SALAD_OPTIONS: staticSaladOptions
    });
  }

  try {
    const { data: categories, error: catErr } = await supabase
      .from('categories')
      .select('*')
      .eq('active', true)
      .order('display_order');
    if (catErr) throw catErr;

    const { data: products, error: prodErr } = await supabase
      .from('products')
      .select(`
        id, name, description, base_price, image_url, category_id, display_order,
        variants(id, name, price, display_order),
        modifier_groups(
          id, name, max_selection,
          modifiers(id, name, display_order, price_modifier)
        )
      `)
      .eq('available', true)
      .order('display_order');
    if (prodErr) throw prodErr;

    // Map Categories
    const mappedCategories = categories.map(c => ({
      id: c.id,
      name: c.name,
      icon: c.icon
    }));

    // Map Products
    const mappedProducts = products.map(p => {
      const staticMatch = staticMenuItems.find((item: any) => item.name?.toLowerCase() === p.name?.toLowerCase() || item.id === p.id);
      const inferredOrientation = staticMatch?.image_orientation || (
        (p.category_id === 'jugos' || p.category_id === 'smoothies' || p.category_id === 'infusiones' || p.category_id === 'embotellada' || p.name?.toLowerCase().includes('jugo') || p.name?.toLowerCase().includes('smoothie') || p.name?.toLowerCase().includes('infusion'))
          ? 'vertical'
          : (p.category_id === 'ensaladas' || p.category_id === 'bowls' || p.name?.toLowerCase().includes('ensalada') || p.name?.toLowerCase().includes('bowl') || p.name?.toLowerCase().includes('coctel') || p.name?.toLowerCase().includes('hotcakes'))
          ? 'square'
          : 'horizontal'
      );

      // 1. Corregir nombre y ID en vivo si en DB dice Rafaella
      let correctedName = p.name || '';
      let correctedId = p.id;
      if (correctedName.toLowerCase().includes('rafaell')) {
        correctedName = 'Bowl Rafaello';
        if (correctedId === 'bowl-rafaella') correctedId = 'bowl-rafaello';
      }

      // 2. Mapeo veloz y garantizado hacia archivos locales .webp ultra ligeros
      let resolvedImage = p.image_url || staticMatch?.image || '/images/ensalada.webp';
      if (typeof resolvedImage === 'string') {
        resolvedImage = resolvedImage.replace(/\.(png|jpg|jpeg)$/i, '.webp');
      }

      const lowerName = correctedName.toLowerCase();
      if (lowerName.includes('rafaell')) resolvedImage = '/images/rafaello.webp';
      else if (lowerName.includes('hotcakes')) resolvedImage = '/images/hotcakes.webp';
      else if (lowerName.includes('avena')) resolvedImage = '/images/bowl_avena.webp';
      else if (lowerName.includes('cóctel') || lowerName.includes('coctel')) resolvedImage = '/images/coctel.webp';
      else if (lowerName.includes('yogurt')) resolvedImage = '/images/yogurt.webp';
      else if (lowerName.includes('burrito')) resolvedImage = '/images/burrito.webp';
      else if (lowerName.includes('pollo') && lowerName.includes('rollito')) resolvedImage = '/images/rollito1.webp';
      else if (lowerName.includes('tsurimi') && lowerName.includes('rollito')) resolvedImage = '/images/rollito2.webp';
      else if (lowerName.includes('mixto') && lowerName.includes('rollito')) resolvedImage = '/images/rollito3.webp';
      else if (lowerName.includes('ciabatta')) resolvedImage = '/images/ciabatta.webp';
      else if (lowerName.includes('torta')) resolvedImage = '/images/torta.webp';
      else if (lowerName.includes('sandwich') || lowerName.includes('sándwich')) resolvedImage = '/images/sandwich.webp';
      else if (lowerName.includes('ensalada')) resolvedImage = '/images/ensalada.webp';
      else if (lowerName.includes('infusión') || lowerName.includes('infusion')) resolvedImage = '/images/infusion.webp';
      else if (lowerName.includes('clasico') || lowerName.includes('clásico')) resolvedImage = '/images/smoothie_clasico.webp';
      else if (lowerName.includes('deluxe') || lowerName.includes('súper') || lowerName.includes('super')) resolvedImage = '/images/smoothie_deluxe.webp';
      else if (lowerName.includes('natural')) resolvedImage = '/images/jugo_natural.webp';
      else if (lowerName.includes('mixto') && lowerName.includes('jugo')) resolvedImage = '/images/jugo_mixto.webp';

      const item: any = {
        id: correctedId,
        name: correctedName,
        description: p.description,
        price: Number(p.base_price),
        image: resolvedImage,
        image_orientation: (p as any).image_orientation || inferredOrientation,
        category: p.category_id,
        customizable: false
      };

      if (p.variants && p.variants.length > 0) {
        p.variants.sort((a: any, b: any) => a.display_order - b.display_order);
        item.prices = {};
        p.variants.forEach((v: any) => {
          item.prices[v.name] = Number(v.price);
        });
        item.customizable = true;
      }

      const flavorGroup = p.modifier_groups?.find((g: any) => g.name === 'Sabor' || g.name === 'Sabores');
      if (flavorGroup && flavorGroup.modifiers) {
        flavorGroup.modifiers.sort((a: any, b: any) => a.display_order - b.display_order);
        item.flavors = flavorGroup.modifiers.map((m: any) => m.name);
        item.maxFlavors = flavorGroup.max_selection || 1;
        item.customizable = true;
      }

      if (p.modifier_groups && p.modifier_groups.length > 0) {
        (item as any).modifier_groups = p.modifier_groups;
        if (p.modifier_groups.some((g: any) => g.name !== 'Sabor' && g.name !== 'Sabores')) {
          item.customizable = true;
        }
      }

      return item;
    });

    // Reconstruct SALAD_OPTIONS
    const SALAD_OPTIONS = {
      proteins: [] as any[],
      toppings: [] as any[],
      seedsAndNuts: [] as any[],
      dressings: [] as any[],
      extras: staticSaladOptions.extras
    };

    products.forEach(p => {
      p.modifier_groups?.forEach((g: any) => {
        g.modifiers?.forEach((m: any) => {
          // Usamos slugify para mantener compatibilidad con hardcoded UI logic
          const opt = { id: slugify(m.name), name: m.name };
          if (g.name === 'Proteínas' && !SALAD_OPTIONS.proteins.find(x => x.name === opt.name)) {
            SALAD_OPTIONS.proteins.push(opt);
          } else if ((g.name === 'Toppings' || g.name === 'Frutas (Toppings)') && !SALAD_OPTIONS.toppings.find(x => x.name === opt.name)) {
            SALAD_OPTIONS.toppings.push(opt);
          } else if ((g.name === 'Semillas y Frutos Secos' || g.name === 'Semillas y Granos') && !SALAD_OPTIONS.seedsAndNuts.find(x => x.name === opt.name)) {
            SALAD_OPTIONS.seedsAndNuts.push(opt);
          } else if (g.name === 'Aderezos' && !SALAD_OPTIONS.dressings.find(x => x.name === opt.name)) {
            SALAD_OPTIONS.dressings.push(opt);
          }
        });
      });
    });

    if (!SALAD_OPTIONS.toppings.some(x => x.id === 'aguacate' || x.name?.toLowerCase() === 'aguacate')) {
      SALAD_OPTIONS.toppings.unshift({ id: 'aguacate', name: 'Aguacate' });
    }
    if (!SALAD_OPTIONS.toppings.some(x => x.id === 'granos-de-elote' || x.name?.toLowerCase().includes('elote'))) {
      SALAD_OPTIONS.toppings.splice(1, 0, { id: 'granos-de-elote', name: 'Granos de Elote' });
    }

    return NextResponse.json({
      CATEGORIES: mappedCategories,
      MENU_ITEMS: mappedProducts,
      SALAD_OPTIONS: SALAD_OPTIONS
    });

  } catch (error) {
    console.error('Menu API error:', error);
    return NextResponse.json({
      CATEGORIES: staticCategories,
      MENU_ITEMS: staticMenuItems,
      SALAD_OPTIONS: staticSaladOptions
    });
  }
}
