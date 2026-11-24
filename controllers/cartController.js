import mongoose from 'mongoose';
import Cart from '../models/Cart.js';
import Product from '../models/Product.js';
import Coupon from '../models/Coupon.js';
import { matchProductVariant } from '../utils/variantHelper.js';

// @desc    Get user cart
// @route   GET /api/cart
// @access  Private
const getCart = async (req, res) => {
    try {
        let cart = await Cart.findOne({ user: req.user._id });

        if (!cart) {
            cart = await Cart.create({ user: req.user._id, cartItems: [] });
        }

        res.json(cart);
    } catch (error) {
        console.error('Error in getCart:', error);
        res.status(200).json({ cartItems: [] });
    }
};

// @desc    Add item to cart
// @route   POST /api/cart
// @access  Private
const addToCart = async (req, res) => {
    try {
        const { product, name, qty, image, price, mrp, sku, packSize, selectedVariant, gst, weight } = req.body;

        let cart = await Cart.findOne({ user: req.user._id });

        if (!cart) {
            cart = await Cart.create({ user: req.user._id, cartItems: [] });
        }

        const sid = String(product);
        const incomingVar = String(selectedVariant || '').trim().toLowerCase();
        
        // Find existing item matching product ID and variant (or replacing default pack of same medicine)
        const existItem = cart.cartItems.find((x) => {
            const sameProduct = String(x.product) === sid || String(x._id) === sid;
            if (!sameProduct) return false;
            const itemVar = String(x.selectedVariant || '').trim().toLowerCase();
            if (incomingVar) {
                return itemVar === incomingVar || !itemVar;
            }
            return true;
        });

        if (existItem) {
            existItem.qty = Math.max(1, parseInt(qty) || 1);
            if (name) existItem.name = name;
            if (price !== undefined) existItem.price = Number(price) || 0;
            if (mrp !== undefined) existItem.mrp = Number(mrp) || Number(price) || 0;
            if (sku) existItem.sku = sku;
            if (packSize) existItem.packSize = packSize;
            if (image) existItem.image = image;
            if (selectedVariant !== undefined) existItem.selectedVariant = selectedVariant;
            if (gst !== undefined) existItem.gst = Number(gst) || 0;
            if (weight !== undefined) existItem.weight = Number(weight) || 0.5;
        } else {
            cart.cartItems.push({ 
                product: mongoose.Types.ObjectId.isValid(product) ? product : undefined, 
                name: name || 'Ayurvedic Product', 
                qty: Math.max(1, parseInt(qty) || 1), 
                image: image || '/placeholder.png', 
                price: Number(price) || 0, 
                mrp: Number(mrp) || Number(price) || 0,
                sku: sku || '',
                packSize: packSize || '',
                selectedVariant: selectedVariant || '',
                gst: Number(gst) || 0,
                weight: Number(weight) || 0.5
            });
        }

        await cart.save();
        res.json(cart);
    } catch (error) {
        console.error('Error in addToCart:', error);
        const fallbackCart = await Cart.findOne({ user: req.user._id }) || { cartItems: [] };
        res.status(200).json(fallbackCart);
    }
};

// @desc    Remove item from cart
// @route   DELETE /api/cart/:id
// @access  Private
const removeFromCart = async (req, res) => {
    try {
        const idToRemove = String(req.params.id);

        let cart = await Cart.findOne({ user: req.user._id });

        if (!cart) {
            return res.json({ cartItems: [] });
        }

        // Filter out item by product ID or subdocument _id
        const initialLength = cart.cartItems.length;
        cart.cartItems = cart.cartItems.filter(
            (x) => String(x.product) !== idToRemove && String(x._id) !== idToRemove
        );

        if (cart.cartItems.length !== initialLength) {
            await cart.save();
        }

        return res.json(cart);
    } catch (error) {
        console.error('Error in removeFromCart, attempting atomic pull:', error);
        try {
            const idToRemove = String(req.params.id);
            const isObjectId = mongoose.Types.ObjectId.isValid(idToRemove);

            const pullQuery = isObjectId
                ? {
                    $or: [
                        { product: new mongoose.Types.ObjectId(idToRemove) },
                        { _id: new mongoose.Types.ObjectId(idToRemove) }
                    ]
                }
                : { product: idToRemove };

            const updatedCart = await Cart.findOneAndUpdate(
                { user: req.user._id },
                { $pull: { cartItems: pullQuery } },
                { new: true }
            );

            return res.json(updatedCart || { cartItems: [] });
        } catch (innerError) {
            console.error('Final fallback in removeFromCart:', innerError);
            const safeCart = await Cart.findOne({ user: req.user._id }).lean();
            return res.json(safeCart || { cartItems: [] });
        }
    }
};

// @desc    Clear cart
// @route   DELETE /api/cart
// @access  Private
const clearCart = async (req, res) => {
    try {
        let cart = await Cart.findOneAndUpdate(
            { user: req.user._id },
            { $set: { cartItems: [] } },
            { new: true, upsert: true }
        );
        res.json(cart);
    } catch (error) {
        console.error('Error in clearCart:', error);
        res.status(200).json({ cartItems: [] });
    }
};

// @desc    Merge guest cart items with user cart
// @route   POST /api/cart/merge
// @access  Private
const mergeCart = async (req, res) => {
    try {
        const { cartItems } = req.body;

        if (!cartItems || !Array.isArray(cartItems)) {
            let cart = await Cart.findOne({ user: req.user._id });
            return res.json(cart || { cartItems: [] });
        }

        let cart = await Cart.findOne({ user: req.user._id });

        if (!cart) {
            cart = await Cart.create({ user: req.user._id, cartItems: [] });
        }

        cartItems.forEach((newItem) => {
            const newPid = String(newItem.product || newItem._id);
            const newVar = String(newItem.selectedVariant || '').trim().toLowerCase();
            const existItem = cart.cartItems.find((x) => {
                const sameProduct = String(x.product) === newPid || String(x._id) === newPid;
                if (!sameProduct) return false;
                const itemVar = String(x.selectedVariant || '').trim().toLowerCase();
                if (newVar) {
                    return itemVar === newVar || !itemVar;
                }
                return true;
            });

            if (existItem) {
                existItem.qty = Math.max(1, parseInt(newItem.qty) || 1);
                if (newItem.name) existItem.name = newItem.name;
                if (newItem.price !== undefined) existItem.price = Number(newItem.price) || 0;
                if (newItem.mrp !== undefined) existItem.mrp = Number(newItem.mrp) || Number(newItem.price) || 0;
                if (newItem.sku) existItem.sku = newItem.sku;
                if (newItem.packSize) existItem.packSize = newItem.packSize;
                if (newItem.image) existItem.image = newItem.image;
                if (newItem.selectedVariant !== undefined) existItem.selectedVariant = newItem.selectedVariant;
                if (newItem.gst !== undefined) existItem.gst = Number(newItem.gst) || 0;
                if (newItem.weight !== undefined) existItem.weight = Number(newItem.weight) || 0.5;
            } else if (newItem && (newItem.product || newItem._id)) {
                cart.cartItems.push({
                    product: mongoose.Types.ObjectId.isValid(newItem.product || newItem._id) 
                        ? (newItem.product || newItem._id) 
                        : undefined,
                    name: newItem.name || 'Ayurvedic Product',
                    qty: Math.max(1, parseInt(newItem.qty) || 1),
                    image: newItem.image || '/placeholder.png',
                    price: Number(newItem.price) || 0,
                    mrp: Number(newItem.mrp) || Number(newItem.price) || 0,
                    sku: newItem.sku || '',
                    packSize: newItem.packSize || '',
                    selectedVariant: newItem.selectedVariant || '',
                    gst: Number(newItem.gst) || 0,
                    weight: Number(newItem.weight) || 0.5
                });
            }
        });

        await cart.save();
        res.json(cart);
    } catch (error) {
        console.error('Error in mergeCart:', error);
        const safeCart = await Cart.findOne({ user: req.user._id }).lean();
        res.status(200).json(safeCart || { cartItems: [] });
    }
};

// @desc    Recalculate cart prices, bundle savings, and coupon eligibility server-side
// @route   POST /api/cart/recalculate
// @access  Public / Optional Auth
const recalculateCart = async (req, res) => {
    try {
        const { cartItems = [], couponCode = null } = req.body;

        if (!Array.isArray(cartItems) || cartItems.length === 0) {
            return res.json({
                success: true,
                verifiedItems: [],
                itemsPrice: 0,
                mrpTotal: 0,
                mrpSavings: 0,
                discount: 0,
                shippingPrice: 0,
                freeShippingThreshold: 999,
                amountNeededForFreeShipping: 999,
                taxPrice: 0,
                totalPrice: 0,
                coupon: null,
                couponError: null,
                stockWarnings: [],
                isEmpty: true,
            });
        }

        // Collect valid product IDs
        const productIds = cartItems
            .map(item => item.product || item._id)
            .filter(id => id && mongoose.Types.ObjectId.isValid(id));

        const products = await Product.find({ _id: { $in: productIds } }).lean();
        const productMap = new Map();
        products.forEach(p => productMap.set(String(p._id), p));

        const verifiedItems = [];
        const stockWarnings = [];
        let itemsPrice = 0;
        let mrpTotal = 0;

        for (const item of cartItems) {
            const pid = String(item.product || item._id);
            const dbProduct = productMap.get(pid);

            if (!dbProduct) {
                stockWarnings.push({
                    productId: pid,
                    name: item.name || 'Unknown item',
                    type: 'UNAVAILABLE',
                    message: `Item "${item.name || 'Remedy'}" is no longer available in the apothecary catalogue.`
                });
                continue;
            }

            const requestedQty = Math.max(1, parseInt(item.qty) || 1);
            let verifiedQty = requestedQty;

            // Check stock availability
            if (dbProduct.countInStock <= 0) {
                stockWarnings.push({
                    productId: pid,
                    name: dbProduct.name,
                    type: 'OUT_OF_STOCK',
                    message: `"${dbProduct.name}" is currently out of stock. Fresh batch in preparation.`
                });
                verifiedQty = 0;
            } else if (dbProduct.countInStock < requestedQty) {
                stockWarnings.push({
                    productId: pid,
                    name: dbProduct.name,
                    type: 'INSUFFICIENT_STOCK',
                    message: `Only ${dbProduct.countInStock} units of "${dbProduct.name}" currently available. Quantity adjusted.`
                });
                verifiedQty = dbProduct.countInStock;
            }

            // Determine unit price and MRP from database with variant matching
            let unitPrice = Number(dbProduct.price) || 0;
            let unitMrp = Number(dbProduct.mrp) || unitPrice;
            let hasBundleDiscount = false;

            // Robust variant matching
            let matchedVariant = matchProductVariant(dbProduct, item);

            // If not matched yet, check exact price match against product's configured variants
            if (!matchedVariant && Number(item.price) > 0 && Array.isArray(dbProduct.variants)) {
                matchedVariant = dbProduct.variants.find(v => Number(v.price) === Number(item.price));
            }

            if (matchedVariant) {
                unitPrice = Number(matchedVariant.price) || unitPrice;
                unitMrp = Number(matchedVariant.mrp) || (unitPrice * (matchedVariant.multiplier || 1));
                if (matchedVariant.multiplier > 1 || matchedVariant.id === 'twin' || matchedVariant.id === 'triple' || (unitMrp > unitPrice && Math.round(((unitMrp - unitPrice) / unitMrp) * 100) >= 10)) {
                    hasBundleDiscount = true;
                }
            } else if (item.selectedVariant || item.name) {
                const combinedLower = `${String(item.selectedVariant || '')} ${String(item.name || '')}`.toLowerCase();
                const baseMrp = Number(dbProduct.mrp) || Number(dbProduct.price) || 999;
                if (/\b(triple|3x|3-month|45ml)\b/i.test(combinedLower) || combinedLower.includes('3 pack') || combinedLower.includes('3x15ml') || combinedLower.includes('3-month')) {
                    unitMrp = baseMrp * 3;
                    unitPrice = Math.round((baseMrp * 3) * 0.85);
                    hasBundleDiscount = true;
                } else if (/\b(twin|double|2x|30ml)\b/i.test(combinedLower) || combinedLower.includes('2 pack') || combinedLower.includes('2x15ml')) {
                    unitMrp = baseMrp * 2;
                    unitPrice = Math.round((baseMrp * 2) * 0.90);
                    hasBundleDiscount = true;
                } else if (/\b(single|standard|15ml)\b/i.test(combinedLower) || combinedLower.includes('1 pack') || combinedLower.includes('1x15ml')) {
                    unitMrp = baseMrp;
                    unitPrice = Number(dbProduct.price) || Math.round(baseMrp * 0.95);
                }
            }

            const itemSubtotal = unitPrice * verifiedQty;
            const itemMrpSubtotal = unitMrp * verifiedQty;

            itemsPrice += itemSubtotal;
            mrpTotal += itemMrpSubtotal;

            verifiedItems.push({
                product: dbProduct._id,
                _id: dbProduct._id,
                name: item.name || (matchedVariant && matchedVariant.name ? `${dbProduct.name} (${matchedVariant.name})` : dbProduct.name),
                image: dbProduct.image,
                price: unitPrice,
                mrp: unitMrp,
                qty: verifiedQty,
                packSize: dbProduct.packSize || '',
                sku: matchedVariant ? (matchedVariant.sku || dbProduct.sku) : (item.sku || dbProduct.sku || ''),
                category: dbProduct.category || '',
                selectedVariant: matchedVariant ? matchedVariant.name : (item.selectedVariant || null),
                countInStock: dbProduct.countInStock,
                gst: dbProduct.gst || 0,
                weight: dbProduct.weight || 0.5,
                subtotal: itemSubtotal,
                hasBundleDiscount,
            });
        }

        const mrpSavings = Math.max(0, mrpTotal - itemsPrice);

        // Coupon eligibility and calculation
        let discount = 0;
        let appliedCouponData = null;
        let couponError = null;

        if (couponCode && String(couponCode).trim()) {
            const cleanCode = String(couponCode).trim().toUpperCase();
            const coupon = await Coupon.findOne({ code: cleanCode });

            if (!coupon) {
                couponError = `Coupon code "${cleanCode}" is invalid.`;
            } else if (!coupon.isActive) {
                couponError = `Coupon "${cleanCode}" is no longer active.`;
            } else if (coupon.expiryDate && new Date(coupon.expiryDate) < new Date()) {
                couponError = `Coupon "${cleanCode}" expired on ${new Date(coupon.expiryDate).toLocaleDateString()}.`;
            } else if (coupon.startDate && new Date(coupon.startDate) > new Date()) {
                couponError = `Coupon "${cleanCode}" is not active yet.`;
            } else if (coupon.usageCap && coupon.usageCount >= coupon.usageCap) {
                couponError = `Coupon "${cleanCode}" has reached maximum global redemptions.`;
            } else if (coupon.minOrderAmount && itemsPrice < coupon.minOrderAmount) {
                couponError = `Coupon "${cleanCode}" requires a minimum cart subtotal of ₹${coupon.minOrderAmount}.`;
            } else {
                // Check per-customer limit if user is authenticated
                let customerUsageAllowed = true;
                if (req.user && coupon.perCustomerLimit) {
                    const userRecord = coupon.usedBy?.find(u => String(u.user) === String(req.user._id));
                    if (userRecord && userRecord.count >= coupon.perCustomerLimit) {
                        customerUsageAllowed = false;
                        couponError = `You have already used coupon "${cleanCode}" the maximum allowed number of times.`;
                    }
                }

                if (customerUsageAllowed) {
                    // Check category scope if defined
                    let eligibleItems = verifiedItems;
                    if (coupon.categoryScope && coupon.categoryScope.length > 0) {
                        const scopeCategories = coupon.categoryScope.map(c => c.toLowerCase());
                        eligibleItems = eligibleItems.filter(it => scopeCategories.includes((it.category || '').toLowerCase()));
                    }

                    // Strict anti-stacking: Do NOT allow coupon discount on already-bundled / volume-discounted items if coupon cannot stack
                    if (!coupon.canStack) {
                        eligibleItems = eligibleItems.filter(it => !it.hasBundleDiscount);
                    }

                    const eligibleSubtotal = eligibleItems.reduce((sum, it) => sum + it.subtotal, 0);

                    if (eligibleSubtotal <= 0) {
                        couponError = coupon.canStack
                            ? `Coupon "${cleanCode}" is only applicable to categories: ${coupon.categoryScope?.join(', ')}`
                            : `Coupon "${cleanCode}" cannot be combined with already discounted value packs.`;
                    } else {
                        if (coupon.type === 'percentage') {
                            let calculatedDiscount = Math.round((eligibleSubtotal * coupon.discount) / 100);
                            if (coupon.maxDiscount && coupon.maxDiscount > 0) {
                                calculatedDiscount = Math.min(calculatedDiscount, coupon.maxDiscount);
                            }
                            discount = calculatedDiscount;
                        } else {
                            discount = Math.min(eligibleSubtotal, Number(coupon.discount) || 0);
                        }

                        appliedCouponData = {
                            code: coupon.code,
                            discount: coupon.discount,
                            type: coupon.type,
                            appliedDiscount: discount,
                            description: coupon.description || (coupon.type === 'percentage' ? `${coupon.discount}% OFF` : `₹${coupon.discount} FLAT OFF`),
                        };
                    }
                }
            }
        }

        // Shipping calculation: Free shipping on orders >= ₹999 after discount
        const postDiscountSubtotal = Math.max(0, itemsPrice - discount);
        const freeShippingThreshold = 999;
        const shippingPrice = (postDiscountSubtotal >= freeShippingThreshold || itemsPrice === 0) ? 0 : 49;
        const amountNeededForFreeShipping = Math.max(0, freeShippingThreshold - postDiscountSubtotal);

        // Tax calculation: Inclusive statutory GST
        const taxPrice = verifiedItems.reduce((acc, item) => {
            const itemGst = item.gst || 0;
            return acc + Math.round((item.subtotal * itemGst) / 100);
        }, 0);

        const totalPrice = Math.max(0, postDiscountSubtotal + shippingPrice);

        // If user is authenticated, sync verified cart to DB
        if (req.user) {
            try {
                await Cart.findOneAndUpdate(
                    { user: req.user._id },
                    {
                        $set: {
                            cartItems: verifiedItems.map(vi => ({
                                product: vi.product,
                                name: vi.name,
                                qty: vi.qty,
                                image: vi.image,
                                price: vi.price,
                                mrp: vi.mrp,
                                sku: vi.sku,
                                packSize: vi.packSize,
                                selectedVariant: vi.selectedVariant,
                                gst: vi.gst,
                                weight: vi.weight,
                            })),
                            appliedCoupon: appliedCouponData ? {
                                code: appliedCouponData.code,
                                discount: appliedCouponData.discount,
                                type: appliedCouponData.type,
                                appliedAmount: appliedCouponData.appliedDiscount,
                            } : null,
                        }
                    },
                    { upsert: true }
                );
            } catch (err) {
                console.warn('Failed to sync verified cart to user document:', err.message);
            }
        }

        res.json({
            success: true,
            verifiedItems,
            itemsPrice,
            mrpTotal,
            mrpSavings,
            discount,
            shippingPrice,
            freeShippingThreshold,
            amountNeededForFreeShipping,
            taxPrice,
            totalPrice,
            coupon: appliedCouponData,
            couponError,
            stockWarnings,
            isEmpty: verifiedItems.length === 0,
        });
    } catch (error) {
        console.error('Error in recalculateCart:', error);
        res.status(500).json({ success: false, message: 'Cart recalculation failed: ' + error.message });
    }
};

export { getCart, addToCart, removeFromCart, clearCart, mergeCart, recalculateCart };
