import dotenv from 'dotenv';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { v4 as uuidv4 } from 'uuid';
import { MONGO_URI, PORT, FRONTEND_URL } from './Config/env.js';
import { userRouter } from './Routers/userRouter.js';
import { galleryRouter } from './Routers/galleryRouter.js';

dotenv.config();

const app = express();
const NODE_ENV = process.env.NODE_ENV || 'development';
const isDevelopment = NODE_ENV === 'development';

// ============================================================================
// 1. SECURITY MIDDLEWARE
// ============================================================================

// Security headers
app.use(helmet());

// CORS Configuration - Environment-specific
const allowedOrigins = isDevelopment
    ? ['http://localhost:5173', 'http://localhost:3000']
    : [FRONTEND_URL];

app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                callback(new Error('CORS policy: Origin not allowed'));
            }
        },
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        credentials: true,
        optionsSuccessStatus: 200,
        maxAge: 3600
    })
);

// Rate Limiting - Different limits for different endpoints
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => isDevelopment
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per windowMs
    message: 'Too many authentication attempts, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => isDevelopment
});

app.use(globalLimiter);

// ============================================================================
// 2. BODY PARSING & VALIDATION MIDDLEWARE
// ============================================================================

// Parse JSON with size limit
app.use(express.json({ limit: '10mb' }));

// Request validation middleware - Content-Type validation
app.use((req, res, next) => {
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        const contentType = req.headers['content-type'];
        if (!contentType || !contentType.includes('application/json')) {
            return res.status(415).json({
                success: false,
                message: 'Content-Type must be application/json'
            });
        }
    }
    next();
});

// ============================================================================
// 3. REQUEST TRACKING & LOGGING
// ============================================================================

// Add request ID for tracking
app.use((req, res, next) => {
    req.id = uuidv4();
    const timestamp = new Date().toISOString();
    
    console.log(`[${timestamp}] [${req.id}] ${req.method} ${req.originalUrl}`);
    
    // Log response details
    const originalSend = res.send;
    res.send = function (data) {
        const statusCode = res.statusCode;
        const level = statusCode >= 400 ? 'ERROR' : 'INFO';
        console.log(`[${timestamp}] [${req.id}] Response: ${statusCode} ${level}`);
        return originalSend.call(this, data);
    };
    
    next();
});

// ============================================================================
// 4. PROTECTED ROUTES WITH RATE LIMITING
// ============================================================================

// Apply stricter rate limit to auth endpoints
app.use('/api/V1/users/register', authLimiter);
app.use('/api/V1/users/login', authLimiter);
app.use('/api/V1/users/forgot-password', authLimiter);
app.use('/api/V1/users/reset-password', authLimiter);

// ============================================================================
// 5. ROUTES
// ============================================================================

app.use('/api/V1/users', userRouter);
app.use('/api/V1/gallery', galleryRouter);

// Health check route
app.get('/api/V1/health', (req, res) => {
    res.status(200).json({
        success: true,
        status: 'OK',
        message: 'Server is running',
        timestamp: new Date().toISOString(),
        environment: NODE_ENV
    });
});

// ============================================================================
// 6. ERROR HANDLING MIDDLEWARE
// ============================================================================

// 404 handler
app.use((req, res) => {
    console.error(`[ERROR] [${req.id}] 404 - Route not found: ${req.method} ${req.originalUrl}`);
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

    if (isDuplicate) {
        message = 'Duplicate field value entered';
        details = Object.keys(err.keyValue);
    } else if (isValidationError) {
        message = 'Validation error';
        details = Object.keys(err.errors);
    } else if (isJWTError) {
        message = 'Invalid authentication token';
    } else if (isJWTExpired) {
        message = 'Authentication token has expired';
    }

    console.error(`[ERROR] [${req.id}] ${statusCode} - ${message}`, {
        error: err.message,
        stack: isDevelopment ? err.stack : undefined,
        path: req.originalUrl
    });

    res.status(statusCode).json({
        success: false,
        message,
        ...(details && { details }),
        requestId: req.id,
        timestamp: new Date().toISOString(),
        ...(isDevelopment && { error: err.message, stack: err.stack })
    });
});

// ============================================================================
// 7. DATABASE & SERVER INITIALIZATION
// ============================================================================

// MongoDB connection
mongoose.connect(MONGO_URI)
    .then(() => {
        console.log('✓ Connected to MongoDB');
    })
    .catch((err) => {
        console.error('✗ Error connecting to MongoDB:', err.message);
        process.exit(1);
    });

// Handle MongoDB connection events
mongoose.connection.on('disconnected', () => {
    console.warn('⚠ MongoDB disconnected');
});

mongoose.connection.on('error', (err) => {
    console.error('✗ MongoDB connection error:', err.message);
});

// Start server
const server = app.listen(PORT, () => {
    console.log(`✓ Server is running on port ${PORT} in ${NODE_ENV} mode`);
});

// Graceful shutdown
process.on('unhandledRejection', (err) => {
    console.error('✗ Unhandled Rejection:', err.message);
    server.close(() => process.exit(1));
});

process.on('SIGTERM', () => {
    console.log('⚠ SIGTERM received. Shutting down gracefully...');
    server.close(() => {
        console.log('✓ Server closed');
        mongoose.connection.close();
        process.exit(0);
    });
});