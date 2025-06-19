import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, Clock, AlertCircle, Users, FileText } from "lucide-react"

interface TaskStats {
  totalIssued: number
  completed: number
  accepted: number
  pending: number
}

interface EmployeeTask {
  id: string
  name: string
  avatar?: string
  taskTitle: string
  status: 'in_progress' | 'completed' | 'pending'
  progress: number
}

interface TaskProgressCardsProps {
  stats: TaskStats
  employees: EmployeeTask[]
}

export function TaskProgressCards({ stats, employees }: TaskProgressCardsProps) {
  const [showEmployeeList, setShowEmployeeList] = useState(false)

  const getStatusColor = (status: EmployeeTask['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500'
      case 'in_progress':
        return 'bg-blue-500'
      case 'pending':
        return 'bg-yellow-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getStatusIcon = (status: EmployeeTask['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'in_progress':
        return <Clock className="h-4 w-4 text-blue-500" />
      case 'pending':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
      default:
        return null
    }
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tasks Issued</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalIssued}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Tasks</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completed}</div>
            <Progress value={(stats.completed / stats.totalIssued) * 100} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Accepted Tasks</CardTitle>
            <AlertCircle className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.accepted}</div>
            <Progress value={(stats.accepted / stats.totalIssued) * 100} className="mt-2" />
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setShowEmployeeList(true)}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Tasks</CardTitle>
            <Users className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
            <Progress value={(stats.pending / stats.totalIssued) * 100} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-2">Click to view employee progress</p>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showEmployeeList} onOpenChange={setShowEmployeeList}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Employee Task Progress</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              {employees.map((employee) => (
                <div key={employee.id} className="flex items-center space-x-4 p-4 rounded-lg border">
                  <Avatar>
                    <AvatarImage src={employee.avatar} />
                    <AvatarFallback>{employee.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium leading-none">{employee.name}</p>
                      <Badge variant="outline" className={getStatusColor(employee.status)}>
                        {getStatusIcon(employee.status)}
                        <span className="ml-1 capitalize">{employee.status.replace('_', ' ')}</span>
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{employee.taskTitle}</p>
                    <Progress value={employee.progress} className="mt-2" />
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  )
} 