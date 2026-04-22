import { createFileRoute } from "@tanstack/react-router";
import { FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app/reports")({
  head: () => ({ meta: [{ title: "Reports — HealthOS" }] }),
  component: Reports,
});

const reports = [
  { title: "Weekly Health Report", date: "May 18 – May 24, 2024", summary: "Sleep ↑18%, stress trending down. Strong week." },
  { title: "Weekly Health Report", date: "May 11 – May 17, 2024", summary: "Recovery improved. Activity slightly below target." },
  { title: "Monthly Health Report", date: "April 2024", summary: "Health score average 79. Best month for HRV." },
];

function Reports() {
  return (
    <div className="max-w-4xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-sm text-muted-foreground">Your health summaries, ready to read or share.</p>
      </header>
      {reports.map((r, i) => (
        <div key={i} className="rounded-2xl bg-card border border-border shadow-card p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <FileText className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold">{r.title}</h3>
            <p className="text-xs text-muted-foreground">{r.date}</p>
            <p className="text-sm mt-1">{r.summary}</p>
          </div>
          <Button variant="outline" className="rounded-full"><Download className="h-3.5 w-3.5 mr-1" /> PDF</Button>
        </div>
      ))}
    </div>
  );
}
