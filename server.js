import express from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import mongoose from 'mongoose';
import connectDB from './config/db.js';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy - critical for production behind Vercel / Cloudflare reverse proxy
app.set('trust proxy', 1);

/* =========================
   ✅ HARDENED CORS CONFIG (Placed FIRST to handle preflights)
========================= */

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "https://www.hridved.in",
  "https://hridved.in"
];

// Strict regex for Vercel preview/production subdomains
const vercelRegex = /^https:\/\/hridved-.*\.vercel\.app$/;

// Universal Pre-flight OPTIONS & CORS Headers Interceptor (Guarantees HTTP 200 OK for every OPTIONS preflight)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const isAllowed = !origin || allowedOrigins.includes(origin) || vercelRegex.test(origin);

  if (origin && isAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Origin, Accept, X-Requested-With, X-CSRF-Token, Idempotency-Key, idempotency-key, x-idempotency-key, Cache-Control, Pragma');
    res.setHeader('Access-Control-Max-Age', '86400');
  }

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin) || vercelRegex.test(origin)) {
      callback(null, true);
    } else {
      console.warn('CORS Blocked for origin:', origin);
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Origin',
    'Accept',
    'X-Requested-With',
    'X-CSRF-Token',
    'Idempotency-Key',
    'idempotency-key',
    'x-idempotency-key',
    'Cache-Control',
    'Pragma'
  ],
  exposedHeaders: ['set-cookie'],
  optionsSuccessStatus: 200 // Legacy browser support for 204 preflight
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Security Headers (configured not to interfere with cross-origin embeds)
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Request Logger for Production Debugging
app.use((req, res, next) => {
  if (req.url === '/favicon.ico' || req.url === '/favicon.png') {
    return res.status(204).end();
  }
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Rate Limiting (Skips OPTIONS preflight to never break CORS)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 2000, // Reasonable capacity for modern e-commerce browsing
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS',
  message: { message: 'Too many requests from this IP, please try again after 15 minutes' },
});
app.use('/api/', limiter);

// Serverless DB Connection Check
app.use(async (req, res, next) => {
  if (mongoose.connection.readyState === 0) {
    try {
      await connectDB();
    } catch (dbErr) {
      console.error('Serverless auto DB connect warning:', dbErr.message);
    }
  }
  next();
});

// Middleware
app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());


/* =========================
   ROUTES
========================= */

import userRoutes from './routes/userRoutes.js';
import productRoutes from './routes/productRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import concernRoutes from './routes/concernRoutes.js';
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
import shippingRoutes from './routes/shippingRoutes.js';
import addressRoutes from './routes/addressRoutes.js';
import checkoutRoutes from './routes/checkoutRoutes.js';
import oauthRoutes from './routes/oauthRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import aboutRoutes from './routes/aboutRoutes.js';
import doctorBookingRoutes from './routes/doctorBookingRoutes.js';
import couponRoutes from './routes/couponRoutes.js';
import configRoutes from './routes/configRoutes.js';
import leadRoutes from './routes/leadRoutes.js';
import websiteEventRoutes from './routes/websiteEventRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import razorpayRoutes from './routes/razorpayRoutes.js';
import aiAssistantRoutes from './routes/aiAssistantRoutes.js';
import systemHealthRoutes from './routes/systemHealthRoutes.js';
import { notFound, errorHandler } from './middleware/errorMiddleware.js';

app.use('/api/users', userRoutes);
app.use('/api/auth', oauthRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/concerns', concernRoutes);
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
app.use('/api/config', configRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/website-events', websiteEventRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/assistant', aiAssistantRoutes);
app.use('/api/system-health', systemHealthRoutes);

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

// Start Server (Standalone vs Serverless)
const startServer = async () => {
  try {
    await connectDB();
    initTrackingCron(); // Start automated tracking updates
    console.log('[SHIPPING] Local courier shipping system initialized');
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

if (!process.env.VERCEL) {
  startServer();
} else {
  connectDB().catch(err => console.error('Initial Vercel DB connection:', err.message));
}

export default app;
