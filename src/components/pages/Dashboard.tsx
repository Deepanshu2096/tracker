import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ROUTES_FRONTEND } from "@/constant";
import { Clock, Activity, ShieldCheck, Users } from "lucide-react";

export default function Dashboard() {
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
          <Button asChild variant="secondary" className="bg-white text-sky-600 hover:bg-white/90">
            <Link to={ROUTES_FRONTEND.TIME_TRACKING}>Go to Time Tracking</Link>
          </Button>
          <Button asChild variant="outline" className="border-white text-white hover:bg-white/10">
            <Link to={ROUTES_FRONTEND.TEAM}>Manage Team</Link>
          </Button>
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
            <p>
              No analytics are available yet. Once data is connected you’ll see:
            </p>
            <Separator />
            <ul className="space-y-2 pl-4 text-slate-500">
              <li>• Real-time session status per employee</li>
              <li>• Check-in/out streaks and total hours</li>
              <li>• Idle time and break summaries</li>
            </ul>
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

