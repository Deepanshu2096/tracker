import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useActivityLogStore, type ActivityLog } from '@/store/activityLogStore'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Eye, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const formatDateTime = (value: string | null) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

const metadataPreview = (metadata: Record<string, unknown> | null) => {
  if (!metadata || Object.keys(metadata).length === 0) return '—'
  try {
    const preview = JSON.stringify(metadata)
    return preview.length > 50 ? preview.substring(0, 50) + '...' : preview
  } catch {
    return '—'
  }
}

const formatMetadata = (metadata: Record<string, unknown> | null) => {
  if (!metadata || Object.keys(metadata).length === 0) return null
  return metadata
}

export default function ActivityLogs() {
  const { user } = useAuth()
  const [hasFetched, setHasFetched] = useState(false)
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [actionFilter, setActionFilter] = useState<string>('all')

  const {
    logs,
    profilesDirectory,
    loading,
    error,
    page,
    total,
    pageSize,
    getActivityLogs,
    getProfiles,
    setPage,
    setPageSize,
  } = useActivityLogStore()

  // Fetch data when component mounts or page changes
  useEffect(() => {
    if (!user) {
      return
    }

    // Only fetch once on mount or when page changes
    const fetchData = async () => {
      try {
        setHasFetched(true)
        // Fetch profiles first
        await getProfiles()
        // Then fetch activity logs with current page and pageSize
        await getActivityLogs({ page, pageSize: pageSize || 10 })
      } catch (error) {
        console.error('Error fetching activity logs:', error)
      }
    }

    fetchData()
    // Only depend on user id, page, and pageSize - not the functions
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, page, pageSize])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize])

  // Get unique actions for filter dropdown
  const uniqueActions = useMemo(() => {
    const actions = new Set(logs.map((log) => log.action))
    return Array.from(actions).sort()
  }, [logs])

  const handlePageChange = (newPage: number) => {
    if (newPage < 0 || newPage >= totalPages) return
    setPage(newPage)
  }

  const handleViewDetails = (log: ActivityLog) => {
    setSelectedLog(log)
    setIsDialogOpen(true)
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 py-10 px-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-slate-800">Activity Logs</h1>
        <p className="text-sm text-slate-500">
          Every session, break, and administrative override is captured here. Use filters and pagination to review history.
        </p>
      </header>

      <div className="space-y-6">


        <Card className="border border-slate-200 shadow-lg">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between mb-4">
              <CardTitle className="text-lg font-semibold">Activity Logs</CardTitle>
              <div className="text-sm text-slate-500">
                Showing {logs.length > 0 ? ((page * pageSize) + 1) : 0} to {Math.min((page + 1) * pageSize, total)} of {total} results
              </div>
            </div>
            
            {/* Search and Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search by actor, action, or details..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  {uniqueActions.map((action) => (
                    <SelectItem key={action} value={action}>
                      {action.replace(/_/g, ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
          {(!hasFetched || (loading && logs.length === 0)) && !error ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-purple-600)] mb-2"></div>
            <p className="text-sm text-slate-500">Loading activity logs…</p>
            </div>
          ) : error ? (
            <div className="space-y-2">
              <p className="text-sm text-destructive font-medium">Error: {error}</p>
              {error.includes('relation') || error.includes('does not exist') || error.includes('table') ? (
                <p className="text-xs text-muted-foreground">
                  The activity_logs table may not exist in the database. Please create it or contact your administrator.
                </p>
              ) : null}
            </div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-muted-foreground">No activity logs found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50">
                    <TableHead className="font-semibold text-slate-700">Time</TableHead>
                    <TableHead className="font-semibold text-slate-700">Actor</TableHead>
                    <TableHead className="font-semibold text-slate-700">Action</TableHead>
                    <TableHead className="font-semibold text-slate-700">Target</TableHead>
                    <TableHead className="font-semibold text-slate-700">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log: ActivityLog) => {
                  const actor = log.actor_id ? profilesDirectory[log.actor_id] : null
                  const target = log.target_user_id ? profilesDirectory[log.target_user_id] : null

                  return (
                    <TableRow 
                      key={log.id}
                      className="cursor-pointer hover:bg-purple-50/50 transition-colors border-b border-slate-100"
                      onClick={() => handleViewDetails(log)}
                    >
                      <TableCell>{formatDateTime(log.created_at)}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-700">
                            {actor?.email ?? 'System'}
                          </span>
                          {actor?.role && (
                            <span className="text-xs text-slate-400 capitalize">{actor.role}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize bg-purple-100 text-purple-700 hover:bg-purple-200">
                          {log.action.replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {target?.email ?? '—'}
                        {target?.role && (
                          <span className="text-xs text-slate-400 ml-2 capitalize">({target.role})</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                         
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleViewDetails(log)
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          </CardContent>
          {total > pageSize && (
            <div className="border-t border-slate-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-slate-500">
                  0 of {total} row(s) selected.
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <span>Rows per page</span>
                    <Select 
                      value={pageSize.toString()} 
                      onValueChange={(value) => {
                        setPageSize(parseInt(value))
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

      {/* Details Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] bg-gradient-to-br from-purple-50 to-purple-50/50 border-purple-200">
          <DialogHeader className="bg-white/50 rounded-lg p-4 -mx-2">
            <DialogTitle className="text-slate-800">Activity Log Details</DialogTitle>
            <DialogDescription className="text-slate-600">
              Complete information about this activity log entry
            </DialogDescription>
          </DialogHeader>
          
          {selectedLog && (
            <div className="max-h-[60vh] overflow-y-auto pr-4 space-y-4">
              {/* ID */}
              <div className="grid grid-cols-[120px_1fr] gap-4 text-sm">
                <span className="font-medium text-slate-500">Log ID:</span>
                <span className="text-slate-700 font-mono text-xs break-all">{selectedLog.id}</span>
              </div>

              {/* Timestamp */}
              <div className="grid grid-cols-[120px_1fr] gap-4 text-sm">
                <span className="font-medium text-slate-500">Timestamp:</span>
                <span className="text-slate-700">{formatDateTime(selectedLog.created_at)}</span>
              </div>

              {/* Actor */}
              <div className="grid grid-cols-[120px_1fr] gap-4 text-sm">
                <span className="font-medium text-slate-500">Actor:</span>
                <div className="space-y-1">
                  {selectedLog.actor_id ? (
                    <>
                      <div className="font-medium text-slate-700">
                        {profilesDirectory[selectedLog.actor_id]?.email ?? 'Unknown User'}
                      </div>
                      {profilesDirectory[selectedLog.actor_id]?.role && (
                        <Badge variant="secondary" className="capitalize bg-purple-100 text-purple-700 hover:bg-purple-200">
                          {profilesDirectory[selectedLog.actor_id]?.role}
                        </Badge>
                      )}
                      <div className="text-xs text-slate-400 font-mono break-all">{selectedLog.actor_id}</div>
                    </>
                  ) : (
                    <span className="text-slate-500 italic">System</span>
                  )}
                </div>
              </div>

              {/* Action */}
              <div className="grid grid-cols-[120px_1fr] gap-4 text-sm">
                <span className="font-medium text-slate-500">Action:</span>
                <Badge variant="secondary" className="capitalize w-fit bg-purple-100 text-purple-700 hover:bg-purple-200">
                  {selectedLog.action.replace(/_/g, ' ')}
                </Badge>
              </div>

              {/* Target User */}
              {selectedLog.target_user_id && (
                <div className="grid grid-cols-[120px_1fr] gap-4 text-sm">
                  <span className="font-medium text-slate-500">Target User:</span>
                  <div className="space-y-1">
                    <div className="font-medium text-slate-700">
                      {profilesDirectory[selectedLog.target_user_id]?.email ?? 'Unknown User'}
                    </div>
                    {profilesDirectory[selectedLog.target_user_id]?.role && (
                      <Badge variant="outline" className="capitalize">
                        {profilesDirectory[selectedLog.target_user_id]?.role}
                      </Badge>
                    )}
                    <div className="text-xs text-slate-400 font-mono break-all">{selectedLog.target_user_id}</div>
                  </div>
                </div>
              )}

              {/* Metadata */}
              <div className="grid grid-cols-[120px_1fr] gap-4 text-sm">
                <span className="font-medium text-slate-500">Metadata:</span>
                <div className="space-y-2">
                  {formatMetadata(selectedLog.metadata) ? (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <pre className="text-xs overflow-x-auto whitespace-pre-wrap break-words">
                        {JSON.stringify(selectedLog.metadata, null, 2)}
                      </pre>
                    </div>
                  ) : (
                    <span className="text-slate-400 italic">No metadata available</span>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}


