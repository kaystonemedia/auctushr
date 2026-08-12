"use client"

import { useState, useEffect } from "react"
import { Dialog } from "@headlessui/react"
import { X, Loader2 } from "lucide-react"
import { EmployeeFormData, Employee } from "@/types/employee"
import { format, isValid } from "date-fns"
import { parsePhoneNumberFromString, isValidPhoneNumber } from 'libphonenumber-js'

interface EmployeeFormProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: EmployeeFormData) => Promise<void>
  initialData?: EmployeeFormData
}

interface FormState extends EmployeeFormData {
  role: 'admin' | 'manager' | 'employee';
  hasPassword: boolean;
  managerId: string | null;
}

interface FormErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  department?: string;
  position?: string;
  salary?: string;
  hireDate?: string;
  password?: string;
  managerId?: string;
  role?: string;
}

interface Department {
  id: string
  name: string
  description?: string
}

interface DepartmentResponseItem {
  id: string
  name: string
  description?: string
}

export function EmployeeForm({ isOpen, onClose, onSubmit, initialData }: EmployeeFormProps) {
  const [departments, setDepartments] = useState<Department[]>([])
  const [loadingDepartments, setLoadingDepartments] = useState(false)
  const [managers, setManagers] = useState<Employee[]>([])
  const [loadingManagers, setLoadingManagers] = useState(false)
  const [formData, setFormData] = useState<FormState>({
    firstName: initialData?.firstName || '',
    lastName: initialData?.lastName || '',
    email: initialData?.email || '',
    phone: initialData?.phone || '',
    department: initialData?.department || '',
    position: initialData?.position || '',
    role: initialData?.role || 'employee',
    managerId: initialData?.managerId || null,
    hasPassword: initialData?.hasPassword || false,
    hireDate: initialData?.hireDate || new Date(),
    salary: initialData?.salary || 0,
    status: initialData?.status || 'active',
    mobileNumber: initialData?.mobileNumber || '',
    bankAccount: initialData?.bankAccount || {
      accountNumber: '',
      bankCode: '',
      accountName: ''
    },
    address: initialData?.address || {
      street: '',
      city: '',
      state: '',
      country: '',
      postalCode: ''
    },
    emergencyContact: initialData?.emergencyContact || {
      name: '',
      relationship: '',
      phone: ''
    }
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // Sync form with initialData when opening/editing
  useEffect(() => {
    if (!isOpen || !initialData) return
    const nextForm: FormState = {
      firstName: initialData.firstName || '',
      lastName: initialData.lastName || '',
      email: initialData.email || '',
      phone: initialData.phone || '',
      department: initialData.department || '',
      position: initialData.position || '',
      role: initialData.role || 'employee',
      managerId: initialData.managerId || null,
      hasPassword: initialData.hasPassword || false,
      hireDate: initialData.hireDate || new Date(),
      salary: initialData.salary || 0,
      status: (initialData as any).status || 'active',
      mobileNumber: initialData.mobileNumber || '',
      bankAccount: initialData.bankAccount || {
        accountNumber: '',
        bankCode: '',
        accountName: ''
      },
      address: initialData.address || {
        street: '',
        city: '',
        state: '',
        country: '',
        postalCode: ''
      },
      emergencyContact: initialData.emergencyContact || {
        name: '',
        relationship: '',
        phone: ''
      }
    }
    setFormData(nextForm)
    setErrors({})
    setHasUnsavedChanges(false)
  }, [isOpen, initialData])

  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        setLoadingDepartments(true)
        const response = await fetch('/api/departments', { credentials: 'include' })
        if (!response.ok) throw new Error('Failed to fetch departments')
        const payload = await response.json()
        const departmentsData = ((payload.departments || []) as DepartmentResponseItem[]).map((department) => ({
          id: department.id,
          name: department.name,
          description: department.description
        })) as Department[]
        setDepartments(departmentsData)
      } catch (error) {
        console.error('Error fetching departments:', error)
      } finally {
        setLoadingDepartments(false)
      }
    }
    
    fetchDepartments()
  }, [])

  useEffect(() => {
    const fetchManagers = async () => {
      try {
        setLoadingManagers(true)
        const response = await fetch('/api/employees', { credentials: 'include' })
        if (!response.ok) throw new Error('Failed to fetch managers')
        const payload = await response.json()
        const employees = (payload.employees || []) as Employee[]
        const uniqueManagers = employees.filter((employee) => employee.role === 'manager' || employee.role === 'admin')
        setManagers(uniqueManagers)
      } catch (error) {
        console.error('Error fetching managers:', error)
        setError('Failed to load managers')
      } finally {
        setLoadingManagers(false)
      }
    }

    fetchManagers()
  }, [])

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required'
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required'
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format'
    }

    if (formData.phone && !isValidPhoneNumber(formData.phone)) {
      newErrors.phone = 'Invalid phone number format. Include country code (e.g., +234, +44)'
    }

    if (formData.salary < 0) {
      newErrors.salary = 'Salary cannot be negative'
    }

    if (!isValid(formData.hireDate)) {
      newErrors.hireDate = 'Invalid hire date'
    } else if (formData.hireDate > new Date()) {
      newErrors.hireDate = 'Hire date cannot be in the future'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      // Prepare the data for submission
      const cleanedMobile = formData.mobileNumber?.trim() || null
      const cleanedBankAccount = (() => {
        if (!formData.bankAccount) return null
        const accountNumber = formData.bankAccount.accountNumber?.trim() || ''
        const bankCode = formData.bankAccount.bankCode?.trim() || ''
        const accountName = formData.bankAccount.accountName?.trim() || ''
        if (!accountNumber && !bankCode && !accountName) {
          return null
        }
        return { accountNumber, bankCode, accountName }
      })()
      const cleanedAddress = (() => {
        if (!formData.address) return null
        const street = formData.address.street?.trim() || ''
        const city = formData.address.city?.trim() || ''
        const state = formData.address.state?.trim() || ''
        const country = formData.address.country?.trim() || ''
        const postalCode = formData.address.postalCode?.trim() || ''
        if (!street && !city && !state && !country && !postalCode) {
          return null
        }
        return { street, city, state, country, postalCode }
      })()
      const cleanedEmergencyContact = (() => {
        if (!formData.emergencyContact) return null
        const name = formData.emergencyContact.name?.trim() || ''
        const relationship = formData.emergencyContact.relationship?.trim() || ''
        const phone = formData.emergencyContact.phone?.trim() || ''
        if (!name && !relationship && !phone) {
          return null
        }
        return { name, relationship, phone }
      })()

      const submissionData = {
        ...formData,
        hireDate: formData.hireDate instanceof Date ? formData.hireDate : new Date(formData.hireDate),
        salary: Number(formData.salary),
        status: formData.status || 'active',
        hasPassword: false, // Always false for new employees
        uid: null, // Will be set after first login
        managerId: formData.managerId || null,
        role: formData.role || 'employee',
        // Include payment details
        mobileNumber: cleanedMobile,
        bankAccount: cleanedBankAccount,
        // Include address and emergency contact
        address: cleanedAddress,
        emergencyContact: cleanedEmergencyContact
      }

      console.log('Submitting form data:', submissionData)
      await onSubmit(submissionData)
      console.log('Form submitted successfully')
      
      setHasUnsavedChanges(false)
      onClose()
    } catch (err) {
      console.error('Form submission error:', err)
      setError(err instanceof Error ? err.message : 'Failed to save employee')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    
    // Special handling for date inputs
    if (name === 'hireDate') {
      const date = new Date(value)
      if (isValid(date)) {
        setFormData(prev => ({
          ...prev,
          [name]: date
        }))
        setErrors(prev => ({ ...prev, [name]: undefined }))
      }
    } else if (name === 'salary') {
      // Handle salary input
      const salary = Number(value)
      if (!isNaN(salary)) {
        setFormData(prev => ({
          ...prev,
          [name]: salary
        }))
        setErrors(prev => ({ ...prev, [name]: undefined }))
      }
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }))
      setErrors(prev => ({ ...prev, [name]: undefined }))
    }
    
    setHasUnsavedChanges(true)
  }

  const handleDepartmentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { value } = e.target
    setFormData(prev => ({
      ...prev,
      department: value,
      position: '' // Reset position when department changes
    }))
    setHasUnsavedChanges(true)
    setErrors(prev => ({ ...prev, department: undefined, position: undefined }))
  }

  const handleClose = () => {
    if (hasUnsavedChanges) {
      if (window.confirm('You have unsaved changes. Are you sure you want to close?')) {
        onClose()
      }
    } else {
      onClose()
    }
  }

  const formatPhoneNumber = (value: string) => {
    try {
      const phoneNumber = parsePhoneNumberFromString(value)
      if (phoneNumber) {
        return phoneNumber.formatInternational()
      }
    } catch (error) {
      // If parsing fails, return the original value
      console.error('Error formatting phone number:', error)
    }
    return value
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target
    const formatted = formatPhoneNumber(value)
    setFormData(prev => ({
      ...prev,
      phone: formatted
    }))
    setHasUnsavedChanges(true)
    setErrors(prev => ({ ...prev, phone: undefined }))
  }

  const formatDateForInput = (date: Date): string => {
    try {
      if (isValid(date)) {
        return format(date, 'yyyy-MM-dd')
      }
      return ''
    } catch (error) {
      console.error('Error formatting date:', error)
      return ''
    }
  }

  return (
    <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-2xl w-full max-h-[90vh] bg-white rounded-lg shadow-xl border border-gray-200 flex flex-col">
          <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
            <Dialog.Title className="text-xl font-semibold text-gray-900">
              {initialData ? 'Edit Employee' : 'Add New Employee'}
            </Dialog.Title>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-500 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0">
            {!initialData && (
              <div className="p-4 bg-blue-50 border-b border-blue-100">
                <p className="text-sm text-blue-700">
                  <strong>Note:</strong> The employee will receive an email with instructions to set up their password on their first login.
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    className={`w-full px-3 py-2 border rounded-lg shadow-sm focus:ring-2 focus:ring-gray-400 focus:border-gray-400 transition-colors ${
                      errors.firstName ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.firstName && (
                    <p className="mt-1 text-sm text-red-600">{errors.firstName}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    className={`w-full px-3 py-2 border rounded-lg shadow-sm focus:ring-2 focus:ring-gray-400 focus:border-gray-400 transition-colors ${
                      errors.lastName ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.lastName && (
                    <p className="mt-1 text-sm text-red-600">{errors.lastName}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className={`w-full px-3 py-2 border rounded-lg shadow-sm focus:ring-2 focus:ring-gray-400 focus:border-gray-400 transition-colors ${
                      errors.email ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.email && (
                    <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handlePhoneChange}
                      placeholder="+1234567890"
                      className={`w-full px-3 py-2 border rounded-lg shadow-sm focus:ring-2 focus:ring-gray-400 focus:border-gray-400 transition-colors ${
                        errors.phone ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                  </div>
                  {errors.phone ? (
                    <p className="mt-1 text-sm text-red-600">{errors.phone}</p>
                  ) : (
                    <p className="mt-1 text-sm text-gray-500">
                      Include country code (e.g., +234 for Nigeria, +44 for UK)
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Department <span className="text-gray-400">(optional)</span>
                  </label>
                  <select
                    name="department"
                    value={formData.department}
                    onChange={handleDepartmentChange}
                    disabled={loadingDepartments}
                    className={`w-full px-3 py-2 border rounded-lg shadow-sm focus:ring-2 focus:ring-gray-400 focus:border-gray-400 transition-colors ${
                      errors.department ? 'border-red-500' : 'border-gray-300'
                    } ${loadingDepartments ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <option value="">{loadingDepartments ? 'Loading departments...' : 'Select Department'}</option>
                    {departments.map(dept => (
                      <option key={dept.id} value={dept.name}>{dept.name}</option>
                    ))}
                    {!loadingDepartments && departments.length === 0 && (
                      <option value="" disabled>No departments found. Create one in the Departments page.</option>
                    )}
                  </select>
                  {errors.department && (
                    <p className="mt-1 text-sm text-red-600">{errors.department}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Position <span className="text-gray-400">(optional)</span>
                  </label>
                  <input
                    type="text"
                    name="position"
                    value={formData.position}
                    onChange={handleChange}
                    placeholder="e.g. Product Manager"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-gray-400 focus:border-gray-400 transition-colors"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Leave blank if you don't want to set the position yet.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Role
                  </label>
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleChange}
                    className={`w-full px-3 py-2 border rounded-lg shadow-sm focus:ring-2 focus:ring-gray-400 focus:border-gray-400 transition-colors ${
                      errors.role ? 'border-red-500' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Select Role</option>
                    <option value="admin">Admin</option>
                    <option value="manager">Manager</option>
                    <option value="employee">Employee</option>
                  </select>
                  {errors.role && (
                    <p className="mt-1 text-sm text-red-600">{errors.role}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Manager <span className="text-gray-400">(optional)</span>
                  </label>
                  <div className="relative">
                    <select
                      name="managerId"
                      value={formData.managerId || ''}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-gray-400 focus:border-gray-400 transition-colors"
                      disabled={formData.role === 'admin'}
                    >
                      <option value="">Select Manager</option>
                      {managers.map(manager => (
                        <option key={manager.id} value={manager.id}>
                          {manager.firstName} {manager.lastName} - {manager.department}
                        </option>
                      ))}
                    </select>
                    {loadingManagers && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                      </div>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    {formData.role === 'admin'
                      ? "Admins don't have managers assigned."
                      : "You can assign a manager now or let the employee select one later."}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Salary
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <input
                      type="number"
                      name="salary"
                      value={formData.salary}
                      onChange={handleChange}
                      min={0}
                      className={`w-full pl-8 px-3 py-2 border rounded-lg shadow-sm focus:ring-2 focus:ring-gray-400 focus:border-gray-400 transition-colors ${
                        errors.salary ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                  </div>
                  {errors.salary && (
                    <p className="mt-1 text-sm text-red-600">{errors.salary}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Hire Date
                  </label>
                  <input
                    type="date"
                    name="hireDate"
                    value={formatDateForInput(formData.hireDate)}
                    onChange={handleChange}
                    max={formatDateForInput(new Date())}
                    className={`w-full px-3 py-2 border rounded-lg shadow-sm focus:ring-2 focus:ring-gray-400 focus:border-gray-400 transition-colors ${
                      errors.hireDate ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.hireDate && (
                    <p className="mt-1 text-sm text-red-600">{errors.hireDate}</p>
                  )}
                </div>
              </div>

              <div className="border-t border-gray-200 pt-6">
                <p className="text-sm text-gray-600">
                  Payment details, emergency contacts, and additional profile information can be completed later by the employee from their profile.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmitting ? (
                    <div className="flex items-center">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Saving...
                    </div>
                  ) : (
                    'Save'
                  )}
                </button>
              </div>
            </form>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  )
} 