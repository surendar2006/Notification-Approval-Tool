const statusStyles = {
  Pending: "bg-amber-100 text-amber-700 ring-1 ring-amber-200",
  Approved: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200",
  Rejected: "bg-rose-100 text-rose-700 ring-1 ring-rose-200",
};

export default function StatusBadge({ status }) {
  const classes = statusStyles[status] || "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${classes}`}>
      {status || "Unknown"}
    </span>
  );
}
