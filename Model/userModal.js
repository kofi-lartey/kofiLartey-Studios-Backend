import { Schema } from "mongoose";
import { model } from "mongoose";
import normalize from "normalize-mongoose";

export const UserModal = new Schema({
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    studioName: {
        type: String,
        required: true,
    },
    password: {
        type: String,
        required: true,
    },
    profileImage: {
        type: String,
        default: null,
    },
    
    // OTP fields for email verification
    otp: {
        type: String,
        default: null,
    },
    otpExpiration: {
        type: Date,
        default: null,
    },
    
    // Account status
    isActive: {
        type: Boolean,
        default: true,
    },
    isVerified: {
        type: Boolean,
        default: false,
    },
    
    // Email verification tracking
    emailVerifiedAt: {
        type: Date,
        default: null,
    },
    failedOTPAttempts: {
        type: Number,
        default: 0,
    },
    lastOTPRequest: {
        type: Date,
        default: null,
    },
    
    // Login tracking
    failedLoginAttempts: {
        type: Number,
        default: 0,
    },
    lastLogin: {
        type: Date,
        default: null,
    },
lastActive: {
         type: Date,
         default: null,
     },
     lastLogout: {
         type: Date,
         default: null,
     },

     // Role and admin
    role: {
        type: String,
        enum: ['user', 'admin', 'moderator'],
        default: 'user',
    },
    adminCode: {
        type: String,
        default: null,
        select: false,
    },

    // Password reset (token-based)
    passwordResetToken: {
        type: String,
        default: null,
        select: false,
    },
    passwordResetExpires: {
        type: Date,
        default: null,
    },

    // Password reset OTP fields (OTP-based)
    passwordResetOTP: {
        type: String,
        default: null,
    },
    passwordResetOTPExpires: {
        type: Date,
        default: null,
    },

    // Soft delete
    deletedAt: {
        type: Date,
        default: null,
    },

}, { timestamps: true });

UserModal.plugin(normalize);

export const User = model("User", UserModal);