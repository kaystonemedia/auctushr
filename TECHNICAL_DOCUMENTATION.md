# KaystoneHR - Technical Documentation

## Table of Contents
1. [System Architecture](#system-architecture)
2. [Technology Stack](#technology-stack)
3. [Database Schema](#database-schema)
4. [Security Implementation](#security-implementation)
5. [Development Setup](#development-setup)
6. [Deployment Guide](#deployment-guide)
7. [API Documentation](#api-documentation)
8. [Chrome Extension](#chrome-extension)
9. [Performance Optimization](#performance-optimization)
10. [Monitoring & Maintenance](#monitoring--maintenance)

---

## System Architecture

### Overview
KaystoneHR follows a modern serverless architecture built on Firebase/Firestore with a Next.js frontend. The system implements a role-based access control (RBAC) pattern with real-time data synchronization.

### Architecture Diagram
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Chrome        │    │   Next.js       │    │   Firebase      │
│   Extension     │◄──►│   Frontend      │◄──►│   Backend       │
│   (Tracking)    │    │   (Web App)     │    │   (Database)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Background    │    │   Real-time     │    │   Firestore     │
│   Tracking      │    │   Updates       │    │   Collections   │
│   Service       │    │   (WebSocket)   │    │   & Rules       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Key Components

#### Frontend (Next.js)
- **Pages**: Route-based pages with server-side rendering
- **Components**: Reusable UI components using shadcn/ui
- **Contexts**: Global state management for authentication
- **Hooks**: Custom hooks for data fetching and state management

#### Backend (Firebase)
- **Firestore**: NoSQL document database
- **Authentication**: Firebase Auth with email/password
- **Security Rules**: Server-side authorization
- **Real-time Listeners**: Live data synchronization

#### Chrome Extension
- **Background Script**: Continuous activity monitoring
- **Content Script**: Website interaction tracking
- **Popup Interface**: User controls and settings
- **Storage**: Local data caching and synchronization

---

## Technology Stack

### Frontend Technologies
- **Next.js 14**: React framework with App Router
- **TypeScript**: Static type checking
- **TailwindCSS**: Utility-first CSS framework
- **shadcn/ui**: Modern UI component library
- **React Hook Form**: Form validation and management
- **Date-fns**: Date manipulation library

### Backend Technologies
- **Firebase**: Backend-as-a-Service platform
- **Firestore**: NoSQL document database
- **Firebase Auth**: Authentication service
- **Firebase Functions**: Serverless functions (future enhancement)
- **Firebase Storage**: File storage service

### Development Tools
- **ESLint**: Code linting and formatting
- **Prettier**: Code formatting
- **TypeScript**: Type checking
- **Vercel**: Deployment and hosting platform

### Chrome Extension
- **Manifest V3**: Latest Chrome extension API
- **Web APIs**: Browser interaction APIs
- **IndexedDB**: Local storage for offline capability

---

## Database Schema

### Firestore Collections

#### Users Collection
```typescript
interface User {
  id: string;
  email: string;
  name: string;
  role: 'employee' | 'manager' | 'admin';
  department: string;
  position: string;
  phone?: string;
  address?: string;
  salary?: number;
  hireDate: Date;
  hasPassword: boolean;
  uid: string;
  createdAt: Date;
  updatedAt: Date;
}
```

#### Employees Collection
```typescript
interface Employee {
  id: string;
  uid: string;
  email: string;
  name: string;
  role: 'employee' | 'manager' | 'admin';
  department: string;
  position: string;
  managerId?: string;
  phone?: string;
  address?: string;
  salary?: number;
  hireDate: Date;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}
```

#### Attendance Collection
```typescript
interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: Date;
  clockIn: Date;
  clockOut?: Date;
  breakStart?: Date;
  breakEnd?: Date;
  totalHours?: number;
  location?: {
    latitude: number;
    longitude: number;
    address: string;
  };
  status: 'present' | 'absent' | 'late' | 'early_leave';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

#### Leave Requests Collection
```typescript
interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  type: 'annual' | 'sick' | 'personal' | 'maternity' | 'paternity' | 'bereavement' | 'unpaid';
  startDate: Date;
  endDate: Date;
  status: 'pending' | 'approved' | 'rejected';
  reason: string;
  approvedBy?: string;
  approvedAt?: Date;
  rejectedBy?: string;
  rejectedAt?: Date;
  attachments?: string[];
  createdAt: Date;
  updatedAt: Date;
}
```

#### Leave Balances Collection
```typescript
interface LeaveBalance {
  id: string; // Format: {employeeId}_{year}
  employeeId: string;
  year: number;
  annual: number;
  sick: number;
  personal: number;
  maternity: number;
  paternity: number;
  bereavement: number;
  unpaid: number;
  updatedAt: Date;
}
```

#### Tasks Collection
```typescript
interface Task {
  id: string;
  title: string;
  description: string;
  assignedTo: string;
  assignedBy: string;
  department: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  dueDate?: Date;
  completedAt?: Date;
  attachments?: string[];
  createdAt: Date;
  updatedAt: Date;
}
```

---

## Security Implementation

### Firestore Security Rules
The system implements comprehensive security rules that enforce:
- **Authentication**: All operations require authentication
- **Role-based Access**: Different permissions for employees, managers, and admins
- **Data Isolation**: Users can only access their own data or data they manage
- **Write Restrictions**: Strict validation for data modifications

### Key Security Features
- **Input Validation**: All form inputs are validated client and server-side
- **XSS Protection**: Sanitized outputs prevent cross-site scripting
- **CSRF Protection**: Built-in Next.js CSRF protection
- **Secure Headers**: Security headers configured in Next.js
- **Rate Limiting**: Firestore quotas prevent abuse

### Authentication Flow
1. User enters credentials
2. Firebase Auth validates credentials
3. System queries user role from Firestore
4. JWT token includes user ID and role
5. Client-side context provides user data
6. Firestore rules enforce access control

---

## Development Setup

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Firebase CLI
- Chrome browser (for extension development)

### Installation Steps

1. **Clone Repository**
   ```bash
   git clone <repository-url>
   cd kaystonehr
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   Create `.env.local` file:
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
   ```

4. **Firebase Setup**
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase init
   ```

5. **Development Server**
   ```bash
   npm run dev
   ```

### Project Structure
```
/
├── app/                    # Next.js app router pages
│   ├── (auth)/            # Authentication pages
│   ├── dashboard/         # Dashboard pages
│   ├── employees/         # Employee management
│   ├── attendance/        # Attendance tracking
│   ├── leave/            # Leave management
│   ├── tasks/            # Task management
│   └── api/              # API routes
├── components/           # Reusable UI components
│   ├── ui/              # Base UI components
│   ├── dashboard/       # Dashboard components
│   ├── attendance/      # Attendance components
│   └── leave/           # Leave components
├── contexts/            # React contexts
├── hooks/              # Custom hooks
├── lib/                # Utility functions
├── types/              # TypeScript type definitions
├── extension/          # Chrome extension
└── public/             # Static assets
```

---

## Deployment Guide

### Vercel Deployment (Recommended)

1. **Connect Repository**
   - Link GitHub repository to Vercel
   - Configure environment variables

2. **Build Configuration**
   ```json
   {
     "builds": [
       {
         "src": "package.json",
         "use": "@vercel/next"
       }
     ]
   }
   ```

3. **Environment Variables**
   Set all Firebase configuration variables in Vercel dashboard

4. **Deploy**
   ```bash
   npm run build
   vercel deploy --prod
   ```

### Firebase Hosting Alternative

1. **Build Application**
   ```bash
   npm run build
   npm run export
   ```

2. **Deploy to Firebase**
   ```bash
   firebase deploy
   ```

### Chrome Extension Deployment

1. **Build Extension**
   ```bash
   cd extension
   npm run build
   ```

2. **Package Extension**
   - Zip the extension folder
   - Upload to Chrome Web Store Developer Dashboard

---

## API Documentation

### Authentication Endpoints

#### Login
```
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "password123"
}
```

#### Session Verification
```
GET /api/auth/session
Authorization: Bearer <token>
```

### Employee Management

#### Get All Employees
```
GET /api/employees
Authorization: Bearer <token>
```

#### Create Employee
```
POST /api/employees
Authorization: Bearer <token>
{
  "name": "John Doe",
  "email": "john@example.com",
  "department": "Engineering",
  "position": "Developer"
}
```

### Attendance Tracking

#### Clock In
```
POST /api/attendance/clock-in
Authorization: Bearer <token>
{
  "location": {
    "latitude": 40.7128,
    "longitude": -74.0060
  }
}
```

#### Clock Out
```
POST /api/attendance/clock-out
Authorization: Bearer <token>
{
  "notes": "Completed daily tasks"
}
```

---

## Chrome Extension

### Architecture
The Chrome extension consists of:
- **Background Script**: Continuous monitoring service
- **Content Script**: Website interaction tracking
- **Popup**: User interface and controls
- **Options Page**: Settings and configuration

### Key Features
- **Activity Tracking**: Monitors website usage and application activity
- **Productivity Scoring**: Calculates productivity metrics
- **Data Synchronization**: Syncs data with main application
- **Privacy Controls**: Configurable tracking preferences

### Development
1. **Load Extension**
   ```bash
   cd extension
   npm run build
   ```
   Load `dist` folder in Chrome Developer Mode

2. **Debug Extension**
   - Use Chrome DevTools for debugging
   - Check background script logs
   - Monitor network requests

---

## Performance Optimization

### Frontend Optimization
- **Code Splitting**: Automatic route-based splitting
- **Image Optimization**: Next.js image optimization
- **Lazy Loading**: Component lazy loading
- **Caching**: Browser caching strategies

### Database Optimization
- **Firestore Indexes**: Optimized query indexes
- **Real-time Listeners**: Efficient listener management
- **Data Pagination**: Paginated data loading
- **Caching Strategy**: Client-side data caching

### Bundle Analysis
```bash
npm run analyze
```

### Performance Monitoring
- **Web Vitals**: Core Web Vitals tracking
- **Real User Monitoring**: Performance metrics
- **Error Tracking**: Error monitoring and reporting

---

## Monitoring & Maintenance

### Firebase Monitoring
- **Performance Monitoring**: Firebase Performance
- **Crashlytics**: Error tracking and crash reporting
- **Analytics**: User behavior analytics

### System Health Checks
- **Database Performance**: Monitor Firestore performance
- **Authentication**: Monitor auth success rates
- **Extension Health**: Track extension performance

### Backup Strategy
- **Firestore Backups**: Automated daily backups
- **Data Export**: Regular data exports
- **Disaster Recovery**: Recovery procedures

### Maintenance Tasks
- **Security Updates**: Regular dependency updates
- **Performance Reviews**: Monthly performance audits
- **User Feedback**: Continuous improvement based on feedback

---

## Development Guidelines

### Code Standards
- **TypeScript**: Strict type checking enabled
- **ESLint**: Enforce coding standards
- **Prettier**: Consistent code formatting
- **Commit Messages**: Conventional commit format

### Testing Strategy
- **Unit Tests**: Component and function testing
- **Integration Tests**: API endpoint testing
- **E2E Tests**: User workflow testing
- **Manual Testing**: UI/UX testing

### Version Control
- **Git Flow**: Feature branch workflow
- **Code Reviews**: Required pull request reviews
- **Continuous Integration**: Automated testing on commits

---

## Troubleshooting

### Common Issues

#### Build Errors
- **TypeScript Errors**: Check type definitions
- **Module Not Found**: Verify import paths
- **Environment Variables**: Ensure all variables are set

#### Database Issues
- **Permission Denied**: Check Firestore security rules
- **Query Limits**: Monitor Firestore quotas
- **Real-time Listeners**: Manage listener lifecycle

#### Extension Issues
- **Manifest Errors**: Validate manifest.json
- **Permission Issues**: Check extension permissions
- **Background Script**: Debug background script errors

### Debugging Tools
- **Chrome DevTools**: Browser debugging
- **Firebase Console**: Database monitoring
- **Vercel Analytics**: Deployment monitoring

---

*This technical documentation provides comprehensive guidance for developers and system administrators working with KaystoneHR.*

**Last Updated**: [Current Date]  
**Version**: 1.0  
**Maintainer**: Development Team 