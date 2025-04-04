import { Event } from '@/types/event'

interface EventListProps {
  events: Event[]
}

export function EventList({ events }: EventListProps) {
  if (events.length === 0) {
    return <p className="text-gray-500">No events found</p>
  }

  return (
    <ul className="space-y-4">
      {events.map(event => (
        <li 
          key={event.id} 
          className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
        >
          <div>
            <h3 className="font-medium">{event.title}</h3>
            <p className="text-sm text-gray-500">
              {event.startTime.toDate().toLocaleDateString()} - {event.endTime.toDate().toLocaleDateString()}
            </p>
          </div>
          <span className={`px-2 py-1 text-xs rounded-full ${
            event.type === 'meeting' ? 'bg-blue-100 text-blue-800' :
            event.type === 'deadline' ? 'bg-red-100 text-red-800' :
            'bg-green-100 text-green-800'
          }`}>
            {event.type}
          </span>
        </li>
      ))}
    </ul>
  )
} 