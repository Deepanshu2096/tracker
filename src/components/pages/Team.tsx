import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ROUTES_FRONTEND } from '@/constant'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'

type TeamMember = {
  id: string
  full_name: string | null
  email: string | null
  role: string | null
}

const getInitials = (name: string | null | undefined, email: string | null | undefined) => {
  if (name) {
    const parts = name.split(' ').filter(Boolean)
    return parts.slice(0, 2).map(part => part[0]?.toUpperCase() ?? '').join('')
  }
  if (email) {
    return email.slice(0, 2).toUpperCase()
  }
  return 'AN'
}

const rolePillClasses: Record<string, string> = {
  admin: 'bg-rose-100 text-rose-600 border border-rose-200',
  manager: 'bg-sky-100 text-sky-600 border border-sky-200',
  reviewer: 'bg-emerald-100 text-emerald-600 border border-emerald-200',
  annotator: 'bg-amber-100 text-amber-600 border border-amber-200',
}

const RoleBadge = ({ role }: { role: string | null }) => {
  if (!role) return null
  const classes = rolePillClasses[role] || 'bg-slate-100 text-slate-600 border border-slate-200'
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
  const navigate = useNavigate()

  const isAdmin = userRole === 'admin'

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

  useEffect(() => {
    if (!loading && !isAdmin) {
      navigate(ROUTES_FRONTEND.TIME_TRACKING, { replace: true })
    }
  }, [loading, isAdmin, navigate])

  const admins = useMemo(
    () => members.filter(member => member.role === 'admin'),
    [members]
  )

  const teammates = useMemo(
    () => members.filter(member => member.role !== 'admin'),
    [members]
  )

  if (!isAdmin) {
    return null
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-10 py-10 px-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">
          People &amp; Culture
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-primary">
          Meet the Anvesana Team
        </h1>
        <p className="text-sm text-muted-foreground max-w-xl">
          A snapshot of everyone in your workspace. Roles and access levels are pulled directly from Supabase profiles.
        </p>
      </header>

      {loading ? (
        <div className="rounded-xl border border-dashed border-muted-foreground/30 bg-muted/50 p-6 text-sm text-muted-foreground">
          Loading team members…
        </div>
      ) : error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-sm text-destructive">
          {error}
        </div>
      ) : (
        <>
          {isAdmin && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Admin Panel
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {admins.length === 0 ? (
                  <p className="col-span-full text-sm text-muted-foreground">
                    No admins yet. Promote a teammate to give them full visibility.
                  </p>
                ) : (
                  admins.map(member => (
                    <Card key={member.id} className="border border-rose-100 shadow-sm">
                      <CardHeader className="flex flex-row items-center gap-3 pb-2">
                        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-rose-100 text-rose-600 font-semibold">
                          {getInitials(member.full_name, member.email)}
                        </div>
                        <div>
                          <CardTitle className="text-base font-semibold">
                            {member.full_name || member.email || 'Admin'}
                          </CardTitle>
                          <CardDescription>{member.email}</CardDescription>
                        </div>
                      </CardHeader>
                      <CardContent className="flex flex-col gap-3 pt-0">
                        <RoleBadge role={member.role} />
                        <p className="text-xs text-muted-foreground">
                          Can view and manage all sessions, breaks, and activity logs.
                        </p>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </section>
          )}

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              {isAdmin ? 'Team Members' : 'Your Profile'}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {(isAdmin ? teammates : members).length === 0 ? (
                <p className="col-span-full text-sm text-muted-foreground">
                  {isAdmin
                    ? 'No team members found yet. Invite users to get started.'
                    : 'No additional details available for your profile.'}
                </p>
              ) : (
                (isAdmin ? teammates : members).map(member => (
                  <Card key={member.id} className="border-muted shadow-sm">
                    <CardHeader className="flex flex-row items-center gap-3 pb-2">
                      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary font-semibold">
                        {getInitials(member.full_name, member.email)}
                      </div>
                      <div>
                        <CardTitle className="text-base font-semibold">
                          {member.full_name || member.email || 'Teammate'}
                        </CardTitle>
                        <CardDescription>{member.email}</CardDescription>
                      </div>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3 pt-0">
                      <RoleBadge role={member.role} />
                      <p className="text-xs text-muted-foreground">
                        {member.role === 'annotator'
                          ? 'Tracks sessions and breaks throughout the workday.'
                          : member.role === 'reviewer'
                          ? 'Reviews and verifies completed tasks.'
                          : member.role === 'manager'
                          ? 'Oversees productivity and workload.'
                          : member.role === 'admin'
                          ? 'Full access to analytics and settings.'
                          : 'Team member'}
                      </p>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </section>
        </>
      )}

      {isAdmin && (
        <footer className="rounded-xl border border-dashed border-muted-foreground/30 bg-muted/50 p-6 space-y-2">
          <h3 className="text-lg font-semibold text-primary">Manage access</h3>
          <p className="text-sm text-muted-foreground">
            Admins can promote or demote teammates by updating the <code>role</code> column in Supabase.
            The team page updates automatically based on profile roles.
          </p>
        </footer>
      )}
    </div>
  )
}
