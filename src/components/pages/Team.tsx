import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 py-8 px-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-primary">
          Team Members
        </h1>
        <p className="text-sm text-muted-foreground">
          {isAdmin
            ? 'View and manage all team members in your workspace.'
            : 'View your profile information.'}
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Team</CardTitle>
          <CardDescription>
            {isAdmin
              ? `Total members: ${members.length}`
              : 'Your profile details'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              Loading team members…
            </div>
          ) : error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-6 text-sm text-destructive">
              {error}
            </div>
          ) : members.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              {isAdmin
                ? 'No team members found yet. Invite users to get started.'
                : 'No profile information available.'}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[30%]">Name</TableHead>
                    <TableHead className="w-[40%]">Email</TableHead>
                    <TableHead className="w-[30%]">Role</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">
                        {member.full_name || member.email || 'Unknown'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
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
      </Card>

      {isAdmin && (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>Manage Access</CardTitle>
            <CardDescription>
              Admins can promote or demote teammates by updating the <code>role</code> column in Supabase.
              The team page updates automatically based on profile roles.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  )
}
