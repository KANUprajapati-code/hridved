import SystemConfig from '../models/SystemConfig.js';

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
                    fshipEnabled: true,
                    vamashipEnabled: true
                }
            });
        }
        res.json({ success: true, data: config.shipping });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update shipping configuration
// @route   PUT /api/config/shipping
// @access  Private/Admin
export const updateShippingConfig = async (req, res) => {
    try {
        const { fshipEnabled, vamashipEnabled } = req.body;

        let config = await SystemConfig.findOne();
        if (!config) {
            config = new SystemConfig();
        }

        config.shipping = {
            fshipEnabled: fshipEnabled !== undefined ? fshipEnabled : config.shipping.fshipEnabled,
            vamashipEnabled: vamashipEnabled !== undefined ? vamashipEnabled : config.shipping.vamashipEnabled
        };

        await config.save();
        res.json({ success: true, data: config.shipping });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
