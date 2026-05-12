import { JWT_SECRET } from "../Config/env.js";
import { User } from "../Model/userModal.js";
import jwt from 'jsonwebtoken';

export const authenticate = async (req, res, next) => {
    try {
        // Step 1: Get token from header
        const authHeader = req.header('Authorization');

        if (!authHeader) {
            return res.status(401).json({
                success: false,
                message: 'Access denied. No token provided.',
            });
        }

        // Step 2: Check if Bearer token format
        if (!authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Invalid token format. Use Bearer <token>',
            });
        }

        // Step 3: Extract token
        const token = authHeader.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Access denied. Token is empty.',
            });
        }

        // Step 4: Verify token
        const decoded = jwt.verify(token, JWT_SECRET);

        // Step 5: Check if user still exists in database
        const user = await User.findById(decoded.id).select('-password');

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User no longer exists. Please register again.',
            });
        }

        // Step 6: Check if user account is active
        if (!user.isActive) {
            return res.status(403).json({
                success: false,
                message: 'Your account has been deactivated. Please contact support.',
            });
        }

        // Step 7: Attach full user object to request
        req.user = user;
        req.userId = user._id;

        // Update last active
        user.lastActive = new Date();
        await user.save({ validateBeforeSave: false });

        next();

    } catch (error) {
        console.error('Auth Error:', error.message);

        // Handle specific JWT errors
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Invalid token. Please login again.',
            });
        }

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token has expired. Please login again.',
                code: 'TOKEN_EXPIRED',
            });
        }

        if (error.name === 'NotBeforeError') {
            return res.status(401).json({
                success: false,
                message: 'Token not yet active.',
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Authentication error. Please try again.',
        });
    }
};