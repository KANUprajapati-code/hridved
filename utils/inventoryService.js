import mongoose from 'mongoose';
import Product from '../models/Product.js';
import NotificationLog from '../models/NotificationLog.js';

/**
 * Calculates total units needed for an order item based on variant multiplier
 */
export const calculateUnitsNeeded = (item) => {
    let multiplier = 1;
    if (item.multiplier && Number(item.multiplier) > 0) {
        multiplier = Number(item.multiplier);
    } else if (item.name) {
        if (/pack of 2|double value/i.test(item.name)) multiplier = 2;
        else if (/pack of 3|3-month/i.test(item.name)) multiplier = 3;
    }
    return (Number(item.qty) || 1) * multiplier;
};

/**
 * 1. Validate Stock Server-Side
 * Returns { valid: true, items: [...] } or { valid: false, message: string }
 */
export const validateOrderStock = async (orderItems) => {
    if (!orderItems || !Array.isArray(orderItems) || orderItems.length === 0) {
        return { valid: false, message: 'Order items list is empty' };
    }

    const validatedItems = [];

    for (const item of orderItems) {
        const productId = item.product || item._id;
        if (!productId) {
            return { valid: false, message: 'Invalid product identifier in cart item' };
        }

        let product = null;
        if (mongoose.Types.ObjectId.isValid(productId)) {
            product = await Product.findById(productId);
        }
        if (!product && item.name) {
            const cleanName = item.name.split('(')[0].trim();
            product = await Product.findOne({ name: new RegExp(cleanName, 'i') });
        }

        if (!product) {
            return { valid: false, message: `Product "${item.name || 'Unknown'}" is no longer available in the catalogue.` };
        }

        const unitsNeeded = calculateUnitsNeeded(item);
        const availableStock = Number(product.countInStock) || 0;

        if (availableStock < unitsNeeded) {
            return {
                valid: false,
                message: availableStock === 0
                    ? `"${product.name}" is currently out of stock.`
                    : `Only ${availableStock} unit(s) of "${product.name}" are currently available in stock (requested: ${unitsNeeded}).`,
                outOfStockProductId: product._id,
                available: availableStock
            };
        }

        validatedItems.push({
            productId: product._id,
            name: product.name,
            sku: item.sku || product.sku || `HRV-${String(product._id).slice(-6).toUpperCase()}`,
            unitsNeeded,
            currentStock: availableStock
        });
    }

    return { valid: true, validatedItems };
};

/**
 * 2. Deduct Stock Atomically (Prevents Race-Condition Overselling)
 */
export const deductOrderStock = async (orderItems) => {
    const results = [];

    for (const item of orderItems) {
        const productId = item.product || item._id;
        if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
            continue;
        }

        const unitsNeeded = calculateUnitsNeeded(item);

        const updateResult = await Product.findOneAndUpdate(
            { _id: productId, countInStock: { $gte: unitsNeeded } },
            { $inc: { countInStock: -unitsNeeded } },
            { new: true }
        );

        if (updateResult) {
            results.push({
                productId,
                deducted: unitsNeeded,
                remainingStock: updateResult.countInStock
            });

            // Low-Stock Threshold Alert (classical batch warning when <= 5)
            if (updateResult.countInStock <= 5) {
                console.warn(`[INVENTORY ALERT] Low stock for "${updateResult.name}" (SKU: ${updateResult.sku || 'N/A'}). Remaining: ${updateResult.countInStock}`);
                try {
                    await NotificationLog.create({
                        notificationType: 'order_confirmation', // reuse or log internally
                        channel: 'sms',
                        status: 'simulated_demo',
                        provider: 'simulator',
                        triggerReason: `Low stock alert: "${updateResult.name}" inventory dropped to ${updateResult.countInStock} units.`,
                        messageSnippet: `Low stock alert: ${updateResult.name} has ${updateResult.countInStock} units remaining.`
                    });
                } catch (logErr) {
                    // Non-blocking
                }
            }
        } else {
            console.error(`[INVENTORY] Failed to deduct ${unitsNeeded} units for product ${productId}. Possible concurrent purchase.`);
        }
    }

    return results;
};

/**
 * 3. Restore Stock in Case of Cancellation / Gateway Rejection
 */
export const restoreOrderStock = async (orderItems) => {
    for (const item of orderItems) {
        const productId = item.product || item._id;
        const unitsToRestore = calculateUnitsNeeded(item);
        await Product.updateOne(
            { _id: productId },
            { $inc: { countInStock: unitsToRestore } }
        );
        console.log(`[INVENTORY] Restored ${unitsToRestore} units for product ${productId}`);
    }
};

export default {
    calculateUnitsNeeded,
    validateOrderStock,
    deductOrderStock,
    restoreOrderStock
};
