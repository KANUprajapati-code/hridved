import mongoose from 'mongoose';

const systemConfigSchema = mongoose.Schema({
    shipping: {
        fshipEnabled: {
            type: Boolean,
            default: true,
        },
        vamashipEnabled: {
            type: Boolean,
            default: true,
        },
    }
}, {
    timestamps: true,
});

const SystemConfig = mongoose.model('SystemConfig', systemConfigSchema);

export default SystemConfig;
