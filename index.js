import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import mongoose from 'mongoose';
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

// ============================================================================
// 1. CORS - ABSOLUTE FIRST
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

    console.log(`🌐 ${req.method} ${req.url} - Origin: ${origin}`);

    if (req.method === 'OPTIONS') {
        const headers = {
            'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
            'Access-Control-Max-Age': '86400',
            'Vary': 'Origin'
        };

        if (origin && allowedOrigins.includes(origin)) {
            headers['Access-Control-Allow-Origin'] = origin;
            headers['Access-Control-Allow-Credentials'] = 'true';
        } else {
            headers['Access-Control-Allow-Origin'] = '*';
        }

        console.log('✅ Preflight headers:', JSON.stringify(headers));
        res.writeHead(200, headers);
        return res.end();
    }

    // For regular requests
    if (origin && allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    res.setHeader('Vary', 'Origin');
    next();
});

// ============================================================================
// 2. RATE LIMITING (optional, skip in dev)
// ============================================================================
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isDevelopment ? 1000 : 100,
    message: 'Too many requests',
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isDevelopment,
    validate: { trustProxy: false }
});

app.use(globalLimiter);

// ============================================================================
// 3. BODY PARSING
// ============================================================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ============================================================================
// 4. LOGGING
// ============================================================================
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
        message: 'Server is running',
        timestamp: new Date().toISOString(),
        environment: NODE_ENV
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
    console.error('❌ Error:', err.message);
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
            console.log(`🚀 Server running on port ${PORT}`);
        });
    })
    .catch((err) => {
        console.error('❌ MongoDB error:', err);
        process.exit(1);
    });