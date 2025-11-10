export default function Dashboard() {
  return (
    <div className="max-w-4xl mx-auto space-y-10 py-10 px-6">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">
          Overview
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-primary">
          Dashboard
        </h1>
        <p className="text-sm text-muted-foreground max-w-xl">
          Overview of activity will appear here once data is connected.
        </p>
        </div>

      <Card className="shadow-lg border-muted">
        <CardHeader className="space-y-1">
          <CardTitle className="text-lg font-semibold text-primary">
            Session Summary
          </CardTitle>
      </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            No analytics are available yet. Check in/out activity, app usage,
            and break information will display after integration.
          </p>
          <Separator />
          <ul className="space-y-2 list-disc pl-4">
            <li>Real-time session status</li>
            <li>Tracked desktop and website activity</li>
            <li>Idle time and break summaries</li>
          </ul>
      </CardContent>
    </Card>
    </div>
  )
}

