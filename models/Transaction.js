import mongoose from 'mongoose';

const transactionSchema = mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'User',
        },
        order: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Order',
        },
        merchantTransactionId: {
            type: String,
            required: true,
            unique: true,
        },
        transactionId: {
            type: String,
        },
        amount: {
            type: Number,
            required: true,
        },
        status: {
            type: String,
            required: true,
            default: 'PENDING', // PENDING, SUCCESS, FAILED
        },
        paymentResponse: {
            type: Object,
        },
    },
    {
        timestamps: true,
    }
);

const Transaction = mongoose.model('Transaction', transactionSchema);

export default Transaction;
