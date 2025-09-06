import { NextRequest, NextResponse } from 'next/server'
import type { QueryDocumentSnapshot } from 'firebase-admin/firestore'


export async function GET(request: NextRequest) {
  try {
    // Dynamically import Firebase Admin to avoid client-side bundling issues
    const { adminDb } = await import('@/lib/firebase-admin')
    
    // Check if Firebase Admin is properly initialized
    if (!adminDb) {
      throw new Error('Firebase Admin SDK not properly initialized. Check environment variables.')
    }
    
    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employeeId')
    const month = searchParams.get('month')
    const year = searchParams.get('year')

    if (!employeeId || !month || !year) {
      return NextResponse.json(
        { error: 'Missing required parameters: employeeId, month, year' },
        { status: 400 }
      )
    }

    // Get employee details from all collections (Admin SDK)
    const [userDoc, managerDoc, employeeDoc] = await Promise.all([
      adminDb.collection('users').doc(employeeId).get(),
      adminDb.collection('managers').doc(employeeId).get(),
      adminDb.collection('employees').doc(employeeId).get()
    ])
    
    let employee = null
    let employeeCollection = ''
    
    if (userDoc.exists()) {
      employee = userDoc.data()
      employeeCollection = 'users'
    } else if (managerDoc.exists()) {
      employee = managerDoc.data()
      employeeCollection = 'managers'
    } else if (employeeDoc.exists()) {
      employee = employeeDoc.data()
      employeeCollection = 'employees'
    }
    
    if (!employee) {
      return NextResponse.json(
        { error: 'Employee not found in any collection (users, managers, employees)' },
        { status: 404 }
      )
    }

         // Get payroll entry for the specified month/year
     const payrollQuery = adminDb
       .collection('payrollEntries')
       .where('employeeId', '==', employeeId)
       .where('month', '==', month)
       .where('year', '==', parseInt(year))
    const payrollSnapshot = await payrollQuery.get()
    
    if (payrollSnapshot.empty) {
      return NextResponse.json(
        { error: 'No payroll data found for the specified period' },
        { status: 404 }
      )
    }

    const payrollEntry = payrollSnapshot.docs[0].data()

         // Get productivity data for the month
     const startDate = new Date(parseInt(year), parseInt(month) - 1, 1)
     const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59, 999)
     
     // For now, use default productivity analytics since ProductivityService uses client SDK
     const productivityAnalytics = {
       overview: {
         averageProductivityScore: 75, // Default score
         focusTimePercentage: 60,
         taskCompletionRate: 80,
         totalFocusSessions: 20,
         totalTasksCompleted: 15,
         totalMeetingHours: 10
       }
     }

         // Calculate attendance rate
     const attendanceQuery = adminDb
       .collection('attendance')
       .where('employeeId', '==', employeeId)
       .where('date', '>=', startDate)
       .where('date', '<=', endDate)
    const attendanceSnapshot = await attendanceQuery.get()
    const attendanceRecords = attendanceSnapshot.docs.map((doc: QueryDocumentSnapshot) => doc.data() as any)
    
    const totalDays = attendanceRecords.length
    const presentDays = attendanceRecords.filter(record => record.status === 'present').length
    const attendanceRate = totalDays > 0 ? (presentDays / totalDays) * 100 : 0

    // Calculate bonuses based on productivity and attendance
    const baseSalary = payrollEntry.grossSalary || employee.salary || 0
    const performanceBonus = payrollEntry.performanceBonus || 0
    const attendanceBonus = payrollEntry.attendanceBonus || 0
    const totalBonus = performanceBonus + attendanceBonus

    // Calculate deductions
    const deductions = payrollEntry.deductions || {
      tax: 0,
      insurance: 0,
      other: 0
    }

    const totalDeductions = deductions.tax + deductions.insurance + deductions.other
    const netPay = payrollEntry.netSalary || (baseSalary + totalBonus - totalDeductions)

    // Build payslip data
    const payslipData = {
      employeeId,
      employeeName: `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || 'Unknown Employee',
      department: employee.department || 'Unassigned',
      position: employee.position || 'Employee',
      baseSalary,
      performanceBonus,
      attendanceBonus,
      totalBonus,
      grossSalary: baseSalary + totalBonus,
      deductions,
      totalDeductions,
      netPay,
      month,
      year: parseInt(year),
      processedAt: payrollEntry.processedAt,
      productivityScore: productivityAnalytics.overview.averageProductivityScore,
      attendanceRate,
      focusTimePercentage: productivityAnalytics.overview.focusTimePercentage,
      taskCompletionRate: productivityAnalytics.overview.taskCompletionRate,
      totalFocusSessions: productivityAnalytics.overview.totalFocusSessions,
      totalTasksCompleted: productivityAnalytics.overview.totalTasksCompleted,
      totalMeetingHours: productivityAnalytics.overview.totalMeetingHours
    }

    return NextResponse.json({
      success: true,
      payslip: payslipData
    })

  } catch (error) {
    console.error('Error generating payslip:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    
    // More detailed error information
    const errorDetails = {
      message: error instanceof Error ? error.message : 'Unknown error',
      type: error?.constructor?.name || 'Unknown',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to generate payslip',
        details: errorDetails.message,
        errorInfo: errorDetails
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Dynamically import Firebase Admin and PayrollService
    const { adminDb } = await import('@/lib/firebase-admin')
    const { createAdminPayrollService } = await import('@/lib/payroll')
    
    // Check if Firebase Admin is properly initialized
    if (!adminDb) {
      throw new Error('Firebase Admin SDK not properly initialized. Check environment variables.')
    }
    
    console.log('POST /api/payroll/payslip called')
    const body = await request.json()
    const { employeeId, month, year, customData } = body
    console.log('Request body:', { employeeId, month, year, customData })

    if (!employeeId || !month || !year) {
      return NextResponse.json(
        { error: 'Missing required parameters: employeeId, month, year' },
        { status: 400 }
      )
    }

    // Generate (or compute) payroll using unified PayrollService logic
    const [userDoc, managerDoc, employeeDoc] = await Promise.all([
      adminDb.collection('users').doc(employeeId).get(),
      adminDb.collection('managers').doc(employeeId).get(),
      adminDb.collection('employees').doc(employeeId).get()
    ])
    
    let employee = null
    let employeeCollection = ''
    
    if (userDoc.exists()) {
      employee = userDoc.data()
      employeeCollection = 'users'
    } else if (managerDoc.exists()) {
      employee = managerDoc.data()
      employeeCollection = 'managers'
    } else if (employeeDoc.exists()) {
      employee = employeeDoc.data()
      employeeCollection = 'employees'
    }
    
    if (!employee) {
      return NextResponse.json(
        { error: 'Employee not found in any collection (users, managers, employees)' },
        { status: 404 }
      )
    }

         // Process payroll if not already processed
     const payrollQuery = adminDb
       .collection('payrollEntries')
       .where('employeeId', '==', employeeId)
       .where('month', '==', month)
       .where('year', '==', parseInt(year))
    const payrollSnapshot = await payrollQuery.get()

    let payrollEntry
    if (payrollSnapshot.empty) {
      const baseSalary = employee.salary || 0
      const payrollService = await createAdminPayrollService()
      const computed = await payrollService.processProductivityBasedPayroll(
        employeeId,
        month,
        parseInt(year),
        baseSalary
      )
      payrollEntry = computed
      await adminDb.collection('payrollEntries').add(payrollEntry)
    } else {
      payrollEntry = payrollSnapshot.docs[0].data()
    }

         // Get productivity data (reusing startDate and endDate from above)
     
     // For now, use default productivity analytics since ProductivityService uses client SDK
     const productivityAnalytics = {
       overview: {
         averageProductivityScore: 75, // Default score
         focusTimePercentage: 60,
         taskCompletionRate: 80,
         totalFocusSessions: 20,
         totalTasksCompleted: 15,
         totalMeetingHours: 10
       }
     }

    // Build comprehensive payslip data
    const payslipData = {
      employeeId,
      employeeName: `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || 'Unknown Employee',
      department: employee.department || 'Unassigned',
      position: employee.position || 'Employee',
      baseSalary: payrollEntry.baseSalary || 0,
      performanceBonus: payrollEntry.performanceBonus || 0,
      attendanceBonus: payrollEntry.attendanceBonus || 0,
      totalBonus: payrollEntry.totalBonus || 0,
      grossSalary: payrollEntry.grossSalary || 0,
      deductions: payrollEntry.deductions || { tax: 0, insurance: 0, other: 0 },
      netPay: payrollEntry.netPay || 0,
      month,
      year: parseInt(year),
      processedAt: payrollEntry.processedAt,
      productivityScore: productivityAnalytics.overview.averageProductivityScore,
      attendanceRate: payrollEntry.attendanceRate,
      focusTimePercentage: productivityAnalytics.overview.focusTimePercentage,
      taskCompletionRate: productivityAnalytics.overview.taskCompletionRate,
      totalFocusSessions: productivityAnalytics.overview.totalFocusSessions,
      totalTasksCompleted: productivityAnalytics.overview.totalTasksCompleted,
      totalMeetingHours: productivityAnalytics.overview.totalMeetingHours
    }

    return NextResponse.json({
      success: true,
      payslip: payslipData
    })

  } catch (error) {
    console.error('Error processing payslip:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    
    // More detailed error information
    const errorDetails = {
      message: error instanceof Error ? error.message : 'Unknown error',
      type: error?.constructor?.name || 'Unknown',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to process payslip',
        details: errorDetails.message,
        errorInfo: errorDetails
      },
      { status: 500 }
    )
  }
} 