import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import twilio from "twilio";

dotenv.config();

const app = express();
const port = process.env.PORT || 5174;

const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim())
  : "*";

app.use(cors({ origin: corsOrigins }));
app.use(express.json());

const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM } = process.env;

const twilioClient =
  TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN
    ? twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
    : null;

const requireEnv = (name) => {
  if (!process.env[name]) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
};

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/send-decision", async (req, res) => {
  try {
    const { decision, note, notification } = req.body;

    if (!decision || !notification) {
      return res.status(400).json({ message: "Missing decision payload." });
    }

    const { recipients, title, id } = notification;

    if (!recipients?.phone) {
      return res.status(400).json({ message: "Missing recipient phone." });
    }

    requireEnv("TWILIO_ACCOUNT_SID");
    requireEnv("TWILIO_AUTH_TOKEN");
    requireEnv("TWILIO_FROM");

    if (!twilioClient) {
      throw new Error("Twilio client not configured.");
    }

    const smsBody = `${decision}: ${title} (${id}). ${note ? `Note: ${note}` : ""}`.trim();

    await twilioClient.messages.create({
      from: TWILIO_FROM,
      to: recipients.phone,
      body: smsBody,
    });

    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Failed to send notification.",
    });
  }
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Approval server running on http://localhost:${port}`);
});
