import { Router } from "express";
import { forgotPassword, login, register, resendVerificationOTP, resetPassword, signOut, updateProfile, verifyEmail } from "../Controllers/userController.js";
import { uploadSingle } from "../Utiles/uploadFiles.js";
import { authenticate } from "../Middleware/auth.js";

export const userRouter = Router();

userRouter.post('/register', register);
userRouter.post('/resend-otp', resendVerificationOTP);
userRouter.post('/sign-out', authenticate, signOut);
userRouter.post('/verify-otp', verifyEmail);
userRouter.post('/login', login);
userRouter.post('/forgot-password', forgotPassword);
userRouter.post('/reset-password', resetPassword);
// userRouter.post('/verify-reset-otp', verifyResetOTP);

// user profile
userRouter.patch('/profile',authenticate, uploadSingle, updateProfile);
