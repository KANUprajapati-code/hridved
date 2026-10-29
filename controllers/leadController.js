import AudienceLead from '../models/AudienceLead.js';
import User from '../models/User.js';

// @desc    Track customer activity (Add to Cart, WhatsApp click, etc.)
// @route   POST /api/leads/track
// @access  Public (with optional user context)
export const trackLead = async (req, res) => {
    try {
        const {
            phone,
            customerName,
            email,
            actionType,
            product,
            cartItems,
            cartTotal,
        } = req.body;

        const effectivePhone = (phone || req.user?.phone || '').toString().replace(/\D/g, '').slice(-10);
        const effectiveName = customerName || req.user?.name || (effectivePhone ? `Lead ${effectivePhone.slice(-4)}` : 'Guest Visitor');
        const effectiveEmail = email || req.user?.email || '';
        const userId = req.user?._id || null;

        // If no phone or user, we still want to log anonymous interaction if product exists
        if (!effectivePhone && !userId) {
            return res.status(200).json({ success: true, message: 'Unauthenticated interaction recorded' });
        }

        // Avoid duplicate log if same action + product within last 5 minutes
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const existingRecent = await AudienceLead.findOne({
            phone: effectivePhone,
            actionType: actionType || 'whatsapp_click',
            createdAt: { $gte: fiveMinutesAgo },
            ...(product?.productId ? { 'product.productId': product.productId } : {})
        });

        if (existingRecent) {
            // Update timestamp & return
            existingRecent.updatedAt = new Date();
            await existingRecent.save();
            return res.status(200).json({ success: true, leadId: existingRecent._id });
        }

        const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
        const userAgent = req.headers['user-agent'] || '';

        const lead = await AudienceLead.create({
            customerName: effectiveName,
            phone: effectivePhone,
            email: effectiveEmail,
            user: userId,
            actionType: actionType || 'whatsapp_click',
            product: product || {},
            cartItems: cartItems || [],
            cartTotal: cartTotal || (product?.price || 0),
            followUpStatus: 'New',
            ipAddress: ip,
            userAgent: userAgent,
            notes: [{
                text: `Action captured: ${actionType || 'whatsapp_click'} on ${product?.name || 'cart'}`,
                addedBy: 'System',
                createdAt: new Date(),
            }]
        });

        // If user is logged in and didn't have phone, update user profile
        if (userId && effectivePhone) {
            await User.findByIdAndUpdate(userId, { phone: effectivePhone });
        }

        return res.status(201).json({ success: true, leadId: lead._id });
    } catch (error) {
        console.error('trackLead error:', error);
        return res.status(500).json({ message: 'Failed to record tracking event' });
    }
};

// @desc    Get all leads with filters & stats for Admin
// @route   GET /api/leads/admin
// @access  Private/Admin
export const getLeadsAdmin = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const { search, actionType, status, startDate, endDate } = req.query;

        let query = {};

        if (search) {
            query.$or = [
                { phone: { $regex: search, $options: 'i' } },
                { customerName: { $regex: search, $options: 'i' } },
                { 'product.name': { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
            ];
        }

        if (actionType && actionType !== 'all') {
            query.actionType = actionType;
        }

        if (status && status !== 'all') {
            query.followUpStatus = status;
        }

        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) query.createdAt.$lte = new Date(endDate);
        }

        const totalLeads = await AudienceLead.countDocuments(query);
        const leads = await AudienceLead.find(query)
            .populate('user', 'name email phone avatar')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        // Calculate summary analytics across all leads
        const [
            allCount,
            whatsappClicksCount,
            whatsappOrdersCount,
            cartAbandonedCount,
            convertedCount,
            newCount,
        ] = await Promise.all([
            AudienceLead.countDocuments({}),
            AudienceLead.countDocuments({ actionType: 'whatsapp_click' }),
            AudienceLead.countDocuments({ actionType: 'whatsapp_order' }),
            AudienceLead.countDocuments({ actionType: { $in: ['add_to_cart', 'cart_abandoned'] } }),
            AudienceLead.countDocuments({ followUpStatus: 'Converted' }),
            AudienceLead.countDocuments({ followUpStatus: 'New' }),
        ]);

        const conversionRate = allCount > 0 ? ((convertedCount / allCount) * 100).toFixed(1) : 0;

        return res.status(200).json({
            leads,
            pagination: {
                page,
                limit,
                totalPages: Math.ceil(totalLeads / limit),
                totalLeads,
            },
            stats: {
                total: allCount,
                whatsappClicks: whatsappClicksCount,
                whatsappOrders: whatsappOrdersCount,
                cartAbandoned: cartAbandonedCount,
                converted: convertedCount,
                newLeads: newCount,
                conversionRate: Number(conversionRate),
            },
        });
    } catch (error) {
        console.error('getLeadsAdmin error:', error);
        return res.status(500).json({ message: 'Failed to fetch audience leads' });
    }
};

// @desc    Update lead follow-up status, notes, or tags
// @route   PUT /api/leads/admin/:id
// @access  Private/Admin
export const updateLeadAdmin = async (req, res) => {
    try {
        const { followUpStatus, note, tags } = req.body;
        const lead = await AudienceLead.findById(req.params.id);

        if (!lead) {
            return res.status(404).json({ message: 'Lead not found' });
        }

        if (followUpStatus) {
            lead.followUpStatus = followUpStatus;
            lead.lastContactedAt = new Date();
        }

        if (note && note.trim()) {
            lead.notes.push({
                text: note.trim(),
                addedBy: req.user?.name || 'Admin',
                createdAt: new Date(),
            });
            lead.lastContactedAt = new Date();
        }

        if (tags && Array.isArray(tags)) {
            lead.tags = tags;
        }

        const updatedLead = await lead.save();
        return res.status(200).json(updatedLead);
    } catch (error) {
        console.error('updateLeadAdmin error:', error);
        return res.status(500).json({ message: 'Failed to update lead' });
    }
};

// @desc    Delete lead
// @route   DELETE /api/leads/admin/:id
// @access  Private/Admin
export const deleteLeadAdmin = async (req, res) => {
    try {
        const lead = await AudienceLead.findById(req.params.id);
        if (!lead) {
            return res.status(404).json({ message: 'Lead not found' });
        }

        await lead.deleteOne();
        return res.status(200).json({ message: 'Lead deleted successfully' });
    } catch (error) {
        console.error('deleteLeadAdmin error:', error);
        return res.status(500).json({ message: 'Failed to delete lead' });
    }
};

// @desc    Export Audience Leads as CSV for Meta / Google Ads / WhatsApp Marketing
// @route   GET /api/leads/admin/export
// @access  Private/Admin
export const exportLeadsCSV = async (req, res) => {
    try {
        const { actionType, status } = req.query;
        let query = {};
        if (actionType && actionType !== 'all') query.actionType = actionType;
        if (status && status !== 'all') query.followUpStatus = status;

        const leads = await AudienceLead.find(query).sort({ createdAt: -1 });

        const headers = [
            'Customer Name',
            'Phone Number',
            'Email',
            'Action Type',
            'Product / Cart',
            'Value (INR)',
            'Status',
            'Last Note',
            'Created Date',
        ];

        const rows = leads.map((l) => {
            const lastNote = l.notes && l.notes.length > 0 ? l.notes[l.notes.length - 1].text.replace(/"/g, '""') : '';
            const prodName = (l.product?.name || (l.cartItems?.length ? `${l.cartItems.length} items in cart` : '')).replace(/"/g, '""');
            return [
                `"${(l.customerName || '').replace(/"/g, '""')}"`,
                `"${l.phone || ''}"`,
                `"${l.email || ''}"`,
                `"${l.actionType || ''}"`,
                `"${prodName}"`,
                `"${l.cartTotal || 0}"`,
                `"${l.followUpStatus || 'New'}"`,
                `"${lastNote}"`,
                `"${new Date(l.createdAt).toLocaleDateString()}"`,
            ].join(',');
        });

        const csvContent = [headers.join(','), ...rows].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="hridved_audience_leads.csv"');
        return res.status(200).send(csvContent);
    } catch (error) {
        console.error('exportLeadsCSV error:', error);
        return res.status(500).json({ message: 'Failed to export CSV' });
    }
};
