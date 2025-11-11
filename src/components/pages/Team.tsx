import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const demoTeam = [
  { id: '1', name: 'Alex Johnson', title: 'Product Manager' },
  { id: '2', name: 'Priya Patel', title: 'Lead Engineer' },
  { id: '3', name: 'Marcus Lee', title: 'UX Researcher' },
];

export default function Team() {
  return (
    <div className="max-w-4xl mx-auto space-y-10 py-10 px-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">
          People &amp; Culture
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-primary">
          Meet the Anvesana Team
        </h1>
        <p className="text-sm text-muted-foreground max-w-xl">
          We’re a group of builders, researchers, and operators focused on
          making work easier and more transparent for every organisation.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        {demoTeam.map((member) => (
          <Card key={member.id} className="border-muted shadow-sm">
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <div className="bg-primary/10 text-primary rounded-lg h-11 w-11 flex items-center justify-center font-semibold">
                {member.name.slice(0, 2)}
              </div>
              <div>
                <CardTitle className="text-base font-semibold">
                  {member.name}
                </CardTitle>
                <CardDescription>{member.title}</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <Badge variant="secondary" className="uppercase tracking-wide text-xs">
                Active
                            </Badge>
          </CardContent>
        </Card>
        ))}
      </section>

      <footer className="rounded-xl border border-dashed border-muted-foreground/30 bg-muted/50 p-6 space-y-2">
        <h3 className="text-lg font-semibold text-primary">Hiring soon</h3>
        <p className="text-sm text-muted-foreground">
          The full team management experience will live here once the Anvesana
          desktop agent starts streaming activity data.
        </p>
      </footer>
    </div>
  )
}

