'use client'

import { useState, useEffect } from 'react'
import { useNewAuth } from '@/contexts/new-auth-context'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command'
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
  }, [user])

  useEffect(() => {
    // Set selected employee when value changes
    if (value && employees.length > 0) {
      const selected = employees.find(emp => emp.id === value)
      if (selected) {
        setSelectedEmployee(selected)
      }
    }
  }, [value, employees])

  const fetchEmployees = async () => {
    if (!user) return

    try {
      setLoading(true)
      let employeesQuery = query(collection(db, 'employees'))

      // If user is a manager, only show their team members
      if (user.role === 'manager') {
        employeesQuery = query(
          employeesQuery,
          where('managerId', '==', user.id)
        )
      }

      const snapshot = await getDocs(employeesQuery)
      const employeesData = snapshot.docs.map(doc => ({
        id: doc.id,
        name: `${doc.data().firstName} ${doc.data().lastName}`.trim(),
        email: doc.data().email,
        role: doc.data().role,
        department: doc.data().department
      }))

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
        <Command>
          <CommandInput 
            placeholder="Search employees..." 
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandEmpty>No employees found.</CommandEmpty>
          <CommandGroup className="max-h-[300px] overflow-y-auto">
            {filteredEmployees.map((employee) => (
              <CommandItem
                key={employee.id}
                onSelect={(currentValue) => {
                  const selected = employees.find(emp => emp.id === currentValue)
                  if (selected) {
                    setSelectedEmployee(selected)
                    onChange(selected.id, selected.name)
                    setOpen(false)
                  }
                }}
                value={employee.id}
                className="cursor-pointer"
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
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  )
} 