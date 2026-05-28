import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/api-auth'

type PersonDoc = {
  id: string
  role: 'admin' | 'manager' | 'employee'
  [key: string]: unknown
}

type EmployeeDetails = {
  id: string
  exists: boolean
  collection?: string
  data?: unknown
  error?: string
}

type PayrollEntryData = {
  id: string
  data: unknown
}

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['admin'])
  if (auth.error) return auth.error

  try {
    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employeeId')

    const results: {
      hasFirebaseAdmin: boolean
      totalUsers: number
      totalManagers: number
      totalEmployees: number
      totalPayrollEntries: number
      employeeDetails: EmployeeDetails | null
      employeePayrollEntries: PayrollEntryData[]
      allPeople: PersonDoc[]
      error?: string
    } = {
      hasFirebaseAdmin: false,
      totalUsers: 0,
      totalManagers: 0,
      totalEmployees: 0,
      totalPayrollEntries: 0,
      employeeDetails: null,
      employeePayrollEntries: [],
      allPeople: []
    }

    try {
      const { error: countError } = await supabaseAdmin
        .from('profiles')
        .select('*', { count: 'exact', head: true })
      if (countError) throw countError

      const { data: roleCounts, error: roleCountError } = await supabaseAdmin
        .from('profiles')
        .select('role')
      if (roleCountError) throw roleCountError

      results.totalUsers = roleCounts?.filter((p: { role: string }) => p.role === 'admin').length || 0
      results.totalManagers = roleCounts?.filter((p: { role: string }) => p.role === 'manager').length || 0
      results.totalEmployees = roleCounts?.filter((p: { role: string }) => p.role === 'employee').length || 0

      const { count: payrollCount, error: payrollCountError } = await supabaseAdmin
        .from('payroll_entries')
        .select('*', { count: 'exact', head: true })
      if (payrollCountError) throw payrollCountError
      results.totalPayrollEntries = payrollCount || 0

      const { data: samplePeople, error: samplePeopleError } = await supabaseAdmin
        .from('profiles')
        .select('id, auth_user_id, email, first_name, last_name, role, department, status')
        .limit(5)
      if (samplePeopleError) throw samplePeopleError
      results.allPeople = (samplePeople || []) as PersonDoc[]

      // If employeeId is provided, get specific details from all collections
      if (employeeId) {
        try {
          const { data: employee, error: employeeError } = await supabaseAdmin
            .from('profiles')
            .select('*')
            .or(`id.eq.${employeeId},auth_user_id.eq.${employeeId}`)
            .maybeSingle()

          if (employeeError) {
            throw employeeError
          }

          if (employee) {
            results.employeeDetails = {
              id: employee.id,
              exists: true,
              collection: 'profiles',
              data: employee
            }
          } else {
            results.employeeDetails = {
              id: employeeId,
              exists: false,
              error: 'Employee not found in any collection (users, managers, employees)'
            }
          }
        } catch (error) {
          results.employeeDetails = {
            id: employeeId,
            exists: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        }

        // Get payroll entries for this employee
        try {
          const { data: employeeProfile } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .or(`id.eq.${employeeId},auth_user_id.eq.${employeeId}`)
            .maybeSingle()

          if (!employeeProfile) {
            results.employeePayrollEntries = []
          } else {
            const { data: payrollEntries, error: payrollError } = await supabaseAdmin
              .from('payroll_entries')
              .select('*')
              .eq('employee_id', employeeProfile.id)
              .order('updated_at', { ascending: false })
              .limit(5)

            if (payrollError) {
              throw payrollError
            }

            results.employeePayrollEntries = (payrollEntries || []).map((entry: { id: string }) => ({
              id: entry.id,
              data: entry
            }))
          }
        } catch {
          results.employeePayrollEntries = []
        }
      }

    } catch (error) {
      results.error = error instanceof Error ? error.message : 'Unknown error'
    }

    return NextResponse.json({
      success: true,
      ...results
    })

  } catch (error) {
    console.error('Error in diagnose endpoint:', error)
    return NextResponse.json(
      { 
        error: 'Diagnose failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 