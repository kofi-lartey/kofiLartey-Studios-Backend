import { User } from "../Model/userModal.js";
import { registerSchema, resendOTPSchema, verifyEmailSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema, resetPasswordWithOTPSchema, verifyResetOTPSchema, updateProfileSchema } from "../Scheme/userSchema.js";
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { OTPExpirationTime, OTPGenerator } from "../Utiles/additionals.js";
import { sendOTPEmail, sendPasswordResetOTP, sendVerificationEmail } from "../Utiles/mailer.js";
import { FRONTEND_URL, JWT_EXPIRES_IN, JWT_SECRET } from "../Config/env.js";
import crypto from 'crypto';

export const register = async (req, res) => {
    try {
        // 1. Validate request body
        const { error, value } = registerSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message,
                errors: error.details.map(detail => ({
                    field: detail.path[0],
                    message: detail.message
                }))
            });
        }

        const { name, email, studioName, password } = value;

        // 2. Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ // 409 Conflict is more appropriate than 400
                success: false,
                message: 'Email is already registered. Please use a different email or login.',
                action: 'login' // Helpful for frontend
            });
        }

        // 3. Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // 4. Generate OTP and hash it
        const otpCode = OTPGenerator(6);
        const hashedOTP = await bcrypt.hash(otpCode, 10);
        const otpExpiration = OTPExpirationTime();

        // 5. Create new user
        const newUser = await User.create({
            name,
            email: email.toLowerCase().trim(), // Normalize email
            studioName,
            password: hashedPassword,
            otp: hashedOTP,
            otpExpiration,
            isVerified: false,
            isActive: true,
            role: 'user'
        });

        // 6. Send OTP to email (don't await if you want faster response, but handle errors)
        try {
            await sendOTPEmail(email, studioName, otpCode);
        } catch (emailError) {
            console.error('Failed to send OTP email:', emailError);
            // Still return success but notify user
            return res.status(201).json({
                success: true,
                message: 'Account created but verification email failed. Please contact support.',
                data: {
                    user: {
                        id: newUser._id,
                        name: newUser.name,
                        email: newUser.email,
                        studioName: newUser.studioName,
                    },
                    requiresManualVerification: true
                },
            });
        }

        // 7. Generate JWT token
        const token = jwt.sign(
            {
                id: newUser._id,
                email: newUser.email,
                studioName: newUser.studioName,
                role: newUser.role,
                isVerified: newUser.isVerified
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        // 8. Prepare response data (remove circular reference)
        const responseData = {
            token,
            user: {
                id: newUser._id,
                name: newUser.name,
                email: newUser.email,
                studioName: newUser.studioName,
                profileImage: newUser.profileImage,
                isActive: newUser.isActive,
                isVerified: newUser.isVerified,
                role: newUser.role,
            }
        };

        // 9. Return successful response
        return res.status(201).json({
            success: true,
            message: 'Account created successfully! Please check your email for verification code.',
            data: responseData,
            nextStep: 'verify-email',
            verificationEmailSent: true
        });

    } catch (error) {
        console.error('Error in register controller:', error);

        // Handle duplicate key error (MongoDB)
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: 'Email already exists. Please use a different email.',
            });
        }

        // Handle validation errors
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: Object.values(error.errors).map(err => err.message)
            });
        }

        res.status(500).json({
            success: false,
            message: 'An error occurred while registering. Please try again later.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// verify email otp
export const verifyEmail = async (req, res) => {
    try {
        // Validate request body with Joi schema
        const { error, value } = verifyEmailSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message,
                errors: error.details.map(detail => ({
                    field: detail.path[0],
                    message: detail.message
                }))
            });
        }

        const { email, otp } = value;

        // Check if user exists
        const user = await User.findOne({
            email: email.toLowerCase().trim()
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found. Please register first.',
                action: 'register'
            });
        }

        // Check if user is already verified
        if (user.isVerified) {
            return res.status(400).json({
                success: false,
                message: 'Email is already verified. Please login to continue.',
                action: 'login'
            });
        }

        // Check if user account is active
        if (!user.isActive) {
            return res.status(403).json({
                success: false,
                message: 'Your account has been locked. Please contact support for assistance.',
                action: 'support'
            });
        }

        // Check if OTP exists
        if (!user.otp || !user.otpExpiration) {
            return res.status(400).json({
                success: false,
                message: 'No verification code found. Please request a new verification code.',
                action: 'resend-otp'
            });
        }

        // Check if OTP has expired
        if (user.otpExpiration < new Date()) {
            // Clear expired OTP
            user.otp = null;
            user.otpExpiration = null;
            await user.save();

            return res.status(400).json({
                success: false,
                message: 'Verification code has expired. Please request a new code.',
                action: 'resend-otp',
                expired: true
            });
        }

        // Verify OTP
        const isOTPValid = await bcrypt.compare(otp, user.otp);
        if (!isOTPValid) {
            // Track failed attempts
            user.failedOTPAttempts = (user.failedOTPAttempts || 0) + 1;

            const remainingAttempts = 5 - user.failedOTPAttempts;

            // Lock account after 5 failed attempts
            if (user.failedOTPAttempts >= 5) {
                user.isActive = false;
                await user.save();

                return res.status(403).json({
                    success: false,
                    message: 'Too many failed attempts. Your account has been locked. Please contact support.',
                    action: 'support',
                    locked: true
                });
            }

            await user.save();

            return res.status(400).json({
                success: false,
                message: `Invalid verification code. ${remainingAttempts} attempt${remainingAttempts !== 1 ? 's' : ''} remaining.`,
                remainingAttempts: remainingAttempts
            });
        }

        // Update user to verified
        user.isVerified = true;
        user.otp = null;
        user.otpExpiration = null;
        user.emailVerifiedAt = new Date();
        user.failedOTPAttempts = 0;
        user.lastActive = new Date();
        await user.save();

        // Generate new token with verified status
        const token = jwt.sign(
            {
                id: user._id,
                email: user.email,
                studioName: user.studioName,
                role: user.role,
                isVerified: true
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        // Remove sensitive data from user object
        const userData = {
            id: user._id,
            name: user.name,
            email: user.email,
            studioName: user.studioName,
            profileImage: user.profileImage,
            isVerified: user.isVerified,
            isActive: user.isActive,
            role: user.role,
            emailVerifiedAt: user.emailVerifiedAt
        };

        // Return success response
        return res.status(200).json({
            success: true,
            message: 'Email verified successfully! You can now access all features.',
            data: {
                token,
                user: userData
            },
            redirectTo: '/dashboard'
        });

    } catch (error) {
        console.error('Error in verifyEmail controller:', error);

        return res.status(500).json({
            success: false,
            message: 'An error occurred while verifying email. Please try again later.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

export const resendVerificationOTP = async (req, res) => {
    try {
        // Validate request body with Joi schema
        const { error, value } = resendOTPSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message,
                errors: error.details.map(detail => ({
                    field: detail.path[0],
                    message: detail.message
                }))
            });
        }

        const { email } = value;

        // Check if user exists
        const user = await User.findOne({
            email: email.toLowerCase().trim()
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found. Please register first.',
                action: 'register'
            });
        }

        // Check if already verified
        if (user.isVerified) {
            return res.status(400).json({
                success: false,
                message: 'Email is already verified. Please login.',
                action: 'login'
            });
        }

        // Check if user account is active
        if (!user.isActive) {
            return res.status(403).json({
                success: false,
                message: 'Your account has been locked. Please contact support for assistance.',
                action: 'support'
            });
        }

        // Check if last OTP request was less than 60 seconds ago (rate limiting)
        if (user.lastOTPRequest && (new Date() - user.lastOTPRequest) < 60000) {
            const remainingSeconds = Math.ceil((60000 - (new Date() - user.lastOTPRequest)) / 1000);
            return res.status(429).json({
                success: false,
                message: `Please wait ${remainingSeconds} seconds before requesting a new code.`,
                waitTime: remainingSeconds,
                action: 'wait'
            });
        }

        // Generate new OTP
        const otpCode = OTPGenerator(6);
        const hashedOTP = await bcrypt.hash(otpCode, 10);
        const otpExpiration = OTPExpirationTime();

        // Update user with new OTP
        user.otp = hashedOTP;
        user.otpExpiration = otpExpiration;
        user.lastOTPRequest = new Date();
        user.failedOTPAttempts = 0; // Reset failed attempts
        await user.save();

        // Send new OTP email (don't await to avoid blocking, but handle errors)
        await sendOTPEmail(email, user.studioName, otpCode);

        return res.status(200).json({
            success: true,
            message: 'New verification code sent to your email.',
            data: {
                email: user.email,
                studioName: user.studioName,
                expiresIn: '10 minutes'
            },
            nextStep: 'verify-email'
        });

    } catch (error) {
        console.error('Error in resendVerificationOTP:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to resend verification code. Please try again later.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// login user
export const login = async (req, res) => {
    try {
        // Validate request body
        const { error, value } = loginSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message,
                errors: error.details.map(detail => ({
                    field: detail.path[0],
                    message: detail.message
                }))
            });
        }

        const { email, password } = value;

        // Find user by email
        const user = await User.findOne({
            email: email.toLowerCase().trim()
        });

        // Check if user exists
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password.',
                action: 'register'
            });
        }

        // Check if account is active
        if (!user.isActive) {
            return res.status(403).json({
                success: false,
                message: 'Your account has been locked. Please contact support for assistance.',
                action: 'support'
            });
        }

        // Check if email is verified
        if (!user.isVerified) {
            return res.status(403).json({
                success: false,
                message: 'Please verify your email before logging in.',
                action: 'verify-email',
                email: user.email
            });
        }

        // Check password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            // Track failed login attempts
            user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;

            const remainingAttempts = 5 - user.failedLoginAttempts;

            // Lock account after 5 failed attempts
            if (user.failedLoginAttempts >= 5) {
                user.isActive = false;
                await user.save();

                return res.status(403).json({
                    success: false,
                    message: 'Too many failed login attempts. Your account has been locked. Please contact support.',
                    action: 'support',
                    locked: true
                });
            }

            await user.save();

            return res.status(401).json({
                success: false,
                message: `Invalid email or password. ${remainingAttempts} attempt${remainingAttempts !== 1 ? 's' : ''} remaining.`,
                remainingAttempts: remainingAttempts,
                action: 'login'
            });
        }

        // Reset failed login attempts on successful login
        user.failedLoginAttempts = 0;
        user.lastLogin = new Date();
        user.lastActive = new Date();
        await user.save();

        // Generate JWT token
        const token = jwt.sign(
            {
                id: user._id,
                email: user.email,
                studioName: user.studioName,
                role: user.role,
                isVerified: user.isVerified
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        // Prepare user data (remove sensitive info)
        const userData = {
            id: user._id,
            name: user.name,
            email: user.email,
            studioName: user.studioName,
            profileImage: user.profileImage,
            isVerified: user.isVerified,
            isActive: user.isActive,
            role: user.role,
            lastLogin: user.lastLogin
        };

        // Return success response
        return res.status(200).json({
            success: true,
            message: 'Login successful!',
            data: {
                token,
                user: userData
            },
            redirectTo: user.role === 'admin' ? '/admin/dashboard' : '/dashboard'
        });

    } catch (error) {
        console.error('Error in login controller:', error);

        return res.status(500).json({
            success: false,
            message: 'An error occurred while logging in. Please try again later.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};


export const forgotPassword = async (req, res) => {
    try {
        // Validate request body
        const { error, value } = forgotPasswordSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message,
                errors: error.details.map(detail => ({
                    field: detail.path[0],
                    message: detail.message
                }))
            });
        }

        const { email } = value;

        // Find user by email
        const user = await User.findOne({
            email: email.toLowerCase().trim()
        });

        // For security, don't reveal if user exists
        if (!user) {
            return res.status(200).json({
                success: true,
                message: 'If your email is registered, you will receive a password reset OTP.'
            });
        }

        // Check if account is active
        if (!user.isActive) {
            return res.status(403).json({
                success: false,
                message: 'Your account is locked. Please contact support.',
                action: 'support'
            });
        }

        // Rate limiting - prevent OTP spam (60 seconds cooldown)
        if (user.lastOTPRequest && (new Date() - user.lastOTPRequest) < 60000) {
            const remainingSeconds = Math.ceil((60000 - (new Date() - user.lastOTPRequest)) / 1000);
            return res.status(429).json({
                success: false,
                message: `Please wait ${remainingSeconds} seconds before requesting a new OTP.`,
                waitTime: remainingSeconds
            });
        }

        // Generate OTP
        const otpCode = OTPGenerator(6);
        const hashedOTP = await bcrypt.hash(otpCode, 10);
        const otpExpiration = OTPExpirationTime(10); // 10 minutes expiry

        // Save OTP to database
        user.passwordResetOTP = hashedOTP;
        user.passwordResetOTPExpires = otpExpiration;
        user.lastOTPRequest = new Date();
        await user.save();

        // Send OTP email
        try {
            await sendPasswordResetOTP(email, user.studioName, otpCode);
        } catch (emailError) {
            console.error('Failed to send reset OTP:', emailError);
            // Clear OTP if email fails
            user.passwordResetOTP = null;
            user.passwordResetOTPExpires = null;
            await user.save();

            return res.status(500).json({
                success: false,
                message: 'Failed to send reset OTP. Please try again later.',
                action: 'retry'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Password reset OTP has been sent to your email.',
            data: {
                email: user.email,
                expiresIn: '10 minutes'
            },
            nextStep: 'verify-otp'
        });

    } catch (error) {
        console.error('Error in forgotPassword controller:', error);

        return res.status(500).json({
            success: false,
            message: 'An error occurred. Please try again later.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

export const resetPassword = async (req, res) => {
    try {
        // Validate request body
        const { error, value } = resetPasswordWithOTPSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message,
                errors: error.details.map(detail => ({
                    field: detail.path[0],
                    message: detail.message
                }))
            });
        }

        const { email, otp, newPassword } = value;

        // Find user
        const user = await User.findOne({
            email: email.toLowerCase().trim()
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
                action: 'register'
            });
        }

        // Check if OTP exists and is valid
        if (!user.passwordResetOTP || !user.passwordResetOTPExpires) {
            return res.status(400).json({
                success: false,
                message: 'No reset OTP found. Please request a new one.',
                action: 'forgot-password'
            });
        }

        // Check if OTP has expired
        if (user.passwordResetOTPExpires < new Date()) {
            user.passwordResetOTP = null;
            user.passwordResetOTPExpires = null;
            await user.save();

            return res.status(400).json({
                success: false,
                message: 'Reset OTP has expired. Please request a new one.',
                action: 'forgot-password',
                expired: true
            });
        }

        // Verify OTP
        const isOTPValid = await bcrypt.compare(otp, user.passwordResetOTP);
        if (!isOTPValid) {
            return res.status(400).json({
                success: false,
                message: 'Invalid OTP. Please try again.'
            });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update user password and clear all reset fields
        user.password = hashedPassword;
        user.passwordResetOTP = null;
        user.passwordResetOTPExpires = null;
        user.passwordResetToken = null;
        user.passwordResetExpires = null;
        user.failedLoginAttempts = 0; // Reset failed login attempts
        user.isActive = true; // Reactivate account if it was locked
        await user.save();

        // Generate new JWT token for auto-login
        const token = jwt.sign(
            {
                id: user._id,
                email: user.email,
                studioName: user.studioName,
                role: user.role,
                isVerified: user.isVerified
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        // Prepare user data
        const userData = {
            id: user._id,
            name: user.name,
            email: user.email,
            studioName: user.studioName,
            profileImage: user.profileImage,
            isVerified: user.isVerified,
            isActive: user.isActive,
            role: user.role
        };

        return res.status(200).json({
            success: true,
            message: 'Password has been reset successfully!',
            data: {
                token: token,
                user: userData
            },
            redirectTo: '/dashboard'
        });

    } catch (error) {
        console.error('Error in resetPassword controller:', error);

        return res.status(500).json({
            success: false,
            message: 'An error occurred while resetting your password. Please try again later.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};



// Get user profile
export const getProfile = async (req, res) => {
    try {
        const userId = req.userId;

        const user = await User.findById(userId).select('-password -otp -passwordResetToken -passwordResetExpires -passwordResetOTP -passwordResetOTPExpires -adminCode -failedLoginAttempts -failedOTPAttempts -lastOTPRequest');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const userData = {
            id: user._id,
            name: user.name,
            email: user.email,
            studioName: user.studioName,
            profileImage: user.profileImage,
            isVerified: user.isVerified,
            isActive: user.isActive,
            role: user.role,
            lastActive: user.lastActive,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
        };

        return res.status(200).json({
            success: true,
            message: 'Profile retrieved successfully',
            data: {
                user: userData
            }
        });

    } catch (error) {
        console.error('Error in getProfile controller:', error);

        return res.status(500).json({
            success: false,
            message: 'An error occurred while fetching profile. Please try again later.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Sign out user (invalidate session)
export const signOut = async (req, res) => {
    try {
        const userId = req.userId;

        // Optional: Update lastLogout timestamp for audit trail
        await User.findByIdAndUpdate(userId, {
            $set: { lastLogout: new Date() }
        });

        return res.status(200).json({
            success: true,
            message: 'Signed out successfully.'
        });

    } catch (error) {
        console.error('Error in signOut controller:', error);

        return res.status(500).json({
            success: false,
            message: 'An error occurred while signing out. Please try again later.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

export const updateProfile = async (req, res) => {
    try {
        // Get user from authenticated request
        const userId = req.userId;
        const currentUser = req.user;

        // Prepare update data from body and file
        let updateData = {};

        // Handle text fields from request body
        if (req.body.name !== undefined) updateData.name = req.body.name;
        if (req.body.email !== undefined) updateData.email = req.body.email?.toLowerCase().trim();
        if (req.body.studioName !== undefined) updateData.studioName = req.body.studioName;

        // Handle profileImage removal (check before Cloudinary upload)
        const shouldRemoveImage = req.body.profileImage === 'null' || req.body.profileImage === '' || req.body.removeImage === 'true';

        // Handle profile image upload
        if (req.cloudinaryResult && !shouldRemoveImage) {
            updateData.profileImage = req.cloudinaryResult.secure_url;
        } else if (shouldRemoveImage) {
            updateData.profileImage = null;
        }

        // Check if there's anything to update
        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No valid fields to update. Please provide at least one field to update.'
            });
        }

        // Track what is being changed
        const isEmailChanging = updateData.email && updateData.email !== currentUser.email;
        const isStudioNameChanging = updateData.studioName && updateData.studioName !== currentUser.studioName;
        const isNameChanging = updateData.name && updateData.name !== currentUser.name;
        const isProfileImageChanging = updateData.profileImage !== undefined && updateData.profileImage !== currentUser.profileImage;

        // Validate email format if being updated
        if (isEmailChanging) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(updateData.email)) {
                return res.status(400).json({
                    success: false,
                    message: 'Please provide a valid email address'
                });
            }
        }

        // Check if email is being changed and if it's already taken
        if (isEmailChanging) {
            const existingUser = await User.findOne({
                email: updateData.email,
                _id: { $ne: userId }
            });

            if (existingUser) {
                return res.status(409).json({
                    success: false,
                    message: 'Email is already taken by another user. Please use a different email.'
                });
            }
        }

        // Check if studioName is being changed and if it's already taken
        if (isStudioNameChanging) {
            const existingStudio = await User.findOne({
                studioName: updateData.studioName,
                _id: { $ne: userId }
            });

            if (existingStudio) {
                return res.status(409).json({
                    success: false,
                    message: 'Studio name is already taken. Please choose another one.'
                });
            }
        }

        // Handle email change with OTP verification
        let otpCode = null;
        let requiresNewVerification = false;

        if (isEmailChanging) {
            // Generate new OTP for email verification
            otpCode = OTPGenerator(6);
            const hashedOTP = await bcrypt.hash(otpCode, 10);
            const otpExpiration = new Date();
            otpExpiration.setMinutes(otpExpiration.getMinutes() + 10); // 10 minutes expiry

            updateData.otp = hashedOTP;
            updateData.otpExpiration = otpExpiration;
            updateData.isVerified = false;
            updateData.emailVerifiedAt = null;
            updateData.failedOTPAttempts = 0;
            requiresNewVerification = true;
        }

        // Add lastActive update
        updateData.lastActive = new Date();

        // Update user
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            updateData,
            {
                returnDocument: 'after',
                runValidators: true,
                context: 'query'
            }
        ).select('-password -otp -otpExpiration -passwordResetToken -passwordResetExpires -passwordResetOTP -passwordResetOTPExpires -adminCode -failedOTPAttempts -failedLoginAttempts');

        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Send verification email if email was changed
        if (isEmailChanging && otpCode) {
            try {
                await sendVerificationEmail(updatedUser.email, updatedUser.studioName, otpCode);
                console.log(`✅ Verification email sent to new email: ${updatedUser.email}`);

                return res.status(200).json({
                    success: true,
                    message: 'Profile updated successfully! A verification code has been sent to your new email address. Please verify your new email to continue.',
                    data: {
                        user: {
                            id: updatedUser._id,
                            name: updatedUser.name,
                            email: updatedUser.email,
                            studioName: updatedUser.studioName,
                            profileImage: updatedUser.profileImage,
                            isVerified: updatedUser.isVerified,
                            isActive: updatedUser.isActive,
                            role: updatedUser.role,
                            lastActive: updatedUser.lastActive,
                            createdAt: updatedUser.createdAt,
                            updatedAt: updatedUser.updatedAt
                        },
                        requiresNewVerification: true,
                        emailSent: true
                    }
                });
            } catch (emailError) {
                console.error('❌ Failed to send verification email:', emailError);

                // Return success but indicate email wasn't sent
                return res.status(200).json({
                    success: true,
                    message: 'Profile updated successfully, but verification email could not be sent. Please use the "Resend Verification" option to get your code.',
                    data: {
                        user: {
                            id: updatedUser._id,
                            name: updatedUser.name,
                            email: updatedUser.email,
                            studioName: updatedUser.studioName,
                            profileImage: updatedUser.profileImage,
                            isVerified: updatedUser.isVerified,
                            isActive: updatedUser.isActive,
                            role: updatedUser.role,
                            lastActive: updatedUser.lastActive,
                            createdAt: updatedUser.createdAt,
                            updatedAt: updatedUser.updatedAt
                        },
                        requiresNewVerification: true,
                        emailSent: false
                    }
                });
            }
        }

        // If no email change, just return the updated profile
        const changes = [];
        if (isNameChanging) changes.push('name');
        if (isStudioNameChanging) changes.push('studio name');
        if (isProfileImageChanging) changes.push('profile image');

        const changeMessage = changes.length > 0
            ? `Profile updated successfully! ${changes.join(', ')} updated.`
            : 'Profile updated successfully!';

        return res.status(200).json({
            success: true,
            message: changeMessage,
            data: {
                user: {
                    id: updatedUser._id,
                    name: updatedUser.name,
                    email: updatedUser.email,
                    studioName: updatedUser.studioName,
                    profileImage: updatedUser.profileImage,
                    isVerified: updatedUser.isVerified,
                    isActive: updatedUser.isActive,
                    role: updatedUser.role,
                    lastActive: updatedUser.lastActive,
                    createdAt: updatedUser.createdAt,
                    updatedAt: updatedUser.updatedAt
                },
                requiresNewVerification: false,
                emailSent: false
            }
        });

    } catch (error) {
        console.error('❌ Error in updateProfile controller:', error);

        // Handle duplicate key error (MongoDB error code 11000)
        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern)[0];
            const fieldName = field === 'studioName' ? 'Studio name' : field === 'email' ? 'Email' : field;
            return res.status(409).json({
                success: false,
                message: `${fieldName} is already taken. Please choose another one.`
            });
        }

        // Handle validation errors
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: Object.values(error.errors).map(err => err.message)
            });
        }

        // Handle bcrypt errors
        if (error.name === 'BcryptError') {
            return res.status(500).json({
                success: false,
                message: 'Error processing security data. Please try again.'
            });
        }

        return res.status(500).json({
            success: false,
            message: 'An error occurred while updating profile. Please try again later.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
