'use client'

interface TaskProgressProps {
  tasks: Array<{
    title: string
    completed: boolean
    timeSpent: number
  }>
}

export function TaskProgress({ tasks }: TaskProgressProps) {
  const completedTasks = tasks.filter(task => task.completed).length
  const totalTasks = tasks.length
  const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0

  return (
    <div className="space-y-4">
      <div className="flex justify-between text-sm">
        <span>Progress</span>
        <span>{Math.round(progress)}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className="bg-green-500 h-2 rounded-full" 
          style={{ width: `${progress}%` }}
        ></div>
      </div>
      <div className="space-y-2">
        {tasks.map((task, index) => (
          <div key={index} className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${task.completed ? 'bg-green-500' : 'bg-gray-300'}`}></div>
            <span className={`text-sm ${task.completed ? 'line-through text-gray-500' : ''}`}>
              {task.title}
            </span>
            <span className="text-xs text-gray-500 ml-auto">
              {Math.round(task.timeSpent / 60)}m
            </span>
          </div>
        ))}
      </div>
    </div>
  )
} 