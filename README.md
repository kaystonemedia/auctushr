# KayStoneHR

A modern HR management system built with Next.js and Firebase.

## Features

- Employee Management
- Attendance Tracking
- Leave Management
- Payroll Processing
- Document Management
- Role-based Access Control
- Real-time Notifications
- Analytics Dashboard

## Tech Stack

- Next.js 14
- TypeScript
- Firebase (Authentication, Firestore, Functions)
- TailwindCSS
- MongoDB (for data archival)

## Prerequisites

- Node.js 18.x or later
- npm or yarn
- Firebase account
- MongoDB account
- Google Maps API key

## Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
FIREBASE_CLIENT_EMAIL=your_firebase_client_email
FIREBASE_PRIVATE_KEY=your_firebase_private_key
MONGODB_URI=your_mongodb_uri
```

## Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the development server:
   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deployment

1. Install Vercel CLI:
   ```bash
   npm install -g vercel
   ```

2. Login to Vercel:
   ```bash
   vercel login
   ```

3. Deploy to Vercel:
   ```bash
   vercel
   ```

4. Set up environment variables in Vercel:
   - Go to your project settings in Vercel
   - Navigate to the Environment Variables section
   - Add all the variables from your `.env.local` file

5. Deploy Firebase Functions:
   ```bash
   cd functions
   npm install
   firebase deploy --only functions
   ```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
