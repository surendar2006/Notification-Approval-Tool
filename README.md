# Notification Approval Tool

A React + Express full-stack app for reviewing and approving outbound notifications.

## Features

- JWT-based authentication (`/api/auth/login` + bearer-protected APIs)
- Persistent notification datastore (`server/data/notifications.json`)
- Full CRUD APIs for notifications
- React frontend wired to backend APIs for fetch/create/update/delete
- Decision workflow API (`/api/send-decision`) integrated with Twilio SMS
- Basic security headers, server-side validation, and error logging

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Configure environment variables (copy from `.env.example`):

- `JWT_SECRET` is required for auth.
- `TWILIO_*` vars are required for the decision SMS endpoint.
- `BLOB_READ_WRITE_TOKEN` enables persistent storage on Vercel deployments.

3. Run backend:

```bash
npm run dev:server
```

4. Run frontend:

```bash
npm run dev
```

Frontend runs on `http://localhost:5173` and backend defaults to `http://localhost:5174`.

## Vercel deployment notes

- `vercel.json` routes `/api/*` to the Express app through `api/index.js`
- Add `JWT_SECRET`, `CORS_ORIGIN`, and `SERVER_BASE_URL` in Vercel project environment variables
- Add `BLOB_READ_WRITE_TOKEN` if you want notifications to persist across deploys and cold starts
- If frontend and backend are deployed in the same Vercel project, leave `VITE_API_BASE_URL` empty

## API Testing (Postman / Thunder Client)

- Import [postman/notification-approval-tool.postman_collection.json](./postman/notification-approval-tool.postman_collection.json)
- Run `Auth Login` first and copy `token` into the collection variable.
- Run CRUD requests (`List`, `Create`, `Update`, `Delete`) and decision request.

## Troubleshooting dependency installation

If `npm install` fails with a `403 Forbidden` when fetching packages like
`@vitejs/plugin-react`, your environment is likely blocking access to the
public npm registry. Try the following:

1. Use an approved registry:

```bash
npm config set registry https://registry.npmjs.org/
npm install
```

2. Verify proxy settings if your network requires them:

```bash
npm config set proxy http://proxy.example.com:8080
npm config set https-proxy http://proxy.example.com:8080
npm install
```

Cmd Codes to Run:
cd "C:\Users\Surendar\Downloads\Notification-Approval-Tool-18799d854c425b6bcf1e791303d62687ce4e2136\Notification-Approval-Tool-18799d854c425b6bcf1e791303d62687ce4e2136"

npm.cmd run dev:server

npm.cmd run dev
