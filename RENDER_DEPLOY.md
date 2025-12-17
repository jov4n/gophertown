# Deploying to Render.com (Free Plan)

This guide will help you deploy your TownsBuilder Social app to Render.com's free tier.

## Overview

Render.com's free tier includes:
- ✅ WebSocket support
- ✅ Automatic HTTPS/WSS
- ✅ GitHub integration
- ⚠️ Spins down after 15 minutes of inactivity (takes ~30 seconds to wake up)
- ⚠️ Limited to 750 hours/month (usually enough for small projects)

## Prerequisites

1. A GitHub account
2. Your code pushed to a GitHub repository
3. A Render.com account (sign up at https://render.com)

## Deployment Options

### Option 1: Deploy Everything Together (Recommended)

This deploys both the frontend and WebSocket server together.

#### Step 1: Prepare Your Repository

Your repository should already be set up correctly. Make sure:
- `package.json` exists in the root (for building frontend)
- `server/package.json` exists (for the WebSocket server)
- `server/server.js` exists (your server file)

#### Step 2: Deploy on Render.com

1. **Sign in to Render.com**
   - Go to https://render.com
   - Sign up or log in with your GitHub account

2. **Create a New Web Service**
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select your repository: `townsbuilder-social`

3. **Configure the Service**
   - **Name**: `townsbuilder-social` (or any name you prefer)
   - **Environment**: `Node`
   - **Region**: Choose closest to you (e.g., `Oregon (US West)`)
   - **Branch**: `main` (or your default branch)
   - **Root Directory**: Leave empty (uses root)
   - **Build Command**: 
     ```
     npm install --include=dev && npm run build && cd server && npm install
     ```
   - **Start Command**: 
     ```
     cd server && node server.js
     ```
   - **Plan**: Select `Free`

4. **Environment Variables** (Optional)
   - Render automatically provides `PORT` environment variable
   - You can add custom variables if needed:
     - `NODE_ENV=production`

5. **Deploy**
   - Click "Create Web Service"
   - Render will start building and deploying your app
   - Wait for the build to complete (usually 2-5 minutes)

6. **Get Your URL**
   - Once deployed, your app will be available at:
     - `https://your-app-name.onrender.com`
     - WebSocket: `wss://your-app-name.onrender.com`

#### Step 3: Update Frontend Configuration

Update `constants.ts` with your Render.com URL:

```typescript
export const WS_URL = (import.meta as any).env?.VITE_WS_URL || 
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost' 
    ? `wss://${window.location.hostname}` 
    : 'ws://localhost:8080');
```

Since your server serves both the frontend and WebSocket, the WebSocket URL will automatically match your Render.com domain. The code above should work automatically!

If you need to set it explicitly, you can add an environment variable in Render:
- Key: `VITE_WS_URL`
- Value: `wss://your-app-name.onrender.com`

Then rebuild and redeploy.

### Option 2: Using Render Blueprint (render.yaml)

If you prefer using a configuration file:

1. The `render.yaml` file is already in your repository
2. In Render.com dashboard:
   - Click "New +" → "Blueprint"
   - Connect your GitHub repository
   - Render will automatically detect `render.yaml` and configure the service

## Important Notes

### Free Tier Limitations

1. **Spin Down**: Your app will spin down after 15 minutes of inactivity
   - First request after spin-down takes ~30 seconds to wake up
   - Subsequent requests are fast
   - Consider using a keep-alive service (see below)

2. **Monthly Hours**: 750 hours/month free
   - Usually enough for small projects
   - If you exceed, Render will pause your service

### Keep-Alive (Optional)

To prevent your app from spinning down, you can:

1. **Use a Keep-Alive Service**:
   - Services like https://uptimerobot.com (free tier available)
   - Set up a monitor that pings your app every 10-14 minutes
   - URL: `https://your-app-name.onrender.com`

2. **Add Keep-Alive to Your Server**:
   The server already includes WebSocket ping/pong keep-alive, which helps maintain connections.

### WebSocket Support

Render.com fully supports WebSockets on the free tier. Your WebSocket connections will work at:
- `wss://your-app-name.onrender.com` (secure WebSocket)

### Troubleshooting

1. **Build Fails**:
   - Check build logs in Render dashboard
   - Ensure all dependencies are in `package.json`
   - Verify Node.js version (server requires Node 18+)

2. **WebSocket Not Connecting**:
   - Ensure you're using `wss://` (not `ws://`) for production
   - Check browser console for connection errors
   - Verify server is running (check Render logs)

3. **Static Files Not Loading**:
   - Ensure `npm run build` completes successfully
   - Check that `dist/` folder is created during build
   - Verify server.js is looking in the correct path

4. **App Spins Down Too Often**:
   - Use a keep-alive service (see above)
   - Or upgrade to a paid plan ($7/month for always-on)

## Updating Your Deployment

After making changes:

1. Push to GitHub
2. Render will automatically detect changes and redeploy (if auto-deploy is enabled)
3. Or manually trigger a deploy from the Render dashboard

## Monitoring

- View logs in Render dashboard: Your Service → Logs
- Monitor uptime and performance
- Set up alerts for errors

## Next Steps

1. Deploy to Render.com using the steps above
2. Test your WebSocket connections
3. Share your app URL with others!

For more information, visit: https://render.com/docs

