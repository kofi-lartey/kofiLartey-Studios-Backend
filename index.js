import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { v4 as uuidv4 } from 'uuid';
import { MONGO_URI, PORT, FRONTEND_URL } from './Config/env.js';
import { userRouter } from './Routers/userRouter.js';
import { galleryRouter } from './Routers/galleryRouter.js';

const app = express();

// ============================================================================
// 1. GLOBAL SETTINGS
// ============================================================================

app.set('trust proxy', 1);

const NODE_ENV = process.env.NODE_ENV || 'development';
const isDevelopment = NODE_ENV === 'development';

// ============================================================================
// 2. CORS (FIXED)
// ============================================================================

const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',

    'https://kofilartey-studios.netlify.app',
    'https://www.kofilartey-studios.netlify.app',

    FRONTEND_URL
].filter(Boolean);

console.log('✅ Allowed Origins:', allowedOrigins);

const corsOptions = {
    origin: (origin, callback) => {

        if (!origin) return callback(null, true);

        const normalizedOrigin = origin.replace(/\/$/, '');

        const normalizedAllowed = allowedOrigins.map(o =>
            o.replace(/\/$/, '')
        );

        console.log('🌍 Incoming Origin:', normalizedOrigin);

        if (normalizedAllowed.includes(normalizedOrigin)) {
            console.log('✅ CORS ALLOWED');
            return callback(null, true);
        }

        console.log('🚫 CORS BLOCKED:', normalizedOrigin);

        // IMPORTANT: NEVER throw error
        return callback(null, false);
    },

    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With'
    ]
};

// 🔥 MUST be FIRST before everything
app.use(cors(corsOptions));
app.use((req, res, next) => {
    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }
    next();
});

// ============================================================================
// 3. RATE LIMITING
// ============================================================================

const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isDevelopment ? 1000 : 100,
    message: {
        success: false,
        message: 'Too many requests'
    },
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

// 🔍 DEBUG MIDDLEWARE (IMPORTANT)
app.use((req, res, next) => {
    console.log('\n==============================');
    console.log('METHOD:', req.method);
    console.log('URL:', req.originalUrl);
    console.log('ORIGIN:', req.headers.origin || 'NULL');
    console.log('ACCESS-CONTROL-REQUEST-METHOD:', req.headers['access-control-request-method'] || 'NULL');
    console.log('ACCESS-CONTROL-REQUEST-HEADERS:', req.headers['access-control-request-headers'] || 'NULL');
    console.log('==============================\n');

    next();
});

// Request Logger
app.use((req, res, next) => {
    req.id = uuidv4();

    console.log(
        `[${new Date().toISOString()}] [${req.id}] 📥 ${req.method} ${req.originalUrl}`
    );

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
// 6. 404
// ============================================================================

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route not found: ${req.method} ${req.originalUrl}`
    });
});

// ============================================================================
// 7. ERROR HANDLER
// ============================================================================

app.use((err, req, res, next) => {
    console.error(`❌ Error [${req.id}]:`, err.stack);

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
            console.log(`🚀 Server running on port ${PORT} in ${NODE_ENV} mode`);
        });
    })
    .catch((err) => {
        console.error('❌ MongoDB error:', err);
        process.exit(1);
    });