import { Router } from "express";
import { forgotPassword, login, register, resendVerificationOTP, resetPassword, signOut, updateProfile, verifyEmail, getProfile, changePassword, uploadProfileImage } from "../Controllers/userController.js";
import { processSingleImageFast, processProfileImage, uploadSingle } from "../Utiles/uploadFiles.js";
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
userRouter.get('/me', authenticate, getProfile);
userRouter.patch('/profile', authenticate, uploadSingle, processSingleImageFast, updateProfile);
userRouter.put('/profile/image', authenticate, uploadSingle, processProfileImage, uploadProfileImage);
userRouter.patch('/change-password', authenticate, changePassword);
