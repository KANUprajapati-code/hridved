import express from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import connectDB from './config/db.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy - important for production
app.set('trust proxy', 1);

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

/* =========================
   ✅ FIXED CORS CONFIG
========================= */

const allowedOrigins = [
  "http://localhost:5173",
  "https://www.hridved.in",
  "https://hridved.in",
  "https://hridved-opal.vercel.app"
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || (origin && origin.endsWith('.vercel.app'))) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));


/* =========================
   ROUTES
========================= */

import userRoutes from './routes/userRoutes.js';
import productRoutes from './routes/productRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import cartRoutes from './routes/cartRoutes.js';
import blogRoutes from './routes/blogRoutes.js';
import contactRoutes from './routes/contactRoutes.js';
import contentRoutes from './routes/contentRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import doctorRoutes from './routes/doctorRoutes.js';
import tipRoutes from './routes/tipRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import razorpayRoutes from './routes/razorpayRoutes.js';
import shippingRoutes from './routes/shippingRoutes.js';
import addressRoutes from './routes/addressRoutes.js';
import checkoutRoutes from './routes/checkoutRoutes.js';
import oauthRoutes from './routes/oauthRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import aboutRoutes from './routes/aboutRoutes.js';
import doctorPaymentRoutes from './routes/doctorPaymentRoutes.js';
import couponRoutes from './routes/couponRoutes.js';
import { notFound, errorHandler } from './middleware/errorMiddleware.js';

app.use('/api/users', userRoutes);
app.use('/api/auth', oauthRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/blogs', blogRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/tips', tipRoutes);
app.use('/api/config', paymentRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/razorpay', razorpayRoutes);
app.use('/api/shipping', shippingRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/checkout', checkoutRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/doctor-bookings', doctorPaymentRoutes);
app.use('/api/about', aboutRoutes);
app.use('/api/coupons', couponRoutes);

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use('/uploads', express.static(path.join(__dirname, '/uploads')));

app.get('/', (req, res) => {
  res.send('API is running...');
});

// Error Handling
app.use(notFound);
app.use(errorHandler);

// Start Server
const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

startServer();