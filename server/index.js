import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { promises as fs } from "fs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import path from "path";
import twilio from "twilio";
import { get as getBlob, put as putBlob } from "@vercel/blob";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
app.disable("x-powered-by");
const port = process.env.PORT || 5174;
const jwtSecret =
  process.env.JWT_SECRET ||
  (process.env.NODE_ENV === "production" ? "" : "dev-local-jwt-secret");
const serverBaseUrl = String(process.env.SERVER_BASE_URL || `http://localhost:${port}`).trim();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isVercel = Boolean(process.env.VERCEL);
const blobToken = String(process.env.BLOB_READ_WRITE_TOKEN || "").trim();
const useBlobStore = Boolean(blobToken);
const notificationsBlobPath = "data/notifications.json";
const bundledDataDir = path.join(__dirname, "data");
const bundledDataFile = path.join(bundledDataDir, "notifications.json");
const dataDir = isVercel ? path.join("/tmp", "notification-approval-tool-data") : bundledDataDir;
const dataFile = path.join(dataDir, "notifications.json");

const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim())
  : ["http://localhost:5173"];

// Security: CORS + JSON body limit
app.use(cors({ origin: corsOrigins }));
app.use(express.json({ limit: "1mb" }));
// Security headers
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});

const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM } = process.env;
const twilioClient =
  TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN
    ? twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
    : null;

const smtpHost = String(process.env.SMTP_HOST || "").trim();
const smtpPort = Number(String(process.env.SMTP_PORT || "587").trim());
const smtpSecure = String(process.env.SMTP_SECURE || "false").trim().toLowerCase() === "true";
const smtpUser = String(process.env.SMTP_USER || "").trim();
const smtpPass = String(process.env.SMTP_PASS || "").replace(/\s+/g, "");
const smtpFrom = String(process.env.SMTP_FROM || "").trim();

const smtpConfigured =
  Boolean(smtpHost) &&
  Boolean(smtpUser) &&
  Boolean(smtpPass) &&
  Boolean(smtpFrom);

const smtpTransporter = smtpConfigured
  ? nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    })
  : null;

const db = {
  connected: false,
  notifications: [],
};

const nowIso = () => new Date().toISOString();
const makeId = () => `NTF-${Math.floor(2000 + Math.random() * 8000)}`;

const defaultChecklist = [
  { label: "Brand voice approved", done: false },
  { label: "Policy review completed", done: false },
  { label: "Legal compliance check", done: false },
  { label: "QA link validation", done: false },
];

const normalizeNotification = (notification) => ({
  id: notification.id || makeId(),
  title: String(notification.title || "").trim(),
  channel: notification.channel || "Email",
  mentor: String(notification.mentor || notification.requester || "").trim(),
  requesterName: String(notification.requesterName || "").trim(),
  requesterEmail: String(notification.requesterEmail || "").trim().toLowerCase(),
  createdByEmail: String(notification.createdByEmail || "").trim().toLowerCase(),
  createdAt: notification.createdAt || nowIso(),
  scheduledFor: notification.scheduledFor || nowIso(),
  priority: notification.priority || "Medium",
  status: notification.status || "Pending",
  audience: notification.audience || "",
  region: notification.region || "North America",
  riskScore: Number.isFinite(notification.riskScore)
    ? notification.riskScore
    : Number(notification.riskScore || 50),
  tags: Array.isArray(notification.tags)
    ? notification.tags.filter(Boolean)
    : String(notification.tags || "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
  recipients: {
    email: String(notification?.recipients?.email || "").trim(),
    phone: String(notification?.recipients?.phone || "").trim(),
  },
  message: String(notification.message || "").trim(),
  checklist: Array.isArray(notification.checklist)
    ? notification.checklist
    : defaultChecklist,
  audit: Array.isArray(notification.audit) ? notification.audit : [],
});

// Input validation
const validateRequired = (payload) => {
  const requiredFields = [
    "title",
    "mentor",
    "message",
    "recipients.email",
    "recipients.phone",
  ];

  for (const field of requiredFields) {
    if (field === "recipients.email" && !payload?.recipients?.email?.trim()) {
      return "Recipient email is required.";
    }
    if (field === "recipients.phone" && !payload?.recipients?.phone?.trim()) {
      return "Recipient phone is required.";
    }
    if (!["recipients.email", "recipients.phone"].includes(field) && !String(payload?.[field] || "").trim()) {
      return `${field} is required.`;
    }
  }

  if (payload.riskScore !== undefined) {
    const riskScore = Number(payload.riskScore);
    if (!Number.isFinite(riskScore) || riskScore < 0 || riskScore > 100) {
      return "riskScore must be between 0 and 100.";
    }
  }

  return null;
};

// Logging
const logError = (req, error) => {
  // eslint-disable-next-line no-console
  console.error(
    JSON.stringify({
      level: "error",
      time: nowIso(),
      method: req.method,
      path: req.path,
      message: error.message,
    })
  );
};

const requireEnv = (name) => {
  if (!process.env[name]) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
};

const readStreamToText = async (stream) => {
  if (!stream) {
    return "";
  }

  const response = new Response(stream);
  return response.text();
};

const readNotificationsFromBlob = async () => {
  const blob = await getBlob(notificationsBlobPath, {
    access: "private",
    token: blobToken,
  });

  if (!blob?.stream) {
    return [];
  }

  const raw = await readStreamToText(blob.stream);
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
};

const writeNotificationsToBlob = async (notifications) => {
  await putBlob(notificationsBlobPath, JSON.stringify(notifications, null, 2), {
    access: "private",
    addRandomSuffix: false,
    overwrite: true,
    contentType: "application/json",
    token: blobToken,
  });
};

// "Database" connection: file-based persistence
const connectDatabase = async () => {
  if (useBlobStore) {
    try {
      const items = await readNotificationsFromBlob();
      db.notifications = items.map(normalizeNotification);
      db.connected = true;
      return;
    } catch (error) {
      if (error?.name !== "BlobNotFoundError") {
        throw error;
      }

      const bundledRaw = await fs.readFile(bundledDataFile, "utf8");
      const parsed = JSON.parse(bundledRaw);
      const items = Array.isArray(parsed) ? parsed : [];
      db.notifications = items.map(normalizeNotification);
      await writeNotificationsToBlob(db.notifications);
      db.connected = true;
      return;
    }
  }

  await fs.mkdir(dataDir, { recursive: true });

  try {
    await fs.access(dataFile);
  } catch {
    let initialData = [];
    try {
      const bundledRaw = await fs.readFile(bundledDataFile, "utf8");
      const parsed = JSON.parse(bundledRaw);
      initialData = Array.isArray(parsed) ? parsed : [];
    } catch {
      initialData = [];
    }
    await fs.writeFile(dataFile, JSON.stringify(initialData, null, 2));
  }

  const raw = await fs.readFile(dataFile, "utf8");
  const parsed = JSON.parse(raw);
  const items = Array.isArray(parsed) ? parsed : [];
  db.notifications = items.map(normalizeNotification);
  const migrated = items.some((item) => item.requester && !item.mentor);
  if (migrated) {
    await saveDatabase();
  }
  db.connected = true;
};

// Persist to JSON file
const saveDatabase = async () => {
  if (useBlobStore) {
    await writeNotificationsToBlob(db.notifications);
    return;
  }

  await fs.writeFile(dataFile, JSON.stringify(db.notifications, null, 2));
};

// Auth: JWT action token builder
const buildDecisionActionToken = ({
  notificationId,
  decision,
  recipientEmail,
  notifyEmail,
}) => {
  if (!jwtSecret) {
    throw new Error("JWT auth is not configured on server.");
  }

  return jwt.sign(
    {
      type: "decision-action",
      notificationId,
      decision,
      recipientEmail: String(recipientEmail || "").trim().toLowerCase(),
      notifyEmail: String(notifyEmail || "").trim().toLowerCase(),
    },
    jwtSecret,
    { expiresIn: "48h" }
  );
};

const buildDecisionActionLink = ({
  notificationId,
  decision,
  recipientEmail,
  notifyEmail,
}) => {
  const token = buildDecisionActionToken({
    notificationId,
    decision,
    recipientEmail,
    notifyEmail,
  });
  return `${serverBaseUrl}/api/decision-action?token=${encodeURIComponent(token)}`;
};

const extractScheduleWindow = (scheduledFor) => {
  const raw = String(scheduledFor || "").trim();
  if (!raw) {
    return { from: "Not provided", to: "Not provided" };
  }

  const parts = raw.split(" to ");
  if (parts.length >= 2) {
    return {
      from: parts[0].trim() || "Not provided",
      to: parts.slice(1).join(" to ").trim() || "Not provided",
    };
  }

  return { from: raw, to: "Not provided" };
};

const sendApprovalActionEmail = async ({ notification }) => {
  const toList = [
    String(notification?.recipients?.email || "").trim().toLowerCase(),
  ].filter(Boolean);
  const uniqueRecipients = [...new Set(toList)];

  if (uniqueRecipients.length === 0) {
    return { sent: false, reason: "No email recipients found." };
  }

  if (!smtpTransporter) {
    return {
      sent: false,
      reason: "SMTP is not configured. Set SMTP_HOST/SMTP_USER/SMTP_PASS/SMTP_FROM.",
    };
  }

  const approveLink = buildDecisionActionLink({
    notificationId: notification.id,
    decision: "Approved",
    recipientEmail: notification?.recipients?.email,
    notifyEmail: notification?.createdByEmail,
  });
  const rejectLink = buildDecisionActionLink({
    notificationId: notification.id,
    decision: "Rejected",
    recipientEmail: notification?.recipients?.email,
    notifyEmail: notification?.createdByEmail,
  });

  const subject = `Approval required: ${notification.title} (${notification.id})`;
  const schedule = extractScheduleWindow(notification?.scheduledFor);
  const text = [
    `A new approval request requires action.`,
    `Title: ${notification.title}`,
    `Request ID: ${notification.id}`,
    `Mentor: ${notification.mentor}`,
    `From date and time: ${schedule.from}`,
    `To date and time: ${schedule.to}`,
    `Reason: ${notification.message || "Not provided"}`,
    "",
    `Approve: ${approveLink}`,
    `Reject: ${rejectLink}`,
  ].join("\n");

  const requester =
    notification.requesterName || notification.createdByEmail || "Not provided";
  const reason = notification.message || "Not provided";

  const html = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Approval Request</title>
      </head>
      <body style="margin:0; padding:0; background-color:#f4f6fb; color:#1f2937;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f4f6fb; padding:24px 12px; font-family: 'Segoe UI', Arial, sans-serif;">
          <tr>
            <td align="center">
              <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px; width:100%; background-color:#ffffff; border:1px solid #e5e7eb; border-radius:16px; box-shadow:0 12px 24px rgba(31,41,55,0.08); overflow:hidden;">
                <tr>
                  <td style="padding:24px 28px; border-bottom:1px solid #e5e7eb;">
                    <h1 style="margin:0; font-size:22px; line-height:1.3; letter-spacing:-0.2px;">Approval Request</h1>
                    <p style="margin:8px 0 0; font-size:14px; color:#6b7280;">Notification Approval System</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:20px 28px 8px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td style="padding:10px 0; border-bottom:1px solid #e5e7eb; width:38%; font-size:14px; color:#6b7280;">Title</td>
                        <td style="padding:10px 0; border-bottom:1px solid #e5e7eb; font-size:14px; font-weight:600;">${notification.title}</td>
                      </tr>
                      <tr>
                        <td style="padding:10px 0; border-bottom:1px solid #e5e7eb; width:38%; font-size:14px; color:#6b7280;">Request ID</td>
                        <td style="padding:10px 0; border-bottom:1px solid #e5e7eb; font-size:14px; font-weight:600;">${notification.id}</td>
                      </tr>
                      <tr>
                        <td style="padding:10px 0; border-bottom:1px solid #e5e7eb; width:38%; font-size:14px; color:#6b7280;">Mentor</td>
                        <td style="padding:10px 0; border-bottom:1px solid #e5e7eb; font-size:14px;">${notification.mentor}</td>
                      </tr>
                      <tr>
                        <td style="padding:10px 0; border-bottom:1px solid #e5e7eb; width:38%; font-size:14px; color:#6b7280;">Requester</td>
                        <td style="padding:10px 0; border-bottom:1px solid #e5e7eb; font-size:14px;">${requester}</td>
                      </tr>
                      <tr>
                        <td style="padding:10px 0; border-bottom:1px solid #e5e7eb; width:38%; font-size:14px; color:#6b7280;">From date and time</td>
                        <td style="padding:10px 0; border-bottom:1px solid #e5e7eb; font-size:14px;">${schedule.from}</td>
                      </tr>
                      <tr>
                        <td style="padding:10px 0; border-bottom:1px solid #e5e7eb; width:38%; font-size:14px; color:#6b7280;">To date and time</td>
                        <td style="padding:10px 0; border-bottom:1px solid #e5e7eb; font-size:14px;">${schedule.to}</td>
                      </tr>
                      <tr>
                        <td style="padding:10px 0; width:38%; font-size:14px; color:#6b7280;">Reason</td>
                        <td style="padding:10px 0; font-size:14px;">${reason}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 28px 24px;">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-right:12px;">
                          <a href="${approveLink}" style="display:inline-block; padding:12px 20px; background-color:#16a34a; color:#ffffff; text-decoration:none; border-radius:10px; font-size:14px; font-weight:600;">Approve</a>
                        </td>
                        <td>
                          <a href="${rejectLink}" style="display:inline-block; padding:12px 20px; background-color:#dc2626; color:#ffffff; text-decoration:none; border-radius:10px; font-size:14px; font-weight:600;">Reject</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 28px 24px; border-top:1px solid #e5e7eb;">
                    <p style="margin:0; font-size:12px; color:#6b7280;">If the buttons don’t work, copy and paste the links into your browser.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  await smtpTransporter.sendMail({
    from: smtpFrom,
    to: uniqueRecipients.join(","),
    subject,
    text,
    html,
  });

  return { sent: true };
};

const sendDecisionEmail = async ({ notification, decision, note, approverEmail }) => {
  const toList = [
    String(notification?.recipients?.email || "").trim().toLowerCase(),
    String(approverEmail || "").trim().toLowerCase(),
  ].filter(Boolean);
  const uniqueRecipients = [...new Set(toList)];

  if (uniqueRecipients.length === 0) {
    return { sent: false, reason: "No email recipients found." };
  }

  if (!smtpTransporter) {
    return {
      sent: false,
      reason: "SMTP is not configured. Set SMTP_HOST/SMTP_USER/SMTP_PASS/SMTP_FROM.",
    };
  }

  const subject = `${decision}: ${notification.title} (${notification.id})`;
  const schedule = extractScheduleWindow(notification?.scheduledFor);
  const text = [
    `Decision: ${decision}`,
    `Title: ${notification.title}`,
    `Request ID: ${notification.id}`,
    `Mentor: ${notification.mentor}`,
    `From date and time: ${schedule.from}`,
    `To date and time: ${schedule.to}`,
    `Reason: ${notification.message || "Not provided"}`,
    note ? `Note: ${note}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  await smtpTransporter.sendMail({
    from: smtpFrom,
    to: uniqueRecipients.join(","),
    subject,
    text,
  });

  return { sent: true };
};

const sendDecisionResultEmailToUser = async ({ notification, decision, userEmail }) => {
  const to = String(userEmail || "").trim().toLowerCase();
  if (!to) {
    return { sent: false, reason: "No user email found." };
  }

  if (!smtpTransporter) {
    return {
      sent: false,
      reason: "SMTP is not configured. Set SMTP_HOST/SMTP_USER/SMTP_PASS/SMTP_FROM.",
    };
  }

  const schedule = extractScheduleWindow(notification?.scheduledFor);
  const subject = `Leave ${decision.toLowerCase()}: ${notification.title} (${notification.id})`;
  const text = [
    `Your leave request has been ${decision.toLowerCase()}.`,
    `Title: ${notification.title}`,
    `Request ID: ${notification.id}`,
    `Mentor: ${notification.mentor}`,
    `From date and time: ${schedule.from}`,
    `To date and time: ${schedule.to}`,
    `Reason: ${notification.message || "Not provided"}`,
  ].join("\n");

  await smtpTransporter.sendMail({
    from: smtpFrom,
    to,
    subject,
    text,
  });

  return { sent: true };
};

const sendDeletionEmailToUser = async ({ notification, userEmail }) => {
  const to = String(userEmail || "").trim().toLowerCase();
  if (!to) {
    return { sent: false, reason: "No user email found." };
  }

  if (!smtpTransporter) {
    return {
      sent: false,
      reason: "SMTP is not configured. Set SMTP_HOST/SMTP_USER/SMTP_PASS/SMTP_FROM.",
    };
  }

  const schedule = extractScheduleWindow(notification?.scheduledFor);
  const subject = `Request deleted: ${notification.title} (${notification.id})`;
  const text = [
    `Your request has been deleted.`,
    `Title: ${notification.title}`,
    `Request ID: ${notification.id}`,
    `Mentor: ${notification.mentor}`,
    `From date and time: ${schedule.from}`,
    `To date and time: ${schedule.to}`,
    `Reason: ${notification.message || "Not provided"}`,
  ].join("\n");

  await smtpTransporter.sendMail({
    from: smtpFrom,
    to,
    subject,
    text,
  });

  return { sent: true };
};

// Auth: JWT verification middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({ message: "Missing bearer token." });
  }

  try {
    if (!jwtSecret) {
      return res.status(500).json({
        message: "JWT auth is not configured on server.",
      });
    }
    const decoded = jwt.verify(token, jwtSecret);
    req.user = decoded;
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
};

// REST: health check
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, dbConnected: db.connected, authConfigured: Boolean(jwtSecret) });
});

// REST: login -> JWT
app.post("/api/auth/login", (req, res) => {
  try {
    const { email, name } = req.body || {};

    if (!String(email || "").trim() || !String(name || "").trim()) {
      return res.status(400).json({ message: "name and email are required." });
    }

    if (!jwtSecret) {
      return res.status(500).json({
        message: "JWT auth is not configured on server.",
      });
    }

    const token = jwt.sign(
      {
        email: String(email).trim().toLowerCase(),
        name: String(name).trim(),
      },
      jwtSecret,
      { expiresIn: "8h" }
    );

    return res.json({ token });
  } catch (error) {
    logError(req, error);
    return res.status(500).json({
      message: error.message || "Failed to authenticate user.",
    });
  }
});

// REST: read notifications (R)
app.get("/api/notifications", authenticateToken, (_req, res) => {
  const notifications = [...db.notifications].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  res.json({ items: notifications });
});

// REST: decision action link handler
app.get("/api/decision-action", async (req, res) => {
  try {
    const token = String(req.query?.token || "");
    if (!token) {
      return res.status(400).send("Missing decision token.");
    }

    if (!jwtSecret) {
      return res.status(500).send("JWT auth is not configured on server.");
    }

    const decoded = jwt.verify(token, jwtSecret);
    if (
      decoded?.type !== "decision-action" ||
      !decoded?.notificationId ||
      !["Approved", "Rejected"].includes(decoded?.decision)
    ) {
      return res.status(400).send("Invalid decision token.");
    }

    const index = db.notifications.findIndex((item) => item.id === decoded.notificationId);
    if (index < 0) {
      return res.status(404).send("Notification not found.");
    }

    const notification = db.notifications[index];
    const updated = {
      ...notification,
      status: decoded.decision,
      audit: [
        ...notification.audit,
        {
          time: nowIso(),
          item: `${decoded.decision} via email action${decoded.recipientEmail ? ` by ${decoded.recipientEmail}` : ""}`,
        },
      ],
    };

    db.notifications[index] = updated;
    await saveDatabase();

    let userEmailResult = {
      sent: false,
      reason: "User confirmation email not attempted.",
    };
    try {
      userEmailResult = await sendDecisionResultEmailToUser({
        notification: updated,
        decision: decoded.decision,
        userEmail: decoded.notifyEmail || updated.createdByEmail,
      });
    } catch (mailError) {
      userEmailResult = {
        sent: false,
        reason: mailError.message || "Failed to send user confirmation email.",
      };
    }

    return res.send(
      `<html><body style="font-family:Arial,sans-serif;padding:24px;"><h2>Decision recorded</h2><p>Status set to <strong>${decoded.decision}</strong> for <strong>${notification.id}</strong>.</p><p>User confirmation email: <strong>${userEmailResult.sent ? "sent" : "not sent"}</strong>${userEmailResult.reason ? ` (${userEmailResult.reason})` : ""}</p></body></html>`
    );
  } catch (error) {
    return res.status(400).send("Invalid or expired decision token.");
  }
});

// REST: create notification (C)
app.post("/api/notifications", authenticateToken, async (req, res) => {
  try {
    const validationError = validateRequired(req.body || {});
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const notification = normalizeNotification({
      ...req.body,
      id: makeId(),
      status: "Pending",
      createdByEmail: req.user?.email,
      createdAt: nowIso(),
      audit: [
        {
          time: nowIso(),
          item: `Submitted by ${String(req.body.mentor || "Unknown")}`,
        },
      ],
    });

    db.notifications.unshift(notification);
    await saveDatabase();

    let actionEmail = { sent: false, reason: "Approval action email not attempted." };
    try {
      actionEmail = await sendApprovalActionEmail({
        notification,
      });
    } catch (emailError) {
      actionEmail = {
        sent: false,
        reason: emailError.message || "Failed to send approval action email.",
      };
    }

    return res.status(201).json({ item: notification, actionEmail });
  } catch (error) {
    logError(req, error);
    return res.status(500).json({ message: "Failed to create notification." });
  }
});

// REST: update notification (U)
app.put("/api/notifications/:id", authenticateToken, async (req, res) => {
  try {
    const validationError = validateRequired(req.body || {});
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const index = db.notifications.findIndex((item) => item.id === req.params.id);
    if (index < 0) {
      return res.status(404).json({ message: "Notification not found." });
    }

    const existing = db.notifications[index];
    const updated = normalizeNotification({
      ...existing,
      ...req.body,
      id: existing.id,
      createdAt: existing.createdAt,
      audit: [
        ...existing.audit,
        { time: nowIso(), item: `Updated by ${req.user.name}` },
      ],
    });

    db.notifications[index] = updated;
    await saveDatabase();
    return res.json({ item: updated });
  } catch (error) {
    logError(req, error);
    return res.status(500).json({ message: "Failed to update notification." });
  }
});

// REST: partial update (status)
app.patch("/api/notifications/:id/status", authenticateToken, async (req, res) => {
  try {
    const { status } = req.body || {};
    const allowedStatuses = new Set(["Pending", "Approved", "Rejected"]);
    if (!allowedStatuses.has(status)) {
      return res.status(400).json({ message: "Invalid status value." });
    }

    const index = db.notifications.findIndex((item) => item.id === req.params.id);
    if (index < 0) {
      return res.status(404).json({ message: "Notification not found." });
    }

    const existing = db.notifications[index];
    const updated = {
      ...existing,
      status,
      audit: [
        ...existing.audit,
        { time: nowIso(), item: `Status changed to ${status} by ${req.user.name}` },
      ],
    };

    db.notifications[index] = updated;
    await saveDatabase();
    return res.json({ item: updated });
  } catch (error) {
    logError(req, error);
    return res.status(500).json({ message: "Failed to change status." });
  }
});

// REST: delete notification (D)
app.delete("/api/notifications/:id", authenticateToken, async (req, res) => {
  try {
    const index = db.notifications.findIndex((item) => item.id === req.params.id);
    if (index < 0) {
      return res.status(404).json({ message: "Notification not found." });
    }

    const deletedItem = db.notifications[index];
    db.notifications.splice(index, 1);
    await saveDatabase();

    let deletionEmail = {
      sent: false,
      reason: "Deletion email not attempted.",
    };
    try {
      deletionEmail = await sendDeletionEmailToUser({
        notification: deletedItem,
        userEmail: req.user?.email || deletedItem.createdByEmail,
      });
    } catch (mailError) {
      deletionEmail = {
        sent: false,
        reason: mailError.message || "Failed to send deletion email.",
      };
    }

    return res.json({ ok: true, email: deletionEmail });
  } catch (error) {
    logError(req, error);
    return res.status(500).json({ message: "Failed to delete notification." });
  }
});

// REST: send decision notifications
app.post("/api/send-decision", authenticateToken, async (req, res) => {
  try {
    const { decision, note, notificationId } = req.body || {};

    if (!["Approved", "Rejected"].includes(decision)) {
      return res.status(400).json({ message: "Invalid decision value." });
    }

    const index = db.notifications.findIndex((item) => item.id === notificationId);
    if (index < 0) {
      return res.status(404).json({ message: "Notification not found." });
    }

    const notification = db.notifications[index];
    const warnings = [];
    let smsResult = { sent: false, reason: "SMS not attempted." };
    let emailResult = { sent: false, reason: "Email not attempted." };

    if (notification?.recipients?.phone) {
      try {
        if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM || !twilioClient) {
          smsResult = {
            sent: false,
            reason: "Twilio is not configured. Set TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_FROM.",
          };
        } else {
          const smsBody = `${decision}: ${notification.title} (${notification.id}). ${note ? `Note: ${note}` : ""}`.trim();
          await twilioClient.messages.create({
            from: TWILIO_FROM,
            to: notification.recipients.phone,
            body: smsBody,
          });
          smsResult = { sent: true };
        }
      } catch (smsError) {
        smsResult = { sent: false, reason: smsError.message || "Failed to send SMS." };
      }
    } else {
      smsResult = { sent: false, reason: "Missing mentor phone." };
    }

    try {
      emailResult = await sendDecisionEmail({
        notification,
        decision,
        note,
        approverEmail: req.user?.email,
      });
    } catch (emailError) {
      emailResult = {
        sent: false,
        reason: emailError.message || "Failed to send email.",
      };
    }

    if (!smsResult.sent && smsResult.reason) {
      warnings.push(`SMS: ${smsResult.reason}`);
    }
    if (!emailResult.sent && emailResult.reason) {
      warnings.push(`Email: ${emailResult.reason}`);
    }

    const updated = {
      ...notification,
      status: decision,
      audit: [
        ...notification.audit,
        {
          time: nowIso(),
          item: `${decision} by ${req.user.name}${note ? ` with note: ${note}` : ""}`,
        },
      ],
    };

    db.notifications[index] = updated;
    await saveDatabase();

    return res.json({
      ok: true,
      item: updated,
      sms: smsResult,
      email: emailResult,
      warnings,
    });
  } catch (error) {
    logError(req, error);
    return res.status(500).json({
      message: error.message || "Failed to send notification.",
    });
  }
});

// Error handling middleware
app.use((error, req, res, _next) => {
  logError(req, error);
  res.status(500).json({ message: "Unexpected server error." });
});

await connectDatabase();

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === __filename;

if (isDirectRun) {
  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Approval server running on http://localhost:${port}`);
  });
}

export default app;
