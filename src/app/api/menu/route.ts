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
          modifiers(id, name, display_order)
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
      const item: any = {
        id: p.id,
        name: p.name,
        description: p.description,
        price: Number(p.base_price),
        image: p.image_url,
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
