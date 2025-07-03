'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { collection, addDoc, doc, updateDoc, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
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
      managerId: department?.managerId || '',
    },
  })

  useEffect(() => {
    const fetchManagers = async () => {
      try {
        // Get all employees with manager role
        const employeesRef = collection(db, 'employees')
        const q = query(employeesRef, where('role', '==', 'manager'))
        const snapshot = await getDocs(q)
        
        const managersData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
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

      const departmentData = {
        ...data,
        updatedAt: new Date(),
      }

      if (department) {
        // Update existing department
        await updateDoc(doc(db, 'departments', department.id), departmentData)
        toast.success('Department updated successfully')
      } else {
        // Create new department
        const newDepartmentData = {
          ...departmentData,
          createdAt: new Date(),
        }
        await addDoc(collection(db, 'departments'), newDepartmentData)
        toast.success('Department created successfully')
      }

      onSuccess()
    } catch (error) {
      console.error('Error saving department:', error)
      toast.error(department ? 'Failed to update department' : 'Failed to create department')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Enter department description"
                  className="resize-none"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

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
                  <SelectItem value="">No Manager</SelectItem>
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

        <div className="flex justify-end space-x-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : department ? 'Update Department' : 'Create Department'}
          </Button>
        </div>
      </form>
    </Form>
  )
} 