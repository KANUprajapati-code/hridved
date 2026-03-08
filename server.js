import express from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import connectDB from './config/db.js';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Security Middleware
app.use(helmet());

// Simple Request Logger for Production Debugging
app.use((req, res, next) => {
  if (req.url === '/favicon.ico' || req.url === '/favicon.png') {
    return res.status(204).end();
  }
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: 'Too many requests from this IP, please try again after 15 minutes',
});
app.use('/api/', limiter);

// Trust proxy - important for production (especially behind Vercel/VPS reverse proxy)
app.set('trust proxy', 1);

// Middleware
app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf) => {
    if (req.originalUrl.includes('/api/razorpay/webhook')) {
      req.rawBody = buf;
    }
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

/* =========================
   ✅ HARDENED CORS CONFIG
========================= */

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "https://www.hridved.in",
  "https://hridved.in"
];

// Strict regex for Vercel subdomains (replaces insecure origin.includes)
const vercelRegex = /^https:\/\/hridved-.*\.vercel\.app$/;

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin) || vercelRegex.test(origin)) {
      callback(null, true);
    } else {
      console.error('CORS Blocked for origin:', origin);
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Origin',
    'Accept'
  ],
  exposedHeaders: ['set-cookie'],
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
import doctorCategoryRoutes from './routes/doctorCategoryRoutes.js';
import tipRoutes from './routes/tipRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import razorpayRoutes from './routes/razorpayRoutes.js';
import shippingRoutes from './routes/shippingRoutes.js';
import addressRoutes from './routes/addressRoutes.js';
import checkoutRoutes from './routes/checkoutRoutes.js';
import oauthRoutes from './routes/oauthRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import aboutRoutes from './routes/aboutRoutes.js';
import doctorBookingRoutes from './routes/doctorBookingRoutes.js';
import couponRoutes from './routes/couponRoutes.js';
import fshipRoutes from './routes/fshipRoutes.js';
import configRoutes from './routes/configRoutes.js';
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
app.use('/api/doctor-categories', doctorCategoryRoutes);
app.use('/api/tips', tipRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/razorpay', razorpayRoutes);
app.use('/api/shipping', shippingRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/checkout', checkoutRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/doctor-bookings', doctorBookingRoutes);
app.use('/api/about', aboutRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/fship', fshipRoutes);
app.use('/api/config', configRoutes);

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

import { initTrackingCron } from './scripts/trackingCron.js';

// Start Server
const startServer = async () => {
  try {
    await connectDB();
    initTrackingCron(); // Start automated tracking updates
    console.log(`[VAMASHIP] Final Config - BaseURL: ${process.env.VAMASHIP_BASE_URL || 'Falling back to staging'}`);
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

startServer();