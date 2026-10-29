
import Order from '../models/Order.js';
import AudienceLead from '../models/AudienceLead.js';

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
const addOrderItems = async (req, res) => {
    const {
        orderItems,
        shippingAddress,
        paymentMethod,
        itemsPrice,
        taxPrice,
        shippingPrice,
        codPrice,
        totalPrice,
        shippingProvider,
    } = req.body;

    if (orderItems && orderItems.length === 0) {
        res.status(400);
        throw new Error('No order items');
    } else {
        const order = new Order({
            orderItems,
            user: req.user._id,
            shippingAddress,
            paymentMethod,
            itemsPrice,
            taxPrice,
            shippingPrice,
            codPrice,
            discountAmount: req.body.discountAmount || 0,
            totalPrice,
            shippingProvider,
        });

        const createdOrder = await order.save();

        res.status(201).json(createdOrder);
    }
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
        order.isPaid = true;
        order.paidAt = Date.now();
        order.paymentResult = {
            id: req.body.id,
            status: req.body.status,
            update_time: req.body.update_time,
            email_address: req.body.payer.email_address,
        };

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
            itemsPrice,
            taxPrice,
            shippingPrice,
            totalPrice,
            discountAmount,
            email,
            paymentMethod,
            codPrice
        } = req.body;

        if (orderItems && orderItems.length === 0) {
            res.status(400);
            return res.json({ message: 'No order items' });
        }

        const order = new Order({
            user: req.user?._id || undefined,
            orderItems,
            shippingAddress,
            paymentMethod: paymentMethod || 'WhatsApp',
            itemsPrice,
            taxPrice,
            shippingPrice,
            codPrice: codPrice || 0,
            totalPrice,
            discountAmount,
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

        // Privacy-safe sanitization (protect customer PII from public enumeration)
        const sanitizedOrders = orders.map(order => {
            const rawPhone = order.shippingAddress?.mobileNumber || '';
            const rawName = order.shippingAddress?.fullName || 'Customer';
            const maskedPhone = rawPhone.length >= 4 
                ? `******${rawPhone.slice(-4)}` 
                : '******';
            const nameParts = rawName.split(' ');
            const maskedName = nameParts.map(part => part ? `${part[0]}***` : '').join(' ');

            return {
                _id: order._id,
                createdAt: order.createdAt,
                shippingStatus: order.shippingStatus || 'Processing',
                trackingStatus: order.trackingStatus || order.shippingStatus || 'Awaiting logistics update',
                shippingProvider: order.shippingProvider || 'Hridved Fulfillment',
                courierName: order.courierName || order.shippingProvider || 'Direct Logistics',
                waybill: order.waybill || 'Allocation in progress',
                estimatedDelivery: order.estimatedDelivery || null,
                estimatedDeliveryDays: order.estimatedDeliveryDays || '3-5',
                deliveryOption: order.deliveryOption || 'Standard',
                paymentMethod: order.paymentMethod,
                isPaid: order.isPaid,
                totalPrice: order.totalPrice,
                trackingHistory: Array.isArray(order.trackingHistory) ? order.trackingHistory : [],
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
        });

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
