import nodemailer from 'nodemailer';
import { SMTP_HOST, SMTP_PORT, EMAIL_USER, EMAIL_PASS } from '../Config/env.js';

// Validate email credentials at startup
if (!SMTP_HOST || !SMTP_PORT || !EMAIL_USER || !EMAIL_PASS) {
  throw new Error(
    'Missing required email environment variables. ' +
    'Ensure SMTP_HOST, SMTP_PORT, EMAIL_USER, and EMAIL_PASS are set in .env'
  );
}

const transporter = nodemailer.createTransport({
  host: SMTP_HOST.trim(),
  port: Number(SMTP_PORT.trim()),
  secure: Number(SMTP_PORT.trim()) === 465, // true only for 465, false for 587 (uses STARTTLS)
  auth: {
    user: EMAIL_USER.trim(),
    pass: EMAIL_PASS.trim(),
  },
  family: 4, // Force IPv4
  logger: true,
  debug: true,
});

transporter.verify()
  .then(() => console.log("📧 SMTP server is ready"))
  .catch(err => console.error("❌ SMTP verify failed:", err));
  
/**
 * Send OTP verification email
 */
export const sendOTPEmail = async (email, studioName, otpCode) => {
  try {
    const info = await transporter.sendMail({
      from: `"Kofi Lartey Studios" <${EMAIL_USER}>`,
      to: email,
      subject: `🎨 ${otpCode} is your Kofi Lartey Studios verification code`,
      text: `Hello ${studioName}, your verification code is: ${otpCode}. It expires in 10 minutes. Welcome to Kofi Lartey Studios - Where creativity meets excellence!`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify Your Email - Kofi Lartey Studios</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%);">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            
            <!-- Main Card -->
            <div style="background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);">
              
              <!-- Header with Gradient -->
              <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6, #ec4899); padding: 40px 20px; text-align: center;">
                <div style="margin-bottom: 16px;">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin: 0 auto;">
                    <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                    <path d="M2 17L12 22L22 17" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                    <path d="M2 12L12 17L22 12" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                  </svg>
                </div>
                <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: 800; letter-spacing: -0.5px;">
                  Kofi Lartey
                </h1>
                <p style="color: #e9d5ff; margin: 8px 0 0; font-size: 16px; font-weight: 500;">
                  Studios
                </p>
              </div>

              <!-- Body Content -->
              <div style="padding: 48px 32px; text-align: center;">
                <div style="margin-bottom: 24px;">
                  <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6, #ec4899); width: 64px; height: 64px; border-radius: 32px; display: flex; align-items: center; justify-content: center; margin: 0 auto;">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M22 11.08V12C21.9988 14.1564 21.3005 16.2547 20.0093 17.9818C18.7182 19.709 16.9033 20.9725 14.8354 21.5839C12.7674 22.1953 10.5573 22.1219 8.53447 21.3746C6.51168 20.6273 4.78465 19.2461 3.61096 17.4371C2.43727 15.628 1.87979 13.4881 2.02168 11.3363C2.16356 9.18455 2.99721 7.13631 4.39828 5.49706C5.79935 3.85781 7.69279 2.71537 9.79619 2.24013C11.8996 1.7649 14.1003 1.98232 16.07 2.85999" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                      <path d="M22 4L12 14.01L9 11.01" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </div>
                </div>
                
                <h2 style="color: #1f2937; margin: 0 0 12px; font-size: 24px; font-weight: 700;">
                  Verify Your Email
                </h2>
                
                <p style="color: #6b7280; font-size: 16px; line-height: 1.6; margin: 0 0 8px;">
                  Hello <strong style="color: #6366f1;">${studioName}</strong>,
                </p>
                
                <p style="color: #6b7280; font-size: 16px; line-height: 1.6; margin: 0 0 32px;">
                  Welcome to Kofi Lartey Studios! Use the verification code below to complete your registration.
                </p>
                
                <!-- OTP Box -->
                <div style="margin: 32px 0; background: linear-gradient(135deg, #f5f3ff, #ede9fe); padding: 24px; border-radius: 16px; border: 2px solid #c7d2fe;">
                  <p style="color: #4f46e5; font-size: 14px; font-weight: 600; margin: 0 0 12px; text-transform: uppercase; letter-spacing: 1px;">
                    Your Verification Code
                  </p>
                  <div style="font-family: 'Courier New', monospace; background: #ffffff; color: #6366f1; font-size: 48px; font-weight: 800; letter-spacing: 12px; padding: 20px; border-radius: 12px; border: 1px solid #c7d2fe;">
                    ${otpCode}
                  </div>
                  <p style="color: #6b7280; font-size: 13px; margin: 16px 0 0;">
                    ⏰ Valid for <strong>10 minutes</strong>
                  </p>
                </div>

                <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px; border-radius: 8px; margin: 24px 0;">
                  <p style="color: #991b1b; font-size: 13px; margin: 0;">
                    🔒 Security Tip: Never share this code with anyone. Our team will never ask for it.
                  </p>
                </div>

                <p style="color: #9ca3af; font-size: 14px; line-height: 1.5; margin: 24px 0 0;">
                  If you didn't request this verification, you can safely ignore this email.
                </p>
              </div>

              <!-- Footer -->
              <div style="background: linear-gradient(135deg, #1f2937, #111827); color: #9ca3af; padding: 32px; text-align: center; border-top: 1px solid #374151;">
                <div style="margin-bottom: 16px;">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin: 0 auto;">
                    <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="#8b5cf6" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                    <path d="M2 17L12 22L22 17" stroke="#8b5cf6" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                    <path d="M2 12L12 17L22 12" stroke="#8b5cf6" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                  </svg>
                </div>
                <p style="margin: 0 0 8px; font-weight: 600; color: #ffffff;">
                  Kofi Lartey Studios
                </p>
                <p style="margin: 0 0 8px; font-size: 13px;">
                  Creating Digital Masterpieces
                </p>
                <p style="margin: 0 0 16px; font-size: 12px;">
                  📍 Accra, Ghana
                </p>
                <div style="display: inline-flex; gap: 12px; margin-bottom: 16px;">
                  <a href="#" style="color: #8b5cf6; text-decoration: none; font-size: 12px;">Instagram</a>
                  <span style="color: #4b5563;">•</span>
                  <a href="#" style="color: #8b5cf6; text-decoration: none; font-size: 12px;">Twitter/X</a>
                  <span style="color: #4b5563;">•</span>
                  <a href="#" style="color: #8b5cf6; text-decoration: none; font-size: 12px;">LinkedIn</a>
                  <span style="color: #4b5563;">•</span>
                  <a href="#" style="color: #8b5cf6; text-decoration: none; font-size: 12px;">Behance</a>
                </div>
                <hr style="border-color: #374151; margin: 16px 0;">
                <p style="margin: 0; font-size: 11px;">
                  © ${new Date().getFullYear()} Kofi Lartey Studios. All rights reserved.
                </p>
                <p style="margin: 8px 0 0; font-size: 11px;">
                  <a href="#" style="color: #6b7280; text-decoration: none;">Privacy Policy</a> 
                  | 
                  <a href="#" style="color: #6b7280; text-decoration: none;">Terms of Service</a>
                </p>
              </div>
            </div>

            <!-- Disclaimer -->
            <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 11px;">
              <p style="margin: 0;">
                This email was sent to <strong>${email}</strong> because you registered at Kofi Lartey Studios.
              </p>
              <p style="margin: 4px 0 0;">
                If you believe this was a mistake, please contact our support team.
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log("✅ Verification email sent successfully to:", email);
    console.log("📧 Message ID:", info.messageId);
    return info;

  } catch (error) {
    console.error("❌ Error while sending verification email:", error);
    throw new Error(`Failed to send verification email: ${error.message}`);
  }
};

export const sendPasswordResetEmail = async (email, studioName, resetURL) => {
  try {
    const info = await transporter.sendMail({
      from: `"Kofi Lartey Studios" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '🔐 Password Reset Request - Kofi Lartey Studios',
      text: `Hello ${studioName},\n\nYou requested a password reset. Click the link below to reset your password:\n\n${resetURL}\n\nThis link expires in 1 hour.\n\nIf you didn't request this, please ignore this email.\n\nBest regards,\nKofi Lartey Studios Team`,
      html: `
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e5e7eb; overflow: hidden;">
                    <!-- Header -->
                    <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 32px 24px; text-align: center;">
                        <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">Kofi Lartey Studios</h1>
                        <p style="color: #c7d2fe; margin: 8px 0 0;">Password Reset Request</p>
                    </div>

                    <!-- Content -->
                    <div style="padding: 40px 32px; text-align: center;">
                        <h2 style="color: #1f2937; margin: 0 0 12px; font-size: 22px;">Hello ${studioName},</h2>
                        <p style="color: #6b7280; margin: 0 0 24px; line-height: 1.6;">
                            We received a request to reset your password. Click the button below to create a new password.
                        </p>

                        <!-- Reset Button -->
                        <a href="${resetURL}" style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 24px 0;">
                            Reset Password
                        </a>

                        <p style="color: #9ca3af; font-size: 13px; margin: 16px 0;">
                            ⏰ This link expires in <strong>1 hour</strong>
                        </p>

                        <p style="color: #9ca3af; font-size: 13px; margin: 24px 0 0;">
                            If the button doesn't work, copy and paste this link into your browser:<br>
                            <a href="${resetURL}" style="color: #6366f1; word-break: break-all;">${resetURL}</a>
                        </p>

                        <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px; border-radius: 8px; margin: 24px 0;">
                            <p style="color: #991b1b; font-size: 12px; margin: 0;">
                                🔒 Security Tip: If you didn't request this, please ignore this email. Your password will remain unchanged.
                            </p>
                        </div>
                    </div>

                    <!-- Footer -->
                    <div style="background: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
                        <p style="color: #9ca3af; margin: 0; font-size: 12px;">
                            Kofi Lartey Studios © ${new Date().getFullYear()}<br>
                            Accra, Ghana
                        </p>
                    </div>
                </div>
            `
    });

    console.log("✅ Password reset email sent to:", email);
    return info;
  } catch (error) {
    console.error("❌ Error while sending password reset email:", error);
    throw new Error(`Failed to send password reset email: ${error.message}`);
  }
};

export const sendPasswordResetOTP = async (email, studioName, otpCode) => {
  try {
    const info = await transporter.sendMail({
      from: `"Kofi Lartey Studios" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '🔐 Password Reset OTP - Kofi Lartey Studios',
      html: `
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 30px; text-align: center;">
                        <h1 style="color: white; margin: 0;">Kofi Lartey Studios</h1>
                        <p style="color: #c7d2fe;">Password Reset OTP</p>
                    </div>
                    <div style="padding: 40px 30px; text-align: center;">
                        <h2>Hello ${studioName},</h2>
                        <p>Your password reset OTP is:</p>
                        <div style="background: #f3f4f6; padding: 20px; font-size: 32px; font-weight: bold; letter-spacing: 5px; border-radius: 8px; margin: 20px 0;">
                            ${otpCode}
                        </div>
                        <p>This OTP expires in <strong>10 minutes</strong></p>
                        <p>If you didn't request this, please ignore this email.</p>
                    </div>
                    <div style="background: #f9fafb; padding: 20px; text-align: center;">
                        <p>Kofi Lartey Studios © ${new Date().getFullYear()}</p>
                    </div>
                </div>
            `
    });
    console.log("✅ Password reset OTP sent to:", email);
    return info;
  } catch (error) {
    console.error("❌ Error while sending password reset OTP:", error);
    throw new Error(`Failed to send password reset OTP: ${error.message}`);
  }
};

export const sendVerificationEmail = async (email, studioName, otpCode) => {
  try {
    const info = await transporter.sendMail({
      from: `"Kofi Lartey Studios" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '🔐 Verify Your New Email Address - Kofi Lartey Studios',
      text: `Hello ${studioName},\n\nYour verification code for your new email address is: ${otpCode}\n\nThis code expires in 10 minutes.\n\nIf you didn't change your email, please contact support immediately.\n\nBest regards,\nKofi Lartey Studios Team`,
      html: `
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e5e7eb; overflow: hidden;">
                    <!-- Header -->
                    <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 32px 24px; text-align: center;">
                        <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">Kofi Lartey Studios</h1>
                        <p style="color: #c7d2fe; margin: 8px 0 0;">Email Change Verification</p>
                    </div>

                    <!-- Content -->
                    <div style="padding: 40px 32px; text-align: center;">
                        <h2 style="color: #1f2937; margin: 0 0 12px; font-size: 22px;">Hello ${studioName},</h2>
                        <p style="color: #6b7280; margin: 0 0 24px; line-height: 1.6;">
                            You have requested to change your email address. Use the verification code below to verify your new email.
                        </p>

                        <!-- OTP Box -->
                        <div style="background: linear-gradient(135deg, #f5f3ff, #ede9fe); padding: 24px; border-radius: 16px; margin: 24px 0;">
                            <p style="color: #4f46e5; font-size: 14px; font-weight: 600; margin: 0 0 12px; text-transform: uppercase; letter-spacing: 1px;">
                                Your Verification Code
                            </p>
                            <div style="font-family: 'Courier New', monospace; background: #ffffff; color: #6366f1; font-size: 48px; font-weight: 800; letter-spacing: 12px; padding: 20px; border-radius: 12px; border: 1px solid #c7d2fe;">
                                ${otpCode}
                            </div>
                            <p style="color: #6b7280; font-size: 13px; margin: 16px 0 0;">
                                ⏰ This code expires in <strong>10 minutes</strong>
                            </p>
                        </div>

                        <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px; border-radius: 8px; margin: 24px 0;">
                            <p style="color: #991b1b; font-size: 12px; margin: 0;">
                                🔒 Security Alert: If you didn't change your email, please contact our support team immediately.
                            </p>
                        </div>

                        <p style="color: #9ca3af; font-size: 13px; margin: 24px 0 0;">
                            After verification, you can log in with your new email address.
                        </p>
                    </div>

                    <!-- Footer -->
                    <div style="background: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
                        <p style="color: #9ca3af; margin: 0; font-size: 12px;">
                            Kofi Lartey Studios © ${new Date().getFullYear()}<br>
                            Accra, Ghana
                        </p>
                    </div>
                </div>
            `
    });

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
    const info = await transporter.sendMail({
      from: `"GhanaLove Dating" <${EMAIL_USER}>`,
      to: email,
      subject: "❤️ Welcome to GhanaLove – Your Journey Starts Here!",
      text: `Hello ${fullName}, welcome to GhanaLove! You're now part of Ghana's most trusted dating community. Complete your profile and start meeting amazing people near you.`,
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #fdf2f8; padding: 20px; text-align: center;">
          <div style="max-width: 550px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(233, 30, 99, 0.1);">
            
            <!-- Header with gradient -->
            <div style="background: linear-gradient(135deg, #e91e63, #ad1457); padding: 40px 20px;">
              <h1 style="color: #ffffff; margin: 0; font-size: 32px;">❤️ GhanaLove</h1>
              <p style="color: #ffcdd2; margin: 10px 0 0; font-size: 16px;">Find Your Perfect Match in Ghana</p>
            </div>

            <!-- Welcome Message -->
            <div style="padding: 40px 25px; text-align: center;">
              <div style="font-size: 50px; margin-bottom: 20px;">🎉</div>
              <h2 style="color: #333; margin-bottom: 15px;">Welcome to the Family, ${fullName}!</h2>
              
              <p style="color: #666; font-size: 16px; line-height: 1.8; margin-bottom: 30px;">
                You're now part of Ghana's most trusted dating community. <br>
                Thousands of amazing people are waiting to meet you!
              </p>

              <!-- Features -->
              <div style="text-align: left; margin-bottom: 30px;">
                <div style="margin-bottom: 15px;">
                  <span style="color: #e91e63; font-size: 20px;">📍</span>
                  <span style="color: #555; margin-left: 10px;">Find matches near you in Ghana</span>
                </div>
                <div style="margin-bottom: 15px;">
                  <span style="color: #e91e63; font-size: 20px;">✅</span>
                  <span style="color: #555; margin-left: 10px;">All profiles are Ghanaian-verified</span>
                </div>
                <div style="margin-bottom: 15px;">
                  <span style="color: #e91e63; font-size: 20px;">💬</span>
                  <span style="color: #555; margin-left: 10px;">Chat with your matches in real-time</span>
                </div>
                <div style="margin-bottom: 15px;">
                  <span style="color: #e91e63; font-size: 20px;">🔒</span>
                  <span style="color: #555; margin-left: 10px;">Safe and secure dating experience</span>
                </div>
              </div>

              <!-- CTA Button -->
              <a href="https://ghanalove.com/profile" style="display: inline-block; background: linear-gradient(135deg, #e91e63, #ad1457); color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 25px; font-size: 16px; font-weight: bold; margin-top: 10px;">
                Complete Your Profile
              </a>
            </div>

            <!-- Tips Section -->
            <div style="background-color: #fce4ec; padding: 25px; text-align: left;">
              <h3 style="color: #ad1457; margin-top: 0; font-size: 16px;">💡 Tips for Success:</h3>
              <ul style="color: #666; font-size: 14px; line-height: 1.8; padding-left: 20px;">
                <li>Upload clear, recent photos of yourself</li>
                <li>Write an interesting bio that shows your personality</li>
                <li>Be genuine and respectful in conversations</li>
                <li>Verify your identity to build trust</li>
              </ul>
            </div>

            <!-- Footer -->
            <div style="background-color: #f9f9f9; color: #999; font-size: 12px; padding: 20px; border-top: 1px solid #eeeeee; text-align: center;">
              <p style="margin: 0 0 5px;"><strong>GhanaLove Dating</strong></p>
              <p style="margin: 0 0 5px;">Accra, Ghana</p>
              <p style="margin: 0 0 10px;">
                <a href="https://ghanalove.com" style="color: #e91e63; text-decoration: none;">ghanalove.com</a> •
                <a href="https://ghanalove.com/privacy" style="color: #e91e63; text-decoration: none;">Privacy</a> •
                <a href="https://ghanalove.com/terms" style="color: #e91e63; text-decoration: none;">Terms</a>
              </p>
              <p style="margin: 0; font-size: 11px;">You received this email because you created an account on GhanaLove.</p>
            </div>
          </div>
        </div>
      `,
    });

    console.log("Welcome Email Sent: %s", info.messageId);
    return info;
  } catch (error) {
    console.error("❌ Error while sending welcome email:", error);
    throw error;
  }
};

