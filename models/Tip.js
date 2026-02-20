import mongoose from 'mongoose';

const tipSchema = mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
        },
        description: {
            type: String,
            required: true,
        },
        image: {
            type: String,
            required: true,
        },
        category: {
            type: String,
            required: true,
            default: 'General',
        },
    },
    {
        timestamps: true,
    }
);

const Tip = mongoose.model('Tip', tipSchema);

export default Tip;
