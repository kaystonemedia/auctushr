'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { db } from '@/lib/firebase'
import { collection, addDoc, query, where, getDocs, updateDoc, doc } from 'firebase/firestore'
import { Button } from '@/components/ui/button'
import { Calendar, Clock, Users } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { ShiftSchedule } from '@/types/attendance'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'

const SHIFT_TYPES = [
  { value: 'morning', label: 'Morning Shift (6:00 AM - 2:00 PM)' },
  { value: 'evening', label: 'Evening Shift (2:00 PM - 10:00 PM)' },
  { value: 'night', label: 'Night Shift (10:00 PM - 6:00 AM)' },
  { value: 'custom', label: 'Custom Shift' }
]

const DAYS_OF_WEEK = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday'
]

interface ShiftSchedulerProps {
  employeeId?: string;
  departmentId?: string;
  isManager?: boolean;
}

export function ShiftScheduler({ employeeId, departmentId, isManager = false }: ShiftSchedulerProps) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [showDialog, setShowDialog] = useState(false)
  const [currentShift, setCurrentShift] = useState<ShiftSchedule | null>(null)
  const [formData, setFormData] = useState({
    shiftType: 'morning',
    startTime: '09:00',
    endTime: '17:00',
    breakDuration: 60,
    workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    effectiveFrom: new Date().toISOString().split('T')[0]
  })

  useEffect(() => {
    fetchCurrentShift()
  }, [employeeId, departmentId, user])

  const fetchCurrentShift = async () => {
    if (!user && !employeeId && !departmentId) return

    try {
      setLoading(true)
      let q;
      
      if (departmentId) {
        // Fetch department-wide shift
        q = query(
          collection(db, 'shifts'),
          where('departmentId', '==', departmentId),
          where('isActive', '==', true)
        )
      } else {
        // Fetch employee-specific shift
        const targetEmployeeId = employeeId || user?.uid
        q = query(
          collection(db, 'shifts'),
          where('employeeId', '==', targetEmployeeId),
          where('isActive', '==', true)
        )
      }

      const querySnapshot = await getDocs(q)
      if (!querySnapshot.empty) {
        const shiftData = querySnapshot.docs[0].data() as ShiftSchedule
        setCurrentShift({ ...shiftData, id: querySnapshot.docs[0].id })
      }
    } catch (error) {
      console.error('Error fetching shift:', error)
      toast.error('Failed to fetch shift schedule')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    try {
      setLoading(true)
      const targetEmployeeId = employeeId || user.uid

      // If there's an existing active shift, deactivate it
      if (currentShift) {
        await updateDoc(doc(db, 'shifts', currentShift.id), {
          isActive: false,
          effectiveTo: new Date()
        })
      }

      // Create new shift schedule
      const shiftData: Omit<ShiftSchedule, 'id'> = {
        employeeId: departmentId ? undefined : targetEmployeeId,
        departmentId: departmentId,
        employeeName: user.name,
        shiftType: formData.shiftType as ShiftSchedule['shiftType'],
        startTime: formData.startTime,
        endTime: formData.endTime,
        breakDuration: formData.breakDuration,
        workingDays: formData.workingDays as ShiftSchedule['workingDays'],
        effectiveFrom: new Date(formData.effectiveFrom),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      await addDoc(collection(db, 'shifts'), shiftData)
      await fetchCurrentShift()
      setShowDialog(false)
      toast.success('Shift schedule updated successfully')
    } catch (error) {
      console.error('Error updating shift:', error)
      toast.error('Failed to update shift schedule')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold">Shift Schedule</h3>
          {(isManager || !currentShift) && (
            <Button onClick={() => setShowDialog(true)} variant="outline">
              {currentShift ? 'Update Schedule' : 'Set Schedule'}
            </Button>
          )}
        </div>

        {currentShift ? (
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium">
                  {SHIFT_TYPES.find(s => s.value === currentShift.shiftType)?.label}
                </p>
                <p className="text-sm text-gray-500">
                  {currentShift.startTime} - {currentShift.endTime}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium">Working Days</p>
                <p className="text-sm text-gray-500 capitalize">
                  {currentShift.workingDays.join(', ')}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">No shift schedule set</p>
        )}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Shift Schedule</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Shift Type</label>
              <Select
                value={formData.shiftType}
                onValueChange={(value) => setFormData({ ...formData, shiftType: value })}
              >
                {SHIFT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </Select>
            </div>

            {formData.shiftType === 'custom' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Start Time</label>
                  <Input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">End Time</label>
                  <Input
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700">Break Duration (minutes)</label>
              <Input
                type="number"
                value={formData.breakDuration}
                onChange={(e) => setFormData({ ...formData, breakDuration: parseInt(e.target.value) })}
                min="0"
                step="15"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Working Days</label>
              <div className="grid grid-cols-2 gap-2">
                {DAYS_OF_WEEK.map((day) => (
                  <label key={day} className="flex items-center space-x-2">
                    <Checkbox
                      checked={formData.workingDays.includes(day)}
                      onCheckedChange={(checked) => {
                        setFormData({
                          ...formData,
                          workingDays: checked
                            ? [...formData.workingDays, day]
                            : formData.workingDays.filter((d) => d !== day)
                        })
                      }}
                    />
                    <span className="text-sm capitalize">{day}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Effective From</label>
              <Input
                type="date"
                value={formData.effectiveFrom}
                onChange={(e) => setFormData({ ...formData, effectiveFrom: e.target.value })}
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                Save Schedule
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
} 