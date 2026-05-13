import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import mongoose from 'mongoose';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { v4 as uuidv4 } from 'uuid';
import { MONGO_URI, PORT, FRONTEND_URL } from './Config/env.js';
import { userRouter } from './Routers/userRouter.js';
import { galleryRouter } from './Routers/galleryRouter.js';

const app = express();

// CRITICAL: Trust proxy for Render
app.set('trust proxy', 1);

const NODE_ENV = process.env.NODE_ENV || 'development';
const isDevelopment = NODE_ENV === 'development';

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow cross-origin
  crossOriginOpenerPolicy: { policy: "unsafe-none" } // Allow opener access
}));

// ============================================================================
// 1. CORS - ABSOLUTE FIRST, before everything
// ============================================================================
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
    FRONTEND_URL
].filter(Boolean);
  
  // Log every request for debugging
  console.log(`🌐 ${req.method} ${req.url} - Origin: ${origin}`);
  
  // Set CORS headers if origin is allowed
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.header('Access-Control-Max-Age', '86400');
  
  // Handle preflight immediately
  if (req.method === 'OPTIONS') {
    console.log('✅ Preflight handled');
    return res.status(200).end();
  }
  
  next();
});

// ============================================================================
// 2. SECURITY HEADERS - But only non-CORS ones
// ============================================================================

// ============================================================================
// 3. RATE LIMITING
// ============================================================================
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDevelopment ? 1000 : 100,
  message: 'Too many requests',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => isDevelopment,
  validate: { trustProxy: false }
});

app.use(globalLimiter);

// ============================================================================
// 4. BODY PARSING
// ============================================================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ============================================================================
// 5. LOGGING
// ============================================================================
app.use((req, res, next) => {
  req.id = uuidv4();
  console.log(`[${new Date().toISOString()}] [${req.id}] 📥 ${req.method} ${req.originalUrl}`);
  next();
});

// ============================================================================
// 6. ROUTES
// ============================================================================
app.get('/api/V1/health', (req, res) => {
  res.json({
    success: true,
    status: 'OK',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV
  });
});

app.use('/api/V1/users', userRouter);
app.use('/api/V1/gallery', galleryRouter);

// ============================================================================
// 7. ERROR HANDLING
// ============================================================================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
});

app.use((err, req, res, next) => {
  console.error('❌ Error:', err.message);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    ...(isDevelopment && { error: err.message })
  });
});

// ============================================================================
// 8. START SERVER
// ============================================================================
mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB');
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB error:', err);
    process.exit(1);
  });