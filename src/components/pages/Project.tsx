import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { object, string } from 'yup';
import { useToast } from '../../hooks/use-toast';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
} from "@tanstack/react-table";
import {
  Plus,
  Eye,
  Edit,
  Trash2,
  Users,
  FileText,
  Clock,
  AlertCircle,
  ArrowUpDown,
  ChevronDown,
  MoreHorizontal,
  X,
  Check
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

// Hooks and constants
import { useProjectStore } from '@/store/projectStore';
import { useTaskStore } from '@/store/taskStore';
import { useBatchStore } from '@/store/batchStore';
import { ROUTES_FRONTEND as ROUTES } from '@/constant';
import { useAuth } from '@/hooks/useAuth';
import { TaskTemplateEditor } from '@/components/ui/csv-config-editor';
import type { TaskTemplate } from '@/lib/fileIngestion/types';
import type { Tables } from '@/integrations/supabase/types';
import { calculateDailyThroughput } from '@/lib/metricsUtils';
import { supabase } from '@/integrations/supabase/client';

// Types
interface FormData {
  name: string;
  client: string;
  version_name: string;
  instructions?: string;
  reference_link?: string;
}

type Project = Tables<'projects'> & {
  profiles?: {
    email: string;
    name: string;
  };
};

const formSchema = object({
  name: string().required('Project Name is required'),
  client: string().required('Client is required'),
  version_name: string().required('Version name is required'),
  instructions: string().optional(),
  reference_link: string().optional(),
});

export default function Project() {
  const { toast } = useToast();
  const [openSheet, setOpenSheet] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  // Default task template for new projects
  const defaultTaskTemplate: TaskTemplate = {
    inputs: [
      {
        name: "fsn",
        type: "string",
        required: true,
        description: "Unique product identifier or SKU code"
      },
      {
        name: "vertical",
        type: "string",
        required: true,
        description: "Product category or business vertical"
      },
      {
        name: "vertical_description",
        type: "string",
        required: true,
        description: "Detailed description of the product vertical"
      },
      {
        name: "attrs",
        type: "string",
        required: true,
        description: "Product attributes in JSON format"
      },
      {
        name: "image_url_0",
        type: "image_url",
        required: false,
        description: "Primary product image URL"
      }
    ],
    outputs: [
      {
        name: "grade",
        description: "Grade or quality score for the product classification"
      }
    ],
    delimiter: ",",
    hasHeader: true,
    encoding: "utf-8",
    skipEmptyLines: true
  };

  const [taskTemplate, setTaskTemplate] = useState<TaskTemplate | null>(defaultTaskTemplate);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});
  const [searchType, setSearchType] = useState<'name' | 'client'>('name');
  const { user, orgId, userRole } = useAuth();



  const { projects, loading, error, pagination, deleteProject, createProject, updateProject, refreshProjects } = useProjectStore();
  const { batchMetrics, taskHistory } = useTaskStore();
  const { batches } = useBatchStore();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch
  } = useForm<FormData>({
    mode: 'onChange',
  });


  useEffect(() => {
    if (orgId) {
      useProjectStore.getState().getProjects(orgId);
      // Load projects

      // Load all batches for project-batch mapping
      useBatchStore.getState().getAllBatches(orgId!);
    }
  }, [orgId]);

  // Calculate ETA for each project
  const calculateETA = (project: Project) => {
    // Get all batches for this project
    const projectBatches = batches.filter(batch => batch.project_id === project.id);
    if (projectBatches.length === 0) return 'No batches';

    // Get batch metrics for all batches in this project
    const projectBatchMetrics = batchMetrics.filter(metric =>
      projectBatches.some(batch => batch.id === metric.batchId)
    );

    if (projectBatchMetrics.length === 0) return 'No data';

    // Calculate total pending tasks across all batches
    let totalPendingTasks = 0;
    let totalTasks = 0;
    let completedTasks = 0;

    projectBatchMetrics.forEach(metric => {
      const batchTotal = metric.totalTasks || 0;
      const batchCompleted = metric.completedTasks || 0;
      totalTasks += batchTotal;
      completedTasks += batchCompleted;
      totalPendingTasks += (batchTotal - batchCompleted);
    });

    if (totalPendingTasks <= 0) return 'Completed';

    // Calculate daily throughput
    const dailyThroughput = calculateDailyThroughput(taskHistory || []);
    if (dailyThroughput <= 0) return 'No throughput data';

    // Calculate ETA in days
    const etaDays = Math.ceil(totalPendingTasks / dailyThroughput);
    return `${etaDays} day${etaDays !== 1 ? 's' : ''}`;
  };

  const getStatusBadge = () => {
    return <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-100">Active</Badge>;
  };

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 80) return "text-green-600";
    if (accuracy >= 60) return "text-yellow-600";
    return "text-red-600";
  };


  const handleDelete = async (projectId: string) => {
    try {
      await deleteProject(projectId);
      toast({
        title: "Project Deleted",
        description: "Project has been successfully deleted.",
        variant: "default",
      });
    } catch (error) {
      toast({
        title: "Delete Failed",
        description: "Failed to delete project. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Validation function for task template
  const validateTaskTemplate = (template: TaskTemplate | null): string | null => {
    if (!template) {
      return "Task template is required";
    }
    if (!template.inputs || template.inputs.length === 0) {
      return "Task template must have at least one input column";
    }
    if (!template.outputs || template.outputs.length === 0) {
      return "Task template must have at least one output column";
    }
    return null;
  };

  const onSubmit = async (data: FormData) => {
    try {
      // Validate required fields
      if (!data.name?.trim()) {
        toast({
          title: "Validation Error",
          description: "Project name is required.",
          variant: "destructive",
        });
        return;
      }

      if (!data.client?.trim()) {
        toast({
          title: "Validation Error",
          description: "Client name is required.",
          variant: "destructive",
        });
        return;
      }

      if (!data.version_name?.trim()) {
        toast({
          title: "Validation Error",
          description: "Version name is required.",
          variant: "destructive",
        });
        return;
      }

      // Validate task template
      const templateError = validateTaskTemplate(taskTemplate);
      if (templateError) {
        toast({
          title: "Validation Error",
          description: templateError,
          variant: "destructive",
        });
        return;
      }

      if (editingProject) {
        // Update existing project
        const updatedProject = {
          id: editingProject.id,
          name: data.name,
          client: data.client,
          task_template: taskTemplate,
          version_name: data.version_name.trim(),
          instructions: data.instructions || '',
          reference_link: data.reference_link?.trim() || '',
        };

        await updateProject(updatedProject);
        toast({
          title: "Project Updated",
          description: "Project has been successfully updated.",
          variant: "default",
        });
      } else {
        // Create new project
        if (!orgId) {
          toast({
            title: "Validation Error",
            description: "Organization ID is required to create a project.",
            variant: "destructive",
          });
          return;
        }

        const newProject = {
          org_id: orgId,
          name: data.name,
          client: data.client,
          task_template: taskTemplate,
          version_name: data.version_name.trim(),
          instructions: data.instructions || '',
          reference_link: data.reference_link?.trim() || '',
          created_by: user?.id || '',
        };

        await createProject(newProject);
        toast({
          title: "New Project Created",
          description: `You have successfully created a new project named ${data.name}`,
          variant: "default",
        });
      }

      reset();
      setEditingProject(null);
      setTaskTemplate(defaultTaskTemplate);
      setOpenSheet(false);
    } catch (err) {
      console.error('Project operation failed:', err);
      toast({
        title: "Operation Failed",
        description: err instanceof Error ? err.message : "Something went wrong. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Define columns for TanStack Table
  const columns: ColumnDef<Project>[] = [
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
      accessorKey: "name",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Project Name
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        const project = row.original;
        const projectName = project.name || 'Unnamed Project';

        return (
          <div className="flex items-center space-x-3">
            <Avatar className="h-10 w-10 bg-purple-100">
              <AvatarFallback className="bg-purple-100 text-purple-600 font-medium">
                {projectName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <div
                className="font-medium text-gray-900 hover:text-purple-600 hover:underline cursor-pointer transition-colors"
                onClick={() => navigate(ROUTES.ALL_TASKS.replace(':projectId', project.id))}
              >
                {projectName}
              </div>
              <div className="text-sm text-gray-500">
                Project ID: {project.id}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "client",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Client
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => (
        <div className="flex items-center space-x-2">
          <Users className="w-4 h-4 text-gray-400" />
          <span>{row.getValue("client") || 'Unassigned'}</span>
        </div>
      ),
    },
    {
      accessorKey: "creator.email",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Created By
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        const creator = row.original.profiles;

        return (
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">
              {creator?.name || creator?.email || 'Unknown'}
            </span>
          </div>
        );
      },
    },


    {
      accessorKey: "eta",
      header: "ETA",
      cell: ({ row }) => {
        const project = row.original;
        const eta = calculateETA(project);
        return (
          <div className="flex items-center space-x-1">
            <Clock className="w-4 h-4 text-gray-400" />
            <span className="text-sm">{eta}</span>
          </div>
        );
      },
    },
    {
      accessorKey: "created_at",
      header: "Created",
      cell: ({ row }) => {
        const date = new Date(row.getValue("created_at"));
        return (
          <div className="text-sm text-gray-600">
            {date.toLocaleDateString()}
          </div>
        );
      },
      filterFn: (row, id, value) => {
        const createdAt = new Date(row.getValue("created_at"));
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - createdAt.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (value === "7days") return diffDays <= 7;
        if (value === "15days") return diffDays <= 15;
        if (value === "30days") return diffDays <= 30;
        if (value === "90days") return diffDays <= 90;
        return true;
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        return getStatusBadge();
      },
      filterFn: (row, id, value) => {
        const status = "Active";
        return value === status;
      },
    },
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => {
        const project = row.original;

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
              <Link to={ROUTES.BATCH.replace(':projectId', project.id)}>
                <DropdownMenuItem >
                  <Eye className="mr-2 h-4 w-4" />
                  View Project
                </DropdownMenuItem>
              </Link>
              {userRole !== 'annotator' && (
                <DropdownMenuItem
                  onClick={async () => {
                    setEditingProject(project);
                    setValue('name', project.name || '');
                    setValue('client', project.client || '');

                    // Load task template from history if project has template reference
                    if (project.task_template_id) {
                      try {
                        const template = await useTaskStore.getState().getTaskTemplateById(project.task_template_id);
                        setTaskTemplate(template?.task_template as TaskTemplate | null);
                        // Set the version name from the template history
                        setValue('version_name', template?.version_name || '');
                        // Set the instructions and reference link from the template history
                        setValue('instructions', template?.instructions || '');
                        setValue('reference_link', template?.reference_link || '');
                      } catch (error) {
                        console.error('Failed to load task template:', error);
                        setTaskTemplate(null);
                        setValue('version_name', '');
                        setValue('instructions', '');
                        setValue('reference_link', '');
                      }
                    } else {
                      setTaskTemplate(null);
                      setValue('version_name', '');
                      setValue('instructions', '');
                      setValue('reference_link', '');
                    }

                    setOpenSheet(true);
                  }}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Project
                </DropdownMenuItem>
              )}
              {userRole !== 'annotator' && (
                <>
                  <DropdownMenuSeparator />
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <DropdownMenuItem
                        onSelect={(e) => e.preventDefault()}
                        className="text-red-600 focus:text-red-600"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Project
                      </DropdownMenuItem>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Delete</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete this project? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(project.id)}
                          className="bg-red-600 hover:bg-red-700"
                          disabled={loading}
                        >
                          {loading ? 'Deleting...' : 'Delete'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ];

  // Initialize TanStack Table with server-side pagination
  const table = useReactTable({
    data: projects || [],
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    // Server-side pagination configuration
    manualPagination: true,
    pageCount: pagination.totalPages,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      pagination: {
        pageIndex: pagination.page - 1, // TanStack uses 0-based indexing
        pageSize: pagination.pageSize,
      },
    },
    onPaginationChange: (updater) => {
      const newPagination = typeof updater === 'function' ? updater({
        pageIndex: pagination.page - 1,
        pageSize: pagination.pageSize,
      }) : updater;

      // Fetch new data with updated pagination
      refreshProjects(orgId!, {
        page: newPagination.pageIndex + 1,
        pageSize: newPagination.pageSize,
      });
    },
  });

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-gray-900">All Projects</h1>
            <p className="text-gray-600">This screen helps you manage your annotation and tasks</p>
          </div>
          <div className="flex gap-3">
            {userRole !== 'annotator' && (
              <Sheet
                open={openSheet}
                onOpenChange={(open) => {
                  setOpenSheet(open);
                  if (!open) {
                    setEditingProject(null);
                    setTaskTemplate(null);
                    reset();
                  }
                }}
              >
                <SheetTrigger asChild>
                  <Button
                    className="bg-purple-600 hover:bg-purple-700"
                    onClick={() => {
                      setEditingProject(null);
                      setTaskTemplate(defaultTaskTemplate);
                      reset();
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Project
                  </Button>
                </SheetTrigger>
              <SheetContent className="w-[95vw] sm:w-[85vw] sm:max-w-none lg:w-[60vw] xl:w-[55vw] p-4 overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>{editingProject ? 'Update Project' : 'Create New Project'}</SheetTitle>
                </SheetHeader>
                <div className="mt-6">
                  <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="name">Project Name</Label>
                      <Input
                        id="name"
                        placeholder="Enter project name..."
                        {...register('name')}
                        className={errors.name ? 'border-red-500' : ''}
                      />
                      {errors.name && (
                        <p className="text-sm text-red-500">{errors.name.message?.toString()}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="client">Client Name</Label>
                      <Input
                        id="client"
                        placeholder="Enter client name..."
                        {...register('client')}
                        className={errors.client ? 'border-red-500' : ''}
                      />
                      {errors.client && (
                        <p className="text-sm text-red-500">{errors.client.message?.toString()}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="version_name">Template Version Name <span className="text-red-500">*</span></Label>
                      <Input
                        id="version_name"
                        placeholder="e.g., v1.0 - Initial Setup, Bug Fix - Validation Rules"
                        {...register('version_name')}
                        className={errors.version_name ? 'border-red-500' : ''}
                      />
                      {errors.version_name && (
                        <p className="text-sm text-red-500">{errors.version_name.message?.toString()}</p>
                      )}
                      <p className="text-xs text-gray-500">
                        Provide a meaningful name to track this template version
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="instructions">Annotation Instructions</Label>
                      <textarea
                        id="instructions"
                        placeholder="Enter detailed instructions for annotators working on tasks..."
                        {...register('instructions')}
                        className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                      {errors.instructions && (
                        <p className="text-sm text-red-500">{errors.instructions.message?.toString()}</p>
                      )}
                      <p className="text-xs text-gray-500">
                        Provide clear instructions that will be shown to annotators during the annotation process
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="reference_link">Reference Link</Label>
                      <Input
                        id="reference_link"
                        type="url"
                        placeholder="https://example.com/annotation-guidelines"
                        {...register('reference_link')}
                        className={errors.reference_link ? 'border-red-500' : ''}
                      />
                      {errors.reference_link && (
                        <p className="text-sm text-red-500">{errors.reference_link.message?.toString()}</p>
                      )}
                      <p className="text-xs text-gray-500">
                        Optional link to external documentation or guidelines for annotators
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div className="border-b pb-2">
                        <h3 className="text-lg font-medium text-gray-900">Task Template Configuration <span className="text-red-500">*</span></h3>
                        <p className="text-sm text-gray-500 mt-1">Configure how your CSV files should be validated and processed (Required)</p>
                      </div>
                      <TaskTemplateEditor
                        projectId={editingProject ? editingProject.id : 'new-project'}
                        projectName={editingProject ? editingProject.name || 'New Project' : 'New Project'}
                        initialTemplate={taskTemplate}
                        onSave={(template) => {
                          setTaskTemplate(template);
                          return Promise.resolve();
                        }}
                        disabled={loading}
                        inline={true}
                      />
                      {taskTemplate && validateTaskTemplate(taskTemplate) && (
                        <div className="text-sm text-red-500 mt-2">
                          {validateTaskTemplate(taskTemplate)}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-3 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setOpenSheet(false)}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={loading || !!validateTaskTemplate(taskTemplate) || !watch('name')?.trim() || !watch('client')?.trim() || !watch('version_name')?.trim()}
                        className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
                      >
                        {loading ? (editingProject ? 'Updating...' : 'Creating...') : (editingProject ? 'Update Project' : 'Create Project')}
                      </Button>
                    </div>
                  </form>
                </div>
              </SheetContent>
            </Sheet>
            )}
          </div>
        </div>

        {/* TanStack Table with built-in search and filters */}
        <Card className='gap-2'>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className='text-2xl font-bold'>Projects</CardTitle>
              <div className="text-sm text-gray-600">
                Showing {((pagination.page - 1) * pagination.pageSize) + 1} to {Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total} results
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                <span className="ml-2 text-gray-600">Loading projects...</span>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center py-12 text-red-600">
                <AlertCircle className="w-5 h-5 mr-2" />
                Failed to load projects.
              </div>
            ) : (
              <div className="w-full">
                <>
                  {
                    (table.getColumn("name")?.getFilterValue() ||
                      table.getColumn("client")?.getFilterValue() ||
                      table.getColumn("status")?.getFilterValue() ||
                      table.getColumn("created_at")?.getFilterValue()) && (
                      <div className="flex flex-wrap gap-2 mb-4 p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm text-gray-600 font-medium">Active filters:</span>
                        <>

                          {table.getColumn("name")?.getFilterValue() && (
                            <Badge variant="secondary" className="text-xs">
                              Project: "{table.getColumn("name")?.getFilterValue() as string}"
                              <button
                                onClick={() => table.getColumn("name")?.setFilterValue(undefined)}
                                className="ml-1 hover:text-red-500"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </Badge>
                          )}

                          {table.getColumn("client")?.getFilterValue() && (
                            <Badge variant="secondary" className="text-xs">
                              Client: "{table.getColumn("client")?.getFilterValue() as string}"
                              <button
                                onClick={() => table.getColumn("client")?.setFilterValue(undefined)}
                                className="ml-1 hover:text-red-500"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </Badge>
                          )}
                          {table.getColumn("status")?.getFilterValue() && (
                            <Badge variant="secondary" className="text-xs">
                              Status: {table.getColumn("status")?.getFilterValue() as string}
                              <button
                                onClick={() => table.getColumn("status")?.setFilterValue(undefined)}
                                className="ml-1 hover:text-red-500"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </Badge>
                          )}

                          {table.getColumn("created_at")?.getFilterValue() && (
                            <Badge variant="secondary" className="text-xs">
                              Date: {table.getColumn("created_at")?.getFilterValue() as string}
                              <button
                                onClick={() => table.getColumn("created_at")?.setFilterValue(undefined)}
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
                              table.resetColumnFilters()
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
                  {/* Global Search with Toggle */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <div className="relative flex-1 max-w-sm">
                        <Input
                          placeholder={`Search by ${searchType === 'name' ? 'project name' : 'client'}...`}
                          value={(table.getColumn(searchType)?.getFilterValue() as string) ?? ""}
                          onChange={(event) => {
                            // Clear the other search column first
                            if (searchType === 'name') {
                              table.getColumn("client")?.setFilterValue(undefined);
                              table.getColumn("name")?.setFilterValue(event.target.value);
                            } else {
                              table.getColumn("name")?.setFilterValue(undefined);
                              table.getColumn("client")?.setFilterValue(event.target.value);
                            }
                          }}
                          className="pr-20"
                        />
                        <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-16 text-xs px-1"
                              >
                                {searchType === 'name' ? 'Project' : 'Client'}
                                <ChevronDown className="ml-1 h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-32">
                              <DropdownMenuLabel>Search by</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => {
                                  setSearchType('name');
                                  // Clear client search when switching
                                  table.getColumn("client")?.setFilterValue(undefined);
                                }}
                                className={searchType === 'name' ? 'bg-accent' : ''}
                              >
                                <div className="flex items-center space-x-2">
                                  <span>Project Name</span>
                                  {searchType === 'name' && <Check className="h-3 w-3" />}
                                </div>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setSearchType('client');
                                  // Clear project name search when switching
                                  table.getColumn("name")?.setFilterValue(undefined);
                                }}
                                className={searchType === 'client' ? 'bg-accent' : ''}
                              >
                                <div className="flex items-center space-x-2">
                                  <span>Client</span>
                                  {searchType === 'client' && <Check className="h-3 w-3" />}
                                </div>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
                  </div>

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
                        checked={!table.getColumn("created_at")?.getFilterValue()}
                        onCheckedChange={() => {
                          table.getColumn("created_at")?.setFilterValue(undefined)
                        }}
                      >
                        All Time
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        checked={table.getColumn("created_at")?.getFilterValue() === "7days"}
                        onCheckedChange={() => {
                          table.getColumn("created_at")?.setFilterValue("7days")
                        }}
                      >
                        Last 7 Days
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        checked={table.getColumn("created_at")?.getFilterValue() === "15days"}
                        onCheckedChange={() => {
                          table.getColumn("created_at")?.setFilterValue("15days")
                        }}
                      >
                        Last 15 Days
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        checked={table.getColumn("created_at")?.getFilterValue() === "30days"}
                        onCheckedChange={() => {
                          table.getColumn("created_at")?.setFilterValue("30days")
                        }}
                      >
                        Last 30 Days
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        checked={table.getColumn("created_at")?.getFilterValue() === "90days"}
                        onCheckedChange={() => {
                          table.getColumn("created_at")?.setFilterValue("90days")
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
                        checked={!table.getColumn("status")?.getFilterValue()}
                        onCheckedChange={() => {
                          table.getColumn("status")?.setFilterValue(undefined)
                        }}
                      >
                        All Statuses
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        checked={table.getColumn("status")?.getFilterValue() === "Active"}
                        onCheckedChange={() => {
                          table.getColumn("status")?.setFilterValue("Active")
                        }}
                      >
                        Active
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        checked={table.getColumn("status")?.getFilterValue() === "Completed"}
                        onCheckedChange={() => {
                          table.getColumn("status")?.setFilterValue("Completed")
                        }}
                      >
                        Completed
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
                      {loading ? (
                        <TableRow>
                          <TableCell
                            colSpan={columns.length}
                            className="h-24 text-center"
                          >
                            <div className="flex items-center justify-center py-8">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                              <span className="ml-2 text-gray-600">Loading projects...</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : table.getRowModel().rows?.length ? (
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
                              <h3 className="mt-2 text-sm font-medium text-gray-900">No projects found</h3>
                              <p className="mt-1 text-sm text-gray-500">
                                Get started by creating a new project.
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
                        value={`${table.getState().pagination.pageSize}`}
                        onValueChange={(value) => {
                          table.setPageSize(Number(value))
                        }}
                      >
                        <SelectTrigger className="h-8 w-[70px]">
                          <SelectValue placeholder={table.getState().pagination.pageSize} />
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
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            table.previousPage();
                          }}
                          className={!table.getCanPreviousPage() ? "pointer-events-none opacity-50" : ""}
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
                                  table.setPageIndex(0);
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
                                    table.setPageIndex(i - 1);
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
                                  table.setPageIndex(pageCount - 1);
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
                            table.nextPage();
                          }}
                          className={!table.getCanNextPage() ? "pointer-events-none opacity-50" : ""}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}



export const Loader = async () => {

  // Load task history for throughput calculation
  await useTaskStore.getState().getTaskHistoryLast7Days();

  // Load batch task metrics for all projects efficiently
  const projectList = useProjectStore.getState().projects;
  const allBatches = useBatchStore.getState().batches;

  if (projectList.length > 0 && allBatches.length > 0) {
    // Get all batch IDs across all projects to make a single efficient call
    const allBatchIds = allBatches.map(batch => batch.id);
    await useTaskStore.getState().getBatchTaskMetricsForBatches(allBatchIds);
  }

  return null;
}