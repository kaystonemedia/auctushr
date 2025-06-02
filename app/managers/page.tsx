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
import { MoreHorizontal, Plus, Search } from 'lucide-react'
import { AddManagerModal } from '@/components/managers/add-manager-modal'
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useToast } from '@/components/ui/use-toast'

// Define the manager type
interface Manager {
  id: string
  firstName: string
  lastName: string
  email: string
  department: string
  position: string
  status: 'active' | 'inactive'
  createdAt: Date
}

export default function ManagersPage() {
  const router = useRouter()
  const { user, isLoading } = useNewAuth()
  const { toast } = useToast()
  const [managers, setManagers] = useState<Manager[]>([])
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoadingManagers, setIsLoadingManagers] = useState(true)

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'admin')) {
      router.push('/unauthorized')
    }
  }, [user, isLoading, router])

  useEffect(() => {
    const fetchManagers = async () => {
      if (!user || user.role !== 'admin') return

      try {
        setIsLoadingManagers(true)
        const managersRef = collection(db, 'managers')
        const managersQuery = query(
          managersRef,
          where('status', '==', 'active'),
          orderBy('createdAt', 'desc')
        )
        
        const snapshot = await getDocs(managersQuery)
        console.log('Raw manager documents:', snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))
        const managersData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date()
        })) as Manager[]
        console.log('Processed manager data:', managersData)

        setManagers(managersData)
      } catch (error) {
        console.error('Error fetching managers:', error)
        toast({
          title: 'Error',
          description: 'Failed to fetch managers. Please try again.',
          variant: 'destructive',
        })
      } finally {
        setIsLoadingManagers(false)
      }
    }

    fetchManagers()
  }, [user, toast])

  const filteredManagers = managers.filter((manager) =>
    `${manager.firstName} ${manager.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    manager.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    manager.department.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleExport = () => {
    // TODO: Implement export functionality
    console.log('Export managers')
  }

  if (isLoading || isLoadingManagers) {
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
        <h1 className="text-3xl font-bold">Managers</h1>
        <div className="flex gap-4">
          <Button variant="outline" onClick={handleExport}>
            Export
          </Button>
          <Button onClick={() => setIsAddModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Manager
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search managers..."
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
            {filteredManagers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No managers found
                </TableCell>
              </TableRow>
            ) : (
              filteredManagers.map((manager) => (
                <TableRow key={manager.id}>
                  <TableCell className="font-medium">
                    {manager.firstName} {manager.lastName}
                  </TableCell>
                  <TableCell>{manager.email}</TableCell>
                  <TableCell>{manager.department}</TableCell>
                  <TableCell>{manager.position}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        manager.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {manager.status}
                    </span>
                  </TableCell>
                  <TableCell>
                    {manager.createdAt.toLocaleDateString()}
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
                            console.log('Edit manager:', manager.id)
                          }}
                        >
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => {
                            // TODO: Implement deactivate functionality
                            console.log('Deactivate manager:', manager.id)
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

      <AddManagerModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={(manager) => {
          setManagers([...managers, {
            ...manager,
            firstName: manager.firstName,
            lastName: manager.lastName,
            position: manager.position,
            createdAt: new Date()
          }])
          setIsAddModalOpen(false)
        }}
      />
    </div>
  )
} 