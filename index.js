import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors'; // Added: Standard CORS package
import rateLimit from 'express-rate-limit';
import { v4 as uuidv4 } from 'uuid';
import { MONGO_URI, PORT, FRONTEND_URL } from './Config/env.js';
import { userRouter } from './Routers/userRouter.js';
import { galleryRouter } from './Routers/galleryRouter.js';

const app = express();

// ============================================================================
// 1. GLOBAL SETTINGS
// ============================================================================
// CRITICAL: Trust proxy for Render's load balancer
app.set('trust proxy', 1);

const NODE_ENV = process.env.NODE_ENV || 'development';
const isDevelopment = NODE_ENV === 'development';

// ============================================================================
// 2. CORS - REPLACED MANUAL LOGIC
// ============================================================================
const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
    FRONTEND_URL
].filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or Postman)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.error(`🚫 CORS blocked for origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    optionsSuccessStatus: 200 // Some legacy browsers choke on 204
}));

// ============================================================================
// 3. RATE LIMITING
// ============================================================================
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isDevelopment ? 1000 : 100,
    message: { success: false, message: 'Too many requests' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isDevelopment
});
app.use(globalLimiter);

// ============================================================================
// 4. MIDDLEWARE
// ============================================================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request Logging
app.use((req, res, next) => {
    req.id = uuidv4();
    console.log(`[${new Date().toISOString()}] [${req.id}] 📥 ${req.method} ${req.originalUrl}`);
    next();
});

// ============================================================================
// 5. ROUTES
// ============================================================================
app.get('/api/V1/health', (req, res) => {
    res.json({
        success: true,
        status: 'OK',
        environment: NODE_ENV,
        uptime: process.uptime()
    });
});

app.use('/api/V1/users', userRouter);
app.use('/api/V1/gallery', galleryRouter);

// ============================================================================
// 6. ERROR HANDLING
// ============================================================================
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route not found: ${req.method} ${req.originalUrl}`
    });
});

app.use((err, req, res, next) => {
    // If CORS error, specific status
    if (err.message === 'Not allowed by CORS') {
        return res.status(403).json({ success: false, message: err.message });
    }
    
    console.error(`❌ Error [${req.id}]:`, err.stack);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        ...(isDevelopment && { error: err.message })
    });
});

// ============================================================================
// 7. START SERVER
// ============================================================================
mongoose.connect(MONGO_URI)
    .then(() => {
        console.log('✅ Connected to MongoDB');
        app.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT} in ${NODE_ENV} mode`);
        });
    })
    .catch((err) => {
        console.error('❌ MongoDB error:', err);
        process.exit(1);
    });