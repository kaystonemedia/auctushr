'use client'

import { useState, useEffect } from 'react'
import { useNewAuth } from '@/contexts/new-auth-context'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Check, ChevronsUpDown, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'react-hot-toast'

interface Employee {
  id: string
  name: string
  email: string
  role: string
  department?: string
}

interface EmployeeSelectProps {
  value: string
  onChange: (employeeId: string, employeeName: string) => void
  disabled?: boolean
  className?: string
}

export function EmployeeSelect({ value, onChange, disabled, className }: EmployeeSelectProps) {
  const { user } = useNewAuth()
  const [open, setOpen] = useState(false)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    fetchEmployees()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  useEffect(() => {
    if (value && employees.length > 0) {
      const selected = employees.find(emp => emp.id === value)
      if (selected) {
        setSelectedEmployee(selected)
      }
    }
  }, [value, employees])

  const fetchEmployees = async () => {
    if (!user) {
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      let employeesQuery = query(collection(db, 'employees'))
      if (user.role === 'manager') {
        employeesQuery = query(
          employeesQuery,
          where('managerId', '==', user.id)
        )
      }
      const snapshot = await getDocs(employeesQuery)
      const employeesData = snapshot.docs.map(doc => {
        const data = doc.data()
        return {
          id: doc.id, // Use Firestore document ID
          name: data.name || `${data.firstName || ''} ${data.lastName || ''}`.trim(),
          email: data.email,
          role: data.role,
          department: data.department
        }
      })
      
      setEmployees(employeesData)
    } catch (error) {
      console.error('Error fetching employees:', error)
      toast.error('Failed to fetch employees')
    } finally {
      setLoading(false)
    }
  }

  const filteredEmployees = employees.filter(employee => 
    employee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    employee.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // If user is not available, show a warning and disable the dropdown
  if (!user) {
    return (
      <div className="text-red-500 text-sm p-2 border border-red-300 rounded bg-red-50">
        No user context available. Please sign in again.
      </div>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
          disabled={disabled || loading}
        >
          {selectedEmployee ? (
            <span className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              {selectedEmployee.name}
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Select employee...
            </span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <div className="flex flex-col">
          <div className="flex items-center border-b px-3">
            <Users className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Search employees..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="max-h-[300px] overflow-y-auto p-1">
            {filteredEmployees.length === 0 ? (
              <div className="py-6 text-center text-sm">No employees found.</div>
            ) : (
              filteredEmployees.map((employee) => (
                <div
                  key={employee.id}
                  className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                  onClick={() => {
                    setSelectedEmployee(employee)
                    onChange(employee.id, employee.name)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedEmployee?.id === employee.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span className="font-medium">{employee.name}</span>
                    <span className="text-sm text-muted-foreground">{employee.email}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
} 