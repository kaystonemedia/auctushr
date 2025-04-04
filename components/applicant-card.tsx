import { MoreHorizontal, MapPin } from "lucide-react"

interface ApplicantCardProps {
  name: string
  email: string
  location: string
  position: string
  department: string
  tags?: string[]
}

export function ApplicantCard({ name, email, location, position, department, tags = [] }: ApplicantCardProps) {
  // Function to determine tag background color based on tag content
  const getTagColor = (tag: string) => {
    if (tag.includes("Engineering")) return "bg-indigo-100 text-indigo-800"
    if (tag.includes("Design")) return "bg-teal-100 text-teal-800"
    if (tag.includes("Marketing")) return "bg-blue-100 text-blue-800"
    if (tag.includes("HR")) return "bg-yellow-100 text-yellow-800"
    if (tag.includes("People")) return "bg-teal-100 text-teal-800"
    if (tag.includes("Finance")) return "bg-blue-100 text-blue-800"
    if (tag.includes("Management")) return "bg-indigo-100 text-indigo-800"
    if (tag.includes("IT")) return "bg-indigo-100 text-indigo-800"
    if (tag.includes("SEO")) return "bg-yellow-100 text-yellow-800"
    if (tag.includes("Scrum")) return "bg-yellow-100 text-yellow-800"
    if (tag.includes("Accountant")) return "bg-yellow-100 text-yellow-800"
    return "bg-gray-100 text-gray-800"
  }

  // Function to determine department tag color
  const getDepartmentColor = (dept: string) => {
    if (dept === "Design") return "bg-teal-100 text-teal-800"
    if (dept === "Marketing") return "bg-blue-100 text-blue-800"
    if (dept === "IT") return "bg-indigo-100 text-indigo-800"
    if (dept === "Finance") return "bg-blue-100 text-blue-800"
    if (dept === "Management") return "bg-indigo-100 text-indigo-800"
    if (dept === "People & Culture") return "bg-teal-100 text-teal-800"
    return "bg-gray-100 text-gray-800"
  }

  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-medium text-gray-900">{name}</h3>
          <a href={`mailto:${email}`} className="text-sm text-gray-500 hover:underline">
            {email}
          </a>
        </div>
        <button className="text-gray-400 hover:text-gray-600">
          <MoreHorizontal size={18} />
        </button>
      </div>

      <div className="space-y-3">
        <div className="flex items-center text-sm text-rose-500">
          <MapPin size={16} className="mr-1" />
          <span>{location}</span>
        </div>

        <div className="space-y-2">
          {position && (
            <div className="inline-block px-2 py-1 text-xs font-medium rounded-md bg-yellow-100 text-yellow-800">
              {position}
            </div>
          )}

          {department && (
            <div className={`inline-block px-2 py-1 text-xs font-medium rounded-md ${getDepartmentColor(department)}`}>
              {department}
            </div>
          )}
        </div>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag, index) => (
              <span key={index} className={`px-2 py-1 text-xs font-medium rounded-md ${getTagColor(tag)}`}>
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

