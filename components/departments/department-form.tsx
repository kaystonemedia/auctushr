'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { toast } from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const departmentSchema = z.object({
  name: z.string().min(2, 'Department name must be at least 2 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  managerId: z.string().optional(),
})

type DepartmentFormData = z.infer<typeof departmentSchema>

interface Employee {
  id: string
  firstName: string
  lastName: string
  role: string
}

interface DepartmentFormProps {
  department?: {
    id: string
    name: string
    description: string
    managerId?: string
  }
  onSuccess: () => void
  onCancel: () => void
}

export function DepartmentForm({ department, onSuccess, onCancel }: DepartmentFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [managers, setManagers] = useState<Employee[]>([])

  const form = useForm<DepartmentFormData>({
    resolver: zodResolver(departmentSchema),
    defaultValues: {
      name: department?.name || '',
      description: department?.description || '',
      managerId: department?.managerId || 'none',
    },
  })

  useEffect(() => {
    const fetchManagers = async () => {
      try {
        const res = await fetch('/api/employees', { credentials: 'include' })
        if (!res.ok) throw new Error('Failed to load managers')
        const data = await res.json()
        const managersData = (data.employees || [])
          .filter((e: { role: string }) => e.role === 'manager' || e.role === 'admin')
          .map((e: { id: string; firstName: string; lastName: string; role: string }) => ({
            id: e.id,
            firstName: e.firstName,
            lastName: e.lastName,
            role: e.role,
          })) as Employee[]
        setManagers(managersData)
      } catch (error) {
        console.error('Error fetching managers:', error)
        toast.error('Failed to load managers')
      }
    }

    fetchManagers()
  }, [])

  const onSubmit = async (data: DepartmentFormData) => {
    try {
      setIsSubmitting(true)

      const payload = {
        id: department?.id,
        name: data.name,
        description: data.description,
        managerId: data.managerId === 'none' ? null : data.managerId,
      }

      const res = await fetch('/api/departments', {
        method: department ? 'PUT' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Save failed')
      }

      toast.success(department ? 'Department updated successfully' : 'Department created successfully')

      onSuccess()
    } catch (error) {
      console.error('Error saving department:', error)
      toast.error(department ? 'Failed to update department' : 'Failed to create department')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-h-[70vh] overflow-y-auto">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="sm:col-span-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter department name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="sm:col-span-2">
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter department description"
                        className="resize-none min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="sm:col-span-2">
              <FormField
                control={form.control}
                name="managerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department Manager</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a manager" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">No Manager</SelectItem>
                        {managers.map((manager) => (
                          <SelectItem key={manager.id} value={manager.id}>
                            {manager.firstName} {manager.lastName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end space-y-2 space-y-reverse sm:space-y-0 sm:space-x-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSubmitting}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
              {isSubmitting ? 'Saving...' : department ? 'Update Department' : 'Create Department'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
} 