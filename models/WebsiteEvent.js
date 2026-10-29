import mongoose from 'mongoose';

const websiteEventSchema = new mongoose.Schema({
  eventType: { 
    type: String, 
    enum: [
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
      'order_tracking_lookup',
      'assistant_open',
      'assistant_query',
      'assistant_escalate'
    ], 
    required: true 
  },
  sessionId: { type: String, required: true, maxlength: 80 },
  path: { type: String, required: true, maxlength: 180 },
  searchQuery: { type: String, maxlength: 100 },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  consentVersion: { type: String, required: true, maxlength: 30 },
}, { timestamps: true });

websiteEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });
websiteEventSchema.index({ sessionId: 1, createdAt: -1 });
websiteEventSchema.index({ eventType: 1, orderId: 1 });

export default mongoose.model('WebsiteEvent', websiteEventSchema);
