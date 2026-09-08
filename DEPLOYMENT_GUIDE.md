# Deployment Guide for Tidepool

## Quick Setup for Hackathon

### Option 1: Deploy Backend to Railway (Easiest)

1. Go to [railway.app](https://railway.app) and sign up
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your `Valorian0108/Over-Watch` repo
4. Configure:
   - **Root Directory**: `api-server-simple`
   - **Start Command**: `node server.js`
5. Add Environment Variable:
   - `COINMARKETCAP_API_KEY` = Your CMC API key
6. Deploy and get the Railway URL (e.g., `https://tidepool-api.up.railway.app`)

### Option 2: Deploy Backend to Render

1. Go to [render.com](https://render.com) and sign up
2. Click "New +" → "Web Service"
3. Connect your GitHub repo
4. Configure:
   - **Root Directory**: `api-server-simple`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
5. Add Environment Variable:
   - `COINMARKETCAP_API_KEY` = Your CMC API key
6. Deploy and get the Render URL

### Configure Frontend

Once you have your backend URL (from Railway/Render):

1. Go to your Vercel project settings
2. Add Environment Variable:
   - `VITE_API_URL` = Your backend URL + `/api`
   - Example: `https://tidepool-api.up.railway.app/api`
3. Redeploy the frontend

### Testing

1. Test backend: `https://your-backend-url/api/healthz`
2. Test frontend: `https://your-frontend-url.vercel.app`
3. The frontend should fetch live market data from your backend

### For Hackathon Submission

You'll need:
- Frontend URL (Vercel)
- Backend URL (Railway/Render)
- Both working with real CMC data
- COINMARKETCAP_API_KEY configured on backend