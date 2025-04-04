import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { MongoClient, ObjectId } from 'mongodb';
import { 
  FirebaseAttendance, 
  FirebaseActivityLog, 
  FirebaseLeaveRequest 
} from '../../types/database';

// Initialize Firebase Admin
admin.initializeApp();

// MongoDB connection
const mongoUri = process.env.MONGODB_URI;
const client = new MongoClient(mongoUri || '');

// Sync attendance data
export const syncAttendance = onDocumentCreated('attendance/{attendanceId}', async (event) => {
  const attendance = event.data?.data() as FirebaseAttendance;
  const attendanceId = event.params.attendanceId;
  
  try {
    await client.connect();
    const db = client.db('hr_system');
    
    await db.collection('attendance_history').insertOne({
      _id: new ObjectId(attendanceId),
      employeeId: attendance.userId,
      date: attendance.date,
      checkIn: attendance.checkIn.time,
      checkOut: attendance.checkOut?.time,
      status: attendance.status,
      location: {
        checkIn: attendance.checkIn.location,
        checkOut: attendance.checkOut?.location
      },
      deviceInfo: {
        checkIn: attendance.checkIn.deviceInfo,
        checkOut: attendance.checkOut?.deviceInfo
      }
    });
    
    console.log(`Synced attendance ${attendanceId} to MongoDB`);
  } catch (error) {
    console.error('Error syncing attendance:', error);
    throw error;
  } finally {
    await client.close();
  }
});

// Archive activity logs
export const archiveActivityLogs = onSchedule('every 24 hours', async (event) => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  
  try {
    await client.connect();
    const db = client.db('hr_system');
    
    // Get logs from Firebase
    const logsSnapshot = await admin.firestore()
      .collection('activity_logs')
      .where('timestamp', '<', yesterday)
      .get();
    
    if (!logsSnapshot.empty) {
      const logs = logsSnapshot.docs.map(doc => ({
        _id: new ObjectId(doc.id),
        ...doc.data()
      }));
      
      // Insert into MongoDB
      await db.collection('activity_history').insertMany(logs);
      
      // Delete from Firebase
      const batch = admin.firestore().batch();
      logsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      
      console.log(`Archived ${logs.length} activity logs`);
    }
  } catch (error) {
    console.error('Error archiving activity logs:', error);
    throw error;
  } finally {
    await client.close();
  }
});

// Process payroll
export const processPayroll = onSchedule('0 0 1 * *', async (event) => {
  try {
    await client.connect();
    const db = client.db('hr_system');
    
    // Get all active employees
    const employees = await db.collection('employees')
      .find({ 'employmentInfo.status': 'active' })
      .toArray();
    
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    for (const employee of employees) {
      // Get attendance for the month
      const attendance = await db.collection('attendance_history')
        .find({
          employeeId: employee._id,
          date: {
            $gte: new Date(year, month, 1),
            $lt: new Date(year, month + 1, 1)
          }
        })
        .toArray();
      
      // Calculate salary
      const baseSalary = employee.employmentInfo.salary.base;
      const workingDays = attendance.filter(a => a.status === 'present').length;
      const totalDays = new Date(year, month + 1, 0).getDate();
      const dailyRate = baseSalary / totalDays;
      
      const earnings = {
        baseSalary: baseSalary,
        overtime: 0, // Calculate based on attendance
        bonuses: 0,  // Calculate based on performance
        allowances: 0
      };
      
      const deductions = {
        tax: baseSalary * 0.2, // 20% tax
        insurance: baseSalary * 0.1, // 10% insurance
        pension: baseSalary * 0.05, // 5% pension
        other: 0
      };
      
      const netPay = earnings.baseSalary - 
        deductions.tax - 
        deductions.insurance - 
        deductions.pension - 
        deductions.other;
      
      // Create payroll record
      await db.collection('payroll').insertOne({
        employeeId: new ObjectId(employee._id),
        month: new Date(year, month, 1),
        year: year,
        earnings,
        deductions,
        netPay,
        status: 'pending'
      });
    }
    
    console.log('Payroll processed successfully');
  } catch (error) {
    console.error('Error processing payroll:', error);
    throw error;
  } finally {
    await client.close();
  }
}); 