import { v4 as uuidv4 } from 'uuid';

export const OTPGenerator = (length = 6) => {
    const digits = '0123456789';
    let otp = '';
    for (let i = 0; i < length; i++) {
        otp += digits[Math.floor(Math.random() * 10)];
    }
    return otp;
};

export const OTPExpirationTime = (minutes = 10) => {
    const expiration = new Date();
    expiration.setMinutes(expiration.getMinutes() + minutes);
    return expiration;
};

export const isOTPExpired = (expirationDate) => {
    return new Date() > new Date(expirationDate);
};

// Helper function to format bytes
export const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Helper function to calculate expiration date
export const calculateExpirationDate = (expirationPeriod) => {
    if (expirationPeriod === "Never Expire") return null;
    
    const now = new Date();
    switch(expirationPeriod) {
        case "1 hour": return new Date(now.getTime() + 60 * 60 * 1000);
        case "24 hours": return new Date(now.getTime() + 24 * 60 * 60 * 1000);
        case "7 days": return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        case "30 days": return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        default: return null;
    }
};

// Generate unique gallery ID
export const generateGalleryID = () => {
    const prefix = "GAL";
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
};

// Generate access key for gallery
export const generateAccessKey = () => {
    const prefix = "KEY";
    const random = OTPGenerator(8);
    const unique = uuidv4().substring(0, 4).toUpperCase();
    return `${prefix}${random}${unique}`;
};