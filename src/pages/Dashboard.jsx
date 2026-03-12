import { useEffect, useMemo, useState } from "react";
import Header from "../components/Header.jsx";
import StatsCards from "../components/StatsCards.jsx";
import SearchFilterBar from "../components/SearchFilterBar.jsx";
import ApprovalTable from "../components/ApprovalTable.jsx";
import RequestDetails from "../components/RequestDetails.jsx";
import StatusBadge from "../components/StatusBadge.jsx";

const statusOptions = ["Pending", "Approved", "Rejected"];
const titleOptions = [
  "Leave",
  "Sick Leave",
  "Permission",
  "Gp",
  "Od",
  "Emergency Leave",
];
const mentorOptions = [
  { name: "Avery Patel", email: "avery.patel@college.edu", phone: "+14155551001" },
  { name: "Jordan Lee", email: "jordan.lee@college.edu", phone: "+14155551002" },
  { name: "Morgan Chen", email: "morgan.chen@college.edu", phone: "+14155551003" },
  { name: "Taylor Nguyen", email: "taylor.nguyen@college.edu", phone: "+14155551004" },
  { name: "Riya Sharma", email: "riya.sharma@college.edu", phone: "+14155551005" },
  { name: "Megha Ranjini", email: "megharanjini401@gmail.com", phone: "+14155551006" },
];
const allowedRequesterEmails = new Set(
  mentorOptions.map((option) => option.email.toLowerCase())
);

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

const parseJwt = (token) => {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const payload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((char) => `%${`00${char.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join("")
    );
    return JSON.parse(payload);
  } catch {
    return null;
  }
};

const apiUrl = (path) => `${API_BASE_URL}${path}`;

const formatDateShort = (value) => {
  if (!value) {
    return "Not provided";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

const parseScheduleWindow = (scheduledFor) => {
  const raw = String(scheduledFor || "").trim();
  if (!raw) {
    return { from: null, to: null };
  }
  const parts = raw.split(" to ");
  if (parts.length >= 2) {
    return { from: parts[0].trim(), to: parts.slice(1).join(" to ").trim() };
  }
  return { from: raw, to: raw };
};

const formatDuration = (fromRaw, toRaw) => {
  const from = new Date(fromRaw);
  const to = new Date(toRaw);
  if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime())) {
    const diffMs = Math.max(0, to.getTime() - from.getTime());
    const days = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    return `${days} day${days === 1 ? "" : "s"}`;
  }
  return "Not provided";
};

const matchesDateFilter = (item, filter) => {
  if (filter === "all") {
    return true;
  }
  const createdAt = new Date(item.createdAt);
  if (Number.isNaN(createdAt.getTime())) {
    return false;
  }
  const now = new Date();
  if (filter === "today") {
    return (
      createdAt.getFullYear() === now.getFullYear() &&
      createdAt.getMonth() === now.getMonth() &&
      createdAt.getDate() === now.getDate()
    );
  }
  if (filter === "week") {
    const start = new Date(now);
    start.setDate(now.getDate() - 7);
    return createdAt >= start;
  }
  if (filter === "month") {
    return (
      createdAt.getFullYear() === now.getFullYear() &&
      createdAt.getMonth() === now.getMonth()
    );
  }
  return true;
};

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState("");
  const [authError, setAuthError] = useState("");
  const [authReady, setAuthReady] = useState(false);

  const [notifications, setNotifications] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [decisionNote, setDecisionNote] = useState("");
  const [editDraft, setEditDraft] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState("all");

  const [actionState, setActionState] = useState({ status: "idle", message: "" });
  const [requestState, setRequestState] = useState({ status: "idle", message: "" });
  const [newRequest, setNewRequest] = useState({
    title: "Leave",
    mentor: "",
    scheduledFrom: "",
    scheduledTo: "",
    recipients: {
      email: "",
      phone: "",
    },
    requesterName: "",
    requesterEmail: "",
    message: "",
  });

  const isAdmin = Boolean(user?.email && allowedRequesterEmails.has(user.email.toLowerCase()));
  const myRequests = useMemo(
    () => notifications.filter((item) => item.createdByEmail && item.createdByEmail === user?.email),
    [notifications, user?.email]
  );

  const loginForToken = async (identity) => {
    const response = await fetch(apiUrl("/api/auth/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: identity.email,
        name: identity.name,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        error.message ||
          "Authentication failed. Set JWT_SECRET in backend .env and restart server."
      );
    }

    const data = await response.json();
    if (!data?.token) {
      throw new Error(
        "Authentication failed. Set JWT_SECRET in backend .env and restart server."
      );
    }

    setToken(data.token);
    return data.token;
  };

  const ensureToken = async () => {
    if (token) {
      return token;
    }

    const identity = user?.email && user?.name
      ? { email: user.email, name: user.name }
      : { email: "guest@college.edu", name: "Guest User" };

    return loginForToken(identity);
  };

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      setAuthError("Missing Google Client ID. Set VITE_GOOGLE_CLIENT_ID.");
      return;
    }

    const existingScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');

    const initializeGoogle = () => {
      if (!window.google?.accounts?.id) {
        return;
      }

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          const payload = parseJwt(response.credential);
          if (!payload?.email || !payload?.name) {
            setAuthError("Unable to read Google profile.");
            return;
          }
          setUser({ name: payload.name, email: payload.email, picture: payload.picture || "" });
          setAuthError("");
        },
      });

      window.google.accounts.id.renderButton(document.getElementById("google-signin"), {
        theme: "outline",
        size: "large",
        width: "320",
      });

      setAuthReady(true);
    };

    if (existingScript) {
      initializeGoogle();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = initializeGoogle;
    script.onerror = () => setAuthError("Failed to load Google Sign-In.");
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    const login = async () => {
      if (!user?.email || !user?.name) {
        setToken("");
        return;
      }

      try {
        await loginForToken({ email: user.email, name: user.name });
      } catch (error) {
        setAuthError(error.message || "Failed to authenticate user.");
      }
    };

    login();
  }, [user]);

  const loadNotifications = async () => {
    if (!token) {
      setNotifications([]);
      setSelectedId("");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(apiUrl("/api/notifications"), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || "Failed to load notifications.");
      }

      const data = await response.json();
      const items = data.items || [];
      setNotifications(items);
      setSelectedId((current) => (current && items.some((item) => item.id === current) ? current : items[0]?.id || ""));
    } catch (error) {
      setActionState({ status: "error", message: error.message || "Failed to load notifications." });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [token]);

  const selectedNotification = notifications.find((item) => item.id === selectedId) || null;

  useEffect(() => {
    if (!selectedNotification) {
      setEditDraft(null);
      return;
    }

    setEditDraft({
      ...selectedNotification,
      tags: Array.isArray(selectedNotification.tags) ? selectedNotification.tags.join(", ") : "",
    });
  }, [selectedId]);

  const filteredNotifications = useMemo(() => {
    return notifications.filter((item) => {
      const matchesSearch =
        item.title?.toLowerCase().includes(search.toLowerCase()) ||
        item.id?.toLowerCase().includes(search.toLowerCase()) ||
        item.mentor?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "All" || item.status === statusFilter;
      const matchesDate = matchesDateFilter(item, dateFilter);
      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [notifications, search, statusFilter, dateFilter]);

  const statusSummary = useMemo(() => {
    return notifications.reduce(
      (summary, item) => {
        summary.total += 1;
        summary[item.status] = (summary[item.status] || 0) + 1;
        return summary;
      },
      { total: 0, Pending: 0, Approved: 0, Rejected: 0 }
    );
  }, [notifications]);

  const todayTotal = useMemo(() => {
    const today = new Date();
    return notifications.filter((item) => {
      const createdAt = new Date(item.createdAt);
      return (
        createdAt.getFullYear() === today.getFullYear() &&
        createdAt.getMonth() === today.getMonth() &&
        createdAt.getDate() === today.getDate()
      );
    }).length;
  }, [notifications]);

  const withAuth = (authToken, extra = {}) => ({
    ...extra,
    headers: {
      ...(extra.headers || {}),
      Authorization: `Bearer ${authToken}`,
    },
  });

  const notifyAction = (status, message) => {
    setActionState({ status, message });
    if (status !== "loading") {
      setTimeout(() => setActionState({ status: "idle", message: "" }), 3500);
    }
  };

  const handleDecision = async (decision) => {
    if (!selectedNotification || !isAdmin) {
      return;
    }

    notifyAction("loading", "Sending decision...");

    try {
      const authToken = await ensureToken();
      const response = await fetch(
        apiUrl("/api/send-decision"),
        withAuth(authToken, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            decision,
            note: decisionNote,
            notificationId: selectedNotification.id,
          }),
        })
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || "Unable to send decision.");
      }

      const data = await response.json();
      setNotifications((prev) => prev.map((item) => (item.id === data.item.id ? data.item : item)));
      setDecisionNote("");
      if (Array.isArray(data.warnings) && data.warnings.length > 0) {
        notifyAction("success", `${decision} saved. ${data.warnings.join(" | ")}`);
      } else {
        notifyAction("success", `${decision} sent via SMS and email.`);
      }
    } catch (error) {
      notifyAction("error", error.message || "Unable to send decision.");
    }
  };

  const handleUpdateSelected = async () => {
    if (!selectedNotification || !editDraft || !isAdmin) {
      return;
    }

    notifyAction("loading", "Saving changes...");

    try {
      const authToken = await ensureToken();
      const response = await fetch(
        apiUrl(`/api/notifications/${selectedNotification.id}`),
        withAuth(authToken, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...selectedNotification,
            ...editDraft,
            tags: String(editDraft.tags || ""),
            scheduledFor: editDraft.scheduledFor,
          }),
        })
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || "Failed to update notification.");
      }

      const data = await response.json();
      setNotifications((prev) => prev.map((item) => (item.id === data.item.id ? data.item : item)));
      notifyAction("success", "Notification updated.");
    } catch (error) {
      notifyAction("error", error.message || "Failed to update notification.");
    }
  };

  const handleDeleteSelected = async () => {
    if (!selectedNotification || !isAdmin) {
      return;
    }

    notifyAction("loading", "Deleting request...");

    try {
      const authToken = await ensureToken();
      const response = await fetch(
        apiUrl(`/api/notifications/${selectedNotification.id}`),
        withAuth(authToken, { method: "DELETE" })
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || "Failed to delete notification.");
      }

      setNotifications((prev) => prev.filter((item) => item.id !== selectedNotification.id));
      setSelectedId("");
      notifyAction("success", "Notification deleted.");
    } catch (error) {
      notifyAction("error", error.message || "Failed to delete notification.");
    }
  };

  const handleSignOut = () => {
    window.google?.accounts?.id?.disableAutoSelect?.();
    setUser(null);
    setToken("");
  };

  const handleRequestSubmit = async (event) => {
    event.preventDefault();

    try {
      const authToken = await ensureToken();
      const fromIso = newRequest.scheduledFrom
        ? new Date(newRequest.scheduledFrom).toISOString()
        : new Date().toISOString();
      const toIso = newRequest.scheduledTo
        ? new Date(newRequest.scheduledTo).toISOString()
        : new Date(Date.now() + 3600000).toISOString();

      const response = await fetch(
        apiUrl("/api/notifications"),
        withAuth(authToken, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...newRequest,
            requesterName: user?.name || newRequest.requesterName,
            requesterEmail: user?.email || newRequest.requesterEmail,
            scheduledFor: `${fromIso} to ${toIso}`,
          }),
        })
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || "Failed to create notification.");
      }

      const data = await response.json();
      setNotifications((prev) => [data.item, ...prev]);
      setSelectedId(data.item.id);
      setNewRequest((prev) => ({
        ...prev,
        title: "Leave",
        mentor: "",
        scheduledFrom: "",
        scheduledTo: "",
        recipients: { email: "", phone: "" },
        message: "",
      }));
      setRequestState({ status: "success", message: "Leave request submitted." });
    } catch (error) {
      setRequestState({ status: "error", message: error.message || "Failed to submit request." });
    }
  };

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas px-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">College Project</p>
          <h1 className="mt-2 text-2xl font-semibold text-ink">Notification Approval System</h1>
          <p className="mt-2 text-sm text-slate-400">Sign in with your mentor account to continue.</p>
          <div className="mt-6 flex flex-col gap-3">
            <div id="google-signin" />
            {!authReady && !authError && <p className="text-xs text-slate-400">Loading Google sign-in...</p>}
            {authError && <p className="text-xs text-rose-600">{authError}</p>}
          </div>
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-canvas px-4 py-10 md:px-10">
        <Header user={user} onSignOut={handleSignOut} />
        <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-soft">
            <h2 className="text-xl font-semibold text-ink">Apply for leave</h2>
            <p className="mt-1 text-sm text-slate-400">Fill in the request details for approval.</p>
            <form className="mt-6 grid gap-4" onSubmit={handleRequestSubmit}>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Leave Type
                  <select
                    value={newRequest.title}
                    onChange={(event) => setNewRequest((prev) => ({ ...prev, title: event.target.value }))}
                    className="mt-2 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                  >
                    {titleOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Mentor
                  <select
                    value={newRequest.mentor}
                    onChange={(event) => {
                      const selectedName = event.target.value;
                      const selectedMentor = mentorOptions.find((option) => option.name === selectedName);
                      setNewRequest((prev) => ({
                        ...prev,
                        mentor: selectedName,
                        recipients: {
                          ...prev.recipients,
                          email: selectedMentor?.email || "",
                          phone: selectedMentor?.phone || "",
                        },
                      }));
                    }}
                    className="mt-2 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                  >
                    <option value="">Select mentor</option>
                    {mentorOptions.map((option) => (
                      <option key={option.name} value={option.name}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  From Date & Time
                  <input
                    type="datetime-local"
                    value={newRequest.scheduledFrom}
                    onChange={(event) => setNewRequest((prev) => ({ ...prev, scheduledFrom: event.target.value }))}
                    className="mt-2 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                  />
                </label>
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  To Date & Time
                  <input
                    type="datetime-local"
                    value={newRequest.scheduledTo}
                    onChange={(event) => setNewRequest((prev) => ({ ...prev, scheduledTo: event.target.value }))}
                    className="mt-2 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                  />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Mentor Email
                  <input
                    type="email"
                    value={newRequest.recipients.email}
                    onChange={(event) =>
                      setNewRequest((prev) => ({
                        ...prev,
                        recipients: { ...prev.recipients, email: event.target.value },
                      }))
                    }
                    className="mt-2 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                  />
                </label>
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Mentor Phone
                  <input
                    value={newRequest.recipients.phone}
                    onChange={(event) =>
                      setNewRequest((prev) => ({
                        ...prev,
                        recipients: { ...prev.recipients, phone: event.target.value },
                      }))
                    }
                    className="mt-2 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                  />
                </label>
              </div>

              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Requester
                <input
                  value={user?.name || ""}
                  disabled
                  className="mt-2 w-full rounded-xl border border-border bg-slate-50 px-3 py-2 text-sm text-slate-500"
                />
              </label>

              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Remarks
                <textarea
                  value={newRequest.message}
                  onChange={(event) => setNewRequest((prev) => ({ ...prev, message: event.target.value }))}
                  rows={4}
                  className="mt-2 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
              </label>

              {requestState.status !== "idle" && (
                <div className="rounded-xl border border-border bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  {requestState.message}
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                >
                  Submit request
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setNewRequest((prev) => ({
                      ...prev,
                      title: "Leave",
                      mentor: "",
                      scheduledFrom: "",
                      scheduledTo: "",
                      recipients: { email: "", phone: "" },
                      message: "",
                    }))
                  }
                  className="rounded-xl border border-border bg-slate-50 px-4 py-2 text-sm font-semibold text-ink transition hover:bg-slate-100"
                >
                  Clear form
                </button>
              </div>
            </form>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-6 shadow-soft">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-ink">My requests</h3>
                <p className="text-sm text-slate-400">Your submitted leave requests.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={loadNotifications}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-white text-slate-500 transition hover:border-brand/30 hover:text-brand"
                  aria-label="Refresh requests"
                  title="Refresh"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
                    <path
                      d="M20 12a8 8 0 1 1-2.34-5.66"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M20 4v6h-6"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <span className="rounded-full border border-brand/20 bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
                  {myRequests.length} items
                </span>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {myRequests.map((item) => {
                const schedule = parseScheduleWindow(item.scheduledFor);
                return (
                  <div key={item.id} className="rounded-xl border border-border bg-slate-50 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{item.id}</p>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-ink">{item.title}</p>
                      <StatusBadge status={item.status} />
                    </div>
                    <p className="text-xs text-slate-400">{item.mentor}</p>
                    <div className="mt-2 text-xs text-slate-400">
                      {formatDateShort(schedule.from)} → {formatDateShort(schedule.to)}
                    </div>
                    <p className="mt-2 text-sm text-slate-500">{item.message || "No remarks provided."}</p>
                  </div>
                );
              })}
              {myRequests.length === 0 && (
                <p className="text-sm text-slate-400">No requests yet.</p>
              )}
            </div>
          </div>
        </section>
      </main>
    );
  }

  const stats = {
    today: todayTotal,
    pending: statusSummary.Pending,
    approved: statusSummary.Approved,
  };

  return (
    <main className="min-h-screen bg-canvas px-4 py-10 md:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <Header user={user} onSignOut={handleSignOut} />
        <StatsCards stats={stats} />
        <SearchFilterBar
          search={search}
          onSearchChange={setSearch}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          dateFilter={dateFilter}
          onDateChange={setDateFilter}
          statusOptions={statusOptions}
        />
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <ApprovalTable
            notifications={filteredNotifications}
            selectedId={selectedId}
            onSelect={setSelectedId}
            formatDate={formatDateShort}
            formatDuration={formatDuration}
            parseScheduleWindow={parseScheduleWindow}
            isLoading={isLoading}
          />
          <RequestDetails
            notification={selectedNotification}
            editDraft={editDraft}
            onEditChange={setEditDraft}
            decisionNote={decisionNote}
            onDecisionNoteChange={setDecisionNote}
            actionState={actionState}
            onSave={handleUpdateSelected}
            onApprove={() => handleDecision("Approved")}
            onReject={() => handleDecision("Rejected")}
            onDelete={handleDeleteSelected}
            formatDate={formatDateShort}
            parseScheduleWindow={parseScheduleWindow}
          />
        </div>
      </div>
    </main>
  );
}
