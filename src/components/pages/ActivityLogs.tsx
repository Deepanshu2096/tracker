import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

type ActivityLogRow = {
  id: string
  actor_id: string | null
  target_user_id: string | null
  action: string
  metadata: Record<string, unknown> | null
  created_at: string
}

const formatDateTime = (value: string | null) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

const metadataPreview = (metadata: Record<string, unknown> | null) => {
  if (!metadata || Object.keys(metadata).length === 0) return '—'
  try {
    return JSON.stringify(metadata)
  } catch {
    return '—'
  }
}

const PAGE_SIZE = 20

export default function ActivityLogs() {
  const { user, userRole } = useAuth()
  const isAdmin = userRole === 'admin'

  const [logs, setLogs] = useState<ActivityLogRow[]>([])
  const [totalLogs, setTotalLogs] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [profilesDirectory, setProfilesDirectory] = useState<Record<string, { full_name: string | null; email: string | null }>>({})

  useEffect(() => {
    const fetchData = async () => {
      if (!user || !isAdmin) return

      setLoading(true)
      setError(null)

      try {
        const [profilesRes, logsRes] = await Promise.all([
          supabase
            .from('profiles')
            .select('id, full_name, email'),
          supabase
            .from('activity_logs')
            .select('id, actor_id, target_user_id, action, metadata, created_at', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1),
        ])

        if (profilesRes.error) throw profilesRes.error
        if (logsRes.error) throw logsRes.error

        setProfilesDirectory(
          Object.fromEntries((profilesRes.data ?? []).map((item) => [item.id, { full_name: item.full_name, email: item.email }]))
        )

        setLogs(logsRes.data ?? [])
        setTotalLogs(logsRes.count ?? 0)
      } catch (fetchError) {
        const message =
          fetchError instanceof Error ? fetchError.message : 'Unable to load activity logs.'
        setError(message)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [user, isAdmin, page])

  useEffect(() => {
    if (!isAdmin && user) {
      setError('You must be an admin to view activity logs.')
    }
  }, [isAdmin, user])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(totalLogs / PAGE_SIZE)), [totalLogs])

  if (!isAdmin) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-4xl items-center justify-center px-6">
        <Card className="w-full border border-rose-200 bg-rose-50">
          <CardHeader>
            <CardTitle className="text-rose-600">Restricted Access</CardTitle>
            <CardDescription className="text-rose-500">
              Only administrators can view the activity logs.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 py-10 px-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Audit Trail</p>
        <h1 className="text-3xl font-semibold text-slate-800">Activity Logs</h1>
        <p className="text-sm text-slate-500">
          Every session, break, and administrative override is captured here. Use filters and pagination to review history.
        </p>
      </header>

      <Card className="border-none shadow-lg">
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>
            Showing the latest recorded events across all employees.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-slate-500">Loading activity logs…</p>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => {
                  const actor = log.actor_id ? profilesDirectory[log.actor_id] : null
                  const target = log.target_user_id ? profilesDirectory[log.target_user_id] : null

                  return (
                    <TableRow key={log.id}>
                      <TableCell>{formatDateTime(log.created_at)}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-700">
                            {actor?.full_name ?? actor?.email ?? 'System'}
                          </span>
                          {actor?.email && (
                            <span className="text-xs text-slate-400">{actor.email}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize">
                          {log.action.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {target?.full_name ?? target?.email ?? '—'}
                      </TableCell>
                      <TableCell className="max-w-[320px] truncate text-xs text-slate-500">
                        {metadataPreview(log.metadata)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
        {totalLogs > PAGE_SIZE && (
          <CardFooter className="flex items-center justify-between border-t border-slate-100 px-6 py-3 text-xs text-slate-500">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((prev) => Math.max(0, prev - 1))}
              disabled={page === 0 || loading}
            >
              Previous
            </Button>
            <span>
              Page {page + 1} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((prev) => (prev + 1 >= totalPages ? prev : prev + 1))}
              disabled={page + 1 >= totalPages || loading}
            >
              Next
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  )
}


