import { ApplicantCard } from "@/components/applicant-card"
import { Header } from "@/components/header"
import { Sidebar } from "@/components/sidebar"
import { Filter, Plus } from "lucide-react"

export default function ApplicantTrackerPage() {
  const stages = [
    {
      title: "Applied",
      applicants: [
        {
          name: "Harper Stone",
          email: "harperstone@email.com",
          location: "Copenhagen",
          position: "Head of HR",
          department: "People & Culture",
        },
        {
          name: "Alojz Novak",
          email: "alojznovak@email.com",
          location: "Prague",
          position: "Engineering - Front end",
          department: "IT",
        },
        {
          name: "Jay Raver",
          email: "jayraver@email.com",
          location: "Berlin",
          position: "Accountant",
          department: "Finance",
        },
      ],
    },
    {
      title: "Interviewed",
      applicants: [
        {
          name: "Lucy Keyword",
          email: "lucykeyword@email.com",
          location: "Copenhagen",
          position: "SEO Specialist",
          department: "Marketing",
        },
      ],
    },
    {
      title: "Made offer",
      applicants: [
        {
          name: "Millie Ligma",
          email: "millieligma@email.com",
          location: "Los Angeles",
          position: "Junior Designer",
          department: "Design",
        },
        {
          name: "Mike Star",
          email: "mikestar@email.com",
          location: "Dublin",
          position: "Scrum Master",
          department: "Management",
        },
      ],
    },
    {
      title: "Hired",
      applicants: [
        {
          name: "Victor Kowalski",
          email: "kowalskianalysis@email.com",
          location: "Athens",
          position: "Engineering - Back end",
          department: "IT",
        },
      ],
    },
  ]

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar activePath="/applicant-tracker" />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />

        <main className="flex-1 overflow-y-auto p-4">
          <div className="max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-700">Application tracker</h1>
                <p className="text-gray-500">Here&apos;s your selection process overview.</p>
              </div>

              <button className="flex items-center px-3 py-2 bg-gray-100 rounded-md hover:bg-gray-200">
                <Filter size={16} className="mr-2" />
                <span>Filter</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {stages.map((stage, index) => (
                <div key={index}>
                  <h2 className="text-lg font-semibold mb-4 text-gray-700">{stage.title}</h2>
                  <div className="space-y-4">
                    {stage.applicants.map((applicant, i) => (
                      <ApplicantCard
                        key={i}
                        name={applicant.name}
                        email={applicant.email}
                        location={applicant.location}
                        position={applicant.position}
                        department={applicant.department}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="fixed bottom-8 right-8">
              <button className="flex items-center justify-center w-12 h-12 bg-blue-500 text-white rounded-full shadow-lg hover:bg-blue-600">
                <Plus size={24} />
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

