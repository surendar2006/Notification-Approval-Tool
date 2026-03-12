import { CalendarDays, CheckCircle2, Clock } from "lucide-react";

const cardMeta = [
  {
    key: "today",
    label: "Today's Requests",
    icon: CalendarDays,
    accent: "bg-brand/10 text-brand",
  },
  {
    key: "pending",
    label: "Pending Approvals",
    icon: Clock,
    accent: "bg-amber-100 text-amber-600",
  },
  {
    key: "approved",
    label: "Approved Requests",
    icon: CheckCircle2,
    accent: "bg-emerald-100 text-emerald-600",
  },
];

export default function StatsCards({ stats }) {
  return (
    <section className="grid gap-4 md:grid-cols-3">
      {cardMeta.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.key}
            className="flex items-center justify-between rounded-2xl border border-border bg-surface p-5 shadow-soft"
          >
            <div>
              <p className="text-sm text-slate-400">{card.label}</p>
              <p className="mt-2 text-3xl font-semibold text-ink">{stats[card.key]}</p>
            </div>
            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${card.accent}`}>
              <Icon className="h-6 w-6" />
            </div>
          </div>
        );
      })}
    </section>
  );
}
