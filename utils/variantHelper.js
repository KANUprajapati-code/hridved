/**
 * Helper to reliably identify product variant from cart or order item.
 * Checks selectedVariant, name decoration (e.g. "(3 Pack (3x15ml))"), SKU ("-3PK"), and exact price match.
 */
export const matchProductVariant = (dbProduct, item = {}) => {
    if (!dbProduct) return null;
    const variants = Array.isArray(dbProduct.variants) ? dbProduct.variants : [];
    if (variants.length === 0) return null;

    const variantId = String(item.variantId || item.selectedVariantId || '').trim().toLowerCase();
    const itemVar = String(item.selectedVariant || '').trim().toLowerCase();
    const itemName = String(item.name || '').trim().toLowerCase();
    const itemSku = String(item.sku || '').trim().toLowerCase();
    const itemPrice = Number(item.price) || 0;

    // 0. Direct match by variantId if provided
    if (variantId) {
        const byId = variants.find(v => String(v.id || '').toLowerCase() === variantId || String(v._id || '').toLowerCase() === variantId);
        if (byId) return byId;
        if (variantId === '45ml' || variantId === 'triple') {
            const triple = variants.find(v => String(v.id).toLowerCase() === 'triple' || v.multiplier === 3);
            if (triple) return triple;
        } else if (variantId === '30ml' || variantId === 'twin') {
            const twin = variants.find(v => String(v.id).toLowerCase() === 'twin' || v.multiplier === 2);
            if (twin) return twin;
        } else if (variantId === '15ml' || variantId === 'single') {
            const single = variants.find(v => String(v.id).toLowerCase() === 'single' || v.multiplier === 1);
            if (single) return single;
        }
    }

    // 1. Direct match by variant ID or Name from item.selectedVariant
    if (itemVar) {
        const direct = variants.find(v => {
            const vId = String(v.id || '').toLowerCase();
            const vName = String(v.name || '').toLowerCase();
            return vId === itemVar || vName === itemVar;
        });
        if (direct) return direct;
    }

    // 2. Direct match by SKU
    if (itemSku) {
        const bySku = variants.find(v => v.sku && String(v.sku).toLowerCase() === itemSku);
        if (bySku) return bySku;
    }

    // 3. Keyword matching across selectedVariant and name
    const combinedText = `${itemVar} ${itemName}`;
    if (/\b(triple|3x|3-pack|3-month|45ml)\b/i.test(combinedText) || combinedText.includes('3 pack') || combinedText.includes('3x15ml') || combinedText.includes('3-month') || /\b3\s*pack/i.test(combinedText)) {
        const triple = variants.find(v => String(v.id).toLowerCase() === 'triple' || v.multiplier === 3);
        if (triple) return triple;
    }
    if (/\b(twin|double|2x|2-pack|30ml)\b/i.test(combinedText) || combinedText.includes('2 pack') || combinedText.includes('2x15ml') || /\b2\s*pack/i.test(combinedText)) {
        const twin = variants.find(v => String(v.id).toLowerCase() === 'twin' || v.multiplier === 2);
        if (twin) return twin;
    }
    if (/\b(single|standard|1-pack)\b/i.test(combinedText) || combinedText.includes('1 pack') || combinedText.includes('1x15ml') || /\b1\s*pack/i.test(combinedText)) {
        const single = variants.find(v => String(v.id).toLowerCase() === 'single' || v.multiplier === 1);
        if (single) return single;
    }

    // 4. Exact price match against variants
    if (itemPrice > 0) {
        const byPrice = variants.find(v => Number(v.price) === itemPrice);
        if (byPrice) return byPrice;
    }

    return null;
};
