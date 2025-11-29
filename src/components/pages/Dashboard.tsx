import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ROUTES_FRONTEND } from "@/constant";
import { Clock, Activity, ShieldCheck, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type WorkSessionRow = {
  id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  status: "open" | "closed";
};

type Summary = {
  currentStatus: "active" | "idle";
  currentSeconds: number;
  todaySeconds: number;
  weekSeconds: number;
  totalSessions: number;
};

const formatDuration = (seconds: number) => {
  if (!seconds || Number.isNaN(seconds)) return "0m";
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
};

export default function Dashboard() {
  const { user, userRole } = useAuth();
  const isAdmin = userRole === "admin";

  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSummary = async () => {
      if (!user) return;

      setLoading(true);
      setError(null);

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      sevenDaysAgo.setHours(0, 0, 0, 0);

      try {
        const { data, error: sessionsError } = await supabase
          .from<WorkSessionRow>("work_sessions")
          .select("id, started_at, ended_at, duration_seconds, status")
          .eq("user_id", user.id)
          .gte("started_at", sevenDaysAgo.toISOString())
          .order("started_at", { ascending: false });

        if (sessionsError) throw sessionsError;

        const now = new Date();
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        let currentSeconds = 0;
        let todaySeconds = 0;
        let weekSeconds = 0;

        const totalSessions = data?.length ?? 0;

        data?.forEach((session) => {
          const started = new Date(session.started_at);
          const ended = session.ended_at ? new Date(session.ended_at) : now;
          const duration =
            session.duration_seconds ??
            Math.max(0, Math.floor((ended.getTime() - started.getTime()) / 1000));

          weekSeconds += duration;

          if (started >= startOfToday) {
            todaySeconds += duration;
          }

          if (session.status === "open") {
            currentSeconds = Math.max(
              currentSeconds,
              Math.floor((now.getTime() - started.getTime()) / 1000)
            );
          }
        });

        setSummary({
          currentStatus: currentSeconds > 0 ? "active" : "idle",
          currentSeconds,
          todaySeconds,
          weekSeconds,
          totalSessions,
        });
      } catch (summaryError) {
        const message =
          summaryError instanceof Error ? summaryError.message : "Unable to load productivity data.";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [user]);

  const summaryContent = useMemo(() => {
    if (loading) {
      return (
        <div className="space-y-3 text-sm text-slate-500">
          <p>Gathering your recent sessions…</p>
          <div className="h-2 w-full rounded-full bg-slate-100" />
          <div className="h-2 w-3/4 rounded-full bg-slate-100" />
        </div>
      );
    }

    if (error) {
      return <p className="text-sm text-destructive">{error}</p>;
    }

    if (!summary) {
      return (
        <p className="text-sm text-slate-500">
          Start a session to see your productivity stats here.
        </p>
      );
    }

    return (
      <div className="grid gap-4 text-sm text-slate-600 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Current Status</p>
          <p className="mt-2 text-lg font-semibold text-slate-800">
            {summary.currentStatus === "active" ? "Active session" : "Checked out"}
          </p>
          <p className="text-xs text-slate-500">
            {summary.currentStatus === "active"
              ? `Elapsed time ${formatDuration(summary.currentSeconds)}`
              : "No active session right now"}
          </p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Today</p>
          <p className="mt-2 text-lg font-semibold text-slate-800">
            {formatDuration(summary.todaySeconds)}
          </p>
          <p className="text-xs text-slate-500">Tracked since midnight</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Last 7 Days</p>
          <p className="mt-2 text-lg font-semibold text-slate-800">
            {formatDuration(summary.weekSeconds)}
          </p>
          <p className="text-xs text-slate-500">Rolling daily total</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Sessions logged</p>
          <p className="mt-2 text-lg font-semibold text-slate-800">
            {summary.totalSessions}
          </p>
          <p className="text-xs text-slate-500">In the last 7 days</p>
        </div>
      </div>
    );
  }, [summary, loading, error]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 py-10 px-6">
      <section className="rounded-3xl bg-gradient-to-r from-sky-500 via-sky-600 to-indigo-600 p-8 text-white shadow-xl">
        <p className="text-xs uppercase tracking-[0.35em] text-white/70">
          Welcome Back
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">
          Overview at a Glance
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-white/80">
          Quickly monitor team activity, review today’s performance, and jump into time tracking or team management in a single click.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button
            asChild
            className="bg-sky-500 text-white shadow-lg hover:bg-sky-500/90"
          >
            <Link to={ROUTES_FRONTEND.TIME_TRACKING}>Go to Time Tracking</Link>
          </Button>
          {isAdmin && (
            <Button asChild variant="outline" className="border-white text-white hover:bg-white/10">
              <Link to={ROUTES_FRONTEND.TEAM}>Manage Team</Link>
            </Button>
          )}
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <Card className="border-none bg-white shadow-lg">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-sky-100 p-2 text-sky-600">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold text-slate-800">
                  Session Summary
                </CardTitle>
                <p className="text-xs text-slate-500">
                  Making sure everyone’s tracking time properly
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-600">
            {summaryContent}
          </CardContent>
        </Card>

        <Card className="border-none bg-white shadow-lg">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-emerald-100 p-2 text-emerald-600">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold text-slate-800">
                  Productivity Insights
                </CardTitle>
                <p className="text-xs text-slate-500">
                  Track patterns before they become issues
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            <p>Upcoming metrics:</p>
            <ul className="space-y-2 pl-4 text-slate-500">
              <li>• Desktop and website engagement snapshots</li>
              <li>• Daily productivity score by project</li>
              <li>• Focus vs. idle ratio with drill-downs</li>
            </ul>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <Card className="border-none bg-white shadow-lg">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-violet-100 p-2 text-violet-600">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold text-slate-800">
                  Compliance Overview
                </CardTitle>
                <p className="text-xs text-slate-500">
                  Maintain clean audit trails automatically
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            <p>What we’ll highlight:</p>
            <ul className="space-y-2 pl-4 text-slate-500">
              <li>• Break adherence and overtime alerts</li>
              <li>• Role-based access events & overrides</li>
              <li>• Export-ready compliance reports</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="border-none bg-white shadow-lg">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-rose-100 p-2 text-rose-600">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold text-slate-800">
                  Team Snapshot
                </CardTitle>
                <p className="text-xs text-slate-500">
                  Keep a pulse on availability and roles
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            <p>Coming soon:</p>
            <ul className="space-y-2 pl-4 text-slate-500">
              <li>• Active vs. offline teammates at a glance</li>
              <li>• Quick invites and pending approvals</li>
              <li>• Role distribution and load balancing</li>
            </ul>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

