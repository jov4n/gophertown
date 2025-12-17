# TownsBuilder WebSocket Server

WebSocket server for the TownsBuilder Social game.

## Local Development

```bash
cd server
npm install
npm start
```

Server will run on `ws://localhost:8080`

## Deploy to Fly.io

1. Make sure you're in the `server/` directory
2. Run `fly launch` (or `flyctl launch` if using the full CLI name)
3. Follow the prompts:
   - Choose an app name (or use the default)
   - Select a region (e.g., `iad` for US East)
   - Don't deploy yet if asked (we'll do that next)
4. Run `fly deploy`
5. Get your WebSocket URL: `wss://your-app-name.fly.dev`

## Update Client

After deployment, update `constants.ts` in the root directory:

```typescript
export const WS_URL = 'wss://your-app-name.fly.dev';
```

Or use environment variable:
```typescript
export const WS_URL = (import.meta as any).env?.VITE_WS_URL || 'ws://localhost:8080';
```

Then set `VITE_WS_URL=wss://your-app-name.fly.dev` in your frontend hosting environment.

