import { TransactionalEmailsClient } from '@getbrevo/brevo/transactionalEmails';
import { BREVO_API_KEY, BREVO_SENDER_EMAIL, FRONTEND_URL } from '../Config/env.js';

// Validate Brevo credentials at startup
if (!BREVO_API_KEY || !BREVO_SENDER_EMAIL) {
  console.warn('⚠️ Missing Brevo credentials. Email sending will not work.');
  console.warn('   Ensure BREVO_API_KEY and BREVO_SENDER_EMAIL are set in .env');
}

// Initialize Brevo API client (v5 syntax)
const client = new TransactionalEmailsClient({
  apiKey: BREVO_API_KEY
});

console.log('✅ Brevo email service initialized');

/**
 * Helper function to send email with retry logic
 */
const sendEmailWithRetry = async (emailData, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await client.sendTransacEmail(emailData);
      console.log(`✅ Email sent successfully on attempt ${attempt}`);
      return response;
    } catch (error) {
      console.error(`❌ Email sending failed on attempt ${attempt}:`, error.message);
      if (attempt === maxRetries) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
};

/**
 * Create email options helper - returns plain object for v5 API
 */
const createEmailOptions = (to, subject, htmlContent, textContent = '') => ({
  sender: { 
    name: "Kofi Lartey Studios", 
    email: BREVO_SENDER_EMAIL 
  },
  to: [{ email: to }],
  subject: subject,
  htmlContent: htmlContent,
  textContent: textContent || htmlContent.replace(/<[^>]*>/g, '').substring(0, 500)
});

/**
 * Send OTP verification email
 */
export const sendOTPEmail = async (email, studioName, otpCode) => {
  try {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Email - Kofi Lartey Studios</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);">
            <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6, #ec4899); padding: 40px 20px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Kofi Lartey Studios</h1>
            </div>
            <div style="padding: 48px 32px; text-align: center;">
              <h2 style="color: #1f2937; margin: 0 0 12px;">Verify Your Email</h2>
              <p style="color: #6b7280; margin: 0 0 8px;">Hello <strong>${studioName}</strong>,</p>
              <p style="color: #6b7280; margin: 0 0 32px;">Welcome! Use the verification code below:</p>
              <div style="margin: 32px 0; background: #f5f3ff; padding: 24px; border-radius: 16px;">
                <div style="font-family: monospace; background: #ffffff; color: #6366f1; font-size: 48px; font-weight: 800; letter-spacing: 12px; padding: 20px; border-radius: 12px;">
                  ${otpCode}
                </div>
                <p style="color: #6b7280; font-size: 13px; margin: 16px 0 0;">⏰ Valid for <strong>10 minutes</strong></p>
              </div>
            </div>
            <div style="background: #1f2937; color: #9ca3af; padding: 32px; text-align: center;">
              <p style="margin: 0;">© ${new Date().getFullYear()} Kofi Lartey Studios. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const emailData = createEmailOptions(email, `🎨 ${otpCode} is your Kofi Lartey Studios verification code`, htmlContent);
    const info = await sendEmailWithRetry(emailData);
    console.log("✅ Verification email sent successfully to:", email);
    return info;

  } catch (error) {
    console.error("❌ Error while sending verification email:", error);
    throw new Error(`Failed to send verification email: ${error.message}`);
  }
};

/**
 * Send password reset email with link
 */
export const sendPasswordResetEmail = async (email, studioName, resetURL) => {
  try {
    const htmlContent = `
      <div style="font-family: 'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);">
        <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 40px 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Kofi Lartey Studios</h1>
          <p style="color: #c7d2fe; margin: 8px 0 0;">Password Reset Request</p>
        </div>
        <div style="padding: 48px 32px; text-align: center;">
          <h2 style="color: #1f2937; margin: 0 0 12px;">Reset Your Password</h2>
          <p style="color: #6b7280; margin: 0 0 8px;">Hello <strong>${studioName}</strong>,</p>
          <p style="color: #6b7280; margin: 0 0 24px;">Click the button below to reset your password:</p>
          <a href="${resetURL}" style="display: inline-block; background: #6366f1; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none;">
            Reset Password
          </a>
          <p style="color: #9ca3af; font-size: 13px; margin-top: 24px;">⏰ This link expires in <strong>1 hour</strong></p>
        </div>
        <div style="background: #1f2937; color: #9ca3af; padding: 32px; text-align: center;">
          <p style="margin: 0;">© ${new Date().getFullYear()} Kofi Lartey Studios. All rights reserved.</p>
        </div>
      </div>
    `;

    const emailData = createEmailOptions(email, '🔐 Password Reset Request - Kofi Lartey Studios', htmlContent);
    const info = await sendEmailWithRetry(emailData);
    console.log("✅ Password reset email sent to:", email);
    return info;
  } catch (error) {
    console.error("❌ Error while sending password reset email:", error);
    throw new Error(`Failed to send password reset email: ${error.message}`);
  }
};

/**
 * Send password reset OTP
 */
export const sendPasswordResetOTP = async (email, studioName, otpCode) => {
  try {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset OTP - Kofi Lartey Studios</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);">
            <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 40px 20px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Kofi Lartey Studios</h1>
            </div>
            <div style="padding: 48px 32px; text-align: center;">
              <h2 style="color: #1f2937; margin: 0 0 12px;">Password Reset</h2>
              <p style="color: #6b7280; margin: 0 0 8px;">Hello <strong>${studioName}</strong>,</p>
              <p style="color: #6b7280; margin: 0 0 32px;">Your password reset OTP is:</p>
              <div style="margin: 32px 0; background: #f5f3ff; padding: 24px; border-radius: 16px;">
                <div style="font-family: monospace; background: #ffffff; color: #6366f1; font-size: 48px; font-weight: 800; letter-spacing: 12px; padding: 20px; border-radius: 12px;">
                  ${otpCode}
                </div>
                <p style="color: #6b7280; font-size: 13px; margin: 16px 0 0;">⏰ Valid for <strong>10 minutes</strong></p>
              </div>
            </div>
            <div style="background: #1f2937; color: #9ca3af; padding: 32px; text-align: center;">
              <p style="margin: 0;">© ${new Date().getFullYear()} Kofi Lartey Studios. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const emailData = createEmailOptions(email, '🔐 Password Reset OTP - Kofi Lartey Studios', htmlContent);
    const info = await sendEmailWithRetry(emailData);
    console.log("✅ Password reset OTP sent to:", email);
    return info;
  } catch (error) {
    console.error("❌ Error while sending password reset OTP:", error);
    throw new Error(`Failed to send password reset OTP: ${error.message}`);
  }
};

/**
 * Send verification email for email change
 */
export const sendVerificationEmail = async (email, studioName, otpCode) => {
  try {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Email Change - Kofi Lartey Studios</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);">
            <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 40px 20px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Kofi Lartey Studios</h1>
            </div>
            <div style="padding: 48px 32px; text-align: center;">
              <h2 style="color: #1f2937; margin: 0 0 12px;">Verify Email Change</h2>
              <p style="color: #6b7280; margin: 0 0 8px;">Hello <strong>${studioName}</strong>,</p>
              <p style="color: #6b7280; margin: 0 0 32px;">Your verification code for your new email address is:</p>
              <div style="margin: 32px 0; background: #f5f3ff; padding: 24px; border-radius: 16px;">
                <div style="font-family: monospace; background: #ffffff; color: #6366f1; font-size: 48px; font-weight: 800; letter-spacing: 12px; padding: 20px; border-radius: 12px;">
                  ${otpCode}
                </div>
                <p style="color: #6b7280; font-size: 13px; margin: 16px 0 0;">⏰ Valid for <strong>10 minutes</strong></p>
              </div>
            </div>
            <div style="background: #1f2937; color: #9ca3af; padding: 32px; text-align: center;">
              <p style="margin: 0;">© ${new Date().getFullYear()} Kofi Lartey Studios. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const emailData = createEmailOptions(email, '🔐 Verify Your New Email Address - Kofi Lartey Studios', htmlContent);
    const info = await sendEmailWithRetry(emailData);
    console.log("✅ Verification email sent to:", email);
    return info;
  } catch (error) {
    console.error("❌ Error while sending verification email:", error);
    throw new Error(`Failed to send verification email: ${error.message}`);
  }
};

/**
 * Send welcome email after successful registration
 */
export const sendWelcomeEmail = async (email, fullName) => {
  try {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Kofi Lartey Studios</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <div style="max-width: 550px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);">
            <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6, #ec4899); padding: 40px 20px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px;">🎨 Kofi Lartey Studios</h1>
            </div>
            <div style="padding: 48px 32px; text-align: center;">
              <div style="font-size: 50px; margin-bottom: 20px;">🎉</div>
              <h2 style="color: #1f2937; margin: 0 0 12px;">Welcome to the Studio, ${fullName}!</h2>
              <p style="color: #6b7280; margin: 0 0 24px;">You're now part of our creative community.</p>
              <a href="${FRONTEND_URL}/dashboard" style="display: inline-block; background: #6366f1; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none;">
                Go to Dashboard
              </a>
            </div>
            <div style="background: #1f2937; color: #9ca3af; padding: 32px; text-align: center;">
              <p style="margin: 0;">© ${new Date().getFullYear()} Kofi Lartey Studios. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const emailData = createEmailOptions(email, '🎨 Welcome to Kofi Lartey Studios!', htmlContent);
    const info = await sendEmailWithRetry(emailData);
    console.log("✅ Welcome Email Sent to:", email);
    return info;
  } catch (error) {
    console.error("❌ Error while sending welcome email:", error);
    throw new Error(`Failed to send welcome email: ${error.message}`);
  }
};
