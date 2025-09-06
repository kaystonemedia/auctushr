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
    
    const currentDate = new Date()
    const currentMonth = (currentDate.getMonth() + 1).toString()
    const currentYear = currentDate.getFullYear()

    // Get all payroll entries for current month (Admin SDK query API)
    const payrollQuery = adminDb
      .collection('payrollEntries')
      .where('month', '==', currentMonth)
      .where('year', '==', currentYear)
    const snapshot = await payrollQuery.get()
    const payrollEntries = snapshot.docs.map((doc: QueryDocumentSnapshot) => doc.data() as any)

    const totalPayrollThisMonth = payrollEntries.reduce((sum, entry) => sum + (entry.netPay || 0), 0)
    const averageProductivity = payrollEntries.length > 0 
      ? payrollEntries.reduce((sum, entry) => sum + (entry.productivityScore || 0), 0) / payrollEntries.length 
      : 0
    const totalBonusesDistributed = payrollEntries.reduce((sum, entry) => sum + (entry.totalBonus || 0), 0)

    // Group by department
    const departmentStats = payrollEntries.reduce((acc, entry) => {
      if (!acc[entry.department]) {
        acc[entry.department] = {
          totalProductivity: 0,
          totalBonuses: 0,
          count: 0
        }
      }
      acc[entry.department].totalProductivity += entry.productivityScore || 0
      acc[entry.department].totalBonuses += entry.totalBonus || 0
      acc[entry.department].count++
      return acc
    }, {} as Record<string, { totalProductivity: number; totalBonuses: number; count: number }>)

    const topPerformingDepartments = Object.entries(departmentStats)
      .map(([department, stats]) => ({
        department,
        averageProductivity: stats.totalProductivity / stats.count,
        totalBonuses: stats.totalBonuses
      }))
      .sort((a, b) => b.averageProductivity - a.averageProductivity)
      .slice(0, 5)

    return NextResponse.json({
      success: true,
      totalPayrollThisMonth,
      averageProductivity,
      totalBonusesDistributed,
      topPerformingDepartments
    })

  } catch (error) {
    console.error('Error fetching payroll insights:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch payroll insights',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 