import express from 'express';
import { FRONTEND_URL, MONGO_URI, PORT } from './Config/env.js';
import mongoose from 'mongoose';
import cors from 'cors';
import { userRouter } from './Routers/userRouter.js';
import { galleryRouter } from './Routers/galleryRouter.js';

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS configuration
app.use(cors({
    origin: [FRONTEND_URL, 'http://localhost:5173'].filter(Boolean),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Request logging middleware
app.use((req, res, next) => {
    console.log(`${req.method} ${req.originalUrl}`);
    next();
});

// Routes
app.use('/api/V1/users', userRouter);
app.use('/api/V1/gallery', galleryRouter);

// Test route
app.get('/api/V1/health', (req, res) => {
    res.json({
        status: 'OK',
        message: 'Server is running',
        timestamp: new Date().toISOString()
    });
});

// 404 handler
app.use((req, res) => {
    console.log(`404 - Route not found: ${req.method} ${req.originalUrl}`);
    res.status(404).json({
        success: false,
        message: `Route not found: ${req.method} ${req.originalUrl}`
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Global error handler:', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// MongoDB connection
mongoose.connect(MONGO_URI)
    .then(() => {
        console.log('Connected to MongoDB');
    })
    .catch((err) => {
        console.error('Error connecting to MongoDB:', err);
    });

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}: http://localhost:${PORT}`);
    console.log(`API Base URL: http://localhost:${PORT}/api/V1`);
    console.log(`Gallery API URL: http://localhost:${PORT}/api/V1/gallery`);
});