'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'

interface AddManagerModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (manager: { id: string; firstName: string; lastName: string; email: string; department: string; position: string; status: string; createdAt: Date }) => void
}

interface FormData {
  firstName: string
  lastName: string
  email: string
  department: string
  position: string
  phone: string
  emergencyContact: {
    name: string
    relationship: string
    phone: string
  }
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

export function AddManagerModal({ isOpen, onClose, onSuccess }: AddManagerModalProps) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [departments, setDepartments] = useState<Department[]>([])
  const [loadingDepartments, setLoadingDepartments] = useState(false)
  const [formData, setFormData] = useState<FormData>({
    firstName: '',
    lastName: '',
    email: '',
    department: '',
    position: '',
    phone: '',
    emergencyContact: {
      name: '',
      relationship: '',
      phone: ''
    }
  })

  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        setLoadingDepartments(true)
        const response = await fetch('/api/departments', { credentials: 'include' })
        if (!response.ok) throw new Error('Failed to load departments')
        const payload = await response.json()
        const departmentsData = ((payload.departments || []) as DepartmentResponseItem[]).map((department) => ({
          id: department.id,
          name: department.name,
          description: department.description
        })) as Department[]
        setDepartments(departmentsData)
      } catch (error) {
        console.error('Error fetching departments:', error)
        toast({
          title: 'Error',
          description: 'Failed to load departments',
          variant: 'destructive'
        })
      } finally {
        setLoadingDepartments(false)
      }
    }
    
    if (isOpen) {
      fetchDepartments()
    }
  }, [isOpen, toast])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const trimmedEmergency = {
        name: formData.emergencyContact.name.trim(),
        relationship: formData.emergencyContact.relationship.trim(),
        phone: formData.emergencyContact.phone.trim()
      }
      const hasEmergencyContact = Boolean(
        trimmedEmergency.name || trimmedEmergency.relationship || trimmedEmergency.phone
      )

      const response = await fetch('/api/employees', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          department: formData.department,
          position: formData.position,
          role: 'manager',
          emergencyContact: hasEmergencyContact ? trimmedEmergency : undefined
        })
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to create manager')
      }
      const result = payload.employee as { id: string }
      const invite = payload.invite as { sent: boolean; error: string | null } | undefined

      if (invite?.sent) {
        toast({
          title: 'Manager added successfully',
          description: 'An invite email with a link to set their password has been sent.',
        })
      } else {
        toast({
          title: 'Manager added, but the invite email was not sent',
          description: invite?.error || 'Unknown error. You can resend the invite from the managers list.',
          variant: 'destructive',
        })
      }

      onSuccess({
        id: result.id,
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        department: formData.department,
        position: formData.position,
        status: 'active',
        createdAt: new Date()
      })

      handleClose()
    } catch (error: unknown) {
      console.error('Error adding manager:', error)
      const message = error instanceof Error ? error.message : 'Failed to add manager. Please try again.'

      // Check if error is specifically about email
      if (message.includes('onboarding email') || message.includes('Failed to send')) {
        toast({
          title: 'Manager created',
          description: 'Manager was created successfully, but the onboarding email failed. Please check your SMTP settings in Settings → Notifications → Email.',
          variant: 'default',
        })
        // Still close and refresh - manager was created
        handleClose()
        return
      }

      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      department: '',
      position: '',
      phone: '',
      emergencyContact: {
        name: '',
        relationship: '',
        phone: ''
      }
    })
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Add New Manager</DialogTitle>
          <DialogDescription>
            Fill in the manager's details below. They will receive an email to set up their account.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="department">Department</Label>
            <Select
              value={formData.department}
              onValueChange={(value) => setFormData({ ...formData, department: value })}
              disabled={loadingDepartments}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingDepartments ? "Loading departments..." : "Select department"} />
              </SelectTrigger>
              <SelectContent>
                {departments.length === 0 && !loadingDepartments && (
                  <SelectItem value="" disabled>No departments found. Create one in the Departments page.</SelectItem>
                )}
                {departments.map(dept => (
                  <SelectItem key={dept.id} value={dept.name}>{dept.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="position">Position</Label>
            <Input
              id="position"
              value={formData.position}
              onChange={(e) => setFormData({ ...formData, position: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              required
            />
          </div>

          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Emergency Contact</h3>
              <span className="text-xs text-muted-foreground">Optional</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="emergencyName">Contact Name</Label>
                <Input
                  id="emergencyName"
                  value={formData.emergencyContact.name}
                  onChange={(e) => setFormData({
                    ...formData,
                    emergencyContact: { ...formData.emergencyContact, name: e.target.value }
                  })}
                  placeholder="e.g., Jane Doe"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emergencyRelationship">Relationship</Label>
                <Input
                  id="emergencyRelationship"
                  value={formData.emergencyContact.relationship}
                  onChange={(e) => setFormData({
                    ...formData,
                    emergencyContact: { ...formData.emergencyContact, relationship: e.target.value }
                  })}
                  placeholder="e.g., Spouse, Parent"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="emergencyPhone">Contact Phone</Label>
              <Input
                id="emergencyPhone"
                type="tel"
                value={formData.emergencyContact.phone}
                onChange={(e) => setFormData({
                  ...formData,
                  emergencyContact: { ...formData.emergencyContact, phone: e.target.value }
                })}
                placeholder="+233XXXXXXXXX"
              />
              <p className="text-xs text-muted-foreground">
                Include country code (e.g., +233 for Ghana). You can provide these details later from your profile.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Adding...' : 'Add Manager'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
} 