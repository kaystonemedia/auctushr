v   # Hostinger Titan Mail SMTP Setup Guide

This guide will help you configure Hostinger Titan Mail SMTP server for sending onboarding emails and other notifications in Auctushr.

## Prerequisites

- A Hostinger hosting account with Titan Mail enabled
- A domain name configured with Titan Mail
- Access to your Hostinger control panel (hPanel)

## Step 1: Get Your SMTP Credentials

1. **Log in to Hostinger hPanel**
   - Go to [hPanel](https://hpanel.hostinger.com/)
   - Log in with your Hostinger account credentials

2. **Navigate to Email Accounts**
   - In the hPanel dashboard, find the **"Email"** section
   - Click on **"Email Accounts"** or **"Titan Email"**

3. **Create or Select an Email Account**
   - If you don't have an email account yet, create one (e.g., `noreply@yourdomain.com`)
   - Note: You'll use this email address as your "From" address

4. **Get SMTP Settings**
   - Click on the email account you want to use
   - Look for **"Email Client Configuration"** or **"SMTP Settings"**
   - You'll find the following information:
     - **SMTP Host**: `smtp.titan.email` (or `smtp.hostinger.com`)
     - **SMTP Port**: `587` (for STARTTLS) or `465` (for SSL)
     - **SMTP Username**: Your full email address (e.g., `noreply@yourdomain.com`)
     - **SMTP Password**: The password for your email account

## Step 2: Configure in Auctushr

1. **Navigate to Settings**
   - Log in to your Auctushr dashboard
   - Go to **Settings** → **Notifications** tab

2. **Enable Email Notifications**
   - Toggle **"Enable Email Notifications"** to ON

3. **Configure Email Addresses**
   - **From Email**: Enter your Titan Mail email address (e.g., `noreply@yourdomain.com`)
   - **Reply To**: Enter the email address where you want replies to go (e.g., `hr@yourdomain.com`)

4. **Configure SMTP Settings**
   - **SMTP Host**: `smtp.titan.email`
   - **SMTP Port**: 
     - `587` (recommended - uses STARTTLS)
     - OR `465` (if you prefer SSL)
   - **SMTP Username**: Your full email address (e.g., `noreply@yourdomain.com`)
   - **SMTP Password**: Your email account password
   - **Use SSL/TLS**: 
     - **OFF** for port 587 (STARTTLS will be used automatically)
     - **ON** for port 465 (SSL)

5. **Save Settings**
   - Click **"Save"** or **"Update Settings"** to save your configuration

## Recommended Configuration

For Hostinger Titan Mail, we recommend:

```
SMTP Host: smtp.titan.email
SMTP Port: 587
SMTP Username: noreply@yourdomain.com (your email address)
SMTP Password: [your email password]
Use SSL/TLS: OFF (STARTTLS will be used automatically)
From Email: noreply@yourdomain.com
Reply To: hr@yourdomain.com
```

## Alternative Configuration (SSL)

If you prefer to use SSL instead of STARTTLS:

```
SMTP Host: smtp.titan.email
SMTP Port: 465
SMTP Username: noreply@yourdomain.com
SMTP Password: [your email password]
Use SSL/TLS: ON
From Email: noreply@yourdomain.com
Reply To: hr@yourdomain.com
```

## Step 3: Test Your Configuration

1. **Add a Test User**
   - Go to **Employees**, **Managers**, or **Administrators** page
   - Add a new user with your own email address
   - The system should automatically send an onboarding email

2. **Check Email Logs**
   - Check your email inbox (including spam folder)
   - If the email doesn't arrive, check the server logs for errors

3. **Verify in Firestore**
   - Check the `emailLogs` collection in Firestore
   - Look for entries with `status: 'sent'`

## Troubleshooting

### Email Not Sending?

1. **Verify SMTP Credentials**
   - Double-check your email address and password
   - Make sure there are no extra spaces
   - Try logging into your email account via webmail to verify credentials

2. **Check Port Settings**
   - Port 587 requires "Use SSL/TLS" to be **OFF**
   - Port 465 requires "Use SSL/TLS" to be **ON**
   - Try switching between ports if one doesn't work

3. **Check Firewall/Network**
   - Ensure your server can access `smtp.titan.email` on ports 587 or 465
   - Check if your hosting provider blocks outbound SMTP connections

4. **Check Server Logs**
   - Review your application logs for SMTP connection errors
   - Common errors:
     - `ECONNREFUSED`: Server can't connect to SMTP host
     - `EAUTH`: Authentication failed (wrong username/password)
     - `ETIMEDOUT`: Connection timeout

5. **Test with Email Client**
   - Try configuring the same SMTP settings in an email client (Outlook, Thunderbird)
   - If it works there but not in the app, check the code implementation

### Email Goes to Spam?

1. **SPF Record**
   - Ensure your domain has SPF records configured
   - SPF should include: `v=spf1 include:_spf.titan.email ~all`

2. **DKIM Record**
   - Hostinger Titan Mail should automatically configure DKIM
   - Verify in your domain's DNS settings

3. **DMARC Record**
   - Consider adding a DMARC record for better deliverability
   - Start with: `v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com`

4. **From Address**
   - Use a proper email address (not a generic one)
   - Match the "From" address with your domain

### Common Error Messages

- **"Authentication failed"**: Wrong username or password
- **"Connection timeout"**: Firewall blocking SMTP port or wrong host
- **"Invalid host"**: Wrong SMTP host address
- **"Certificate error"**: SSL/TLS configuration mismatch

## Security Best Practices

1. **Use App-Specific Password** (if available)
   - Some email providers allow app-specific passwords
   - This is more secure than using your main email password

2. **Store Credentials Securely**
   - Never commit SMTP passwords to version control
   - Use environment variables for sensitive data (if implementing)

3. **Regular Password Updates**
   - Change your email password periodically
   - Update it in the settings when changed

4. **Monitor Email Logs**
   - Regularly check email logs for suspicious activity
   - Set up alerts for failed email attempts

## Additional Resources

- [Hostinger Email Setup Guide](https://www.hostinger.com/tutorials/how-to-set-up-email)
- [Titan Mail Documentation](https://www.hostinger.com/tutorials/titan-email)
- [SMTP Configuration Help](https://www.hostinger.com/tutorials/how-to-configure-smtp)

## Support

If you continue to experience issues:

1. Contact Hostinger support for SMTP configuration help
2. Check Auctushr documentation for email troubleshooting
3. Review server logs for detailed error messages

---

**Note**: Make sure your domain's DNS records are properly configured and propagated before testing email functionality.

