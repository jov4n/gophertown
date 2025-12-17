# Free WebSocket Server Hosting Guide

Here are the best free options for hosting your WebSocket server:

## 🚀 Recommended Options

### 1. **Render.com** ⭐ (Recommended for Free Tier)
- **Free Tier**: ✅ Free tier available (spins down after 15 min inactivity)
- **WebSocket Support**: ✅ Full support
- **Setup**: Very easy, connects to GitHub
- **URL**: https://render.com
- **Detailed Guide**: See [RENDER_DEPLOY.md](./RENDER_DEPLOY.md) for complete instructions
- **Quick Steps**:
  1. Sign up at https://render.com
  2. Click "New +" → "Web Service"
  3. Connect your GitHub repo
  4. Set:
     - **Build Command**: `npm install --include=dev && npm run build && cd server && npm install`
     - **Start Command**: `cd server && node server.js`
     - **Environment**: Node
     - **Plan**: Free
  5. Deploy and get URL (e.g., `https://your-app.onrender.com` and `wss://your-app.onrender.com`)

### 2. **Railway**
- **Free Tier**: $5 credit/month (usually enough for small projects)
- **WebSocket Support**: ✅ Full support
- **Setup**: Very easy, connects to GitHub
- **URL**: https://railway.app
- **Steps**:
  1. Sign up with GitHub
  2. Click "New Project" → "Deploy from GitHub repo"
  3. Select your repo
  4. Railway auto-detects Node.js and deploys
  5. Configure:
     - **Root Directory**: `server`
     - Or set build/start commands to use `server/` folder
  6. Get your WebSocket URL (e.g., `wss://your-app.railway.app`)

### 3. **Fly.io**
- **Free Tier**: ✅ Generous free tier
- **WebSocket Support**: ✅ Full support
- **URL**: https://fly.io
- **Steps**:
  1. Install Fly CLI: `curl -L https://fly.io/install.sh | sh`
  2. Sign up: `fly auth signup`
  3. Create app: `fly launch` (in your server directory)
  4. Deploy: `fly deploy`
  5. Get URL from dashboard

### 4. **Replit**
- **Free Tier**: ✅ Free tier available
- **WebSocket Support**: ✅ Full support
- **URL**: https://replit.com
- **Steps**:
  1. Create new Repl
  2. Upload `server-example.js` and `package-server.json`
  3. Rename `package-server.json` to `package.json`
  4. Run `npm install` then `npm start`
  5. Use Replit's WebSocket URL

### 5. **Glitch**
- **Free Tier**: ✅ Free tier available
- **WebSocket Support**: ✅ Full support
- **URL**: https://glitch.com
- **Steps**:
  1. Create new project
  2. Upload server files
  3. Glitch auto-runs Node.js projects
  4. Get WebSocket URL from project settings

## 📝 Setup Instructions

### Option A: Separate Server Folder (Current Setup)

Your project already has:
- `server/server.js` - Your WebSocket server
- `server/package.json` - Server dependencies
- Root `package.json` - Frontend dependencies

For platforms like Render.com, use:
- **Build Command**: `npm install && npm run build && cd server && npm install`
- **Start Command**: `cd server && node server.js`

### Option B: Monorepo Setup

Keep server files in root and configure hosting platform to:
- Build: `npm install && npm run build && npm install --prefix server`
- Start: `node server/server.js`

## 🔧 Environment Variables

Most platforms automatically set `PORT`. If not, add:
- `PORT=3001` (or whatever port the platform assigns)

## 🔗 Update Client Configuration

After deploying, update `constants.ts`:

```typescript
export const WS_URL = 'wss://your-app.railway.app';
// or
export const WS_URL = 'wss://your-app.onrender.com';
// etc.
```

Or use environment variable:
```typescript
export const WS_URL = (import.meta as any).env?.VITE_WS_URL || 'ws://localhost:3001';
```

Then set `VITE_WS_URL` in your hosting platform's environment variables.

## ⚠️ Important Notes

1. **HTTPS/WSS Required**: Most browsers require secure WebSocket (`wss://`) connections for production
2. **Free Tier Limitations**: 
   - Render: Spins down after 15 min inactivity (takes ~30s to wake up)
   - Railway: Limited by $5/month credit
   - Fly.io: Generous but has usage limits
3. **Keep-Alive**: Some platforms require keep-alive pings to prevent shutdown
4. **CORS**: WebSocket doesn't have CORS, but ensure your server accepts connections from your domain

## 🎯 Quick Start (Render.com - Recommended)

1. Your project is already set up with `server/` folder
2. Push to GitHub (if not already)
3. Go to https://render.com and sign up
4. Click "New +" → "Web Service"
5. Connect your GitHub repo
6. Configure:
   - **Build Command**: `npm install && npm run build && cd server && npm install`
   - **Start Command**: `cd server && node server.js`
   - **Plan**: Free
7. Deploy!
8. Your app will be at `https://your-app-name.onrender.com`
9. WebSocket automatically works at `wss://your-app-name.onrender.com`

**Note**: The frontend WebSocket URL in `constants.ts` will automatically use the correct domain when deployed.

For detailed instructions, see [RENDER_DEPLOY.md](./RENDER_DEPLOY.md)

That's it! 🎉

