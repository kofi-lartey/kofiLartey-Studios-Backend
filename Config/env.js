import dotenv from 'dotenv';

dotenv.config();

export const PORT = process.env.PORT
export const MONGO_URI = process.env.MONGO_URI

// JWT
export const JWT_SECRET = process.env.JWT_SECRET
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN

// emailer
export const EMAIL_FROM = process.env.EMAIL_FROM
export const EMAIL_USER = process.env.EMAIL_USER
export const EMAIL_PASS = process.env.EMAIL_PASS
export const SMTP_HOST = process.env.SMTP_HOST
export const SMTP_PORT = process.env.SMTP_PORT

// Cloudinary
export const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME
export const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY
export const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET

// frotend url
export const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

