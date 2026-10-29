'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useNewAuth } from '@/contexts/new-auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Plus, Search, Users, Building2 } from 'lucide-react'
import { AddAdminModal } from '@/components/administrators/add-admin-modal'
import { OverviewTable } from '@/components/administrators/overview-table'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/use-toast'
import { resendOnboardingInvite } from '@/lib/email-service'

// Define the admin type
interface Administrator {
  id: string
  firstName: string
  lastName: string
  email: string
  department: string
  position: string
  status: 'active' | 'inactive'
  hasPassword: boolean
  createdAt: Date
}

export default function AdministratorsPage() {
  const router = useRouter()
  const { user, isLoading } = useNewAuth()
  const { toast } = useToast()
  const [administrators, setAdministrators] = useState<Administrator[]>([])
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoadingAdmins, setIsLoadingAdmins] = useState(true)

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'admin')) {
      router.push('/unauthorized')
    }
  }, [user, isLoading, router])

  useEffect(() => {
    const fetchAdministrators = async () => {
      if (!user || user.role !== 'admin') return

      try {
        setIsLoadingAdmins(true)
        const response = await fetch('/api/employees', { credentials: 'include' })
        if (!response.ok) throw new Error('Failed to fetch administrators')
        const data = await response.json()
        const adminsData = ((data.employees || []) as any[])
          .filter((employee) => employee.role === 'admin' && employee.status !== 'inactive')
          .map((employee) => ({
            id: employee.id,
            firstName: employee.firstName || '',
            lastName: employee.lastName || '',
            email: employee.email || '',
            department: employee.department || '',
            position: employee.position || '',
            status: employee.status || 'active',
            hasPassword: Boolean(employee.hasPassword),
            createdAt: employee.createdAt ? new Date(employee.createdAt) : new Date(),
          })) as Administrator[]
        setAdministrators(adminsData)
      } catch (error) {
        console.error('Error fetching administrators:', error)
        toast({
          title: 'Error',
          description: 'Failed to fetch administrators. Please try again.',
          variant: 'destructive',
        })
      } finally {
        setIsLoadingAdmins(false)
      }
    }

    fetchAdministrators()
  }, [user, toast])

  const filteredAdministrators = administrators.filter((admin) =>
    `${admin.firstName} ${admin.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    admin.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    admin.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
    admin.position.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleExport = () => {
    // TODO: Implement export functionality
    console.log('Export administrators')
  }

  if (isLoading || isLoadingAdmins) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (!user || user.role !== 'admin') {
    return null
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Administrators</h1>
          <p className="text-muted-foreground mt-1">
            <a href="/productivity" className="text-primary hover:underline">
              Manage tasks and productivity →
            </a>
          </p>
        </div>
        <div className="flex gap-4">
          <Button variant="outline" onClick={handleExport}>
            Export
          </Button>
          <Button onClick={() => setIsAddModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Administrator
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="administrators" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Administrators
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Tabs defaultValue="all" className="space-y-4">
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="managers">Managers</TabsTrigger>
              <TabsTrigger value="employees">Employees</TabsTrigger>
            </TabsList>

            <TabsContent value="all">
              <OverviewTable viewType="all" />
            </TabsContent>

            <TabsContent value="managers">
              <OverviewTable viewType="managers" />
            </TabsContent>

            <TabsContent value="employees">
              <OverviewTable viewType="employees" />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="administrators">
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search administrators..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Position</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAdministrators.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No administrators found
                </TableCell>
              </TableRow>
            ) : (
              filteredAdministrators.map((admin) => (
                <TableRow key={admin.id}>
                  <TableCell className="font-medium">
                    {admin.firstName} {admin.lastName}
                  </TableCell>
                  <TableCell>{admin.email}</TableCell>
                  <TableCell>
                    <span className="capitalize">{admin.department}</span>
                  </TableCell>
                  <TableCell>{admin.position}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        admin.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {admin.status}
                    </span>
                  </TableCell>
                  <TableCell>
                    {admin.createdAt.toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          className="h-8 w-8 p-0"
                        >
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            // TODO: Implement edit functionality
                            console.log('Edit administrator:', admin.id)
                          }}
                        >
                          Edit
                        </DropdownMenuItem>
                        {!admin.hasPassword && (
                          <DropdownMenuItem
                            onClick={async () => {
                              try {
                                await resendOnboardingInvite(admin.id)
                                toast({ title: 'Invite sent', description: `A new invite was emailed to ${admin.email}.` })
                              } catch (error) {
                                toast({
                                  title: 'Invite not sent',
                                  description: error instanceof Error ? error.message : 'Failed to resend invite',
                                  variant: 'destructive',
                                })
                              }
                            }}
                          >
                            Resend invite
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => {
                            // TODO: Implement deactivate functionality
                            console.log('Deactivate administrator:', admin.id)
                          }}
                        >
                          Deactivate
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
        </TabsContent>
      </Tabs>

      <AddAdminModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={(admin) => {
          setAdministrators([...administrators, {
            ...admin,
            firstName: admin.firstName,
            lastName: admin.lastName,
            department: admin.department,
            position: admin.position,
            hasPassword: false,
            createdAt: new Date()
          }])
          setIsAddModalOpen(false)
        }}
      />
    </div>
  )
} 