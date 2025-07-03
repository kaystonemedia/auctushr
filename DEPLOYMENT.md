# 🚀 Vercel Deployment Guide

## Quick Deployment Steps

### 1. **Prepare Your Repository**
```bash
# Make sure all changes are committed
git add .
git commit -m "Prepare for Vercel deployment"
git push origin main
```

### 2. **Deploy to Vercel**

#### Option A: Using Vercel CLI (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel --prod
```

#### Option B: Using Vercel Dashboard
1. Go to [vercel.com](https://vercel.com)
2. Click "New Project"
3. Import your GitHub repository
4. Configure project settings
5. Deploy

### 3. **Configure Environment Variables**

In your Vercel project dashboard, go to **Settings > Environment Variables** and add:

#### Required Firebase Variables:
```
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

#### Required Firebase Admin Variables:
```
FIREBASE_ADMIN_PROJECT_ID=your_project_id
FIREBASE_ADMIN_PRIVATE_KEY_ID=your_private_key_id
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----\n"
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your_project.iam.gserviceaccount.com
FIREBASE_ADMIN_CLIENT_ID=your_client_id
FIREBASE_ADMIN_AUTH_URI=https://accounts.google.com/o/oauth2/auth
FIREBASE_ADMIN_TOKEN_URI=https://oauth2.googleapis.com/token
FIREBASE_ADMIN_AUTH_PROVIDER_X509_CERT_URL=https://www.googleapis.com/oauth2/v1/certs
FIREBASE_ADMIN_CLIENT_X509_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxxxx%40your_project.iam.gserviceaccount.com
```

### 4. **Get Firebase Configuration**

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Go to **Project Settings > General**
4. Scroll down to "Your apps" section
5. Copy the config values

### 5. **Get Firebase Admin SDK**

1. In Firebase Console, go to **Project Settings > Service Accounts**
2. Click "Generate new private key"
3. Download the JSON file
4. Copy the values to your environment variables

### 6. **Test the Deployment**

After deployment, your app will be available at:
```
https://your-project-name.vercel.app
```

## 🔧 Troubleshooting

### Common Issues:

1. **Build Errors**
   - Check that all dependencies are in `package.json`
   - Ensure TypeScript compilation passes locally

2. **Environment Variables**
   - Make sure all Firebase variables are set
   - Check that private keys are properly formatted

3. **Firebase Connection**
   - Verify Firebase project ID matches
   - Check Firebase security rules are published

4. **Authentication Issues**
   - Ensure Firebase Auth is enabled
   - Check domain is added to authorized domains

## 📋 Pre-Deployment Checklist

- [ ] All code is committed and pushed
- [ ] Firebase project is configured
- [ ] Environment variables are ready
- [ ] Local build passes (`npm run build`)
- [ ] Firebase security rules are published
- [ ] Test accounts are created in Firebase

## 🎯 Post-Deployment

1. **Test all features:**
   - User registration/login
   - Employee management
   - Attendance tracking
   - Productivity dashboard
   - Payroll management

2. **Create test accounts:**
   - Admin user
   - Manager user
   - Employee user

3. **Share with your boss:**
   - Send the Vercel URL
   - Provide test account credentials
   - Document key features to test

## 🔒 Security Notes

- Never commit `.env` files to git
- Use Vercel's environment variable encryption
- Regularly rotate Firebase admin keys
- Monitor Firebase usage and costs

## 📞 Support

If you encounter issues:
1. Check Vercel deployment logs
2. Review Firebase console for errors
3. Test locally with production environment variables 