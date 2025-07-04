# KaystoneHR - Complete User Guide

## Table of Contents
1. [System Overview](#system-overview)
2. [Getting Started](#getting-started)
3. [User Roles & Permissions](#user-roles--permissions)
4. [Core Features](#core-features)
5. [Module-by-Module Guide](#module-by-module-guide)
6. [Chrome Extension](#chrome-extension)
7. [Common Workflows](#common-workflows)
8. [Troubleshooting](#troubleshooting)

---

## System Overview

KaystoneHR is a comprehensive Human Resources management platform designed to streamline HR operations for modern organizations. The system provides role-based access control with distinct interfaces for Employees, Managers, and Administrators.

### Key Capabilities
- **Employee Management**: Complete employee lifecycle management
- **Attendance Tracking**: Real-time attendance monitoring with location verification
- **Leave Management**: Comprehensive leave request and approval system
- **Task Management**: Project and task assignment with progress tracking
- **Productivity Analytics**: Advanced productivity monitoring and reporting
- **Payroll Integration**: Payroll processing and management
- **Real-time Notifications**: Instant updates across all modules
- **Chrome Extension**: Desktop productivity tracking

### Technology Stack
- **Frontend**: Next.js 14 with TypeScript
- **Backend**: Firebase (Firestore, Authentication)
- **UI Framework**: TailwindCSS with shadcn/ui components
- **Real-time Updates**: Firebase real-time listeners
- **Security**: Role-based access control with Firestore security rules

---

## Getting Started

### First-Time Login
1. **Receive Invitation**: Your administrator will send you login credentials
2. **Initial Login**: Use the provided email and temporary password
3. **Password Change**: You'll be prompted to change your password on first login
4. **Profile Setup**: Complete your profile information
5. **Role Assignment**: Your role (Employee/Manager/Admin) determines available features

### System Requirements
- **Web Browser**: Chrome, Firefox, Safari, or Edge (latest versions)
- **Chrome Extension**: Chrome browser required for productivity tracking
- **Internet Connection**: Required for real-time features
- **Location Services**: Optional but recommended for attendance tracking

---

## User Roles & Permissions

### 🔵 Employee Role
**Primary Functions:**
- View personal dashboard
- Clock in/out for attendance
- Submit leave requests
- View assigned tasks
- Update task progress
- Access productivity analytics
- Manage personal profile

**Restrictions:**
- Cannot access other employees' data
- Cannot approve leave requests
- Cannot assign tasks to others
- Cannot access admin settings

### 🟢 Manager Role
**Additional Capabilities:**
- Access team management dashboard
- View team members' data
- Approve/reject leave requests
- Assign tasks to team members
- Generate team reports
- Monitor team productivity
- Access department analytics

**Restrictions:**
- Cannot access company-wide admin settings
- Cannot manage other managers
- Cannot access payroll for all employees

### 🔴 Administrator Role
**Full System Access:**
- Complete employee management
- System-wide settings configuration
- User role management
- Company-wide analytics
- Payroll management
- System maintenance
- All reports and exports

---

## Core Features

### 🏢 Dashboard System
- **Personalized Views**: Role-specific dashboards
- **Real-time Statistics**: Live data updates
- **Quick Actions**: One-click access to common tasks
- **Visual Analytics**: Charts and graphs for key metrics

### 👥 Employee Management
- **Employee Profiles**: Comprehensive employee information
- **Department Organization**: Hierarchical department structure
- **Role Assignment**: Flexible role and permission management
- **Onboarding Workflow**: Streamlined new employee setup

### ⏰ Attendance System
- **Digital Clock In/Out**: Web-based attendance tracking
- **Location Verification**: GPS-based location tracking
- **Attendance History**: Complete attendance records
- **Analytics Dashboard**: Attendance patterns and insights

### 📅 Leave Management
- **Multiple Leave Types**: Annual, sick, personal, maternity, paternity, bereavement, unpaid
- **Balance Tracking**: Real-time leave balance monitoring
- **Approval Workflow**: Structured approval process
- **Calendar Integration**: Visual leave calendar

### 📋 Task Management
- **Task Assignment**: Assign tasks to individuals or teams
- **Progress Tracking**: Real-time task progress monitoring
- **Priority Management**: Task prioritization and deadlines
- **Reporting**: Task completion analytics

### 📊 Productivity Analytics
- **Activity Monitoring**: Desktop activity tracking via Chrome extension
- **Focus Sessions**: Productivity session management
- **Performance Metrics**: Individual and team productivity scores
- **Insights & Reports**: Detailed productivity analytics

---

## Module-by-Module Guide

### 📊 Dashboard Module

#### Employee Dashboard
- **Today's Summary**: Attendance status, tasks due, leave balance
- **Quick Actions**: Clock in/out, request leave, view tasks
- **Recent Activity**: Latest updates and notifications
- **Productivity Score**: Current productivity metrics

#### Manager Dashboard
- **Team Overview**: Team member status and activity
- **Pending Approvals**: Leave requests awaiting approval
- **Team Performance**: Productivity and attendance metrics
- **Quick Management**: Direct access to team management tools

#### Admin Dashboard
- **System Overview**: Company-wide statistics
- **Employee Management**: Complete employee administration
- **System Health**: Performance monitoring and alerts
- **Analytics Hub**: Comprehensive reporting dashboard

### 👥 Employee Management Module

#### Adding New Employees
1. Navigate to **Employees** → **Add Employee**
2. Fill in basic information:
   - Personal details (name, email, phone)
   - Job information (position, department, salary)
   - Login credentials
3. Set role and permissions
4. Save and send invitation

#### Managing Existing Employees
- **Edit Profile**: Update employee information
- **Change Role**: Modify permissions and access levels
- **Deactivate**: Temporarily disable employee access
- **Delete**: Permanently remove employee (admin only)

#### Department Management
- **Create Departments**: Set up organizational structure
- **Assign Managers**: Designate department heads
- **Move Employees**: Transfer employees between departments

### ⏰ Attendance Module

#### For Employees
1. **Clock In**: 
   - Click "Clock In" on dashboard
   - Verify location (if enabled)
   - Add optional notes
2. **Clock Out**:
   - Click "Clock Out" when leaving
   - Add work summary (optional)
3. **View History**: Access personal attendance records

#### For Managers
- **Team Attendance**: View team members' attendance
- **Attendance Reports**: Generate attendance analytics
- **Approve Adjustments**: Handle attendance corrections

#### For Administrators
- **System Settings**: Configure attendance policies
- **Location Management**: Set up office locations
- **Reporting**: Company-wide attendance analytics

### 📅 Leave Management Module

#### Submitting Leave Requests (Employees)
1. Navigate to **Leave Management**
2. Click **Request Leave**
3. Fill out the form:
   - Select leave type
   - Choose start and end dates
   - Provide reason
   - Attach documents (if needed)
4. Review balance calculation
5. Submit request

#### Managing Leave Requests (Managers/Admins)
1. Go to **Leave Management**
2. Switch to **Pending** tab
3. Review each request:
   - Check employee balance
   - Verify dates and reason
   - Approve or reject with comments
4. Request status updates automatically

#### Leave Balance Management
- **Automatic Calculation**: System calculates remaining days
- **Balance Display**: Visual representation of all leave types
- **Annual Reset**: Automatic balance renewal
- **Manual Adjustments**: Admin can modify balances

### 📋 Task Management Module

#### Creating Tasks (Managers/Admins)
1. Navigate to **Tasks** → **Create Task**
2. Fill in task details:
   - Task title and description
   - Assign to employee(s)
   - Set priority and deadline
   - Add attachments
3. Save and notify assignees

#### Managing Tasks (Employees)
- **View Assigned Tasks**: See all tasks assigned to you
- **Update Progress**: Mark tasks as in progress, completed
- **Add Comments**: Communicate with task assigners
- **Upload Files**: Attach work files to tasks

#### Task Analytics
- **Completion Rates**: Track task completion statistics
- **Performance Metrics**: Analyze task performance
- **Team Productivity**: Monitor team task efficiency

### 📊 Productivity Module

#### Focus Sessions
- **Start Session**: Begin focused work periods
- **Break Timer**: Manage work breaks
- **Session Analytics**: Track focus time and productivity

#### Activity Monitoring (Chrome Extension)
- **Website Tracking**: Monitor website usage
- **Application Usage**: Track application activity
- **Productivity Scoring**: Automatic productivity calculations

#### Reports & Analytics
- **Daily Reports**: Daily productivity summaries
- **Weekly/Monthly Trends**: Long-term productivity patterns
- **Team Comparisons**: Benchmark against team performance

---

## Chrome Extension

### Installation
1. Download extension from admin
2. Install in Chrome browser
3. Configure with your login credentials
4. Enable required permissions

### Features
- **Automatic Tracking**: Background activity monitoring
- **Productivity Scoring**: Real-time productivity calculations
- **Website Categorization**: Automatic productive/non-productive classification
- **Time Tracking**: Detailed time allocation reports

### Settings
- **Tracking Preferences**: Customize what gets tracked
- **Productivity Categories**: Define productive vs. non-productive activities
- **Privacy Controls**: Manage data collection preferences

---

## Common Workflows

### 🌅 Daily Employee Workflow
1. **Morning Login**: Access dashboard
2. **Clock In**: Start workday with attendance
3. **Check Tasks**: Review assigned tasks
4. **Work Period**: Complete tasks with optional focus sessions
5. **Break Management**: Use break timer for breaks
6. **Task Updates**: Update task progress throughout day
7. **Clock Out**: End workday with attendance

### 📋 Manager Approval Workflow
1. **Dashboard Review**: Check pending approvals
2. **Leave Requests**: Review and approve/reject leave requests
3. **Task Assignment**: Assign new tasks to team members
4. **Team Monitoring**: Monitor team productivity and attendance
5. **Report Generation**: Create team performance reports

### 🏢 Admin System Management
1. **System Monitoring**: Check system health and statistics
2. **Employee Management**: Handle new hires, role changes
3. **Settings Configuration**: Update system policies and settings
4. **Report Generation**: Create company-wide analytics
5. **User Support**: Handle user issues and questions

### 🎯 Leave Request Workflow
1. **Employee**: Submit leave request with details
2. **System**: Verify leave balance and validate dates
3. **Manager**: Receive notification and review request
4. **Decision**: Approve or reject with comments
5. **Notification**: Employee receives decision notification
6. **Balance Update**: System updates leave balance accordingly

---

## Troubleshooting

### Common Issues

#### Login Problems
- **Forgot Password**: Use "Forgot Password" link on login page
- **Account Locked**: Contact administrator for unlock
- **Role Issues**: Verify role assignment with manager/admin

#### Attendance Issues
- **Clock In/Out Failed**: Check internet connection and location services
- **Wrong Location**: Verify you're at approved work location
- **Missing Records**: Contact manager for manual adjustment

#### Leave Request Issues
- **Insufficient Balance**: Check leave balance display
- **Request Rejected**: Review rejection reason and contact manager
- **Wrong Dates**: Ensure end date is after start date

#### Chrome Extension Issues
- **Not Tracking**: Verify extension is enabled and logged in
- **Incorrect Data**: Check extension settings and permissions
- **Performance Issues**: Restart browser or reinstall extension

### Getting Help
1. **In-App Help**: Look for help icons and tooltips
2. **Manager Support**: Contact your direct manager
3. **Admin Support**: Reach out to system administrators
4. **Technical Issues**: Report bugs through the system

---

## Security & Privacy

### Data Protection
- **Encryption**: All data encrypted in transit and at rest
- **Access Control**: Role-based access with minimum necessary permissions
- **Audit Logging**: Complete audit trail of all system actions
- **Privacy Controls**: Granular privacy settings for personal data

### Best Practices
- **Strong Passwords**: Use complex passwords and change regularly
- **Secure Networks**: Use trusted networks for system access
- **Log Out**: Always log out when finished using the system
- **Report Issues**: Immediately report any security concerns

---

## System Updates & Maintenance

### Regular Updates
- **Feature Updates**: New features released regularly
- **Security Patches**: Automatic security updates
- **Performance Improvements**: Ongoing optimization

### Maintenance Windows
- **Scheduled Maintenance**: Planned downtime notifications
- **Emergency Maintenance**: Urgent fixes with minimal disruption
- **Backup Procedures**: Regular data backups and recovery testing

---

*This guide covers the core functionality of KaystoneHR. For specific questions or additional features, please contact your system administrator.*

**Last Updated**: [Current Date]  
**Version**: 1.0  
**Support**: Contact your HR administrator or system admin 