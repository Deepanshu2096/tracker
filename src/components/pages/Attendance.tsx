import { useEffect, useMemo, useState } from 'react';
import { Calendar, Clock, Users, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAttendanceStore } from '@/store/attendanceStore';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const Attendance = () => {
  const { toast } = useToast();
  
  const {
    attendanceData,
    loading,
    error,
    getAttendanceData,
    clearError,
  } = useAttendanceStore();

  // Default to last 30 days
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);

  const [startDate, setStartDate] = useState<string>(
    thirtyDaysAgo.toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState<string>(today.toISOString().split('T')[0]);

  useEffect(() => {
    if (startDate && endDate) {
      getAttendanceData(startDate, endDate);
    }
  }, [startDate, endDate, getAttendanceData]);

  // Show toast on error
  useEffect(() => {
    if (error) {
      toast({
        title: 'Error',
        description: error,
        variant: 'destructive',
      });
      clearError();
    }
  }, [error, toast, clearError]);

  // Calculate statistics
  const stats = useMemo(() => {
    let totalRecords = 0;
    let fullDays = 0;
    let halfDays = 0;

    attendanceData.forEach((day) => {
      day.employees.forEach((emp) => {
        totalRecords++;
        if (emp.status === 'full') {
          fullDays++;
        } else if (emp.status === 'half') {
          halfDays++;
        }
      });
    });

    return {
      totalRecords,
      fullDays,
      halfDays,
    };
  }, [attendanceData]);

  const getStatusBadge = (status: 'full' | 'half' | 'miss' | 'partial') => {
    switch (status) {
      case 'full':
        return <Badge variant="default">Full Day</Badge>;
      case 'half':
        return <Badge variant="secondary">Half Day</Badge>;
      case 'partial':
        return <Badge variant="outline">Partial</Badge>;
      case 'miss':
        return <Badge variant="destructive">Miss</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-slate-800">Attendance</h1>
        <p className="text-sm text-slate-500">Track employee attendance and work hours</p>
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Date Range Card */}
      <Card className="border-none shadow-lg">
        <CardHeader>
          <CardTitle>Date Range</CardTitle>
          <CardDescription>Select the date range to view attendance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="text-sm font-medium mb-2 block">Start Date</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setStartDate(e.target.value);
                }}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">End Date</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setEndDate(e.target.value);
                }}
              />
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const today = new Date();
                  const thirtyDaysAgo = new Date(today);
                  thirtyDaysAgo.setDate(today.getDate() - 30);
                  setStartDate(thirtyDaysAgo.toISOString().split('T')[0]);
                  setEndDate(today.toISOString().split('T')[0]);
                }}
              >
                Reset to Last 30 Days
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-none shadow-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-500 flex items-center justify-between">
              <span>Total Records</span>
              <Calendar className="h-4 w-4" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-slate-800">{stats.totalRecords}</div>
            <p className="text-sm text-slate-500 mt-1">Attendance records</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-500 flex items-center justify-between">
              <span>Full Days</span>
              <Clock className="h-4 w-4" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-green-600">{stats.fullDays}</div>
            <p className="text-sm text-slate-500 mt-1">8+ hours worked</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-500 flex items-center justify-between">
              <span>Half Days</span>
              <Users className="h-4 w-4" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-orange-600">{stats.halfDays}</div>
            <p className="text-sm text-slate-500 mt-1">4-8 hours worked</p>
          </CardContent>
        </Card>
      </div>

      {/* Attendance Records */}
      {loading ? (
        <Card className="border-none shadow-lg">
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
          </CardContent>
        </Card>
      ) : attendanceData.length === 0 ? (
        <Card className="border-none shadow-lg">
          <CardContent className="flex items-center justify-center py-12">
            <p className="text-sm text-muted-foreground">No attendance records found for the selected date range.</p>
          </CardContent>
        </Card>
      ) : (
        attendanceData.map((day) => (
          <Card key={day.date} className="border-none shadow-lg">
            <CardHeader>
              <CardTitle>{formatDate(day.date)}</CardTitle>
              <CardDescription>{day.employees.length} {day.employees.length === 1 ? 'employee' : 'employees'}</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Hours Worked</TableHead>
                    <TableHead>Sessions</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {day.employees.map((emp) => (
                    <TableRow key={emp.userId}>
                      <TableCell className="font-medium">
                        {emp.email?.split('@')[0] || 'Unknown'}
                      </TableCell>
                      <TableCell className="text-slate-500">{emp.email || '—'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-slate-400" />
                          <span>{emp.hoursWorked.toFixed(2)}h</span>
                        </div>
                      </TableCell>
                      <TableCell>{emp.sessions}</TableCell>
                      <TableCell>{getStatusBadge(emp.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
};

export default Attendance;

