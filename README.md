# Notification Approval Tool

A React-based interface for reviewing and approving outbound notifications.

## Getting Started

```bash
npm install
npm run dev
```

The dev server runs on `http://localhost:5173`.

## Troubleshooting dependency installation

If `npm install` fails with a `403 Forbidden` when fetching packages like
`@vitejs/plugin-react`, your environment is likely blocking access to the
public npm registry. Try the following:

1. **Use an approved registry** (common in enterprise environments):
   ```bash
   npm config set registry https://registry.npmjs.org/
   npm install
   ```
   If your organization provides an internal registry (for example, Artifactory
   or Verdaccio), set that URL instead.

2. **Verify proxy settings** if your network requires them:
   ```bash
   npm config set proxy http://proxy.example.com:8080
   npm config set https-proxy http://proxy.example.com:8080
   npm install
   ```

3. **Check for blocked packages or scopes** in your security policy. Some
   environments restrict specific packages or scopes. If that's the case, ask
   your administrator to allowlist `@vitejs/plugin-react` and its dependencies.
