# Resend Quick Setup for Testing (No Domain Required)

## Quick Start

Since you're testing and don't have a domain yet, here's the fastest way to get emails working:

### Step 1: Install Resend Package

```bash
npm install resend
```

### Step 2: Get Your Resend API Key

1. Sign up at [resend.com](https://resend.com) (free account)
2. Go to API Keys in your dashboard
3. Create a new API key
4. Copy the key (starts with `re_`)

### Step 3: Configure Environment Variables

Add to your `.env.local` (for local development) and `.env.production` (for Vercel):

```env
RESEND_API_KEY=re_your_api_key_here
```

**Note:** The code will also check for `NEXT_PUBLIC_RESEND_API_KEY` if you prefer that naming.

### Step 4: Set Up Your From Address (No Domain Required!)

Since you don't have a domain yet, Resend provides a test domain for free:

**Option A: Use Resend's Default Test Domain**

1. In your Resend dashboard:
   - Go to **Domains** section
   - You'll see your account has access to a test domain
   - The format is usually: `onboarding@resend.dev` or `your-account@resend.app`
   - Check the "Receiving" tab for your inbound address

2. Add to your `.env.production` and `.env.local`:
   ```env
   RESEND_FROM_ADDRESS=onboarding@resend.dev
   ```
   (Replace with your actual Resend test domain from the dashboard)

**Option B: Configure in Settings UI**

1. Go to Settings → Notifications → Email
2. Enable email notifications
3. Set **From** field to your Resend test domain (e.g., `onboarding@resend.dev`)
4. Set **Reply To** to the same address

**Note:** If you get an "invalid from address" error, check your Resend dashboard for the exact test domain format they provide. It's usually in the Domains or Receiving section.

### Step 5: Deploy to Vercel

Since you already have `NEXT_PUBLIC_RESEND_API_KEY` in your `.env.production`, you have two options:

**Option A: Use Existing Variable (Already Set!)**
- Your `NEXT_PUBLIC_RESEND_API_KEY` is already in `.env.production`
- The code will automatically detect it
- Just make sure it's also added to Vercel environment variables:
  1. Go to your Vercel project → Settings → Environment Variables
  2. Add `NEXT_PUBLIC_RESEND_API_KEY` with value: `re_your_api_key_here`
  3. Add `RESEND_FROM_ADDRESS` with your test domain (e.g., `onboarding@resend.dev`)

**Option B: Use Server-Side Variable (More Secure)**
- Add `RESEND_API_KEY` (without NEXT_PUBLIC) to Vercel:
  1. Go to Vercel project → Settings → Environment Variables
  2. Add `RESEND_API_KEY` with your key
  3. Add `RESEND_FROM_ADDRESS` with your test domain

2. Redeploy your application

### Step 6: Test It!

1. Add a new employee/manager/admin through the system
2. Check the email logs in Firestore (`emailLogs` collection)
3. The recipient should receive the onboarding email

## Free Tier Limits

- ✅ **3,000 emails per month**
- ✅ **100 emails per day**
- ✅ Perfect for testing!

## Troubleshooting

### "Invalid 'from' address" error?

- Make sure you're using your Resend test domain (format: `something@your-id.resend.app`)
- Check your Resend dashboard → Domains to find your test domain
- Or verify a domain for free in Resend (takes 5 minutes)

### Emails not sending?

1. Check Vercel logs for errors
2. Verify `RESEND_API_KEY` is set in Vercel environment variables
3. Check Firestore `emailLogs` collection for error details
4. Make sure email notifications are enabled in Settings

### For Production Later

When you get a domain:
1. Verify it in Resend dashboard (free, takes 5 minutes)
2. Update the "From" address in Settings → Notifications → Email
3. That's it! No code changes needed.

