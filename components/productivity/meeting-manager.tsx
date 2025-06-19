import { useState, useEffect } from 'react'
import { useNewAuth } from '@/contexts/new-auth-context'
import { ProductivityService } from '@/lib/productivity'
import { MeetingRecord, ProductivitySettings } from '@/types/productivity'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Plus, Clock, Users, Calendar, Tag, CheckCircle, AlertCircle, XCircle } from 'lucide-react'
import { format } from 'date-fns'

const DEFAULT_SETTINGS: ProductivitySettings = {
  focusSessionDuration: 25, // minutes
  breakDuration: 5, // minutes
  maxFocusSessionsPerDay: 8,
  minFocusTimePercentage: 60, // 60%
  maxMeetingTimePercentage: 30, // 30%
  productivityThresholds: {
    low: 40,
    medium: 70,
    high: 90
  },
  notificationPreferences: {
    focusReminders: true,
    breakReminders: true,
    productivityAlerts: true,
    meetingReminders: true
  }
}

const MEETING_TYPE_COLORS = {
  one_on_one: 'bg-blue-500',
  team: 'bg-green-500',
  client: 'bg-purple-500',
  other: 'bg-gray-500'
}

const STATUS_COLORS = {
  scheduled: 'bg-blue-500',
  in_progress: 'bg-yellow-500',
  completed: 'bg-green-500',
  cancelled: 'bg-red-500'
}

export function MeetingManager() {
  const { user } = useNewAuth()
  const [meetings, setMeetings] = useState<MeetingRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingRecord | null>(null)
  const [newMeeting, setNewMeeting] = useState({
    title: '',
    description: '',
    type: 'team' as const,
    startTime: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    endTime: format(new Date(new Date().getTime() + 60 * 60 * 1000), "yyyy-MM-dd'T'HH:mm"),
    participants: [] as { id: string; name: string }[]
  })
  const [filter, setFilter] = useState({
    status: 'all',
    type: 'all',
    search: ''
  })

  useEffect(() => {
    if (user) {
      fetchMeetings()
    }
  }, [user])

  const fetchMeetings = async () => {
    try {
      setLoading(true)
      const service = ProductivityService.getInstance(DEFAULT_SETTINGS)
      const userMeetings = await service.getMeetings(user!.uid, new Date(), new Date())
      setMeetings(userMeetings)
    } catch (error) {
      console.error('Error fetching meetings:', error)
      toast.error('Failed to fetch meetings')
    } finally {
      setLoading(false)
    }
  }

  const createMeeting = async () => {
    if (!user || !newMeeting.title || !newMeeting.startTime || !newMeeting.endTime) {
      toast.error('Please fill in all required fields')
      return
    }

    try {
      setLoading(true)
      const service = ProductivityService.getInstance(DEFAULT_SETTINGS)
      await service.createMeeting({
        ...newMeeting,
        organizer: user.uid,
        participants: [...newMeeting.participants, { id: user.uid, name: user.displayName || 'You' }],
        status: 'scheduled',
        startTime: new Date(newMeeting.startTime),
        endTime: new Date(newMeeting.endTime),
        duration: (new Date(newMeeting.endTime).getTime() - new Date(newMeeting.startTime).getTime()) / (1000 * 60),
        efficiency: 0
      })
      toast.success('Meeting created successfully')
      setIsDialogOpen(false)
      setNewMeeting({
        title: '',
        description: '',
        type: 'team',
        startTime: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        endTime: format(new Date(new Date().getTime() + 60 * 60 * 1000), "yyyy-MM-dd'T'HH:mm"),
        participants: []
      })
      fetchMeetings()
    } catch (error) {
      console.error('Error creating meeting:', error)
      toast.error('Failed to create meeting')
    } finally {
      setLoading(false)
    }
  }

  const updateMeetingStatus = async (meetingId: string, status: MeetingRecord['status']) => {
    try {
      setLoading(true)
      const service = ProductivityService.getInstance(DEFAULT_SETTINGS)
      await service.updateMeeting(meetingId, { status })
      toast.success('Meeting status updated')
      fetchMeetings()
    } catch (error) {
      console.error('Error updating meeting status:', error)
      toast.error('Failed to update meeting status')
    } finally {
      setLoading(false)
    }
  }

  const updateMeetingEfficiency = async (meetingId: string, efficiency: number) => {
    try {
      setLoading(true)
      const service = ProductivityService.getInstance(DEFAULT_SETTINGS)
      await service.updateMeetingEfficiency(meetingId, efficiency)
      toast.success('Meeting efficiency updated')
      fetchMeetings()
    } catch (error) {
      console.error('Error updating meeting efficiency:', error)
      toast.error('Failed to update meeting efficiency')
    } finally {
      setLoading(false)
    }
  }

  const filteredMeetings = meetings.filter(meeting => {
    if (filter.status !== 'all' && meeting.status !== filter.status) return false
    if (filter.type !== 'all' && meeting.type !== filter.type) return false
    if (filter.search && !meeting.title.toLowerCase().includes(filter.search.toLowerCase())) return false
    return true
  })

  const getEfficiencyColor = (efficiency: number) => {
    if (efficiency >= DEFAULT_SETTINGS.productivityThresholds.high) return 'bg-green-500'
    if (efficiency >= DEFAULT_SETTINGS.productivityThresholds.medium) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">Meetings</h2>
          <p className="text-sm text-muted-foreground">
            Manage your meetings and track their efficiency
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Meeting
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Schedule New Meeting</DialogTitle>
              <DialogDescription>
                Create a new meeting and invite participants
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={newMeeting.title}
                  onChange={(e) => setNewMeeting({ ...newMeeting, title: e.target.value })}
                  placeholder="Enter meeting title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={newMeeting.description}
                  onChange={(e) => setNewMeeting({ ...newMeeting, description: e.target.value })}
                  placeholder="Enter meeting description"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Meeting Type</Label>
                <Select
                  value={newMeeting.type}
                  onValueChange={(value: 'one_on_one' | 'team' | 'client' | 'other') =>
                    setNewMeeting({ ...newMeeting, type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select meeting type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="one_on_one">One-on-One</SelectItem>
                    <SelectItem value="team">Team</SelectItem>
                    <SelectItem value="client">Client</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startTime">Start Time</Label>
                  <Input
                    id="startTime"
                    type="datetime-local"
                    value={newMeeting.startTime}
                    onChange={(e) => setNewMeeting({ ...newMeeting, startTime: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endTime">End Time</Label>
                  <Input
                    id="endTime"
                    type="datetime-local"
                    value={newMeeting.endTime}
                    onChange={(e) => setNewMeeting({ ...newMeeting, endTime: e.target.value })}
                  />
                </div>
              </div>
              {/* TODO: Add participant selection */}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={createMeeting} disabled={loading}>
                Schedule Meeting
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center space-x-4">
        <Input
          placeholder="Search meetings..."
          value={filter.search}
          onChange={(e) => setFilter({ ...filter, search: e.target.value })}
          className="max-w-sm"
        />
        <Select
          value={filter.status}
          onValueChange={(value) => setFilter({ ...filter, status: value })}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={filter.type}
          onValueChange={(value) => setFilter({ ...filter, type: value })}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="one_on_one">One-on-One</SelectItem>
            <SelectItem value="team">Team</SelectItem>
            <SelectItem value="client">Client</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      ) : filteredMeetings.length === 0 ? (
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No Meetings Found</h3>
          <p className="mt-2 text-sm text-gray-500">
            {filter.search || filter.status !== 'all' || filter.type !== 'all'
              ? 'Try adjusting your filters'
              : 'Schedule a new meeting to get started'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredMeetings.map((meeting) => (
            <Card key={meeting.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{meeting.title}</CardTitle>
                    <CardDescription className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {format(new Date(meeting.startTime), 'MMM d, yyyy h:mm a')}
                      </span>
                      <span>→</span>
                      <span>
                        {format(new Date(meeting.endTime), 'MMM d, yyyy h:mm a')}
                      </span>
                    </CardDescription>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge className={MEETING_TYPE_COLORS[meeting.type]}>
                      {meeting.type}
                    </Badge>
                    <Badge className={STATUS_COLORS[meeting.status]}>
                      {meeting.status}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {meeting.description && (
                    <p className="text-sm text-muted-foreground">{meeting.description}</p>
                  )}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Meeting Efficiency</span>
                      <span>{meeting.efficiency}%</span>
                    </div>
                    <Progress
                      value={meeting.efficiency}
                      className={getEfficiencyColor(meeting.efficiency)}
                    />
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <div className="flex items-center">
                        <Clock className="mr-1 h-4 w-4" />
                        <span>{meeting.duration} minutes</span>
                      </div>
                      <div className="flex items-center">
                        <Users className="mr-1 h-4 w-4" />
                        <span>{meeting.participants.length} participants</span>
                      </div>
                    </div>
                  </div>
                  {meeting.outcomes && meeting.outcomes.length > 0 && (
                    <div className="space-y-2">
                      <Label>Outcomes</Label>
                      <ul className="list-disc list-inside text-sm text-muted-foreground">
                        {meeting.outcomes.map((outcome, index) => (
                          <li key={index}>{outcome}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <div className="flex items-center space-x-2">
                  {meeting.status === 'scheduled' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateMeetingStatus(meeting.id, 'in_progress')}
                    >
                      Start Meeting
                    </Button>
                  )}
                  {meeting.status === 'in_progress' && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateMeetingStatus(meeting.id, 'completed')}
                      >
                        <CheckCircle className="mr-2 h-4 w-4" />
                        End Meeting
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const efficiency = prompt('Rate meeting efficiency (0-100):')
                          if (efficiency) {
                            updateMeetingEfficiency(meeting.id, parseInt(efficiency))
                          }
                        }}
                      >
                        Rate Efficiency
                      </Button>
                    </>
                  )}
                </div>
                {meeting.status !== 'completed' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => updateMeetingStatus(meeting.id, 'cancelled')}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Cancel
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
} 