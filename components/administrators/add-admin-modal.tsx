'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { createAdmin } from '@/lib/firebase'

interface Administrator {
  id: string
  firstName: string
  lastName: string
  email: string
  department: string
  position: string
  status: 'active' | 'inactive'
  createdAt: Date
}

interface AddAdminModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (admin: Administrator) => void
}

export function AddAdminModal({ isOpen, onClose, onSuccess }: AddAdminModalProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    department: '',
    position: '',
    phone: '',
    emergencyContact: {
      name: '',
      relationship: '',
      phone: ''
    }
  })
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Validate form data
      if (!formData.email || !formData.firstName || !formData.lastName || !formData.department || !formData.position) {
        throw new Error('All required fields must be filled')
      }

      // Create admin using the new createAdmin function
      const result = await createAdmin(formData)

      const newAdmin: Administrator = {
        id: result.id,
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email.toLowerCase(),
        department: formData.department,
        position: formData.position,
        status: 'active',
        createdAt: new Date()
      }

      toast({
        title: 'Success',
        description: 'Administrator added successfully. They will receive instructions to set up their account.',
      })

      onSuccess(newAdmin)
      onClose()
      
      // Reset form data
      setFormData({
        email: '',
        firstName: '',
        lastName: '',
        department: '',
        position: '',
        phone: '',
        emergencyContact: {
          name: '',
          relationship: '',
          phone: ''
        }
      })
    } catch (error: any) {
      console.error('Error adding administrator:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to add administrator',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Add New Administrator</DialogTitle>
          <p className="text-sm text-muted-foreground">
            The administrator will receive an email with instructions to set up their password and complete their profile.
          </p>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto pr-2">
          <form id="add-admin-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  disabled={loading}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  disabled={loading}
                  required
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                disabled={loading}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Select value={formData.department} onValueChange={(value) => setFormData({ ...formData, department: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="management">Management</SelectItem>
                  <SelectItem value="hr">HR</SelectItem>
                  <SelectItem value="engineering">Engineering</SelectItem>
                  <SelectItem value="marketing">Marketing</SelectItem>
                  <SelectItem value="sales">Sales</SelectItem>
                  <SelectItem value="finance">Finance</SelectItem>
                  <SelectItem value="operations">Operations</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="position">Position</Label>
              <Input
                id="position"
                name="position"
                value={formData.position}
                onChange={handleChange}
                disabled={loading}
                required
                placeholder="e.g., System Administrator, HR Director"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone (Optional)</Label>
              <Input
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                disabled={loading}
                placeholder="e.g., +1 (555) 123-4567"
              />
            </div>

            <div className="space-y-4">
              <Label className="text-sm font-medium">Emergency Contact (Optional)</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="emergencyName">Name</Label>
                  <Input
                    id="emergencyName"
                    value={formData.emergencyContact.name}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      emergencyContact: { ...formData.emergencyContact, name: e.target.value } 
                    })}
                    disabled={loading}
                    placeholder="Contact name"
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
                    disabled={loading}
                    placeholder="e.g., Spouse, Parent"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="emergencyPhone">Phone</Label>
                <Input
                  id="emergencyPhone"
                  value={formData.emergencyContact.phone}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    emergencyContact: { ...formData.emergencyContact, phone: e.target.value } 
                  })}
                  disabled={loading}
                  placeholder="Emergency contact phone"
                />
              </div>
            </div>
          </form>
        </div>
        
        <DialogFooter className="flex-shrink-0 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" form="add-admin-form" disabled={loading}>
            {loading ? 'Adding...' : 'Add Administrator'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 