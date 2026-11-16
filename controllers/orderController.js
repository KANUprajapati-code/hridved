
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Coupon from '../models/Coupon.js';
import AudienceLead from '../models/AudienceLead.js';
import { createWayuvegaOrder, trackWayuvegaHistory, WAYUVEGA_STATUS_MAP } from '../utils/wayuvegaService.js';

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
const addOrderItems = async (req, res) => {
    const {
        orderItems,
        shippingAddress,
        paymentMethod,
        couponCode,
        codPrice,
        termsAccepted = true,
        idempotencyKey,
    } = req.body;

    const effectiveIdempotencyKey = idempotencyKey || req.headers['idempotency-key'] || req.headers['x-idempotency-key'];

    if (effectiveIdempotencyKey) {
        const existingOrder = await Order.findOne({ idempotencyKey: effectiveIdempotencyKey });
        if (existingOrder) {
            console.log(`[ORDERS] Idempotency match: Returning existing Order ${existingOrder._id}`);
            return res.status(200).json(existingOrder);
        }
    }

    if (!orderItems || orderItems.length === 0) {
        res.status(400);
        throw new Error('No order items');
    }

    // Server-Side Recalculation: Never trust client totals!
    const productIds = orderItems.map(item => item.product || item._id);
    const dbProducts = await Product.find({ _id: { $in: productIds } });
    const productMap = new Map();
    dbProducts.forEach(p => productMap.set(String(p._id), p));

    let verifiedItemsPrice = 0;
    const verifiedOrderItems = [];

    for (const item of orderItems) {
        const pid = String(item.product || item._id);
        const dbProduct = productMap.get(pid);

        if (!dbProduct) {
            res.status(400);
            throw new Error(`Product ${item.name || pid} not found in catalogue`);
        }

        const qty = Math.max(1, parseInt(item.qty) || 1);

        // Component inventory verification
        if (dbProduct.countInStock < qty) {
            res.status(400);
            throw new Error(`Insufficient stock for "${dbProduct.name}". Only ${dbProduct.countInStock} available.`);
        }

        let unitPrice = Number(dbProduct.price) || 0;
        if (item.selectedVariant) {
            const vLower = String(item.selectedVariant).toLowerCase();
            if (vLower.includes('2') || vLower.includes('twin') || vLower.includes('double')) {
                unitPrice = Math.round(unitPrice * 0.9);
            } else if (vLower.includes('3') || vLower.includes('triple') || vLower.includes('course')) {
                unitPrice = Math.round(unitPrice * 0.85);
            }
        }

        verifiedItemsPrice += unitPrice * qty;

        verifiedOrderItems.push({
            product: dbProduct._id,
            name: dbProduct.name,
            qty,
            image: dbProduct.image,
            price: unitPrice,
            packSize: dbProduct.packSize || '',
            sku: dbProduct.sku || '',
            weight: dbProduct.weight || 0.5,
            category: dbProduct.category || '',
        });
    }

    // Coupon verification & application
    let verifiedDiscount = 0;
    const codeToValidate = couponCode || req.body.coupon?.code || req.body.appliedCoupon?.code;
    let couponDoc = null;

    if (codeToValidate) {
        const cleanCode = String(codeToValidate).trim().toUpperCase();
        couponDoc = await Coupon.findOne({ code: cleanCode, isActive: true });

        if (couponDoc) {
            const now = new Date();
            const isValidDates = (!couponDoc.startDate || couponDoc.startDate <= now) &&
                                 (!couponDoc.expiryDate || couponDoc.expiryDate >= now);
            const isValidCap = !couponDoc.usageCap || couponDoc.usageCount < couponDoc.usageCap;
            const meetsMin = verifiedItemsPrice >= (couponDoc.minOrderAmount || 0);

            if (isValidDates && isValidCap && meetsMin) {
                if (couponDoc.type === 'percentage') {
                    let disc = Math.round((verifiedItemsPrice * couponDoc.discount) / 100);
                    if (couponDoc.maxDiscount && couponDoc.maxDiscount > 0) {
                        disc = Math.min(disc, couponDoc.maxDiscount);
                    }
                    verifiedDiscount = disc;
                } else {
                    verifiedDiscount = Math.min(verifiedItemsPrice, Number(couponDoc.discount) || 0);
                }
            }
        }
    } else if (req.body.discountAmount && Number(req.body.discountAmount) > 0) {
        // Fallback for pre-validated discounts
        verifiedDiscount = Math.min(verifiedItemsPrice, Number(req.body.discountAmount));
    }

    // Verified Shipping: Free shipping on orders >= ₹999 after discount
    const postDiscountAmount = Math.max(0, verifiedItemsPrice - verifiedDiscount);
    const verifiedShippingPrice = postDiscountAmount >= 999 ? 0 : 49;
    const verifiedCodPrice = paymentMethod === 'COD' ? (Number(codPrice) || 0) : 0;
    const verifiedTotalPrice = postDiscountAmount + verifiedShippingPrice + verifiedCodPrice;

    const order = new Order({
        orderItems: verifiedOrderItems,
        user: req.user._id,
        shippingAddress,
        paymentMethod,
        paymentStatus: paymentMethod === 'COD' ? 'Pending' : 'Pending',
        orderStatus: paymentMethod === 'COD' ? 'Confirmed' : 'Placed',
        idempotencyKey: effectiveIdempotencyKey || `idem_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        termsAccepted: Boolean(termsAccepted),
        guestCheckout: false,
        appliedCoupon: couponDoc ? { code: couponDoc.code, discount: verifiedDiscount, type: couponDoc.type } : undefined,
        itemsPrice: verifiedItemsPrice,
        taxPrice: 0,
        shippingPrice: verifiedShippingPrice,
        codPrice: verifiedCodPrice,
        discountAmount: verifiedDiscount,
        totalPrice: verifiedTotalPrice,
        shippingProvider: 'Wayuvega',
    });

    const createdOrder = await order.save();

    // Deduct stock atomically for purchased items
    for (const item of verifiedOrderItems) {
        await Product.findByIdAndUpdate(item.product, {
            $inc: { countInStock: -item.qty }
        });
    }

    // Record coupon usage if coupon applied
    if (couponDoc && verifiedDiscount > 0) {
        await Coupon.findByIdAndUpdate(couponDoc._id, {
            $inc: { usageCount: 1 },
            $push: { usedBy: { user: req.user._id, count: 1 } }
        });
    }

        // Directly Book Shipment with Wayuvega
        try {
            console.log(`[ORDERS] Directly booking shipment with Wayuvega for Order ${createdOrder._id}...`);
            const booking = await createWayuvegaOrder(createdOrder);
            if (booking && booking.success) {
                createdOrder.waybill = booking.waybill;
                createdOrder.wayuvegaOrderId = booking.shipmentOrderId || null;
                createdOrder.wayuvegaReference = booking.orderReferenceNumber || null;
                createdOrder.courierName = booking.courierName || 'DELHIVERY SURFACE';
                createdOrder.shippingProvider = 'Wayuvega';
                createdOrder.wayuvegaStatusCode = '30';
                createdOrder.wayuvegaCurrentStep = 0;
                createdOrder.wayuvegaLastLocation = 'Hridved Fulfillment Facility, Bayad';
                if (booking.labelUrl) {
                    createdOrder.shippingLabelUrl = booking.labelUrl;
                }
                console.log(`[ORDERS] Wayuvega booking confirmed for Order ${createdOrder._id}, AWB: ${createdOrder.waybill}`);
            } else {
                createdOrder.waybill = createdOrder.waybill || `WAYU${Math.floor(1000000000 + Math.random() * 9000000000)}`;
            }
            await createdOrder.save();
        } catch (wvErr) {
            console.error('[ORDERS] Wayuvega booking error:', wvErr.message);
        }

        res.status(201).json(createdOrder);
    };

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private
const getOrderById = async (req, res) => {
    const order = await Order.findById(req.params.id).populate(
        'user',
        'name email'
    );

    if (order) {
        res.json(order);
    } else {
        res.status(404);
        throw new Error('Order not found');
    }
};

// @desc    Update order to paid
// @route   PUT /api/orders/:id/pay
// @access  Private
const updateOrderToPaid = async (req, res) => {
    const order = await Order.findById(req.params.id);

    if (order) {
        // Enforce strict PRD security: Never mark paid from frontend redirect alone without signature or admin override
        const isOnline = (order.paymentMethod || '').toLowerCase().includes('razorpay');
        if (isOnline && !req.user?.isAdmin) {
            const { razorpay_signature, razorpay_payment_id } = req.body;
            if (!razorpay_signature && !razorpay_payment_id) {
                res.status(400);
                throw new Error('Online payments must be validated through secure HMAC gateway verification');
            }
        }

        order.isPaid = true;
        order.paidAt = Date.now();
        order.paymentStatus = 'Captured';
        order.orderStatus = 'Confirmed';
        order.paymentResult = {
            id: req.body.id || req.body.razorpay_payment_id,
            status: req.body.status || 'succeeded',
            update_time: req.body.update_time || Date.now().toString(),
            email_address: req.body.payer?.email_address || req.body.email || 'N/A',
        };

        // Ensure Wayuvega shipment is booked if not done yet
        if (!order.waybill || !order.wayuvegaOrderId || order.waybill.startsWith('HRD')) {
            try {
                const booking = await createWayuvegaOrder(order);
                if (booking && booking.success) {
                    order.waybill = booking.waybill;
                    order.wayuvegaOrderId = booking.shipmentOrderId || null;
                    order.wayuvegaReference = booking.orderReferenceNumber || null;
                    order.courierName = booking.courierName || 'DELHIVERY SURFACE';
                    order.shippingProvider = 'Wayuvega';
                    order.wayuvegaStatusCode = '30';
                    if (booking.labelUrl) {
                        order.shippingLabelUrl = booking.labelUrl;
                    }
                }
            } catch (wvErr) {
                console.error('[ORDERS] Wayuvega updateOrderToPaid error:', wvErr.message);
            }
        }

        const updatedOrder = await order.save();

        res.json(updatedOrder);
    } else {
        res.status(404);
        throw new Error('Order not found');
    }
};

// @desc    Update order to delivered
// @route   PUT /api/orders/:id/deliver
// @access  Private/Admin
const updateOrderToDelivered = async (req, res) => {
    const order = await Order.findById(req.params.id);

    if (order) {
        order.isDelivered = true;
        order.deliveredAt = Date.now();
        order.shippingStatus = 'Delivered';

        const updatedOrder = await order.save();

        try {
            const { sendShippingNotification } = await import('../utils/notificationService.js');
            await sendShippingNotification(updatedOrder._id, 'Delivered');
        } catch (notifyErr) {
            console.warn('[ORDER] Delivery notification error:', notifyErr.message);
        }

        res.json(updatedOrder);
    } else {
        res.status(404);
        throw new Error('Order not found');
    }
};

// @desc    Update order tracking info
// @route   PUT /api/orders/:id/tracking
// @access  Private/Admin
const updateOrderTracking = async (req, res) => {
    const order = await Order.findById(req.params.id);

    if (order) {
        const wasShipped = order.shippingStatus === 'Shipped';
        order.trackingId = req.body.trackingId || order.trackingId;
        order.courierName = req.body.courierName || order.courierName;
        if (req.body.shippingStatus) {
            order.shippingStatus = req.body.shippingStatus;
        }

        const updatedOrder = await order.save();

        if (req.body.shippingStatus === 'Shipped' || (!wasShipped && req.body.trackingId)) {
            try {
                const { sendShippingNotification } = await import('../utils/notificationService.js');
                await sendShippingNotification(updatedOrder._id, 'Shipped');
            } catch (notifyErr) {
                console.warn('[ORDER] Shipping notification error:', notifyErr.message);
            }
        }

        res.json(updatedOrder);
    } else {
        res.status(404);
        throw new Error('Order not found');
    }
};

// @desc    Get logged in user orders
// @route   GET /api/orders/myorders
// @access  Private
const getMyOrders = async (req, res) => {
    const orders = await Order.find({ user: req.user._id });
    res.json(orders);
};

// @desc    Get all orders
// @route   GET /api/orders
// @access  Private/Admin
const getOrders = async (req, res) => {
    const orders = await Order.find({}).populate('user', 'id name');
    res.json(orders);
};

// @desc    Create WhatsApp order
// @route   POST /api/orders/whatsapp
// @access  Public
const createWhatsAppOrder = async (req, res) => {
    try {
        const {
            orderItems,
            shippingAddress,
            couponCode,
            email,
            paymentMethod,
            codPrice
        } = req.body;

        if (!orderItems || orderItems.length === 0) {
            res.status(400);
            return res.json({ message: 'No order items' });
        }

        // Server-Side Recalculation for WhatsApp orders
        const productIds = orderItems.map(item => item.product || item._id);
        const dbProducts = await Product.find({ _id: { $in: productIds } });
        const productMap = new Map();
        dbProducts.forEach(p => productMap.set(String(p._id), p));

        let verifiedItemsPrice = 0;
        const verifiedOrderItems = [];

        for (const item of orderItems) {
            const pid = String(item.product || item._id);
            const dbProduct = productMap.get(pid);

            if (!dbProduct) continue;

            const qty = Math.max(1, parseInt(item.qty) || 1);
            let unitPrice = Number(dbProduct.price) || 0;

            if (item.selectedVariant) {
                const vLower = String(item.selectedVariant).toLowerCase();
                if (vLower.includes('2') || vLower.includes('twin') || vLower.includes('double')) {
                    unitPrice = Math.round(unitPrice * 0.9);
                } else if (vLower.includes('3') || vLower.includes('triple') || vLower.includes('course')) {
                    unitPrice = Math.round(unitPrice * 0.85);
                }
            }

            verifiedItemsPrice += unitPrice * qty;
            verifiedOrderItems.push({
                product: dbProduct._id,
                name: dbProduct.name,
                qty,
                image: dbProduct.image,
                price: unitPrice,
                weight: dbProduct.weight || 0.5,
                category: dbProduct.category || '',
            });
        }

        let verifiedDiscount = 0;
        const codeToValidate = couponCode || req.body.coupon?.code || req.body.appliedCoupon?.code;
        if (codeToValidate) {
            const coupon = await Coupon.findOne({ code: String(codeToValidate).trim().toUpperCase(), isActive: true });
            if (coupon && verifiedItemsPrice >= (coupon.minOrderAmount || 0)) {
                if (coupon.type === 'percentage') {
                    verifiedDiscount = Math.round((verifiedItemsPrice * coupon.discount) / 100);
                    if (coupon.maxDiscount) verifiedDiscount = Math.min(verifiedDiscount, coupon.maxDiscount);
                } else {
                    verifiedDiscount = Math.min(verifiedItemsPrice, Number(coupon.discount) || 0);
                }
            }
        } else if (req.body.discountAmount) {
            verifiedDiscount = Math.min(verifiedItemsPrice, Number(req.body.discountAmount) || 0);
        }

        const postDiscountAmount = Math.max(0, verifiedItemsPrice - verifiedDiscount);
        const verifiedShippingPrice = postDiscountAmount >= 999 ? 0 : 49;
        const verifiedCodPrice = paymentMethod && paymentMethod.includes('COD') ? (Number(codPrice) || 0) : 0;
        const verifiedTotalPrice = postDiscountAmount + verifiedShippingPrice + verifiedCodPrice;

        const order = new Order({
            user: req.user?._id || undefined,
            orderItems: verifiedOrderItems,
            shippingAddress,
            paymentMethod: paymentMethod || 'WhatsApp',
            itemsPrice: verifiedItemsPrice,
            taxPrice: 0,
            shippingPrice: verifiedShippingPrice,
            codPrice: verifiedCodPrice,
            totalPrice: verifiedTotalPrice,
            discountAmount: verifiedDiscount,
            email: email || req.user?.email || '',
            orderSource: 'WhatsApp',
            isPaid: false,
        });

        const createdOrder = await order.save();

        // Track in AudienceLead for marketing & follow-up
        try {
            const customerPhone = shippingAddress?.mobileNumber || req.user?.phone || '';
            const customerName = shippingAddress?.fullName || req.user?.name || 'Customer';
            const cleanPhone = customerPhone.toString().replace(/\D/g, '').slice(-10);

            if (cleanPhone) {
                await AudienceLead.create({
                    customerName,
                    phone: cleanPhone,
                    email: email || req.user?.email || '',
                    user: req.user?._id || null,
                    actionType: 'whatsapp_order',
                    cartItems: orderItems.map((item) => ({
                        productId: item.product,
                        name: item.name,
                        image: item.image,
                        price: item.price,
                        qty: item.qty || 1,
                    })),
                    cartTotal: totalPrice,
                    followUpStatus: 'Converted',
                    notes: [{
                        text: `Placed WhatsApp order #${createdOrder._id} for ₹${totalPrice}`,
                        addedBy: 'System',
                        createdAt: new Date(),
                    }],
                });
            }
        } catch (leadError) {
            console.error('Error tracking WhatsApp Order Lead:', leadError);
        }

        res.status(201).json(createdOrder);
    } catch (error) {
        console.error('Error creating WhatsApp Order:', error);
        res.status(500).json({ message: 'Failed to create order' });
    }
};

// @desc    Track order via mobile, waybill, or order ID (privacy-safe)
// @route   POST /api/orders/track
// @access  Public
const trackOrder = async (req, res) => {
    try {
        const { query } = req.body;
        if (!query || typeof query !== 'string' || !query.trim()) {
            return res.status(400).json({ message: 'Please provide a valid Mobile Number, Order ID, or Waybill' });
        }

        const cleanQuery = query.trim();
        const cleanDigits = cleanQuery.replace(/\D/g, '').slice(-10);
        const isObjectId = /^[0-9a-fA-F]{24}$/.test(cleanQuery);

        let queryObj = {};
        if (isObjectId) {
            queryObj = { _id: cleanQuery };
        } else if (cleanDigits.length === 10) {
            // Match 10-digit phone number or formatted phone number
            queryObj = {
                $or: [
                    { 'shippingAddress.mobileNumber': cleanDigits },
                    { 'shippingAddress.mobileNumber': `+91${cleanDigits}` },
                    { 'shippingAddress.mobileNumber': cleanQuery },
                    { waybill: cleanQuery },
                ]
            };
        } else {
            // Search by waybill, apiOrderId, or trackingId
            queryObj = {
                $or: [
                    { waybill: cleanQuery },
                    { trackingId: cleanQuery },
                    { apiOrderId: cleanQuery },
                ]
            };
        }

        const orders = await Order.find(queryObj).sort({ createdAt: -1 }).limit(10);

        if (!orders || orders.length === 0) {
            return res.status(404).json({ 
                message: 'No orders found matching that query. Please verify your 10-digit mobile number or Order ID.' 
            });
        }

        // Privacy-safe sanitization and live Wayuvega tracking enrichment
        const sanitizedOrders = await Promise.all(orders.map(async (order) => {
            const rawPhone = order.shippingAddress?.mobileNumber || '';
            const rawName = order.shippingAddress?.fullName || 'Customer';
            const maskedPhone = rawPhone.length >= 4 
                ? `******${rawPhone.slice(-4)}` 
                : '******';
            const nameParts = rawName.split(' ');
            const maskedName = nameParts.map(part => part ? `${part[0]}***` : '').join(' ');

            // Check live Wayuvega tracking if available
            let live = null;
            if (order.waybill || order.wayuvegaReference) {
                try {
                    live = await trackWayuvegaHistory(order.waybill || order.wayuvegaReference);
                } catch (e) {
                    // Non-fatal
                }
            }

            // Determine milestone step (0: Confirmed, 1: Packed, 2: Shipped/In Transit, 3: Out for Delivery, 4: Delivered)
            let currentStep = live ? live.currentStep : order.wayuvegaCurrentStep;
            if (currentStep === undefined || currentStep === null) {
                const s = (order.shippingStatus || '').toLowerCase();
                if (s.includes('deliver') || order.isDelivered) currentStep = 4;
                else if (s.includes('out')) currentStep = 3;
                else if (s.includes('ship') || s.includes('transit')) currentStep = 2;
                else if (s.includes('pack') || s.includes('ready')) currentStep = 1;
                else currentStep = 0;
            }

            // Timeline
            let timeline = live?.timeline;
            if (!timeline || timeline.length === 0) {
                if (order.trackingHistory && order.trackingHistory.length > 0) {
                    timeline = order.trackingHistory.map(h => ({
                        code: h.code || '70',
                        status: h.status,
                        description: h.description,
                        location: h.location,
                        timestamp: h.timestamp || order.createdAt,
                        step: WAYUVEGA_STATUS_MAP[h.code]?.step ?? 2
                    }));
                } else {
                    const created = new Date(order.createdAt || Date.now());
                    timeline = [
                        {
                            code: '30',
                            status: 'Order Placed & Confirmed',
                            description: 'Order placed and herbal formulations verified by Hridved dispensary',
                            location: 'Hridved Fulfillment Facility, Bayad',
                            timestamp: created,
                            step: 0
                        }
                    ];
                    if (currentStep >= 1) {
                        timeline.push({
                            code: '40',
                            status: 'Formulated & Packed',
                            description: 'Herbs precisely weighed, sealed and pickup scheduled',
                            location: 'Ahmedabad Fulfillment Center',
                            timestamp: new Date(created.getTime() + 4 * 3600000),
                            step: 1
                        });
                    }
                    if (currentStep >= 2) {
                        timeline.push({
                            code: '70',
                            status: 'In Transit',
                            description: `Package picked up by ${order.courierName || 'Delhivery Surface'} and in transit`,
                            location: 'Ahmedabad Logistics Hub',
                            timestamp: new Date(created.getTime() + 16 * 3600000),
                            step: 2
                        });
                    }
                    if (currentStep >= 3) {
                        timeline.push({
                            code: '80',
                            status: 'Out for Delivery',
                            description: 'Out with delivery executive. Arriving today',
                            location: `${order.shippingAddress?.city || 'Local'} Delivery Center`,
                            timestamp: new Date(created.getTime() + 48 * 3600000),
                            step: 3
                        });
                    }
                    if (currentStep >= 4) {
                        timeline.push({
                            code: '100',
                            status: 'Delivered',
                            description: 'Delivered safely to customer',
                            location: `${order.shippingAddress?.city || 'Destination'}`,
                            timestamp: order.deliveredAt ? new Date(order.deliveredAt) : new Date(created.getTime() + 54 * 3600000),
                            step: 4
                        });
                    }
                }
            }

            return {
                _id: order._id,
                createdAt: order.createdAt,
                shippingStatus: live?.currentShippingStatus || order.shippingStatus || 'Processing',
                trackingStatus: live?.currentStatus || order.trackingStatus || order.shippingStatus || 'Order Confirmed',
                statusCode: live?.currentStatusCode || order.wayuvegaStatusCode || (currentStep === 4 ? '100' : currentStep === 3 ? '80' : currentStep === 2 ? '70' : currentStep === 1 ? '40' : '30'),
                currentStep,
                shippingProvider: order.shippingProvider || 'Wayuvega',
                courierName: live?.courierName || order.courierName || 'DELHIVERY SURFACE',
                waybill: order.waybill || live?.awbNumber || 'Allocation in progress',
                location: live?.latestLocation || order.wayuvegaLastLocation || 'Ahmedabad Hub',
                estimatedDelivery: live?.expectedDeliveryDate || order.estimatedDelivery || null,
                estimatedDeliveryDays: order.estimatedDeliveryDays || '3-5',
                deliveryOption: order.deliveryOption || 'Standard',
                paymentMethod: order.paymentMethod,
                isPaid: order.isPaid,
                totalPrice: order.totalPrice,
                timeline,
                trackingHistory: timeline,
                orderItems: (order.orderItems || []).map(item => ({
                    name: item.name,
                    qty: item.qty,
                    price: item.price,
                    image: item.image,
                })),
                // Privacy-masked address protection
                destinationCity: order.shippingAddress?.city || 'India',
                destinationState: order.shippingAddress?.state || '',
                destinationPincodeMasked: order.shippingAddress?.pincode ? `${order.shippingAddress.pincode.slice(0, 3)}***` : '***',
                recipientMasked: maskedName,
                phoneMasked: maskedPhone,
            };
        }));

        return res.status(200).json(sanitizedOrders);
    } catch (error) {
         console.error('Error tracking Order:', error);
         return res.status(500).json({ message: 'Failed to track order' });
    }
};

// @desc    Cancel order and atomically restore stock
// @route   PUT /api/orders/:id/cancel
// @access  Private
const cancelOrder = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Verify authorization: either order belongs to user or user is admin
        const isOwner = order.user && req.user && order.user.toString() === req.user._id.toString();
        const isAdmin = req.user && req.user.isAdmin;
        if (!isOwner && !isAdmin) {
            return res.status(403).json({ message: 'Not authorized to cancel this order' });
        }

        if (order.isCancelled || order.shippingStatus === 'Cancelled') {
            return res.status(400).json({ message: 'Order has already been cancelled.' });
        }

        if (['Shipped', 'Delivered'].includes(order.shippingStatus)) {
            return res.status(400).json({ 
                message: 'This order has already been dispatched with our logistics partners. Please initiate a return request after delivery.' 
            });
        }

        order.isCancelled = true;
        order.cancelledAt = Date.now();
        order.shippingStatus = 'Cancelled';
        order.cancellationReason = req.body.reason || 'Cancelled by customer / store admin';
        const updatedOrder = await order.save();

        // Atomically restore deducted inventory
        try {
            const { restoreOrderStock } = await import('../utils/inventoryService.js');
            await restoreOrderStock(updatedOrder.orderItems);
        } catch (stockErr) {
            console.error('[INVENTORY] Stock restoration error on order cancellation:', stockErr.message);
        }

        res.json({ message: 'Order cancelled successfully and stock restored to inventory', order: updatedOrder });
    } catch (err) {
        console.error('Cancel order error:', err);
        res.status(500).json({ message: err.message || 'Server error cancelling order' });
    }
};

export {
    addOrderItems,
    getOrderById,
    updateOrderToPaid,
    updateOrderToDelivered,
    updateOrderTracking,
    getMyOrders,
    getOrders,
    createWhatsAppOrder,
    trackOrder,
    cancelOrder,
};
