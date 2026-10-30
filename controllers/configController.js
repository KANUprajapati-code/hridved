import SystemConfig from '../models/SystemConfig.js';

// Helper to normalize and sanitize shipping settings with safe defaults
const sanitizeShippingConfig = (shipping = {}) => {
    return {
        vamashipEnabled: shipping.vamashipEnabled !== undefined ? Boolean(shipping.vamashipEnabled) : true,
        fshipEnabled: shipping.fshipEnabled !== undefined ? Boolean(shipping.fshipEnabled) : true,
        isFreeShipping: shipping.isFreeShipping !== undefined ? Boolean(shipping.isFreeShipping) : true,
        shippingFee: shipping.shippingFee !== undefined ? Math.max(0, Number(shipping.shippingFee) || 0) : 0,
        freeShippingThreshold: shipping.freeShippingThreshold !== undefined ? Math.max(0, Number(shipping.freeShippingThreshold) || 0) : 0,
        codFee: shipping.codFee !== undefined ? Math.max(0, Number(shipping.codFee) || 0) : 0,
        isCodFeeEnabled: shipping.isCodFeeEnabled !== undefined ? Boolean(shipping.isCodFeeEnabled) : false
    };
};

// @desc    Get shipping configuration
// @route   GET /api/config/shipping
// @access  Public
export const getShippingConfig = async (req, res) => {
    try {
        let config = await SystemConfig.findOne();
        if (!config) {
            // Create default config if it doesn't exist
            config = await SystemConfig.create({
                shipping: {
                    vamashipEnabled: true,
                    fshipEnabled: true,
                    isFreeShipping: true,
                    shippingFee: 0,
                    freeShippingThreshold: 0,
                    codFee: 0,
                    isCodFeeEnabled: false
                }
            });
        }
        res.json({ success: true, data: sanitizeShippingConfig(config.shipping) });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update shipping configuration
// @route   PUT /api/config/shipping
// @access  Private/Admin
export const updateShippingConfig = async (req, res) => {
    try {
        const {
            fshipEnabled,
            vamashipEnabled,
            isFreeShipping,
            shippingFee,
            freeShippingThreshold,
            codFee,
            isCodFeeEnabled
        } = req.body;

        let config = await SystemConfig.findOne();
        if (!config) {
            config = new SystemConfig();
        }

        const current = config.shipping || {};

        config.shipping = {
            fshipEnabled: fshipEnabled !== undefined ? Boolean(fshipEnabled) : (current.fshipEnabled ?? true),
            vamashipEnabled: vamashipEnabled !== undefined ? Boolean(vamashipEnabled) : (current.vamashipEnabled ?? true),
            isFreeShipping: isFreeShipping !== undefined ? Boolean(isFreeShipping) : (current.isFreeShipping ?? true),
            shippingFee: shippingFee !== undefined ? Math.max(0, Number(shippingFee) || 0) : (current.shippingFee ?? 0),
            freeShippingThreshold: freeShippingThreshold !== undefined ? Math.max(0, Number(freeShippingThreshold) || 0) : (current.freeShippingThreshold ?? 0),
            codFee: codFee !== undefined ? Math.max(0, Number(codFee) || 0) : (current.codFee ?? 0),
            isCodFeeEnabled: isCodFeeEnabled !== undefined ? Boolean(isCodFeeEnabled) : (current.isCodFeeEnabled ?? false)
        };

        await config.save();
        res.json({ success: true, data: sanitizeShippingConfig(config.shipping) });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
