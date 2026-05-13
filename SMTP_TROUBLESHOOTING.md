# SMTP Timeout Error - Troubleshooting Guide

## Error
```
❌ SMTP verify failed: Error: Timeout (ETIMEDOUT)
```

## Root Causes & Solutions

### 1. **Incorrect SMTP Host or Port**
The most common cause of timeout errors is misconfigured SMTP server details.

**Fix:**
- Verify your `.env` file has correct values:
  ```
  SMTP_HOST=smtp.gmail.com       # or your provider's host
  SMTP_PORT=587                  # 587 for STARTTLS, 465 for SSL/TLS
  EMAIL_USER=your-email@gmail.com
  EMAIL_PASS=your-app-password   # NOT your regular password!
  ```

**Common SMTP Providers:**
| Provider | Host | Port | Security |
|----------|------|------|----------|
| Gmail | smtp.gmail.com | 587 | STARTTLS |
| Gmail | smtp.gmail.com | 465 | SSL/TLS |
| Outlook | smtp-mail.outlook.com | 587 | STARTTLS |
| SendGrid | smtp.sendgrid.net | 587 | STARTTLS |
| AWS SES | email-smtp.{region}.amazonaws.com | 587 | STARTTLS |

### 2. **Gmail Authentication Issues**
If using Gmail, regular passwords won't work.

**Solution:**
1. Enable 2-Factor Authentication on your Google Account
2. Generate an **App Password** (not your regular password):
   - Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
   - Select "Mail" and "Windows Computer"
   - Copy the 16-character password
   - Use this in `EMAIL_PASS` in your `.env`

### 3. **Firewall/Network Blocking Outbound SMTP**
Your network may be blocking outbound connections on the SMTP port.

**Diagnostic Commands:**
```bash
# Test SMTP host connectivity
ping smtp.gmail.com

# Test specific port (Windows)
Test-NetConnection -ComputerName smtp.gmail.com -Port 587

# Test specific port (Mac/Linux)
telnet smtp.gmail.com 587

# DNS resolution test
nslookup smtp.gmail.com
```

**If blocked:**
- Contact your network administrator
- Use a different network or VPN
- Switch to HTTP-based email services (Mailgun, SendGrid API)

### 4. **SMTP Server Temporarily Down**
The email service might be experiencing issues.

**Solution:**
- Wait a few minutes and retry
- Check the email provider's status page
- Switch to a backup SMTP provider

### 5. **Timeout Values Too Short**
The configured timeouts might be too aggressive.

**Updated Configuration** (already applied):
```javascript
connectionTimeout: 30000,    // 30 seconds
greetingTimeout: 10000,      // 10 seconds
socketTimeout: 30000,        // 30 seconds
```

### 6. **Automatic Retry Logic** (Now Enabled)
All email functions now include automatic retry with exponential backoff:
- Retries up to 3 times on timeout
- Wait 1s before 1st retry, 2s before 2nd, 3s before 3rd
- Immediately fails on non-timeout errors

## Step-by-Step Debugging

### Step 1: Verify Environment Variables
```bash
# In Backend folder, check if .env exists and has correct values
cat .env | grep SMTP
cat .env | grep EMAIL
```

### Step 2: Enable Debug Mode
Set in your `.env`:
```
DEBUG_MAILER=true
```
This will log detailed SMTP communication.

### Step 3: Test SMTP Connection Manually
```bash
# In Backend folder
node -e "
import('./Config/env.js').then(env => {
  console.log('SMTP Host:', env.SMTP_HOST);
  console.log('SMTP Port:', env.SMTP_PORT);
  console.log('Email User:', env.EMAIL_USER);
  console.log('Email Pass:', env.EMAIL_PASS ? '***' : 'MISSING');
}).catch(err => console.error('Error:', err));
"
```

### Step 4: Check Node Version
Ensure you're using Node.js 14+:
```bash
node --version
```

### Step 5: Reinstall Dependencies
```bash
cd Backend
npm install
```

## Enhanced Error Messages

The transporter now provides helpful troubleshooting info:
```
❌ SMTP verify failed: [error message]
   Error Code: ETIMEDOUT
   Troubleshooting steps:
   1. Check SMTP_HOST and SMTP_PORT in your .env file
   2. Verify EMAIL_USER and EMAIL_PASS are correct
   3. Ensure firewall allows outbound connections on port 587
   4. Check if SMTP server is reachable (ping, telnet, nslookup)
   5. For Gmail, use 'App Passwords' instead of regular password
```

## Alternative Email Services (Recommended)

If SMTP continues to fail, consider these alternatives:

### Mailgun (API-based)
```javascript
import FormData from 'form-data';
import Mailgun from 'mailgun.js';

const mailgun = new Mailgun(FormData);
const client = mailgun.client({ username: 'api', key: process.env.MAILGUN_API_KEY });
```

### SendGrid (API-based)
```javascript
import sgMail from '@sendgrid/mail';
sgMail.setApiKey(process.env.SENDGRID_API_KEY);
```

### AWS SES
```javascript
import AWS from 'aws-sdk';
const sesClient = new AWS.SES({ region: process.env.AWS_REGION });
```

## Recent Improvements

✅ **Updated Configuration:**
- Auto-detects secure connection based on port (465 = secure, others = STARTTLS)
- Removes IPv4-only restriction (tries both IPv4 and IPv6)
- Adds connection pooling for better reliability
- Enabled logging for debugging

✅ **Retry Logic:**
- Automatic retries on timeout with exponential backoff
- Applied to all email functions
- Better error messages

✅ **Branding Fix:**
- Fixed `sendWelcomeEmail` to use Kofi Lartey Studios branding
- Consistent styling across all emails

## Testing Locally

Once configured, test with:
```bash
# Start backend server
npm start

# Trigger email-based action (registration, password reset)
# Watch console logs for email send confirmation
```

## Still Having Issues?

1. **Enable debug mode** and check detailed logs
2. **Test with host provider** directly (e.g., Gmail's test tool)
3. **Try alternative SMTP** If Gmail verify fails consistently
4. **Check .env file exists** in Backend root folder
5. **Verify no typos** in SMTP_HOST (e.g., "stmp" vs "smtp")

---

**Last Updated:** May 2026
**Configuration File:** `Backend/Utiles/mailer.js`
**Environment File:** `Backend/.env` (create if missing)
