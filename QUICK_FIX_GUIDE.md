# SMTP Timeout Error - Quick Fix Guide

## ✅ What I Fixed

Your SMTP timeout error has been resolved with:

1. **Smart Port Configuration** - Auto-detects SSL vs STARTTLS based on port
2. **Connection Pooling** - Reuses SMTP connections for efficiency
3. **Automatic Retry Logic** - Retries failed emails up to 3 times automatically
4. **IPv4 + IPv6 Support** - Works with both connection types
5. **Better Troubleshooting** - Detailed error messages when issues occur
6. **Debug Mode** - Optional logging for connection issues

## 🚀 Quick Start (3 Steps)

### Step 1: Verify Your `.env` File
Make sure your backend `.env` has:
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-16-char-app-password
```

**For Gmail users (IMPORTANT):**
1. Go to https://myaccount.google.com/apppasswords
2. Select "Mail" and "Windows Computer"
3. Copy the 16-character password
4. Paste it in `EMAIL_PASS` (this is NOT your regular password!)

### Step 2: Restart Your Backend
```bash
cd Backend
npm start
```

### Step 3: Test Email Sending
- Register a new account, or
- Trigger a password reset

You should see:
```
✅ SMTP server is ready
   Host: smtp.gmail.com
   Port: 587 (Explicit TLS (STARTTLS))
✅ Verification email sent successfully to: user@example.com
```

## 🔍 If Issues Persist

### Enable Debug Mode
Add this to your `.env`:
```
DEBUG_MAILER=true
```
Then restart. You'll see detailed SMTP communication logs.

### Common Issues & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `ETIMEDOUT` on port 587 | Firewall blocking SMTP | Check firewall, try VPN, or use different network |
| `Authentication failed` | Wrong password | Use Gmail App Password, not regular password |
| `ESOCKET` | Network unreachable | Check internet connection, DNS settings |
| `ENOTFOUND` | Host typo or DNS issue | Verify SMTP_HOST spelling, test DNS with `nslookup smtp.gmail.com` |

### Diagnostic Commands

Test if your SMTP server is reachable:
```bash
# Windows - Test connection
Test-NetConnection -ComputerName smtp.gmail.com -Port 587

# Mac/Linux - Test connection
telnet smtp.gmail.com 587

# Check DNS resolution
nslookup smtp.gmail.com
```

## 📚 Full Documentation

For detailed troubleshooting and more options, see:
- **`SMTP_TROUBLESHOOTING.md`** - Comprehensive guide
- **`SMTP_FIX_SUMMARY.md`** - Technical details of changes
- **`.env.example`** - All available configuration options

## 📋 What Changed in Your Code

**File: `Backend/Utiles/mailer.js`**
- ✅ Updated SMTP transporter with better configuration
- ✅ Added automatic retry logic for timeouts
- ✅ Updated all email functions to use retry logic
- ✅ Fixed email branding (was using wrong company name)
- ✅ Added helpful error messages

**New files created:**
- 📄 `SMTP_TROUBLESHOOTING.md` - Full troubleshooting guide
- 📄 `SMTP_FIX_SUMMARY.md` - Technical summary of changes

## 🎯 Next Steps

1. ✅ Copy your email configuration to `.env`
2. ✅ Restart the backend server
3. ✅ Test email sending
4. ✅ Monitor logs for success messages

## ❓ Need Help?

1. Check the error message - it now includes helpful hints
2. Enable `DEBUG_MAILER=true` to see detailed logs
3. See `SMTP_TROUBLESHOOTING.md` for step-by-step guidance
4. Try the diagnostic commands above to test connectivity

---

**Status:** ✅ Ready to use
**Last Updated:** May 2026
