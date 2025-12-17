# Deployment Guide

## Architecture

- **Frontend**: Deploy to GitHub Pages (static files)
- **WebSocket Server**: Deploy to Fly.io (in `server/` directory)

## Step 1: Deploy Frontend to GitHub Pages

1. Build your frontend:
   ```bash
   npm run build
   ```

2. This creates a `dist/` folder with all static files

3. Push to GitHub and enable GitHub Pages:
   - Go to your repo → Settings → Pages
   - Source: Deploy from a branch
   - Branch: `main` (or your branch)
   - Folder: `/dist` (or `/` if you copy dist contents to root)

4. Your frontend will be at: `https://yourusername.github.io/townsbuilder-social/`

## Step 2: Deploy WebSocket Server to Fly.io

1. Navigate to server directory:
   ```bash
   cd server
   ```

2. Deploy:
   ```bash
   fly launch
   fly deploy
   ```

3. Get your WebSocket URL: `wss://your-app-name.fly.dev`

## Step 3: Update Frontend Configuration

Update `constants.ts` with your Fly.io WebSocket URL:

```typescript
export const WS_URL = 'wss://your-app-name.fly.dev';
```

Then rebuild and redeploy to GitHub Pages.

## Alternative: Serve Frontend from Fly.io

If you want to serve the frontend from Fly.io too, you need to:

1. Build the frontend: `npm run build`
2. Update the server to serve static files (see below)
3. Deploy from root directory (not server/)

But **GitHub Pages is recommended** for the frontend as it's simpler and free.

