import { useEffect, useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'

type TeamMember = {
  id: string
  full_name: string | null
  email: string | null
  role: string | null
}

const roleBadgeClasses: Record<string, string> = {
  admin: 'bg-rose-100 text-rose-600 border border-rose-200',
  manager: 'bg-sky-100 text-sky-600 border border-sky-200',
  reviewer: 'bg-emerald-100 text-emerald-600 border border-emerald-200',
  annotator: 'bg-amber-100 text-amber-600 border border-amber-200',
}

const ROLE_OPTIONS = ['all', 'admin', 'manager', 'reviewer', 'annotator']

const RoleBadge = ({ role }: { role: string | null }) => {
  if (!role) return <span className="text-muted-foreground">—</span>
  const classes = roleBadgeClasses[role] || 'bg-slate-100 text-slate-600 border border-slate-200'
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wide ${classes}`}>
      <span className="h-2 w-2 rounded-full bg-current opacity-70" />
      {role}
    </span>
  )
}

export default function Team() {
  const { user, userRole } = useAuth()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)

  const isAdmin = userRole === 'admin' || userRole === 'manager'

  useEffect(() => {
    if (!user) return

    const fetchTeam = async () => {
      setLoading(true)
      setError(null)

      try {
        const query = supabase
          .from('profiles')
          .select('id, full_name, email, role')
          .order('full_name', { ascending: true })

        if (!isAdmin) {
          query.eq('id', user.id)
        }

        const { data, error: queryError } = await query

        if (queryError) {
          throw queryError
        }

        setMembers(data ?? [])
      } catch (teamError) {
        const message =
          teamError instanceof Error ? teamError.message : 'Unable to load team members.'
        setError(message)
      } finally {
        setLoading(false)
      }
    }

    fetchTeam()
  }, [user, isAdmin])

  // Filter members based on search and role filter
  const filteredMembers = useMemo(() => {
    let filtered = members

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter((member) => {
        const name = member.full_name?.toLowerCase() || ''
        const email = member.email?.toLowerCase() || ''
        return name.includes(query) || email.includes(query)
      })
    }

    // Filter by role
    if (roleFilter !== 'all') {
      filtered = filtered.filter((member) => member.role === roleFilter)
    }

    return filtered
  }, [members, searchQuery, roleFilter])

  // Paginate filtered members
  const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredMembers.length / pageSize)), [filteredMembers.length, pageSize])
  const paginatedMembers = useMemo(() => {
    const start = page * pageSize
    const end = start + pageSize
    return filteredMembers.slice(start, end)
  }, [filteredMembers, page, pageSize])

  const handlePageChange = (newPage: number) => {
    if (newPage < 0 || newPage >= totalPages) return
    setPage(newPage)
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 py-10 px-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-slate-800">Team Members</h1>
        <p className="text-sm text-slate-500">
          {isAdmin
            ? 'View and manage all team members in your workspace.'
            : 'View your profile information.'}
        </p>
      </header>

      <Card className="border border-slate-200 shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between mb-4">
            <CardTitle className="text-lg font-semibold">Team Members</CardTitle>
            <div className="text-sm text-slate-500">
              Showing {paginatedMembers.length > 0 ? ((page * pageSize) + 1) : 0} to {Math.min((page + 1) * pageSize, filteredMembers.length)} of {filteredMembers.length} results
            </div>
          </div>
          
          {/* Search and Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setPage(0) // Reset to first page on search
                }}
                className="pl-9"
              />
            </div>
            <Select 
              value={roleFilter} 
              onValueChange={(value) => {
                setRoleFilter(value)
                setPage(0) // Reset to first page on filter change
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((role) => (
                  <SelectItem key={role} value={role}>
                    {role === 'all' ? 'All Roles' : role.charAt(0).toUpperCase() + role.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-purple-600)] mb-2"></div>
              <p className="text-sm text-slate-500">Loading team members…</p>
            </div>
          ) : error ? (
            <div className="p-8">
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-6 text-sm text-destructive">
                {error}
              </div>
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-muted-foreground">
                {isAdmin
                  ? 'No team members found yet. Invite users to get started.'
                  : 'No profile information available.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50">
                    <TableHead className="font-semibold text-slate-700">Name</TableHead>
                    <TableHead className="font-semibold text-slate-700">Email</TableHead>
                    <TableHead className="font-semibold text-slate-700">Role</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedMembers.map((member) => (
                    <TableRow 
                      key={member.id}
                      className="hover:bg-purple-50/50 transition-colors border-b border-slate-100"
                    >
                      <TableCell className="font-medium text-slate-700">
                        {member.full_name || member.email || 'Unknown'}
                      </TableCell>
                      <TableCell className="text-slate-600">
                        {member.email || '—'}
                      </TableCell>
                      <TableCell>
                        <RoleBadge role={member.role} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
        {filteredMembers.length > pageSize && (
          <div className="border-t border-slate-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-500">
                0 of {filteredMembers.length} row(s) selected.
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <span>Rows per page</span>
                  <Select 
                    value={pageSize.toString()} 
                    onValueChange={(value) => {
                      setPageSize(parseInt(value))
                      setPage(0) // Reset to first page when changing page size
                    }}
                  >
                    <SelectTrigger className="w-[70px] h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page === 0 || loading}
                    className="h-8"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <span className="px-3 py-1 text-sm text-slate-700 bg-purple-50 rounded">
                    {page + 1}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page + 1 >= totalPages || loading}
                    className="h-8"
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>

    
    </div>
  )
}
