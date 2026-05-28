'use client'

import { useState, useEffect } from 'react'
import { useNewAuth } from '@/contexts/new-auth-context'
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
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchEmployees()
  }, [user])

  useEffect(() => {
    if (value && employees.length > 0) {
      const selected = employees.find((emp) => emp.id === value)
      if (selected) setSelectedEmployee(selected)
    }
  }, [value, employees])

  const fetchEmployees = async () => {
    if (!user) {
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      const res = await fetch('/api/employees', { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to fetch employees')
      const data = await res.json()
      const employeesData = (data.employees || data || []).map(
        (item: {
          id: string
          firstName?: string
          lastName?: string
          email: string
          role: string
          department?: string
        }) => ({
          id: item.id,
          name: `${item.firstName || ''} ${item.lastName || ''}`.trim() || item.email,
          email: item.email,
          role: item.role,
          department: item.department,
        })
      )
      setEmployees(employeesData.filter((e: Employee) => e.role === 'employee' || e.role === 'manager'))
    } catch (error) {
      console.error('Error fetching employees:', error)
      toast.error('Failed to fetch employees')
    } finally {
      setLoading(false)
    }
  }

  const filteredEmployees = employees.filter(
    (employee) =>
      employee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      employee.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (!user) {
    return (
      <div className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-500">
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
          className={cn('w-full justify-between', className)}
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
                  role="button"
                  tabIndex={0}
                  className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                  onClick={() => {
                    setSelectedEmployee(employee)
                    onChange(employee.id, employee.name)
                    setOpen(false)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      setSelectedEmployee(employee)
                      onChange(employee.id, employee.name)
                      setOpen(false)
                    }
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      selectedEmployee?.id === employee.id ? 'opacity-100' : 'opacity-0'
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
