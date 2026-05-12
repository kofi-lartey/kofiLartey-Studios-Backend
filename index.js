import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import { FRONTEND_URL, MONGO_URI, PORT } from './Config/env.js';
import { userRouter } from './Routers/userRouter.js';
import { galleryRouter } from './Routers/galleryRouter.js';

const app = express();

// 1. MIDDLEWARE 
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 2. CORS CONFIGURATION
// This MUST come before your routes
const allowedOrigins = [
    'http://localhost:5173', 
    FRONTEND_URL 
];

// app.use(cors({
//     origin: function (origin, callback) {
//         // Allow requests with no origin (like mobile apps or Postman)
//         if (!origin) return callback(null, true);

//         if (allowedOrigins.indexOf(origin) !== -1) {
//             callback(null, true);
//         } else {
//             // Log exactly what origin is being blocked for easier debugging
//             console.log("CORS blocked origin:", origin);
//             callback(new Error('Not allowed by CORS'));
//         }
//     },
//     credentials: true,
//     methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
//     allowedHeaders: ['Content-Type', 'Authorization']
// }));

app.use(cors());



// 3. LOGGING
app.use((req, res, next) => {
    console.log(`${req.method} ${req.originalUrl}`);
    next();
});

// 4. ROUTES
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

// 5. ERROR HANDLING
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route not found: ${req.method} ${req.originalUrl}`
    });
});

app.use((err, req, res, next) => {
    console.error('Global error handler:', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: err.message 
    });
});

// 6. CONNECTIONS
mongoose.connect(MONGO_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch((err) => console.error('Error connecting to MongoDB:', err));

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});