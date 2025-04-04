import { Task } from '@/types/task'
import { Timestamp } from 'firebase/firestore'

interface TaskListProps {
  tasks: Task[]
}

export function TaskList({ tasks }: TaskListProps) {
  if (tasks.length === 0) {
    return <p className="text-gray-500">No tasks found</p>
  }

  return (
    <ul className="space-y-4">
      {tasks.map(task => (
        <li 
          key={task.id} 
          className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
        >
          <div>
            <h3 className="font-medium">{task.title}</h3>
            <p className="text-sm text-gray-500">
              Due: {new Date(task.dueDate instanceof Timestamp ? task.dueDate.toDate() : task.dueDate).toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 text-xs rounded-full ${
              task.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
              task.status === 'accepted' ? 'bg-blue-100 text-blue-800' :
              task.status === 'in_progress' ? 'bg-purple-100 text-purple-800' :
              'bg-green-100 text-green-800'
            }`}>
              {task.status.replace('_', ' ')}
            </span>
            <span className={`px-2 py-1 text-xs rounded-full ${
              task.priority === 'high' ? 'bg-red-100 text-red-800' :
              task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
              'bg-green-100 text-green-800'
            }`}>
              {task.priority}
            </span>
          </div>
        </li>
      ))}
    </ul>
  )
} 