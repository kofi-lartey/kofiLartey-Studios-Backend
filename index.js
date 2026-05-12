import dotenv from 'dotenv';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import { MONGO_URI, PORT } from './Config/env.js';
import { userRouter } from './Routers/userRouter.js';
import { galleryRouter } from './Routers/galleryRouter.js';

dotenv.config();

const app = express();

app.use(cors());

// 2. Then other middlewares
app.use(express.json());



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