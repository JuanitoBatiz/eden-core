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
        ...(item.customizations.flavors || [])
      ].filter(Boolean); // Clean any undefined

      for (const selectedSlug of allSelectedSlugs) {
          let foundMod: any = null;
          let foundGroup: any = null;

          // Search in all modifier groups of the product
          if (dbProduct.modifier_groups) {
             for (const group of dbProduct.modifier_groups) {
                if (!group.modifiers) continue;
                // Frontend UI sends either exact name string or the generated slug string
                const match = group.modifiers.find((m: any) => slugify(m.name) === selectedSlug || m.id === selectedSlug || m.name === selectedSlug);
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
                
                // If over the free limit, apply the extra price from the group settings
                if (groupCounts[foundGroup.id] > (foundGroup.free_limit || 0)) {
                   modifiersExtraPrice += Number(foundGroup.extra_price || 0);
                }
             }
          } else {
            // Unrecognized modifier, maybe deprecated or menu changed
             conflicts.push({ product_id: item.id, product_name: item.name, reason: `La opción "${selectedSlug}" ya no es válida.` });
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
