export interface Employee {
  firstName: string
  lastName: string
  role: "admin" | "manager" | "employee"
  managerId?: string
  email: string
  password: string
  imagePreview: string | null
}

export interface Manager {
  id: string
  name: string
}

