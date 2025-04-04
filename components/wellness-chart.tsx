interface WellnessChartProps {
    departments: {
      name: string
      score: number
      color: string
    }[]
  }
  
  export function WellnessChart({ departments }: WellnessChartProps) {
    const maxScore = 100
  
    return (
      <div className="bg-white p-6 rounded-lg">
        <h3 className="text-lg font-semibold mb-6">Employees&apos; wellness by department</h3>
  
        <div className="space-y-4">
          {departments.map((dept, index) => (
            <div key={index} className="flex items-center">
              <div className="w-24 text-right mr-4 text-sm text-gray-600">{dept.name}</div>
              <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`${dept.color} h-full`}
                  style={{ width: `${(dept.score / maxScore) * 100}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
  
        <div className="mt-8 flex justify-between text-xs text-gray-500">
          {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((value) => (
            <div key={value}>{value}</div>
          ))}
        </div>
      </div>
    )
  }
  
  