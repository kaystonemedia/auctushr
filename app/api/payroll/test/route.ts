import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Check if Firebase Admin is available, fallback to mock data if not
    let adminDb = null
    let firebaseAdmin = null
    
    try {
      const firebaseAdminModule = await import('@/lib/firebase-admin')
      adminDb = firebaseAdminModule.adminDb
      firebaseAdmin = true
      
      // Check if Firebase Admin is properly initialized
      if (!adminDb) {
        throw new Error('Firebase Admin DB not initialized')
      }
    } catch (importError) {
      console.warn('Firebase Admin not available, using mock data:', importError)
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

    // If Firebase Admin is not available, return mock data
    if (!adminDb || !firebaseAdmin) {
      const mockEmployee = {
        firstName: 'John',
        lastName: 'Doe',
        department: 'Engineering',
        salary: 50000
      }

      const mockPayrollEntry = {
        employeeId,
        employeeName: `${mockEmployee.firstName} ${mockEmployee.lastName}`,
        department: mockEmployee.department,
        baseSalary: mockEmployee.salary,
        performanceBonus: 5000,
        attendanceBonus: 2500,
        totalBonus: 7500,
        grossSalary: 57500,
        deductions: { tax: 7500, insurance: 2500, other: 1000 },
        netPay: 46500,
        month,
        year: parseInt(year),
        processedAt: new Date().toISOString(),
        productivityScore: 85,
        attendanceRate: 95
      }

      return NextResponse.json({
        success: true,
        message: 'Using mock data (Firebase Admin not available)',
        employee: {
          id: employeeId,
          name: `${mockEmployee.firstName} ${mockEmployee.lastName}`,
          department: mockEmployee.department,
          salary: mockEmployee.salary
        },
        hasPayrollEntry: true,
        payrollEntry: mockPayrollEntry,
        processedPayroll: null,
        isMockData: true
      })
    }

    // Test 1: Check if employee exists
    const employeeDoc = await (adminDb as any).collection('users').doc(employeeId).get()
    if (!employeeDoc.exists()) {
      return NextResponse.json(
        { error: 'Employee not found', employeeId },
        { status: 404 }
      )
    }

    const employee = employeeDoc.data()

    // Test 2: Check if payroll entry exists
    const payrollQuery = (adminDb as any)
      .collection('payrollEntries')
      .where('employeeId', '==', employeeId)
      .where('month', '==', month)
      .where('year', '==', parseInt(year))
    const payrollSnapshot = await payrollQuery.get()
    
    const hasPayrollEntry = !payrollSnapshot.empty
    const payrollEntry = hasPayrollEntry ? payrollSnapshot.docs[0].data() : null

    // Test 3: Try to process payroll if it doesn't exist
    let processedPayroll = null
    if (!hasPayrollEntry) {
      try {
        const baseSalary = employee.salary || 0
        
        // Create a simple payroll entry (same logic as in payslip route)
        const productivityScore = 75 // Default score
        const performanceBonus = (productivityScore / 100) * (baseSalary * 0.1) // 10% of base salary
        const attendanceBonus = baseSalary * 0.05 // 5% attendance bonus
        const totalBonus = performanceBonus + attendanceBonus
        
        // Calculate deductions
        const tax = baseSalary * 0.15 // 15% tax
        const insurance = baseSalary * 0.05 // 5% insurance
        const other = baseSalary * 0.02 // 2% other deductions
        const totalDeductions = tax + insurance + other
        
        // Calculate final amounts
        const grossSalary = baseSalary + totalBonus
        const netPay = grossSalary - totalDeductions
        
        processedPayroll = {
          employeeId,
          employeeName: `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || 'Unknown Employee',
          department: employee.department || 'Unassigned',
          baseSalary,
          performanceBonus,
          attendanceBonus,
          totalBonus,
          grossSalary,
          deductions: { tax, insurance, other },
          netPay,
          month,
          year: parseInt(year),
          processedAt: new Date().toISOString(),
          productivityScore,
          attendanceRate: 85 // Default attendance rate
        }
      } catch (error) {
        console.error('Error processing payroll:', error)
        return NextResponse.json({
          error: 'Failed to process payroll',
          details: error instanceof Error ? error.message : 'Unknown error',
          employeeId,
          month,
          year
        }, { status: 500 })
      }
    }

    return NextResponse.json({
      success: true,
      employee: {
        id: employeeId,
        name: `${employee.firstName || ''} ${employee.lastName || ''}`.trim(),
        department: employee.department,
        salary: employee.salary
      },
      hasPayrollEntry,
      payrollEntry,
      processedPayroll
    })

  } catch (error) {
    console.error('Error in test endpoint:', error)
    return NextResponse.json(
      { 
        error: 'Test failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
} 