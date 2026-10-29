import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import WebsiteEvent from '../models/WebsiteEvent.js';

const allowedEvents = new Set([
  'page_view', 
  'view_item_list', 
  'select_item', 
  'product_view', 
  'view_item', 
  'search', 
  'add_to_wishlist', 
  'add_to_cart', 
  'remove_from_cart', 
  'view_cart', 
  'begin_checkout', 
  'add_shipping_info', 
  'add_payment_info', 
  'order_created', 
  'purchase', 
  'consultation_click', 
  'whatsapp_click', 
  'pincode_check', 
  'newsletter_signup', 
  'order_tracking_lookup'
]);

export const collectWebsiteEvent = asyncHandler(async (req, res) => {
  const { eventType, sessionId, path, productId, orderId, searchQuery, consentVersion } = req.body || {};
  if (!allowedEvents.has(eventType) || typeof sessionId !== 'string' || !/^[a-zA-Z0-9_-]{16,80}$/.test(sessionId) ||
      typeof path !== 'string' || !path.startsWith('/') || path.length > 180 || consentVersion !== 'analytics-v1') {
    res.status(400);
    throw new Error('Invalid analytics event');
  }

  // Deduplication check for purchase events to prevent multi-count
  if (eventType === 'purchase' && orderId && mongoose.isValidObjectId(orderId)) {
    const existingPurchase = await WebsiteEvent.findOne({ eventType: 'purchase', orderId });
    if (existingPurchase) {
      return res.status(200).json({ success: true, deduplicated: true });
    }
  }

  const record = { eventType, sessionId, path, consentVersion };
  if (productId && mongoose.isValidObjectId(productId)) record.productId = productId;
  if ((eventType === 'order_created' || eventType === 'purchase') && orderId && mongoose.isValidObjectId(orderId)) {
    record.orderId = orderId;
  }
  if (eventType === 'search' && typeof searchQuery === 'string') {
    record.searchQuery = searchQuery.slice(0, 100).trim();
  }

  await WebsiteEvent.create(record);
  res.status(202).json({ success: true });
});

export const getWebsiteEventSummary = asyncHandler(async (req, res) => {
  const from = new Date();
  from.setDate(from.getDate() - Math.min(Math.max(Number(req.query.days) || 30, 1), 90));
  const [counts, sessions] = await Promise.all([
    WebsiteEvent.aggregate([
      { $match: { createdAt: { $gte: from } } },
      { $group: { _id: '$eventType', count: { $sum: 1 } } },
    ]),
    WebsiteEvent.distinct('sessionId', { createdAt: { $gte: from } }),
  ]);
  const byType = Object.fromEntries(counts.map(row => [row._id, row.count]));
  const ordersCompleted = (byType.purchase || 0) || (byType.order_created || 0);
  res.json({
    days: Math.round((Date.now() - from.getTime()) / 86400000),
    uniqueSessions: sessions.length,
    pageViews: byType.page_view || 0,
    productViews: (byType.product_view || 0) + (byType.view_item || 0),
    searches: byType.search || 0,
    wishlistAdds: byType.add_to_wishlist || 0,
    addToCart: byType.add_to_cart || 0,
    cartViews: byType.view_cart || 0,
    checkoutStarted: byType.begin_checkout || 0,
    ordersCreated: byType.order_created || 0,
    purchases: byType.purchase || 0,
    consultationClicks: byType.consultation_click || 0,
    whatsappClicks: byType.whatsapp_click || 0,
    conversionRate: sessions.length ? Number((ordersCompleted / sessions.length * 100).toFixed(2)) : 0,
  });
});
