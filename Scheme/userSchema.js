import Joi from 'joi';

// Joi schema for User model
export const userJoiSchema = Joi.object({
    // Basic Information
    name: Joi.string()
        .min(2)
        .max(100)
        .required()
        .messages({
            'string.empty': 'Name is required',
            'string.min': 'Name must be at least 2 characters long',
            'string.max': 'Name cannot exceed 100 characters',
            'any.required': 'Name is required'
        }),

    email: Joi.string()
        .email({
            minDomainSegments: 2,
            tlds: { allow: true }
        })
        .required()
        .lowercase()
        .trim()
        .messages({
            'string.email': 'Please provide a valid email address',
            'string.empty': 'Email is required',
            'any.required': 'Email is required'
        }),

    studioName: Joi.string()
        .min(2)
        .max(100)
        .required()
        .pattern(/^[a-zA-Z0-9\s\-&]+$/)
        .messages({
            'string.empty': 'Studio name is required',
            'string.min': 'Studio name must be at least 2 characters long',
            'string.max': 'Studio name cannot exceed 100 characters',
            'string.pattern.base': 'Studio name can only contain letters, numbers, spaces, hyphens, and ampersands',
            'any.required': 'Studio name is required'
        }),

    password: Joi.string()
        .min(8)
        .max(50)
        .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
        .required()
        .messages({
            'string.empty': 'Password is required',
            'string.min': 'Password must be at least 8 characters long',
            'string.max': 'Password cannot exceed 50 characters',
            'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)',
            'any.required': 'Password is required'
        }),

    confirmPassword: Joi.string()
        .valid(Joi.ref('password'))
        .required()
        .messages({
            'any.only': 'Passwords do not match',
            'string.empty': 'Please confirm your password',
            'any.required': 'Password confirmation is required'
        }),

    profileImage: Joi.string()
        .uri()
        .optional()
        .allow(null, '')
        .messages({
            'string.uri': 'Profile image must be a valid URL'
        }),

    // Email verification OTP fields
    otp: Joi.string()
        .length(6)
        .pattern(/^\d+$/)
        .optional()
        .allow(null)
        .messages({
            'string.length': 'OTP must be exactly 6 digits',
            'string.pattern.base': 'OTP must contain only numbers'
        }),

    otpExpiration: Joi.date()
        .optional()
        .allow(null)
        .messages({
            'date.base': 'OTP expiration must be a valid date'
        }),

    // Account status
    isActive: Joi.boolean()
        .default(true),

    isVerified: Joi.boolean()
        .default(false),

    // Email verification tracking
    emailVerifiedAt: Joi.date()
        .optional()
        .allow(null),

    failedOTPAttempts: Joi.number()
        .integer()
        .min(0)
        .default(0),

    lastOTPRequest: Joi.date()
        .optional()
        .allow(null),

    // Login tracking
    failedLoginAttempts: Joi.number()
        .integer()
        .min(0)
        .default(0),

    lastLogin: Joi.date()
        .optional()
        .allow(null),

    lastActive: Joi.date()
        .optional()
        .allow(null),

    // Role and admin
    role: Joi.string()
        .valid('user', 'admin', 'moderator')
        .default('user'),

    adminCode: Joi.string()
        .optional()
        .allow(null)
        .when('role', {
            is: 'admin',
            then: Joi.string().required(),
            otherwise: Joi.optional()
        })
        .messages({
            'any.required': 'Admin code is required for admin role'
        }),

    // Password reset token fields
    passwordResetToken: Joi.string()
        .optional()
        .allow(null),

    passwordResetExpires: Joi.date()
        .optional()
        .allow(null),

    // Password reset OTP fields
    passwordResetOTP: Joi.string()
        .length(6)
        .pattern(/^\d+$/)
        .optional()
        .allow(null)
        .messages({
            'string.length': 'Password reset OTP must be exactly 6 digits',
            'string.pattern.base': 'Password reset OTP must contain only numbers'
        }),

    passwordResetOTPExpires: Joi.date()
        .optional()
        .allow(null),

    // Soft delete
    deletedAt: Joi.date()
        .optional()
        .allow(null)

});

// Registration Schema
export const registerSchema = Joi.object({
    name: userJoiSchema.extract('name'),
    email: userJoiSchema.extract('email'),
    studioName: userJoiSchema.extract('studioName'),
    password: userJoiSchema.extract('password'),
    // confirmPassword: Joi.string().valid(Joi.ref('password')).required().messages({
    //     'any.only': 'Passwords do not match',
    //     'string.empty': 'Please confirm your password',
    //     'any.required': 'Password confirmation is required'
    // }),
    role: userJoiSchema.extract('role'),
    adminCode: userJoiSchema.extract('adminCode')
});

// Login Schema
export const loginSchema = Joi.object({
    email: Joi.string()
        .email()
        .required()
        .lowercase()
        .trim()
        .messages({
            'string.email': 'Please provide a valid email address',
            'string.empty': 'Email is required',
            'any.required': 'Email is required'
        }),
    password: Joi.string()
        .required()
        .messages({
            'string.empty': 'Password is required',
            'any.required': 'Password is required'
        })
});

// Email Verification Schema
export const verifyEmailSchema = Joi.object({
    email: Joi.string()
        .email()
        .required()
        .lowercase()
        .trim()
        .messages({
            'string.email': 'Please provide a valid email address',
            'string.empty': 'Email is required',
            'any.required': 'Email is required'
        }),
    otp: Joi.string()
        .length(6)
        .pattern(/^\d+$/)
        .required()
        .messages({
            'string.length': 'OTP must be exactly 6 digits',
            'string.pattern.base': 'OTP must contain only numbers',
            'string.empty': 'OTP is required',
            'any.required': 'OTP is required'
        })
});

// Resend OTP Schema
export const resendOTPSchema = Joi.object({
    email: Joi.string()
        .email()
        .required()
        .lowercase()
        .trim()
        .messages({
            'string.email': 'Please provide a valid email address',
            'string.empty': 'Email is required',
            'any.required': 'Email is required'
        })
});

// Forgot Password Schema (Request OTP)
export const forgotPasswordSchema = Joi.object({
    email: Joi.string()
        .email()
        .required()
        .lowercase()
        .trim()
        .messages({
            'string.email': 'Please provide a valid email address',
            'string.empty': 'Email is required',
            'any.required': 'Email is required'
        })
});

// Verify Reset OTP Schema
export const verifyResetOTPSchema = Joi.object({
    email: Joi.string()
        .email()
        .required()
        .lowercase()
        .trim()
        .messages({
            'string.email': 'Please provide a valid email address',
            'string.empty': 'Email is required',
            'any.required': 'Email is required'
        }),
    otp: Joi.string()
        .length(6)
        .pattern(/^\d+$/)
        .required()
        .messages({
            'string.length': 'OTP must be exactly 6 digits',
            'string.pattern.base': 'OTP must contain only numbers',
            'string.empty': 'OTP is required',
            'any.required': 'OTP is required'
        })
});

// Reset Password with OTP Schema
export const resetPasswordWithOTPSchema = Joi.object({
    email: Joi.string()
        .email()
        .required()
        .lowercase()
        .trim()
        .messages({
            'string.email': 'Please provide a valid email address',
            'string.empty': 'Email is required',
            'any.required': 'Email is required'
        }),
    otp: Joi.string()
        .length(6)
        .pattern(/^\d+$/)
        .required()
        .messages({
            'string.length': 'OTP must be exactly 6 digits',
            'string.pattern.base': 'OTP must contain only numbers',
            'string.empty': 'OTP is required',
            'any.required': 'OTP is required'
        }),
    newPassword: Joi.string()
        .min(8)
        .max(50)
        .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
        .required()
        .messages({
            'string.empty': 'New password is required',
            'string.min': 'Password must be at least 8 characters long',
            'string.max': 'Password cannot exceed 50 characters',
            'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)',
            'any.required': 'New password is required'
        }),
    // confirmPassword: Joi.string()
    //     .valid(Joi.ref('newPassword'))
    //     .required()
    //     .messages({
    //         'any.only': 'Passwords do not match',
    //         'string.empty': 'Please confirm your password',
    //         'any.required': 'Password confirmation is required'
    //     })
});

// Reset Password Schema (Token-based - kept for backward compatibility)
export const resetPasswordSchema = Joi.object({
    token: Joi.string()
        .required()
        .messages({
            'string.empty': 'Reset token is required',
            'any.required': 'Reset token is required'
        }),
    password: Joi.string()
        .min(8)
        .max(50)
        .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
        .required()
        .messages({
            'string.empty': 'New password is required',
            'string.min': 'Password must be at least 8 characters long',
            'string.max': 'Password cannot exceed 50 characters',
            'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)',
            'any.required': 'New password is required'
        }),
    confirmPassword: Joi.string()
        .valid(Joi.ref('password'))
        .required()
        .messages({
            'any.only': 'Passwords do not match',
            'string.empty': 'Please confirm your password',
            'any.required': 'Password confirmation is required'
        })
});

// Update Profile Schema
export const updateProfileSchema = Joi.object({
    name: Joi.string()
        .min(2)
        .max(100)
        .optional()
        .messages({
            'string.min': 'Name must be at least 2 characters long',
            'string.max': 'Name cannot exceed 100 characters'
        }),
    email: Joi.string()
        .email({
            minDomainSegments: 2,
            tlds: { allow: true }
        })
        .optional()
        .lowercase()
        .trim()
        .messages({
            'string.email': 'Please provide a valid email address',
            'string.empty': 'Email cannot be empty if provided'
        }),
    studioName: Joi.string()
        .min(2)
        .max(100)
        .optional()
        .pattern(/^[a-zA-Z0-9\s\-&]+$/)
        .messages({
            'string.min': 'Studio name must be at least 2 characters long',
            'string.max': 'Studio name cannot exceed 100 characters',
            'string.pattern.base': 'Studio name can only contain letters, numbers, spaces, hyphens, and ampersands'
        }),
    profileImage: Joi.string()
        .uri()
        .optional()
        .allow(null, '')
        .messages({
            'string.uri': 'Profile image must be a valid URL'
        })
}).min(1);

// Change Password Schema
export const changePasswordSchema = Joi.object({
    currentPassword: Joi.string()
        .required()
        .messages({
            'string.empty': 'Current password is required',
            'any.required': 'Current password is required'
        }),
    newPassword: Joi.string()
        .min(8)
        .max(50)
        .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
        .required()
        .messages({
            'string.empty': 'New password is required',
            'string.min': 'Password must be at least 8 characters long',
            'string.max': 'Password cannot exceed 50 characters',
            'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)',
            'any.required': 'New password is required'
        }),
    confirmNewPassword: Joi.string()
        .valid(Joi.ref('newPassword'))
        .required()
        .messages({
            'any.only': 'Passwords do not match',
            'string.empty': 'Please confirm your new password',
            'any.required': 'Password confirmation is required'
        })
});

// Helper function to validate data
export const validate = (schema, data) => {
    const { error, value } = schema.validate(data, {
        abortEarly: false,
        stripUnknown: true
    });

    if (error) {
        const errors = error.details.map(detail => ({
            field: detail.path[0],
            message: detail.message
        }));
        return { error: true, errors, value: null };
    }

    return { error: false, errors: null, value };
};