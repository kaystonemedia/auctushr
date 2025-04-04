interface DepartmentChartProps {
    data: {
      department: string
      value: number
      color: string
    }[]
    title: string
    maxValue?: number
  }
  
  export function DepartmentChart({ data, title, maxValue = 100 }: DepartmentChartProps) {
    return (
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold mb-6">{title}</h3>
        <div className="space-y-4">
          {data.map((item, index) => (
            <div key={index}>
              <div className="flex justify-between mb-1">
                <span className="text-sm">{item.department}</span>
              </div>
              <div className="h-4 w-full bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full ${item.color}`} style={{ width: `${(item.value / maxValue) * 100}%` }}></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }
  
  