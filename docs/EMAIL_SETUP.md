# Email Setup Guide

This guide explains how to configure email notifications for the onboarding process.

## Overview

When an admin or manager adds a new user (employee, manager, or admin), the system automatically sends an onboarding email to the user's provided email address. The email includes:
- Welcome message personalized by role
- User's position and department
- Role-specific information and capabilities
- Login instructions
- Next steps for onboarding

## Configuration

### Option 1: SMTP Configuration (Recommended)

1. Go to **Settings** → **Notifications** → **Email**
2. Enable email notifications
3. Configure SMTP settings:
   - **Host**: Your SMTP server (e.g., `smtp.titan.email` for Hostinger, `smtp.gmail.com`, `smtp.sendgrid.net`)
   - **Port**: SMTP port (usually 587 for STARTTLS or 465 for SSL)
   - **Secure**: Enable for SSL (port 465), disable for STARTTLS (port 587)
   - **Username**: Your SMTP username/email (full email address)
   - **Password**: Your SMTP password or app password
   - **From**: Email address to send from (e.g., `noreply@yourcompany.com`)
   - **Reply To**: Email address for replies (e.g., `hr@yourcompany.com`)

**For Hostinger Titan Mail users**, see the detailed setup guide: [Hostinger Titan Mail Setup](./HOSTINGER_TITAN_MAIL_SETUP.md)

### Option 2: Resend API (Recommended for Testing - FREE)

Resend offers a **free tier** perfect for testing:
- **3,000 emails per month**
- **100 emails per day**
- No credit card required
- Includes RESTful API access

**Setup Steps:**

1. Sign up for a free [Resend](https://resend.com) account
2. Get your API key from the Resend dashboard
3. Install the Resend package:
   ```bash
   npm install resend
   ```
4. Add to your `.env` file:
   ```
   RESEND_API_KEY=re_your_api_key_here
   ```
5. The system will automatically use Resend if the API key is available

**Important for Testing (No Domain Required):**

Since you don't have a domain yet, you can use Resend's test domain:

1. **Get Your Resend Test Domain:**
   - Go to your Resend dashboard
   - Navigate to "Domains" section
   - You'll see your test domain (format: `your-alias@your-id.resend.app`)
   - Or check the "Receiving" tab for your inbound address

2. **Set the From Address:**
   - Option A: Add to your `.env` file:
     ```
     RESEND_FROM_ADDRESS=your-alias@your-id.resend.app
     ```
   - Option B: Configure in Settings → Notifications → Email → From field

3. **For Production:** When you get a domain, verify it in Resend (free) and update the "From" address.

**Note:** Resend requires a verified domain or their test domain for the "from" address. The test domain works perfectly for testing without any domain ownership.

### Option 3: Other Email Services

You can integrate other email services (SendGrid, AWS SES, etc.) by modifying:
- `app/api/email/onboarding/route.ts`

## Email Content

The onboarding email includes:
- Professional HTML template with company branding
- Welcome message personalized with user name and role
- Role-specific content (Employee, Manager, or Administrator)
- Position and department information
- Step-by-step onboarding instructions
- Direct login link
- Contact information for support (role-appropriate)

## Testing

To test email functionality:

1. Ensure email notifications are enabled in Settings
2. Add a new user (employee, manager, or admin) through their respective pages:
   - Employees page for employees
   - Managers page for managers
   - Administrators page for admins
3. Check the email logs in Firestore (`emailLogs` collection)
4. Verify the email was received by the user

## Troubleshooting

### Emails not sending?

1. **Check Settings**: Ensure email notifications are enabled
2. **Verify SMTP Credentials**: Double-check username, password, host, and port
3. **Check Logs**: Review server logs for error messages
4. **Firewall/Network**: Ensure SMTP ports are not blocked
5. **Email Service Status**: Check if your email service provider is operational

### Email goes to spam?

- Ensure SPF, DKIM, and DMARC records are configured for your domain
- Use a verified sender email address
- Avoid spam trigger words in subject/content
- Consider using a dedicated email service (Resend, SendGrid) for better deliverability

## Development Mode

In development, if email is not configured, the system will:
- Log email content to the console
- Not throw errors (employee creation will still succeed)
- Store email logs in Firestore for debugging

## Future Enhancements

- Email templates customization
- Multiple language support
- Email scheduling options
- Attachment support (company policies, etc.)
- Email tracking and analytics

