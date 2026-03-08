import mongoose from 'mongoose';

const orderSchema = mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User',
    },
    orderItems: [
        {
            name: { type: String, required: true },
            qty: { type: Number, required: true },
            image: { type: String, required: true },
            price: { type: Number, required: true },
            product: {
                type: mongoose.Schema.Types.ObjectId,
                required: true,
                ref: 'Product',
            },
        },
    ],
    shippingAddress: {
        addressId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Address',
        },
        fullName: { type: String, required: true },
        mobileNumber: { type: String, required: true },
        houseNumber: { type: String, required: true },
        landmark: { type: String, default: '' },
        city: { type: String, required: true },
        state: { type: String, required: true },
        pincode: { type: String, required: true },
        addressType: { type: String, enum: ['Home', 'Office'], default: 'Home' },
    },
    paymentMethod: {
        type: String,
        required: true,
    },
    paymentResult: {
        id: { type: String },
        status: { type: String },
        update_time: { type: String },
        email_address: { type: String },
    },
    razorpayOrderId: { type: String },
    razorpayPaymentId: { type: String },
    razorpaySignature: { type: String },
    // Shipping Integration Fields
    shippingProvider: { type: String, enum: ['Vamaship'], default: 'Vamaship' },
    waybill: { type: String }, // Fship waybill
    apiOrderId: { type: String }, // Fship order id
    pickupOrderId: { type: String }, // Fship pickup id
    shippingLabelUrl: { type: String },
    trackingStatus: { type: String },
    trackingHistory: [
        {
            dateAndTime: { type: Date },
            status: { type: String },
            remark: { type: String },
            location: { type: String },
        }
    ],
    shippingStatus: {
        type: String,
        enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'RTO', 'Shipping Pending'],
        default: 'Pending'
    },
    isReverse: { type: Boolean, default: false },
    shipmentId: { type: String }, // Legacy/Generic
    trackingId: { type: String }, // Generic tracker
    courierName: { type: String },
    estimatedDelivery: { type: Date },
    deliveryOption: {
        type: String,
        default: 'Standard',
    },
    estimatedDeliveryDays: {
        type: String, // e.g., "3-5" or "1-2"
        default: '3-5',
    },
    itemsPrice: {
        type: Number,
        required: true,
        default: 0.0,
    },
    taxPrice: {
        type: Number,
        required: true,
        default: 0.0,
    },
    shippingPrice: {
        type: Number,
        required: true,
        default: 0.0,
    },
    discountAmount: {
        type: Number,
        default: 0.0,
    },
    totalPrice: {
        type: Number,
        required: true,
        default: 0.0,
    },
    isPaid: {
        type: Boolean,
        required: true,
        default: false,
    },
    paidAt: {
        type: Date,
    },
    isDelivered: {
        type: Boolean,
        required: true,
        default: false,
    },
    deliveredAt: {
        type: Date,
    },
}, {
    timestamps: true,
});

const Order = mongoose.model('Order', orderSchema);

export default Order;
