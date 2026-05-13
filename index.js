import dotenv from 'dotenv';
dotenv.config(); // ← MUST be first, before other imports use env vars

import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { v4 as uuidv4 } from 'uuid';
import { MONGO_URI, PORT, FRONTEND_URL } from './Config/env.js';
import { userRouter } from './Routers/userRouter.js';
import { galleryRouter } from './Routers/galleryRouter.js';

const app = express();
const NODE_ENV = process.env.NODE_ENV || 'development';
const isDevelopment = NODE_ENV === 'development';
const ALLOW_LOCALHOST = process.env.ALLOW_LOCALHOST === 'true' || NODE_ENV === 'development';


// ============================================================================
// 1. SECURITY MIDDLEWARE (Must be first)
// ============================================================================

// Security headers
app.use(helmet());

// Base allowed origins (always included)
// CORS Configuration

const allowedOrigins = [];

// Always add production frontend URL
if (FRONTEND_URL) {
    allowedOrigins.push(FRONTEND_URL.replace(/\/$/, '')); // Remove trailing slash
}

// Allow localhost for development or if explicitly enabled
if (ALLOW_LOCALHOST) {
    allowedOrigins.push(
        'http://localhost:5173',
        'http://localhost:3000',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:3000'
    );
}

// Fallback if no origins configured
if (allowedOrigins.length === 0) {
    console.warn('⚠️ No CORS origins configured!');
    allowedOrigins.push('http://localhost:5173');
}

console.log('🌍 Environment:', NODE_ENV);
console.log('🏠 Allow Localhost:', ALLOW_LOCALHOST);
console.log('✅ Allowed CORS origins:', allowedOrigins);

app.use(
    cors({
        origin: (origin, callback) => {
            // Allow requests with no origin (Postman, mobile apps, etc.)
            if (!origin) {
                return callback(null, true);
            }

            const isAllowed = allowedOrigins.includes(origin);

            if (isAllowed) {
                callback(null, true);
            } else {
                console.warn(`❌ CORS blocked: ${origin}`);
                console.warn('   Allowed:', allowedOrigins);
                callback(null, false);
            }
        },
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
        credentials: true,
        optionsSuccessStatus: 200,
        maxAge: 3600
    })
);

// Rate Limiting - Global
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => isDevelopment // Skip rate limiting in development
});

app.use(globalLimiter);

// ============================================================================
// 2. BODY PARSING MIDDLEWARE
// ============================================================================

// Parse JSON with size limit
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Content-Type validation - Skip OPTIONS requests (CORS preflight)
app.use((req, res, next) => {
    // IMPORTANT: Skip CORS preflight OPTIONS requests
    if (req.method === 'OPTIONS') {
        return next();
    }

    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        const contentType = req.headers['content-type'];
        if (!contentType || !contentType.includes('application/json')) {
            return res.status(415).json({
                success: false,
                message: 'Content-Type must be application/json',
                timestamp: new Date().toISOString()
            });
        }
    }
    next();
});

// ============================================================================
// 3. REQUEST TRACKING & LOGGING MIDDLEWARE
// ============================================================================

// Add request ID for tracking
app.use((req, res, next) => {
    req.id = uuidv4();
    const timestamp = new Date().toISOString();

    console.log(`[${timestamp}] [${req.id}] 📥 ${req.method} ${req.originalUrl}`);

    // Capture response for logging
    const originalSend = res.send;
    res.send = function (data) {
        const statusCode = res.statusCode;
        const level = statusCode >= 400 ? '❌ ERROR' : '✅ SUCCESS';
        console.log(`[${timestamp}] [${req.id}] ${level} Status: ${statusCode}`);
        return originalSend.call(this, data);
    };

    next();
});

// ============================================================================
// 4. RATE LIMITING FOR AUTH ENDPOINTS
// ============================================================================

// Stricter rate limit for auth endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per windowMs
    message: 'Too many authentication attempts, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => isDevelopment
});

// Apply auth rate limiting
app.use('/api/V1/users/register', authLimiter);
app.use('/api/V1/users/login', authLimiter);
app.use('/api/V1/users/forgot-password', authLimiter);
app.use('/api/V1/users/reset-password', authLimiter);

// ============================================================================
// 5. API ROUTES
// ============================================================================

// Health check route (must be before other routes to avoid conflicts)
app.get('/api/V1/health', (req, res) => {
    res.status(200).json({
        success: true,
        status: 'OK',
        message: 'Server is running',
        timestamp: new Date().toISOString(),
        environment: NODE_ENV,
        uptime: process.uptime()
    });
});

// Main routes
app.use('/api/V1/users', userRouter);
app.use('/api/V1/gallery', galleryRouter);

// Root route
app.get('/', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Kofi Lartey Studios API',
        version: '1.0.0',
        documentation: '/api/V1/health'
    });
});

// ============================================================================
// 6. ERROR HANDLING MIDDLEWARE
// ============================================================================

// 404 - Route not found
app.use((req, res) => {
    console.error(`[${new Date().toISOString()}] [${req.id}] ❌ 404 - Route not found: ${req.method} ${req.originalUrl}`);
    res.status(404).json({
        success: false,
        message: `Route not found: ${req.method} ${req.originalUrl}`,
        requestId: req.id,
        timestamp: new Date().toISOString()
    });
});

// Global error handler
app.use((err, req, res, next) => {
    const statusCode = err.status || err.statusCode || 500;
    const isDuplicate = err.code === 11000;
    const isValidationError = err.name === 'ValidationError';
    const isJWTError = err.name === 'JsonWebTokenError';
    const isJWTExpired = err.name === 'TokenExpiredError';

    let message = err.message || 'Internal server error';
    let details = null;

    // Handle specific error types
    if (isDuplicate) {
        message = 'Duplicate field value entered';
        details = Object.keys(err.keyValue || {});
    } else if (isValidationError) {
        message = 'Validation error';
        details = Object.keys(err.errors || {});
    } else if (isJWTError) {
        message = 'Invalid authentication token';
    } else if (isJWTExpired) {
        message = 'Authentication token has expired';
    }

    // Add CORS headers to error responses
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Access-Control-Allow-Credentials', 'true');
    }

    console.error(`[${new Date().toISOString()}] [${req.id}] ❌ ${statusCode} - ${message}`, {
        error: err.message,
        stack: isDevelopment ? err.stack : undefined,
        path: req.originalUrl,
        method: req.method
    });

    res.status(statusCode).json({
        success: false,
        message,
        ...(details && { details }),
        requestId: req.id,
        timestamp: new Date().toISOString(),
        ...(isDevelopment && {
            error: err.message,
            stack: err.stack
        })
    });
});

// ============================================================================
// 7. DATABASE CONNECTION & SERVER START
// ============================================================================

const startServer = async () => {
    try {
        // Connect to MongoDB first
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB');

        // Handle MongoDB connection events
        mongoose.connection.on('disconnected', () => {
            console.warn('⚠️ MongoDB disconnected');
        });

        mongoose.connection.on('error', (err) => {
            console.error('❌ MongoDB connection error:', err.message);
        });

        // Start server only after DB connection
        const server = app.listen(PORT, () => {
            console.log(`\n🚀 Server is running on port ${PORT}`);
            console.log(`📡 Environment: ${NODE_ENV}`);
            console.log(`🔗 Health check: http://localhost:${PORT}/api/V1/health\n`);
        });

        // Graceful shutdown
        const gracefulShutdown = (signal) => {
            console.log(`\n⚠️ ${signal} received. Shutting down gracefully...`);
            server.close(() => {
                console.log('✅ HTTP server closed');
                mongoose.connection.close(false).then(() => {
                    console.log('✅ MongoDB connection closed');
                    process.exit(0);
                });
            });

            // Force shutdown after 10 seconds
            setTimeout(() => {
                console.error('❌ Forced shutdown after timeout');
                process.exit(1);
            }, 10000);
        };

        // Handle shutdown signals
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));

        // Handle unhandled rejections
        process.on('unhandledRejection', (err) => {
            console.error('❌ Unhandled Rejection:', err);
            server.close(() => process.exit(1));
        });

    } catch (err) {
        console.error('❌ Failed to start server:', err.message);
        process.exit(1);
    }
};

// Start the server
startServer();