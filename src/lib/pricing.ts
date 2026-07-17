const slugify = (text: string) => text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, '-');

export function calculateOrderTotal(cartItems: any[], dbProducts: any[]) {
  let total = 0;
  const conflicts: any[] = [];
  const validItems: any[] = [];

  for (const item of cartItems) {
    const dbProduct = dbProducts.find((p: any) => p.id === item.id);
    if (!dbProduct || !dbProduct.available) {
      conflicts.push({ product_id: item.id, product_name: item.name, reason: 'Producto no disponible o desactivado temporalmente.' });
      continue;
    }

    let itemPrice = Number(dbProduct.base_price);

    // 1. Variant Check (Size)
    if (item.size && dbProduct.variants && dbProduct.variants.length > 0) {
      const variant = dbProduct.variants.find((v: any) => v.name === item.size);
      if (!variant) {
        conflicts.push({ product_id: item.id, product_name: item.name, reason: `El tamaño ${item.size} ya no está disponible.` });
        continue;
      }
      itemPrice = Number(variant.price);
    }

    // 1.5. Smoothie Mixto check (Chico: $80, Grande: $90)
    const isSmoothieMixto = item.name === 'Smoothie Mixto' || item.name?.toLowerCase().includes('smoothie mixto') || (item.customizations?.flavors && item.customizations.flavors.length > 1 && item.id === 'smoothies-clasicos');
    if (item.id === 'smoothies-clasicos' && isSmoothieMixto) {
      if (item.size === 'Chico') itemPrice = 80;
      else if (item.size === 'Grande') itemPrice = 90;
      else itemPrice = 80;
    }

    // 2. Modifiers Check
    let modifiersExtraPrice = 0;
    const groupCounts: Record<string, number> = {};

    if (item.customizations) {
      // Flatten all selected customization slugs from the frontend
      const allSelectedSlugs = [
        ...(item.customizations.proteins || []),
        ...(item.customizations.toppings || []),
        ...(item.customizations.seedsAndNuts || []),
        ...(item.customizations.dressings || []),
        ...(item.customizations.flavors || []),
        ...(item.customizations.extras || [])
      ].filter(Boolean); // Clean any undefined

      for (const selectedSlug of allSelectedSlugs) {
        let foundMod: any = null;
        let foundGroup: any = null;

        // Search in all modifier groups of the product
        if (dbProduct.modifier_groups) {
          for (const group of dbProduct.modifier_groups) {
            if (!group.modifiers) continue;
            // Frontend UI sends either exact name string or the generated slug string
            const match = group.modifiers.find((m: any) => slugify(m.name) === slugify(selectedSlug) || m.id === selectedSlug || m.name === selectedSlug);
            if (match) {
              foundMod = match;
              foundGroup = group;
              break;
            }
          }
        }

        if (foundMod && foundGroup) {
          if (!foundMod.available) {
            conflicts.push({ product_id: item.id, product_name: item.name, reason: `El ingrediente "${foundMod.name}" se ha agotado.` });
          } else {
            // Count how many we've selected from this group
            if (!groupCounts[foundGroup.id]) groupCounts[foundGroup.id] = 0;
            groupCounts[foundGroup.id]++;

            // Calculate dynamic free limit if it's a salad in size Grande
            let freeLimit = foundGroup.free_limit !== undefined ? foundGroup.free_limit : 0;
            const isSalad = dbProduct.category_id === '299824bb-ede2-47ed-bf0e-b5fd9548af73' || dbProduct.name?.toLowerCase().includes('ensalada');
            if (isSalad) {
              if (foundGroup.name === 'Proteínas') {
                freeLimit = item.size === 'Grande' ? 2 : 1;
                if (!foundGroup.extra_price) foundGroup.extra_price = 30;
              } else if (foundGroup.name === 'Toppings' || foundGroup.name === 'Frutas (Toppings)') {
                freeLimit = item.size === 'Grande' ? 6 : 4;
                if (!foundGroup.extra_price) foundGroup.extra_price = 15;
              } else if (foundGroup.name?.includes('Semillas')) {
                freeLimit = item.size === 'Grande' ? 4 : 2;
                if (!foundGroup.extra_price) foundGroup.extra_price = 15;
              } else if (foundGroup.name === 'Aderezos') {
                freeLimit = 1;
                if (!foundGroup.extra_price) foundGroup.extra_price = 15;
              }
            }

            const isSandwichOrTorta = dbProduct.id === 'sandwich' || dbProduct.id === 'torta' || dbProduct.id === 'sandwich-pavo' || dbProduct.id === 'sandwich-pollo' || dbProduct.name?.includes('Sándwich') || dbProduct.name?.includes('Torta');
            if (isSandwichOrTorta && (foundGroup.name === 'Especialidad' || foundGroup.name?.includes('Especialidad'))) {
              freeLimit = 1;
              if (!foundGroup.extra_price) foundGroup.extra_price = 30;
            }

            // Include individual modifier price if configured
            modifiersExtraPrice += Number(foundMod.price_modifier || foundMod.price || 0);

            // If over the free limit, apply the extra price from the group settings
            if (groupCounts[foundGroup.id] > freeLimit) {
              modifiersExtraPrice += Number(foundGroup.extra_price || 0);
            }
          }
        } else {
          // Modificador no encontrado en los modifier_groups de Supabase.
          // Esto ocurre cuando un topping existe en el menú estático (menuData.ts)
          // pero aún no ha sido añadido a la tabla modifier_groups en la base de datos
          // (ej: Aguacate, Granos de Elote recién agregados).
          // Decisión: NO tratar como conflicto bloqueante — lo aceptamos como
          // anotación de precio $0. El cajero puede gestionar manualmente si aplica cargo extra.
          // Una vez que el ítem esté en Supabase, el precio se calculará automáticamente.
          console.warn(`[PRICING] Modificador no encontrado en DB para producto "${item.name}": "${selectedSlug}" — aceptado como opción sin cargo adicional.`);
          // No sumamos precio ni añadimos al conflicto — el modificador ya está en item.customizations
          // y viajará en el snapshot del pedido para que cocina lo vea.
        }
      }
    }

    itemPrice += modifiersExtraPrice;

    const snapshotItem = {
      ...item,
      // We overwrite the price coming from the frontend with the server truth
      calculated_unit_price: itemPrice,
      final_subtotal: itemPrice * item.quantity
    };
    validItems.push(snapshotItem);
    total += itemPrice * item.quantity;
  }

  return { total, conflicts, validItems };
}
