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
// 2. ALLOWED ORIGINS
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

// ============================================================================
// 3. CORS (CLEAN + SAFE)
// ============================================================================

const corsOptions = {
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);

        const normalizedOrigin = origin.replace(/\/$/, '');
        const isAllowed = allowedOrigins
            .map(o => o.replace(/\/$/, ''))
            .includes(normalizedOrigin);

        console.log('🌍 Incoming Origin:', normalizedOrigin);

        if (isAllowed) {
            return callback(null, true);
        }

        console.log('🚫 CORS BLOCKED:', normalizedOrigin);
        return callback(new Error(`CORS blocked: ${normalizedOrigin}`), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));

// ============================================================================
// 4. RATE LIMITING - SEPARATE LIMITERS FOR DIFFERENT ENDPOINTS
// ============================================================================

// ✅ General API limiter (lighter restrictions)
const generalLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: isDevelopment ? 500 : 60, // 60 requests per minute
    message: {
        success: false,
        message: 'Too many requests. Please slow down.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isDevelopment
});

// ✅ Auth endpoints limiter (login, register)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: isDevelopment ? 100 : 5, // 5 attempts per 15 minutes
    message: {
        success: false,
        message: 'Too many authentication attempts. Please try again after 15 minutes.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isDevelopment
});

// ✅ Password reset limiter (more restrictive)
const passwordResetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: isDevelopment ? 50 : 3, // 3 requests per hour
    message: {
        success: false,
        message: 'Too many password reset requests. Please try again after 1 hour.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isDevelopment
});

// ✅ Profile update limiter
const profileUpdateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: isDevelopment ? 100 : 10, // 10 updates per minute
    message: {
        success: false,
        message: 'Too many profile update attempts. Please wait a moment.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isDevelopment
});

// ✅ Apply general limiter to all routes by default
app.use(generalLimiter);

// ============================================================================
// 5. BODY PARSERS
// ============================================================================

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ============================================================================
// 6. DEBUG MIDDLEWARE (REMOVE IN PRODUCTION IF NEEDED)
// ============================================================================

app.use((req, res, next) => {
    if (isDevelopment) {
        console.log('\n==============================');
        console.log('METHOD:', req.method);
        console.log('URL:', req.originalUrl);
        console.log('ORIGIN:', req.headers.origin || 'NULL');
        console.log('==============================\n');
    }
    next();
});

// ============================================================================
// 7. REQUEST LOGGER
// ============================================================================

app.use((req, res, next) => {
    req.id = uuidv4();
    console.log(
        `[${new Date().toISOString()}] [${req.id}] ${req.method} ${req.originalUrl}`
    );
    next();
});

// ============================================================================
// 8. ROUTES WITH SPECIFIC RATE LIMITERS
// ============================================================================

app.get('/api/V1/health', (req, res) => {
    res.json({
        success: true,
        status: 'OK',
        environment: NODE_ENV,
        uptime: process.uptime()
    });
});

app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Backend is running 🚀'
    });
});

// ✅ Apply specific rate limiters to user routes
app.use('/api/V1/users', authLimiter, userRouter);

// ✅ Override specific routes within userRouter with different limiters
// Note: You'll need to apply these inside the router or create separate middleware

app.use('/api/V1/gallery', galleryRouter);

// ============================================================================
// 9. 404 HANDLER
// ============================================================================

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route not found: ${req.method} ${req.originalUrl}`
    });
});

// ============================================================================
// 10. ERROR HANDLER
// ============================================================================

app.use((err, req, res, next) => {
    console.error(`❌ Error [${req.id}]:`, err.message);

    // Handle rate limit errors specifically
    if (err.statusCode === 429 || err.message === 'Too many requests') {
        return res.status(429).json({
            success: false,
            message: 'Too many requests. Please wait before trying again.'
        });
    }

    res.status(500).json({
        success: false,
        message: 'Internal server error',
        ...(isDevelopment && { error: err.message })
    });
});

// ============================================================================
// 11. DATABASE + SERVER START
// ============================================================================

mongoose.connect(MONGO_URI)
    .then(() => {
        console.log('✅ Connected to MongoDB');

        app.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT} (${NODE_ENV})`);
            console.log(`📊 Rate Limiting: ${isDevelopment ? 'Development (relaxed)' : 'Production (strict)'}`);
            console.log(`   - Auth: 5 attempts/15min`);
            console.log(`   - Password Reset: 3 requests/hour`);
            console.log(`   - General: 60 requests/minute`);
        });
    })
    .catch((err) => {
        console.error('❌ MongoDB error:', err);
        process.exit(1);
    });