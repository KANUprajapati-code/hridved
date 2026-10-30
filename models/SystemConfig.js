import mongoose from 'mongoose';

const systemConfigSchema = mongoose.Schema({
    shipping: {
        vamashipEnabled: {
            type: Boolean,
            default: true,
        },
        fshipEnabled: {
            type: Boolean,
            default: true,
        },
        isFreeShipping: {
            type: Boolean,
            default: true,
        },
        shippingFee: {
            type: Number,
            default: 0,
        },
        freeShippingThreshold: {
            type: Number,
            default: 0,
        },
        codFee: {
            type: Number,
            default: 0,
        },
        isCodFeeEnabled: {
            type: Boolean,
            default: false,
        }
    }
}, {
    timestamps: true,
});

const SystemConfig = mongoose.model('SystemConfig', systemConfigSchema);

export default SystemConfig;
