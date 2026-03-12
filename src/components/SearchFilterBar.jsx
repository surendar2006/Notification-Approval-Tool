import { Calendar, Filter, Search } from "lucide-react";

export default function SearchFilterBar({
  search,
  onSearchChange,
  statusFilter,
  onStatusChange,
  dateFilter,
  onDateChange,
  statusOptions,
}) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 shadow-soft lg:flex-row lg:items-center lg:justify-between">
      <div className="relative w-full lg:max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search by ID, title, or mentor"
          className="w-full rounded-xl border border-border bg-white py-2.5 pl-10 pr-4 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
      </div>
      <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
        <div className="relative">
          <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(event) => onStatusChange(event.target.value)}
            className="w-full appearance-none rounded-xl border border-border bg-white py-2.5 pl-10 pr-8 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
          >
            <option value="All">All Status</option>
            {statusOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div className="relative">
          <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <select
            value={dateFilter}
            onChange={(event) => onDateChange(event.target.value)}
            className="w-full appearance-none rounded-xl border border-border bg-white py-2.5 pl-10 pr-8 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
          >
            <option value="all">All Dates</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>
        </div>
      </div>
    </section>
  );
}
