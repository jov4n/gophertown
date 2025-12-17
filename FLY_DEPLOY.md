# Fly.io Full-Stack Deployment Guide

This guide will help you deploy both the frontend and WebSocket server to Fly.io.

## Prerequisites

1. Fly.io CLI installed: https://fly.io/docs/getting-started/installing-flyctl/
2. Fly.io account (free trial available)
3. Node.js installed locally

## Deployment Steps

### 1. Build Frontend Locally (Optional - Docker will do this)

```bash
npm install
npm run build
```

This creates a `dist/` folder with your built frontend.

### 2. Deploy to Fly.io

From the **root directory** (not server/):

```bash
# If you haven't launched yet
fly launch

# Or if you already have an app
fly deploy
```

The deployment will:
- Build the frontend using the Dockerfile
- Copy the built files to the server
- Deploy everything together

### 3. Get Your URLs

After deployment:

```bash
fly status
```

Your app will be available at:
- **Frontend**: `https://townsbuilder-social.fly.dev`
- **WebSocket**: `wss://townsbuilder-social.fly.dev`

### 4. Update WebSocket URL

Update `constants.ts`:

```typescript
export const WS_URL = 'wss://townsbuilder-social.fly.dev';
```

Then rebuild and redeploy:
```bash
npm run build
fly deploy
```

## Troubleshooting

### Check Logs
```bash
fly logs
```

### SSH into Container
```bash
fly ssh console
```

### Restart App
```bash
fly apps restart townsbuilder-social
```

### View App Info
```bash
fly status
fly info
```

## Environment Variables

If you need to set environment variables:

```bash
fly secrets set VITE_WS_URL=wss://townsbuilder-social.fly.dev
```

## Cost

Fly.io free trial includes:
- 3 shared-cpu-1x VMs with 256MB RAM
- 160GB outbound data transfer
- This setup uses ~512MB RAM, so you can run it on the free tier

## Notes

- The app auto-stops after inactivity (saves resources)
- First request after idle may take ~30 seconds to wake up
- WebSocket connections work seamlessly with the HTTP server

