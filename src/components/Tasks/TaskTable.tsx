import React, { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { AlertCircle, ArrowUpDown, ChevronDown, Edit, Eye, FileText, MoreHorizontal, Play, RefreshCw, Trash2, X } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '../ui/pagination';
import { useTaskStore } from '@/store/taskStore';
import { Checkbox } from '../ui/checkbox';
import type { Task } from '@/types/Tasks.ts';
import { flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable, type ColumnDef, type ColumnFiltersState, type SortingState, type VisibilityState } from '@tanstack/react-table';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { toast } from 'sonner';
import { useTeamStore } from '@/store/teamStore';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate, useParams } from 'react-router-dom';

function TaskTable({populateTasks}: { populateTasks: (task: Task) => void }) {
  const {
    tasks,
    loading,
    error,
    deleteTask,
    updateTask,
    getTasks,
    pagination,
    activeFilters,
    setStatusFilter,
    setDateFilter,
    setSkipFilter,
    clearFilters
  } = useTaskStore();
  const { profiles, getProfiles } = useTeamStore();
  const { projectId, batchId } = useParams<{ projectId: string | undefined; batchId: string | undefined}>();
  const { user, userRole } = useAuth();
  const [statusUpdateLoading, setStatusUpdateLoading] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const navigate = useNavigate();

  // Fetch tasks when component mounts or batchId or projectId changes
  useEffect(() => {
    if (projectId) {
      getTasks(undefined, { page: pagination.page, pageSize: pagination.pageSize }, userRole || undefined, user?.id, projectId);
    }
    if (batchId) {
      getTasks(batchId, { page: pagination.page, pageSize: pagination.pageSize }, userRole || undefined, user?.id, projectId);
    }

  }, [batchId, activeFilters, projectId]);


  // Define columns for TanStack Table
  const columns: ColumnDef<Task>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "id",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Task ID
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        const taskId = row.getValue("id") as string;
        return (
          <div className="font-mono text-sm">
            {taskId.slice(0, 8)}...
          </div>
        );
      },
    },
    {
      accessorKey: "type",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Task Type
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => (
        <div className="font-medium">{row.getValue("type")}</div>
      ),
    },
    {
      accessorKey: "batch_name",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Batch Name
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        const task = row.original;
        return <div className="font-medium">{task?.batches?.name}</div>;
      },
       // Hide the batch_name if we are looking at selected batch tasks
       meta: {
        hidden: batchId !== undefined
      } as any
    },
    {
      accessorKey: "skip_count",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Skip Count
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        const task = row.original;
        return (
          <div className="flex justify-center">
            {task.skip_count && task.skip_count > 0 ? (
              <Badge variant="secondary" className="text-xs">
                {task.skip_count}
              </Badge>
            ) : (
              <span className="text-gray-400 text-xs">0</span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "status",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Status
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        const task = row.original;
        const status = row.getValue("status") as string;
        return getStatusBadge(status)
      },
    },
    {
      accessorKey: "assigned_user",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Assigned User
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        const task = row.original;
        const isLoading = statusUpdateLoading === task.id;

        const assignedUser = task.profiles?.email || 'Unassigned';
        const displayName = task.profiles?.name || assignedUser;

        return (
          <div className="flex items-center space-x-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-blue-100 text-blue-600">
                {displayName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <Select
              value={task.assigned_user ?? 'unassigned'}
              onValueChange={(value) => handleAssignedUserUpdate(task.id, value === 'unassigned' ? undefined : value)}
              disabled={isLoading}
            >
              <SelectTrigger className="w-40 h-8">
                <SelectValue placeholder="Assign user" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={'unassigned'}>Unassigned</SelectItem>
                {profiles.map((profile) => (
                  <SelectItem key={profile.id} value={profile.user_id}>
                    {profile.name || profile.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      },
      // Hide the assigned_user column for annotators
      meta: {
        hidden: userRole === 'annotator'
      } as any
    },
    // {
    //   accessorKey: "timeSpent",
    //   header: "Time Spent",
    //   cell: ({ row }) => {
    //     const task = row.original;
    //     const timeSpent = calculateTimeSpent(task);
    //     return (
    //       <span className="text-sm text-gray-600">
    //         {timeSpent ? `${timeSpent} min` : 'N/A'}
    //       </span>
    //     );
    //   },
    // },
    {
      accessorKey: "created_at",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Created
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        const date = new Date(row.getValue("created_at"));
        return (
          <div className="text-sm text-gray-600">
            {date.toLocaleDateString()}
          </div>
        );
      },
    },
    {
      id: "statusActions",
      header: "Status Actions",
      cell: ({ row }) => {
        const task = row.original;
        const isLoading = statusUpdateLoading === task.id;

        return (
          <div className="flex justify-center">
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                navigate(`/projects/${projectId}/batches/${task.batch_id}/tasks/${task.id}`);
              }}
              disabled={isLoading}
              className="text-yellow-600 border-yellow-600 hover:bg-yellow-50"
            >
              {isLoading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Start
            </Button>
          </div>
        );
      },
    },
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => {
        const task = row.original;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => navigate(`/projects/${projectId}/batches/${batchId}/tasks/${task.id}`)}>
                <Eye className="mr-2 h-4 w-4" />
                View Task
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigate(`/projects/${projectId}/batches/${batchId}/tasks/${task.id}`)}
              >

              </DropdownMenuItem>
              {userRole !== 'annotator' && (
                <DropdownMenuItem
                  onClick={() => {populateTasks(task)
                  }}
                  disabled={task.status === 'ready_for_delivery'}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Task
                </DropdownMenuItem>
              )}
              {userRole !== 'annotator' && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      if (confirm('Are you sure you want to delete this task? This action cannot be undone.')) {
                        handleDelete(task.id);
                      }
                    }}
                    className="text-red-600 focus:text-red-600"
                    disabled={task.status === 'ready_for_delivery'}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Task
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ];

  // Memoize the table instance to prevent recreation
  const table = useReactTable({
    data: tasks || [],
    columns: columns.filter(column => {
      // Filter out columns that should be hidden based on user role
      if ((column.meta as any)?.hidden) {
        return false;
      }
      return true;
    }),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,

    manualPagination: true,
    pageCount: pagination.totalPages,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      pagination: {
        pageIndex: pagination.page - 1, // TanStack use 0-based indexing
        pageSize: pagination.pageSize,
      },
    },
    onPaginationChange: (updater) => {
      const newPagination = typeof updater === 'function' ? updater({
        pageIndex: pagination.page - 1,
        pageSize: pagination.pageSize,
      }) : updater;

      // Fetch new data with updated pagination
      if (batchId || projectId) {
        getTasks(batchId, {
          page: newPagination.pageIndex + 1,
          pageSize: newPagination.pageSize,
        }, userRole || undefined, user?.id, projectId);
      }
    },
  });

  const getStatusBadge = useCallback((status: string) => {
    const statusMap = {
      'available': { variant: 'secondary' as const, className: 'bg-gray-200 text-black hover:gray-200' },
      'needs_review': { variant: 'secondary' as const, className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100' },
      'ready_for_delivery': { variant: 'default' as const, className: 'bg-green-100 text-green-800 hover:bg-green-100' },
      'rejected': { variant: 'destructive' as const, className: 'bg-red-100 text-red-800 hover:bg-red-100' }
    };
    const config = statusMap[status as keyof typeof statusMap] || statusMap.needs_review;
    return (
      <Badge variant={config.variant} className={config.className}>
        {status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
      </Badge>
    );
  }, []);

  // Memoize the handleAssignedUserUpdate function
  const handleAssignedUserUpdate = useCallback(async (taskId: string, assignedUserId: string | undefined) => {
      setStatusUpdateLoading(taskId);
      try {
        await updateTask(taskId, { assigned_user: assignedUserId || null });
        toast.success('Assigned user updated successfully!');
      } catch (error) {
        toast.error('Failed to update assigned user. Please try again.');
      } finally {
        setStatusUpdateLoading(null);
      }
    }, [updateTask]);

  // Memoize the handleDelete function
  const handleDelete = useCallback(async (taskId: string) => {
    try {
      await deleteTask(taskId);
      toast.success('Task deleted successfully!');
    } catch (error) {
      toast.error('Failed to delete task. Please try again.');
    }
  }, [deleteTask]);

  // Memoize the page size change handler
  const handlePageSizeChange = useCallback((value: string) => {
    const newPageSize = Number(value);
    if (batchId || projectId) {
      getTasks(batchId, { page: 1, pageSize: newPageSize }, userRole || undefined, user?.id, projectId);
    }
  }, [batchId, projectId, getTasks, userRole, user?.id, activeFilters]);

   // Memoize the pagination change handler
   const handlePaginationChange = useCallback((newPage: number) => {
    if (batchId || projectId) {
      getTasks(batchId, { page: newPage, pageSize: pagination.pageSize }, userRole || undefined, user?.id, projectId);
    }
  }, [batchId, projectId, getTasks, pagination.pageSize, userRole, user?.id, activeFilters]);


  return (
    <Card className='gap-2'>
      <CardHeader>
        <CardTitle className='text-2xl font-bold'>Tasks</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            <span className="ml-2 text-gray-600">Loading tasks...</span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-12 text-red-600">
            <AlertCircle className="w-5 h-5 mr-2" />
            Failed to load tasks.
          </div>
        ) : (
          <div className="w-full">
            <>
              {
                (activeFilters.status || activeFilters.date || activeFilters.skip !== null) && (
                  <div className="flex flex-wrap gap-2 mb-4 p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-600 font-medium">Active filters:</span>
                    <>
                      {activeFilters.status && (
                        <Badge variant="secondary" className="text-xs">
                          Status: {activeFilters.status.replace('_', ' ')}
                          <button
                            onClick={() => setStatusFilter(null)}
                            className="ml-1 hover:text-red-500"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      )}
                      {activeFilters.date && (
                        <Badge variant="secondary" className="text-xs">
                          Date: {activeFilters.date}
                          <button
                            onClick={() => setDateFilter(null)}
                            className="ml-1 hover:text-red-500"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      )}
                      {activeFilters.skip !== null && (
                        <Badge variant="secondary" className="text-xs">
                          Skip: {activeFilters.skip ? 'Skipped Only' : 'Hide Skipped'}
                          <button
                            onClick={() => setSkipFilter(null)}
                            className="ml-1 hover:text-red-500"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          clearFilters();
                        }}
                        className="h-6 text-xs ml-auto"
                      >
                        Clear All
                      </Button>
                    </>
                  </div>
                )}
            </>

            {/* Search and Filter Controls */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pb-4">
              

              {/* Date Filter */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-9">
                    Date <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Filter by Date</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={!activeFilters.date}
                    onCheckedChange={() => {
                      setDateFilter(null);
                    }}
                  >
                    All Time
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={activeFilters.date === "7days"}
                    onCheckedChange={() => {
                      setDateFilter("7days");
                    }}
                  >
                    Last 7 Days
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={activeFilters.date === "15days"}
                    onCheckedChange={() => {
                      setDateFilter("15days");
                    }}
                  >
                    Last 15 Days
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={activeFilters.date === "30days"}
                    onCheckedChange={() => {
                      setDateFilter("30days");
                    }}
                  >
                    Last 30 Days
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={activeFilters.date === "90days"}
                    onCheckedChange={() => {
                      setDateFilter("90days");
                    }}
                  >
                    Last 90 Days
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Status Filter */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-9">
                    Status <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={!activeFilters.status}
                    onCheckedChange={() => {
                      setStatusFilter(null);
                    }}
                  >
                    All Statuses
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={activeFilters.status === "needs_review"}
                    onCheckedChange={() => {
                      setStatusFilter("needs_review");
                    }}
                  >
                    Needs Review
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={activeFilters.status === "available"}
                    onCheckedChange={() => {
                      setStatusFilter("available");
                    }}
                  >
                    Available
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={activeFilters.status === "ready_for_delivery"}
                    onCheckedChange={() => {
                      setStatusFilter("ready_for_delivery");
                    }}
                  >
                    Ready for Delivery
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={activeFilters.status === "rejected"}
                    onCheckedChange={() => {
                      setStatusFilter("rejected");
                    }}
                  >
                    Rejected
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Skip Filter */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-9">
                    Skip Status <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Filter by Skip Status</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={activeFilters.skip === null}
                    onCheckedChange={() => {
                      setSkipFilter(null);
                    }}
                  >
                    All Tasks
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={activeFilters.skip === true}
                    onCheckedChange={() => {
                      setSkipFilter(true);
                    }}
                  >
                    Show Skipped Only
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={activeFilters.skip === false}
                    onCheckedChange={() => {
                      setSkipFilter(false);
                    }}
                  >
                    Hide Skipped Tasks
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Column Visibility */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-9">
                    Columns <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {table
                    .getAllColumns()
                    .filter((column) => column.getCanHide())
                    .map((column) => {
                      return (
                        <DropdownMenuCheckboxItem
                          key={column.id}
                          className="capitalize"
                          checked={column.getIsVisible()}
                          onCheckedChange={(value) =>
                            column.toggleVisibility(!!value)
                          }
                        >
                          {column.id}
                        </DropdownMenuCheckboxItem>
                      )
                    })}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-md border">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => {
                        return (
                          <TableHead key={header.id}>
                            {header.isPlaceholder
                              ? null
                              : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                          </TableHead>
                        )
                      })}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows?.length ? (
                    table.getRowModel().rows.map((row) => (
                      <TableRow
                        key={row.id}
                        data-state={row.getIsSelected() && "selected"}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={columns.length}
                        className="h-24 text-center"
                      >
                        <div className="text-center py-12">
                          <FileText className="mx-auto h-12 w-12 text-gray-400" />
                          <h3 className="mt-2 text-sm font-medium text-gray-900">No tasks found</h3>
                          <p className="mt-1 text-sm text-gray-500">
                            Get started by creating a new task.
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>


            {/* Enhanced Pagination and Selection Info */}
            <div className="flex items-center justify-between space-x-2 py-4">
              <div className="flex items-center space-x-6">
                <div className="text-sm text-gray-700">
                  {table.getFilteredSelectedRowModel().rows.length} of{" "}
                  {pagination.total} row(s) selected.
                </div>

                {/* Page Size Selection */}
                <div className="flex items-center space-x-2">
                  <p className="text-sm font-medium">Rows per page</p>
                  <Select
                    value={`${pagination.pageSize}`}
                    onValueChange={handlePageSizeChange}
                  >
                    <SelectTrigger className="h-8 w-[70px]">
                      <SelectValue placeholder={pagination.pageSize} />
                    </SelectTrigger>
                    <SelectContent side="top">
                      {[10, 20, 30, 40, 50].map((pageSize) => (
                        <SelectItem key={pageSize} value={`${pageSize}`}>
                          {pageSize}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Shadcn Pagination Component */}
              {pagination.totalPages > 1 && (
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          if (pagination.page > 1) {
                            handlePaginationChange(pagination.page - 1);
                          }
                        }}
                        className={pagination.page <= 1 ? "pointer-events-none opacity-50" : ""}
                      />
                    </PaginationItem>

                    {/* Page Numbers */}
                    {(() => {
                      const pageCount = pagination.totalPages;
                      const currentPage = pagination.page;
                      const pages = [];

                      // Always show first page
                      if (pageCount > 0) {
                        pages.push(
                          <PaginationItem key={0}>
                            <PaginationLink
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                handlePaginationChange(1);
                              }}
                              isActive={currentPage === 1}
                            >
                              1
                            </PaginationLink>
                          </PaginationItem>
                        );
                      }

                      // Show ellipsis if needed
                      if (currentPage > 3) {
                        pages.push(
                          <PaginationItem key="ellipsis1">
                            <PaginationEllipsis />
                          </PaginationItem>
                        );
                      }

                      // Show pages around current page
                      for (let i = Math.max(2, currentPage - 1); i <= Math.min(pageCount - 1, currentPage + 1); i++) {
                        if (i > 1 && i < pageCount) {
                          pages.push(
                            <PaginationItem key={i - 1}>
                              <PaginationLink
                                href="#"
                                onClick={(e) => {
                                  e.preventDefault();
                                  handlePaginationChange(i);
                                }}
                                isActive={currentPage === i}
                              >
                                {i}
                              </PaginationLink>
                            </PaginationItem>
                          );
                        }
                      }

                      // Show ellipsis if needed
                      if (currentPage < pageCount - 2) {
                        pages.push(
                          <PaginationItem key="ellipsis2">
                            <PaginationEllipsis />
                          </PaginationItem>
                        );
                      }

                      // Always show last page if there's more than one page
                      if (pageCount > 1) {
                        pages.push(
                          <PaginationItem key={pageCount - 1}>
                            <PaginationLink
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                handlePaginationChange(pageCount);
                              }}
                              isActive={currentPage === pageCount}
                            >
                              {pageCount}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      }

                      return pages;
                    })()}

                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          if (pagination.page < pagination.totalPages) {
                            handlePaginationChange(pagination.page + 1);
                          }
                        }}
                        className={pagination.page >= pagination.totalPages ? "pointer-events-none opacity-50" : ""}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default TaskTable