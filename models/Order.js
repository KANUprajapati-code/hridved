import mongoose from 'mongoose';

const orderSchema = mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        required: false,
        ref: 'User',
    },
    orderSource: {
        type: String,
        enum: ['Website', 'WhatsApp'],
        default: 'Website'
    },
    email: {
        type: String
    },
    orderItems: [
        {
            name: { type: String, required: true },
            qty: { type: Number, required: true },
            image: { type: String, required: true },
            price: { type: Number, required: true },
            weight: { type: Number, default: 0.5 },
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
    paymentStatus: {
        type: String,
        enum: ['Pending', 'Authorized', 'Captured', 'Failed', 'Refunded'],
        default: 'Pending',
    },
    orderStatus: {
        type: String,
        enum: ['Placed', 'Confirmed', 'Processing', 'Packed', 'Shipped', 'Out For Delivery', 'Delivered', 'Cancelled', 'RTO'],
        default: 'Placed',
    },
    idempotencyKey: {
        type: String,
        index: true,
        sparse: true,
    },
    termsAccepted: {
        type: Boolean,
        default: true,
    },
    guestCheckout: {
        type: Boolean,
        default: false,
    },
    appliedCoupon: {
        code: { type: String },
        discount: { type: Number, default: 0 },
        type: { type: String },
    },
    marketingAttribution: {
        utmSource: { type: String, default: '' },
        utmMedium: { type: String, default: '' },
        utmCampaign: { type: String, default: '' },
        utmTerm: { type: String, default: '' },
        utmContent: { type: String, default: '' },
        gclid: { type: String, default: '' },
        fbclid: { type: String, default: '' },
        landingPage: { type: String, default: '' },
        referrer: { type: String, default: '' },
        capturedAt: { type: Date },
    },
    webhookEvents: [
        {
            event: { type: String },
            receivedAt: { type: Date, default: Date.now },
            payloadId: { type: String },
        }
    ],
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
    shippingProvider: { 
        type: String, 
        enum: ['Wayuvega', 'Vamaship', 'Local', 'Local Courier', 'Standard', 'Custom', 'Delhivery', 'Shiprocket', 'Other'], 
        default: 'Wayuvega' 
    },
    waybill: { type: String }, // AWB / Waybill
    apiOrderId: { type: String }, // Carrier order id
    pickupOrderId: { type: String }, // Pickup id
    shippingLabelUrl: { type: String },
    trackingStatus: { type: String },
    // Wayuvega Specific Fields
    wayuvegaOrderId: { type: String },
    wayuvegaReference: { type: String },
    wayuvegaStatusCode: { type: String },
    wayuvegaLastLocation: { type: String },
    wayuvegaCurrentStep: { type: Number, default: 0 },
    trackingHistory: [
        {
            dateAndTime: { type: Date },
            status: { type: String },
            remark: { type: String },
            location: { type: String },
            code: { type: String },
        }
    ],
    shippingStatus: {
        type: String,
        enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'RTO', 'Shipping Pending', 'Cancelled'],
        default: 'Pending'
    },
    isCancelled: { type: Boolean, default: false },
    cancelledAt: { type: Date },
    cancellationReason: { type: String },
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
    codPrice: {
        type: Number,
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
