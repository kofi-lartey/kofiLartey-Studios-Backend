# SMTP Configuration Checklist

Use this checklist to verify your SMTP setup is correct:

## ✅ Environment Configuration

- [ ] Backend folder has `.env` file (not `.env.example`)
- [ ] `SMTP_HOST` is set (e.g., `smtp.gmail.com`)
- [ ] `SMTP_PORT` is set (e.g., `587`)
- [ ] `EMAIL_USER` is set (your email address)
- [ ] `EMAIL_PASS` is set (16-char app password for Gmail)

### Gmail Setup (if using Gmail)
- [ ] 2-Factor Authentication enabled on Google Account
- [ ] App Password created at https://myaccount.google.com/apppasswords
- [ ] Used "Mail" and "Windows Computer" options when generating
- [ ] 16-character password (no spaces) pasted into EMAIL_PASS

### Alternative Providers (if not Gmail)
- [ ] Verified SMTP host for your provider
- [ ] Verified port number (usually 587 or 465)
- [ ] Verified username/password format required
- [ ] Confirmed authentication method (SMTP plain auth)

## ✅ Code Updates

- [ ] `Backend/Utiles/mailer.js` has been updated
- [ ] `sendEmailWithRetry()` helper function exists
- [ ] All email functions pass options to `sendEmailWithRetry()`
- [ ] No syntax errors in updated files

## ✅ Server Status

- [ ] Backend server starts without errors
- [ ] Initial logs show `✅ SMTP server is ready`
- [ ] Initial logs display correct SMTP host and port
- [ ] Console not showing `❌ SMTP verify failed` errors

## ✅ Testing

- [ ] Able to register a new account (triggers verification email)
- [ ] Verification email arrives in inbox
- [ ] Email comes from correct sender (Kofi Lartey Studios)
- [ ] OTP code in email is correct format

- [ ] Able to request password reset
- [ ] Password reset email arrives in inbox
- [ ] Reset link in email is functional

- [ ] Able to update email address
- [ ] Verification email for new address arrives
- [ ] Email change completes successfully

## ✅ Error Handling

- [ ] When network is down, email functions fail gracefully
- [ ] Retry logic engages automatically on timeout
- [ ] After 3 retries, helpful error message is displayed
- [ ] Debug logs show retry attempts (if DEBUG_MAILER=true)

## ✅ Performance

- [ ] Multiple emails send without timeout issues
- [ ] Connection pooling reduces repeated connection overhead
- [ ] Rate limiting prevents overwhelming the SMTP server
- [ ] No more frequent timeout errors

## 📝 Debug Checklist (if troubleshooting)

### Enable Debug Mode
- [ ] Added `DEBUG_MAILER=true` to `.env`
- [ ] Restarted backend server
- [ ] Console logs show detailed SMTP communication

### Test Network Connectivity
- [ ] Can ping SMTP host: `ping smtp.gmail.com` (or your provider)
- [ ] Port accessible: `Test-NetConnection -ComputerName smtp.gmail.com -Port 587` (Windows)
- [ ] DNS resolves: `nslookup smtp.gmail.com`

### Verify Credentials
- [ ] EMAIL_USER is exactly as shown in provider (case-sensitive)
- [ ] EMAIL_PASS contains NO spaces or special characters
- [ ] For Gmail: password is 16-character app password
- [ ] No trailing spaces in `.env` values

### Check Firewall/Network
- [ ] Outbound SMTP port not blocked by firewall
- [ ] VPN not interfering with SMTP connection
- [ ] ISP not blocking SMTP (try different network if needed)
- [ ] Corporate network has SMTP access configured

## 📞 Troubleshooting Steps

If emails still not sending:

1. **Check .env file is read correctly**
   - Restart backend after editing .env
   - Console should show SMTP_HOST value

2. **Verify credentials**
   - Test password works on web interface
   - For Gmail, confirm using app password (not regular password)

3. **Test SMTP connection directly**
   ```bash
   # Windows
   Test-NetConnection -ComputerName smtp.gmail.com -Port 587
   
   # Mac/Linux
   telnet smtp.gmail.com 587
   ```

4. **Enable DEBUG_MAILER=true and check logs**
   - Look for lines starting with "[nodemailer]"
   - Check for authentication errors

5. **Try alternative SMTP provider**
   - Gmail 587: `smtp.gmail.com`
   - Gmail 465: `smtp.gmail.com` with secure:true
   - Outlook: `smtp-mail.outlook.com:587`
   - SendGrid: `smtp.sendgrid.net:587`

6. **Check email sending code**
   - Verify email address format is valid
   - Check that email function is actually being called
   - Look for error messages in catch block

## ✅ Final Verification

- [ ] All items above checked
- [ ] Backend server starting successfully
- [ ] Test emails sending without errors
- [ ] Error handling working as expected

If any item shows ❌, refer to relevant troubleshooting section in `SMTP_TROUBLESHOOTING.md`

---

**Status:** Ready for verification
**Last Updated:** May 2026
