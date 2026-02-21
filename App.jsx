import { useEffect, useMemo, useState } from "react";
import "./App.css";

const initialNotifications = [
  {
    id: "NTF-2049",
    title: "Failed payment recovery",
    channel: "Email",
    requester: "Avery Patel",
    createdAt: "2026-02-05 09:14",
    scheduledFor: "2026-02-06 10:30",
    priority: "High",
    status: "Pending",
    audience: "Active subscribers",
    region: "North America",
    riskScore: 82,
    tags: ["Billing", "Time-sensitive"],
    recipients: {
      email: "billing-ops@company.com",
      phone: "+14155551200",
    },
    message:
      "We noticed a failed payment on your subscription. Update your billing details to avoid interruption.",
    checklist: [
      { label: "Brand voice approved", done: true },
      { label: "Policy review completed", done: true },
      { label: "Legal compliance check", done: false },
      { label: "QA link validation", done: false },
    ],
    audit: [
      { time: "09:22", item: "Submitted by Avery Patel" },
      { time: "09:31", item: "Auto-risk score calculated: 82" },
      { time: "09:47", item: "Assigned to Approvals Desk" },
    ],
  },
  {
    id: "NTF-2050",
    title: "Weekly usage recap",
    channel: "In-app",
    requester: "Jordan Lee",
    createdAt: "2026-02-05 10:06",
    scheduledFor: "2026-02-07 09:00",
    priority: "Medium",
    status: "Pending",
    audience: "Power users",
    region: "Global",
    riskScore: 46,
    tags: ["Engagement", "Digest"],
    recipients: {
      email: "growth@company.com",
      phone: "+14155551333",
    },
    message:
      "Here is your weekly activity recap. See highlights from your workspace and trending templates.",
    checklist: [
      { label: "Brand voice approved", done: true },
      { label: "Policy review completed", done: true },
      { label: "Legal compliance check", done: true },
      { label: "QA link validation", done: false },
    ],
    audit: [
      { time: "10:11", item: "Submitted by Jordan Lee" },
      { time: "10:26", item: "Content revisions requested" },
      { time: "10:54", item: "Revisions uploaded" },
    ],
  },
  {
    id: "NTF-2051",
    title: "Security verification prompt",
    channel: "SMS",
    requester: "Morgan Chen",
    createdAt: "2026-02-05 11:22",
    scheduledFor: "2026-02-05 14:15",
    priority: "Critical",
    status: "Pending",
    audience: "High-risk logins",
    region: "APAC",
    riskScore: 94,
    tags: ["Security", "OTP"],
    recipients: {
      email: "security@company.com",
      phone: "+14155551444",
    },
    message:
      "Your verification code is 839244. It expires in 10 minutes. If this wasn't you, secure your account.",
    checklist: [
      { label: "Brand voice approved", done: true },
      { label: "Policy review completed", done: true },
      { label: "Legal compliance check", done: true },
      { label: "QA link validation", done: true },
    ],
    audit: [
      { time: "11:23", item: "Submitted by Morgan Chen" },
      { time: "11:24", item: "Escalated due to risk score" },
      { time: "11:29", item: "Security team review complete" },
    ],
  },
  {
    id: "NTF-2052",
    title: "New feature release briefing",
    channel: "Email",
    requester: "Taylor Nguyen",
    createdAt: "2026-02-05 12:35",
    scheduledFor: "2026-02-08 08:45",
    priority: "Low",
    status: "Pending",
    audience: "All customers",
    region: "EMEA",
    riskScore: 28,
    tags: ["Product", "Launch"],
    recipients: {
      email: "product@company.com",
      phone: "+14155551555",
    },
    message:
      "We are launching a new approval dashboard. Explore new automation rules and faster review workflows.",
    checklist: [
      { label: "Brand voice approved", done: true },
      { label: "Policy review completed", done: false },
      { label: "Legal compliance check", done: false },
      { label: "QA link validation", done: false },
    ],
    audit: [
      { time: "12:41", item: "Submitted by Taylor Nguyen" },
      { time: "12:47", item: "Waiting on policy review" },
    ],
  },
];

const priorityStyles = {
  Critical: "pill pill--critical",
  High: "pill pill--high",
  Medium: "pill pill--medium",
  Low: "pill pill--low",
};

const statusStyles = {
  Pending: "status status--pending",
  Approved: "status status--approved",
  Rejected: "status status--rejected",
};

const channelOptions = ["All", "Email", "SMS", "In-app"];
const priorityOptions = ["All", "Critical", "High", "Medium", "Low"];
const statusOptions = ["All", "Pending", "Approved", "Rejected"];

const formatDateTime = (date) =>
  new Date(date).toISOString().slice(0, 16).replace("T", " ");

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
  } catch (error) {
    return null;
  }
};

const emptyRequest = {
  title: "",
  channel: "Email",
  requester: "",
  scheduledFor: "",
  priority: "Medium",
  audience: "",
  region: "North America",
  riskScore: 50,
  tags: "",
  recipients: {
    email: "",
    phone: "",
  },
  message: "",
};

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(
  /\/$/,
  ""
);

export default function App() {
  const [user, setUser] = useState(null);
  const [authError, setAuthError] = useState("");
  const [authReady, setAuthReady] = useState(false);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [selectedId, setSelectedId] = useState(initialNotifications[0].id);
  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [decisionNote, setDecisionNote] = useState("");
  const [view, setView] = useState("queue");
  const [actionState, setActionState] = useState({
    status: "idle",
    message: "",
  });
  const [requestState, setRequestState] = useState({
    status: "idle",
    message: "",
  });
  const [newRequest, setNewRequest] = useState(emptyRequest);

  useEffect(() => {
    if (user) {
      return;
    }

    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      setAuthError("Missing Google Client ID. Set VITE_GOOGLE_CLIENT_ID.");
      return;
    }

    const existingScript = document.querySelector(
      'script[src="https://accounts.google.com/gsi/client"]'
    );

    const initializeGoogle = () => {
      if (!window.google?.accounts?.id) {
        return;
      }

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          const payload = parseJwt(response.credential);
          if (payload) {
            setUser({
              name: payload.name,
              email: payload.email,
              picture: payload.picture,
            });
            setAuthError("");
          } else {
            setAuthError("Unable to read Google profile.");
          }
        },
      });

      window.google.accounts.id.renderButton(
        document.getElementById("google-signin"),
        { theme: "outline", size: "large", width: "320" }
      );
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
    script.onerror = () => {
      setAuthError("Failed to load Google Sign-In.");
    };
    document.body.appendChild(script);
  }, [user]);

  const selectedNotification = notifications.find(
    (notification) => notification.id === selectedId
  );

  const filteredNotifications = useMemo(() => {
    return notifications.filter((notification) => {
      const matchesSearch =
        notification.title.toLowerCase().includes(search.toLowerCase()) ||
        notification.id.toLowerCase().includes(search.toLowerCase()) ||
        notification.requester.toLowerCase().includes(search.toLowerCase());
      const matchesChannel =
        channelFilter === "All" || notification.channel === channelFilter;
      const matchesPriority =
        priorityFilter === "All" || notification.priority === priorityFilter;
      const matchesStatus =
        statusFilter === "All" || notification.status === statusFilter;

      return (
        matchesSearch && matchesChannel && matchesPriority && matchesStatus
      );
    });
  }, [notifications, search, channelFilter, priorityFilter, statusFilter]);

  const updateStatus = (id, status) => {
    setNotifications((prev) =>
      prev.map((notification) =>
        notification.id === id ? { ...notification, status } : notification
      )
    );
  };

  const statusSummary = useMemo(() => {
    return notifications.reduce(
      (summary, notification) => {
        summary.total += 1;
        summary[notification.status] += 1;
        return summary;
      },
      { total: 0, Pending: 0, Approved: 0, Rejected: 0 }
    );
  }, [notifications]);

  const pendingCritical = notifications.filter(
    (notification) =>
      notification.status === "Pending" && notification.priority === "Critical"
  ).length;

  const notifyAction = (status, message) => {
    setActionState({ status, message });
    if (status !== "loading") {
      setTimeout(() => {
        setActionState({ status: "idle", message: "" });
      }, 3500);
    }
  };

  const handleDecision = async (decision) => {
    if (!selectedNotification) {
      return;
    }

    notifyAction("loading", "Sending decision...");

    try {
      const response = await fetch(`${API_BASE_URL}/api/send-decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          note: decisionNote,
          notification: selectedNotification,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({
          message: "Unable to send decision.",
        }));
        throw new Error(error.message || "Unable to send decision.");
      }

      updateStatus(selectedNotification.id, decision);
      setDecisionNote("");
      notifyAction(
        "success",
        `${decision} sent via email and SMS successfully.`
      );
    } catch (error) {
      notifyAction("error", error.message);
    }
  };

  const handleRequestSubmit = (event) => {
    event.preventDefault();

    if (
      !newRequest.title.trim() ||
      !newRequest.requester.trim() ||
      !newRequest.message.trim() ||
      !newRequest.recipients.email.trim() ||
      !newRequest.recipients.phone.trim()
    ) {
      setRequestState({
        status: "error",
        message: "Fill in the required fields before submitting.",
      });
      return;
    }

    const newId = `NTF-${Math.floor(2000 + Math.random() * 8000)}`;
    const createdAt = formatDateTime(new Date());
    const notification = {
      ...newRequest,
      id: newId,
      createdAt,
      scheduledFor:
        newRequest.scheduledFor || formatDateTime(new Date(Date.now() + 3600000)),
      status: "Pending",
      tags: newRequest.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      checklist: [
        { label: "Brand voice approved", done: false },
        { label: "Policy review completed", done: false },
        { label: "Legal compliance check", done: false },
        { label: "QA link validation", done: false },
      ],
      audit: [
        { time: createdAt.slice(11), item: `Submitted by ${newRequest.requester}` },
      ],
    };

    setNotifications((prev) => [notification, ...prev]);
    setSelectedId(notification.id);
    setNewRequest(emptyRequest);
    setRequestState({
      status: "success",
      message: "Approval request created and added to the queue.",
    });
    setView("queue");
  };
  return (
    <div className="app">
      {!user ? (
        <section className="login">
          <div className="login-card">
            <div className="login-brand">
              <span className="login-eyebrow">College Project</span>
              <h1>Notification Approval System</h1>
              <p>
                Sign in with Google to access the approval dashboard and submit
                new requests.
              </p>
            </div>
            <div className="login-actions">
              <div id="google-signin" />
              {!authReady && !authError && (
                <p className="login-hint">Loading Google sign-in...</p>
              )}
              {authError && <p className="login-error">{authError}</p>}
            </div>
            <div className="login-footer">
              <p>Use your college Google account for access.</p>
              <button
                type="button"
                className="button button--ghost"
                onClick={() =>
                  setUser({ name: "Guest User", email: "guest@college.edu" })
                }
              >
                Continue as guest
              </button>
            </div>
          </div>
        </section>
      ) : (
        <>
          <header className="hero hero--academic">
            <div>
              <span className="hero__eyebrow">College Project Dashboard</span>
              <h1>Notification Approval System</h1>
              <p className="hero__subtext">
                A capstone-style interface for reviewing outbound notifications,
                tracking approvals, and documenting decisions for audit.
              </p>
              <div className="hero__meta">
                <div>
                  <span>Course</span>
                  <strong>Software Engineering</strong>
                </div>
                <div>
                  <span>Team</span>
                  <strong>Final Year Project</strong>
                </div>
                <div>
                  <span>Supervisor</span>
                  <strong>Faculty Advisor</strong>
                </div>
              </div>
              <div className="hero__actions">
                <button
                  type="button"
                  className="button button--primary"
                  onClick={() => setView("new")}
                >
                  New approval request
                </button>
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() => setView("queue")}
                >
                  View approvals
                </button>
                <div className="user-chip">
                  <span>{user.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      window.google?.accounts?.id?.disableAutoSelect?.();
                      setUser(null);
                    }}
                  >
                    Sign out
                  </button>
                </div>
              </div>
            </div>
            <div className="hero__panel">
              <div className="metric">
                <p>Total requests</p>
                <strong>{statusSummary.total}</strong>
              </div>
              <div className="metric">
                <p>Pending approvals</p>
                <strong>{statusSummary.Pending}</strong>
              </div>
              <div className="metric">
                <p>Critical pending</p>
                <strong>{pendingCritical}</strong>
              </div>
              <div className="metric metric--accent">
                <p>Median review time</p>
                <strong>1h 14m</strong>
              </div>
            </div>
          </header>

          <section className="view-toggle">
            <button
              type="button"
              className={view === "queue" ? "toggle toggle--active" : "toggle"}
              onClick={() => setView("queue")}
            >
              Approval queue
            </button>
            <button
              type="button"
              className={view === "new" ? "toggle toggle--active" : "toggle"}
              onClick={() => setView("new")}
            >
              New request
            </button>
          </section>

          {view === "queue" && (
            <>
              <section className="filters">
                <div className="search">
                  <label htmlFor="search">Search queue</label>
                  <input
                    id="search"
                    type="search"
                    placeholder="Search by ID, title, or requester"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>
                <div className="filter">
                  <label htmlFor="channel">Channel</label>
                  <select
                    id="channel"
                    value={channelFilter}
                    onChange={(event) => setChannelFilter(event.target.value)}
                  >
                    {channelOptions.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                </div>
                <div className="filter">
                  <label htmlFor="priority">Priority</label>
                  <select
                    id="priority"
                    value={priorityFilter}
                    onChange={(event) => setPriorityFilter(event.target.value)}
                  >
                    {priorityOptions.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                </div>
                <div className="filter">
                  <label htmlFor="status">Status</label>
                  <select
                    id="status"
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                  >
                    {statusOptions.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                </div>
              </section>

              <main className="workspace">
                <section className="queue">
                  <div className="queue__header">
                    <div>
                      <h2>Approval queue</h2>
                      <p>Prioritize by risk, channel, and deadline.</p>
                    </div>
                    <div className="queue__badge">
                      {filteredNotifications.length} items
                    </div>
                  </div>
                  <div className="queue__list">
                    {filteredNotifications.map((notification, index) => (
                      <button
                        key={notification.id}
                        type="button"
                        className={
                          notification.id === selectedId
                            ? "queue-card queue-card--active"
                            : "queue-card"
                        }
                        onClick={() => setSelectedId(notification.id)}
                        style={{ animationDelay: `${index * 0.05}s` }}
                      >
                        <div className="queue-card__top">
                          <div>
                            <span className="queue-card__id">
                              {notification.id}
                            </span>
                            <h3>{notification.title}</h3>
                            <p className="queue-card__requester">
                              {notification.requester}
                            </p>
                          </div>
                          <span className={statusStyles[notification.status]}>
                            {notification.status}
                          </span>
                        </div>
                        <div className="queue-card__meta">
                          <span>{notification.channel}</span>
                          <span>{notification.region}</span>
                          <span>ETA {notification.scheduledFor}</span>
                        </div>
                        <div className="queue-card__footer">
                          <span className={priorityStyles[notification.priority]}>
                            {notification.priority} priority
                          </span>
                          <div className="risk">
                            <span>Risk {notification.riskScore}</span>
                            <div className="risk__bar">
                              <div
                                className="risk__fill"
                                style={{ width: `${notification.riskScore}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                    {filteredNotifications.length === 0 && (
                      <div className="empty">
                        <h3>No notifications found</h3>
                        <p>Adjust your filters to view more approvals.</p>
                      </div>
                    )}
                  </div>
                </section>

                <aside className="panel">
                  {selectedNotification ? (
                    <>
                      <div className="panel__header">
                        <div>
                          <p className="panel__id">{selectedNotification.id}</p>
                          <h2>{selectedNotification.title}</h2>
                          <p className="panel__subtitle">
                            {selectedNotification.channel} -{" "}
                            {selectedNotification.region} - Submitted{" "}
                            {selectedNotification.createdAt}
                          </p>
                        </div>
                        <span className={statusStyles[selectedNotification.status]}>
                          {selectedNotification.status}
                        </span>
                      </div>

                      <div className="panel__grid">
                        <div className="panel__tile">
                          <span>Requester</span>
                          <strong>{selectedNotification.requester}</strong>
                        </div>
                        <div className="panel__tile">
                          <span>Audience</span>
                          <strong>{selectedNotification.audience}</strong>
                        </div>
                        <div className="panel__tile">
                          <span>Priority</span>
                          <strong
                            className={
                              priorityStyles[selectedNotification.priority]
                            }
                          >
                            {selectedNotification.priority}
                          </strong>
                        </div>
                        <div className="panel__tile">
                          <span>Scheduled</span>
                          <strong>{selectedNotification.scheduledFor}</strong>
                        </div>
                      </div>

                      <div className="panel__section">
                        <div className="panel__section-header">
                          <h3>Message preview</h3>
                          <div className="tag-group">
                            {selectedNotification.tags.map((tag) => (
                              <span className="tag" key={tag}>
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                        <p className="panel__message">
                          {selectedNotification.message}
                        </p>
                      </div>

                      <div className="panel__section">
                        <h3>Approval checklist</h3>
                        <ul className="checklist">
                          {selectedNotification.checklist.map((item) => (
                            <li key={item.label} className="checklist__item">
                              <span
                                className={
                                  item.done
                                    ? "checklist__dot checklist__dot--done"
                                    : "checklist__dot"
                                }
                              />
                              <span>{item.label}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="panel__section">
                        <h3>Audit trail</h3>
                        <div className="audit">
                          {selectedNotification.audit.map((event) => (
                            <div key={event.time} className="audit__row">
                              <span>{event.time}</span>
                              <p>{event.item}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="panel__section">
                        <h3>Decision notes</h3>
                        <textarea
                          placeholder="Add rationale for approval or rejection..."
                          value={decisionNote}
                          onChange={(event) => setDecisionNote(event.target.value)}
                        />
                      </div>

                      {actionState.status !== "idle" && (
                        <div
                          className={`action-banner action-banner--${actionState.status}`}
                        >
                          {actionState.message}
                        </div>
                      )}

                      <div className="panel__actions">
                        <button
                          type="button"
                          className="button button--ghost"
                          onClick={() => handleDecision("Rejected")}
                          disabled={actionState.status === "loading"}
                        >
                          Reject & notify
                        </button>
                        <button
                          type="button"
                          className="button button--primary"
                          onClick={() => handleDecision("Approved")}
                          disabled={actionState.status === "loading"}
                        >
                          Approve & release
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="empty">
                      <h3>Select a notification</h3>
                      <p>Pick a request from the queue to review details.</p>
                    </div>
                  )}
                </aside>
              </main>
            </>
          )}

          {view === "new" && (
            <section className="new-request">
              <div className="form-card">
                <div className="form-card__header">
                  <h2>Create approval request</h2>
                  <p>
                    Add a new outbound notification and route it for approval.
                  </p>
                </div>
                <form className="form-grid" onSubmit={handleRequestSubmit}>
                  <div className="form-row">
                    <label htmlFor="title">Title *</label>
                    <input
                      id="title"
                      value={newRequest.title}
                      onChange={(event) =>
                        setNewRequest((prev) => ({
                          ...prev,
                          title: event.target.value,
                        }))
                      }
                      placeholder="e.g., Subscription renewal reminder"
                    />
                  </div>
                  <div className="form-row">
                    <label htmlFor="requester">Requester *</label>
                    <input
                      id="requester"
                      value={newRequest.requester}
                      onChange={(event) =>
                        setNewRequest((prev) => ({
                          ...prev,
                          requester: event.target.value,
                        }))
                      }
                      placeholder="Name or team"
                    />
                  </div>
                  <div className="form-row">
                    <label htmlFor="channel">Channel</label>
                    <select
                      id="channel"
                      value={newRequest.channel}
                      onChange={(event) =>
                        setNewRequest((prev) => ({
                          ...prev,
                          channel: event.target.value,
                        }))
                      }
                    >
                      {channelOptions.slice(1).map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-row">
                    <label htmlFor="priority">Priority</label>
                    <select
                      id="priority"
                      value={newRequest.priority}
                      onChange={(event) =>
                        setNewRequest((prev) => ({
                          ...prev,
                          priority: event.target.value,
                        }))
                      }
                    >
                      {priorityOptions.slice(1).map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-row">
                    <label htmlFor="scheduled">Scheduled for</label>
                    <input
                      id="scheduled"
                      type="datetime-local"
                      value={newRequest.scheduledFor}
                      onChange={(event) =>
                        setNewRequest((prev) => ({
                          ...prev,
                          scheduledFor: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="form-row">
                    <label htmlFor="audience">Audience</label>
                    <input
                      id="audience"
                      value={newRequest.audience}
                      onChange={(event) =>
                        setNewRequest((prev) => ({
                          ...prev,
                          audience: event.target.value,
                        }))
                      }
                      placeholder="e.g., Trial users, Power users"
                    />
                  </div>
                  <div className="form-row">
                    <label htmlFor="region">Region</label>
                    <input
                      id="region"
                      value={newRequest.region}
                      onChange={(event) =>
                        setNewRequest((prev) => ({
                          ...prev,
                          region: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="form-row">
                    <label htmlFor="risk">Risk score</label>
                    <input
                      id="risk"
                      type="number"
                      min="0"
                      max="100"
                      value={newRequest.riskScore}
                      onChange={(event) =>
                        setNewRequest((prev) => ({
                          ...prev,
                          riskScore: Number(event.target.value),
                        }))
                      }
                    />
                  </div>
                  <div className="form-row">
                    <label htmlFor="tags">Tags</label>
                    <input
                      id="tags"
                      value={newRequest.tags}
                      onChange={(event) =>
                        setNewRequest((prev) => ({
                          ...prev,
                          tags: event.target.value,
                        }))
                      }
                      placeholder="Billing, OTP, Product"
                    />
                  </div>
                  <div className="form-row">
                    <label htmlFor="email">Recipient email *</label>
                    <input
                      id="email"
                      type="email"
                      value={newRequest.recipients.email}
                      onChange={(event) =>
                        setNewRequest((prev) => ({
                          ...prev,
                          recipients: {
                            ...prev.recipients,
                            email: event.target.value,
                          },
                        }))
                      }
                      placeholder="ops@company.com"
                    />
                  </div>
                  <div className="form-row">
                    <label htmlFor="phone">Recipient phone *</label>
                    <input
                      id="phone"
                      value={newRequest.recipients.phone}
                      onChange={(event) =>
                        setNewRequest((prev) => ({
                          ...prev,
                          recipients: {
                            ...prev.recipients,
                            phone: event.target.value,
                          },
                        }))
                      }
                      placeholder="+14155550000"
                    />
                  </div>
                  <div className="form-row form-row--full">
                    <label htmlFor="message">Message *</label>
                    <textarea
                      id="message"
                      value={newRequest.message}
                      onChange={(event) =>
                        setNewRequest((prev) => ({
                          ...prev,
                          message: event.target.value,
                        }))
                      }
                      placeholder="Write the exact customer-facing message"
                    />
                  </div>
                  {requestState.status !== "idle" && (
                    <div
                      className={`action-banner action-banner--${requestState.status}`}
                    >
                      {requestState.message}
                    </div>
                  )}
                  <div className="form-actions">
                    <button
                      type="button"
                      className="button button--ghost"
                      onClick={() => setNewRequest(emptyRequest)}
                    >
                      Clear form
                    </button>
                    <button type="submit" className="button button--primary">
                      Submit request
                    </button>
                  </div>
                </form>
              </div>
              <div className="preview-card">
                <h3>Preview</h3>
                <p className="preview-card__title">
                  {newRequest.title || "Notification title"}
                </p>
                <p className="preview-card__meta">
                  {newRequest.channel} - {newRequest.region}
                </p>
                <p className="preview-card__message">
                  {newRequest.message || "Message preview will appear here."}
                </p>
                <div className="preview-card__footer">
                  <span className={priorityStyles[newRequest.priority]}>
                    {newRequest.priority} priority
                  </span>
                  <span className="preview-card__risk">
                    Risk {newRequest.riskScore}
                  </span>
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
