# PropTrack - NHL Player Line Tracker (Backend-Protected Edition)

## 🎯 Overview

PropTrack moves all proprietary calculations to secure backend API endpoints, protecting your intellectual property while maintaining the exact same user experience.

## 📁 File Structure

```
proptrack/
├── api/
│   ├── calculate-rankings.js          # Player ranking algorithm (PROPRIETARY)
│   ├── calculate-goalie-rankings.js   # Goalie ranking algorithm (PROPRIETARY)
│   ├── calculate-hit-rates.js         # Hit rate calculations (PROPRIETARY)
│   ├── update-data.js                 # Daily data fetch cron job
│   ├── get-data.js                    # Serve cached data
│   └── nhl.js                         # NHL API proxy
├── public/
│   ├── index.html                     # Frontend (calculations via API)
│   ├── config.js                      # Configuration file
│   └── favicon.png                    # Site icon
├── package.json                       # Dependencies
├── vercel.json                        # Vercel configuration
└── README.md                          # This file
```

## 🚀 Setup Instructions

### 1. Prerequisites
- A Vercel account (free tier works)
- An Odds API key from https://the-odds-api.com (free tier: 500 requests/month)
- Node.js installed locally (for testing)

### 2. Configuration

#### A. Update API URL
Edit `public/config.js`:
```javascript
const API_BASE_URL = 'https://your-app-name.vercel.app';
```

#### B. Set Environment Variables in Vercel
Go to Vercel Dashboard → Your Project → Settings → Environment Variables

Add these:
```
CRON_SECRET=your_random_secret_string_here_32_characters_minimum
ODDS_API_KEY=your_odds_api_key_from_the_odds_api_com
```

Optional (for advanced scheduling):
```
QSTASH_TOKEN=your_qstash_token_from_upstash_com
```

### 3. Deployment

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy to Vercel
cd proptrack
vercel

# Follow prompts to link/create project
```

### 4. Initial Data Load

After deployment, trigger the first data fetch:
```bash
curl -X GET "https://your-app-name.vercel.app/api/update-data" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Or wait until 3:00 PM UTC (scheduled cron job will run automatically).

### 5. Verify Setup

Visit: `https://your-app-name.vercel.app`

You should see:
- ✅ Players loading from cache
- ✅ Betting lines visible
- ✅ Hit rates calculating
- ✅ Game logs opening

## 🔒 What's Protected Now

All these calculations now happen in the backend (invisible to users):

### Player Rankings (`api/calculate-rankings.js`)
- Composite scoring algorithm
- Weighted averages (L3, L5, L10, Season)
- Trend analysis
- Consistency scoring
- Momentum calculations
- Matchup difficulty assessment

### Goalie Rankings (`api/calculate-goalie-rankings.js`)
- Goalie-specific composite scoring
- Workload analysis
- Quality start tracking
- Save percentage trends
- Opponent offensive strength

### Hit Rate Analysis (`api/calculate-hit-rates.js`)
- Historical performance vs lines
- Weighted trend scoring
- Confidence intervals
- Expected value calculations
- Recent form analysis

## 🎨 Frontend Features (Unchanged)

All user-facing features remain identical:
- ✅ Dark/Light mode
- ✅ Watchlist with parlay calculator
- ✅ Game filtering
- ✅ Search functionality
- ✅ Game log modal with head-to-head stats
- ✅ Team matchup data
- ✅ Sortable columns
- ✅ Responsive design

## 🔧 API Endpoints

### Public Endpoints
- `GET /api/get-data` - Serve cached NHL data
- `GET /api/nhl?endpoint=...` - Proxy to NHL API

### Protected Calculation Endpoints (called by frontend)
- `POST /api/calculate-rankings` - Player rankings
- `POST /api/calculate-goalie-rankings` - Goalie rankings
- `POST /api/calculate-hit-rates` - Hit rate analysis

### Cron Endpoints (require Bearer token)
- `GET /api/update-data` - Daily data refresh (3:00 PM UTC)

## 📊 Data Flow

```
┌─────────────┐
│   NHL API   │ ← Daily fetch at 3 PM UTC
└──────┬──────┘
       │
       ↓
┌─────────────┐
│  Vercel     │ ← Stores raw data
│  Blob       │
└──────┬──────┘
       │
       ↓
┌─────────────┐
│  Frontend   │ ← Loads data on page load
│ (Browser)   │
└──────┬──────┘
       │
       ↓
┌─────────────┐
│  Backend    │ ← Calculates rankings, hit rates
│  APIs       │   (proprietary formulas)
└──────┬──────┘
       │
       ↓
┌─────────────┐
│  Display    │ ← Shows results to user
│  Results    │
└─────────────┘
```

## 🛠 Customization

### Add New Stat Type
1. Update backend calculations in `api/calculate-rankings.js`
2. Add button to frontend HTML
3. Update `selectStat()` function

### Modify Ranking Algorithm
Edit weights in `api/calculate-rankings.js`:
```javascript
const compositeScore = (
  (last10Avg * 0.35) +  // ← Adjust these weights
  (last5Avg * 0.25) +
  (seasonAvg * 0.15) +
  (trendScore * 0.15) +
  (consistencyScore * 0.05) +
  (momentumScore * 0.05)
);
```

### Change Update Schedule
Edit `vercel.json`:
```json
"crons": [
  {
    "path": "/api/update-data",
    "schedule": "0 15 * * *"  // ← Cron syntax: https://crontab.guru
  }
]
```

## 🐛 Troubleshooting

### Players Not Loading
- Check browser console for errors
- Verify `API_BASE_URL` in `config.js`
- Ensure `/api/update-data` has run at least once

### Betting Lines Missing
- Verify `ODDS_API_KEY` is set in Vercel
- Check API quota: https://the-odds-api.com/account
- View logs in Vercel Dashboard

### Calculations Not Working
- Open browser Network tab
- Look for failed POST requests to `/api/calculate-*`
- Check Vercel function logs for errors

### Cron Job Not Running
- Verify `CRON_SECRET` is set
- Check Vercel Dashboard → Cron Jobs
- Manual trigger: `curl -H "Authorization: Bearer SECRET" https://your-app.vercel.app/api/update-data`

## 📈 Monitoring

### View Logs
```bash
vercel logs your-project-name
```

### Check Last Update
Open your app and look at the status bar:
```
✅ Loaded 657 players | Last updated: [timestamp]
```

### API Usage
- Odds API: https://the-odds-api.com/account
- Vercel: Dashboard → Analytics

## 🔐 Security Best Practices

1. **Never commit secrets to Git**
   - Use `.gitignore` for sensitive files
   - Store secrets in Vercel environment variables only

2. **Rotate CRON_SECRET periodically**
   - Update in Vercel environment variables
   - No code changes needed

3. **Monitor API usage**
   - Set up alerts in Odds API dashboard
   - Watch Vercel function invocations

4. **Rate limiting**
   - Backend endpoints have no rate limit (add if needed)
   - Consider adding IP-based rate limiting for production

## 📝 License

Proprietary - All rights reserved

## 🆘 Support

For issues or questions:
1. Check Vercel function logs
2. Review browser console errors
3. Verify environment variables
4. Test API endpoints directly with curl

## 🎯 What Makes This Secure

**Before (Original):**
- All calculations visible in browser source code
- Anyone can copy formulas
- Easy to reverse-engineer algorithms

**After (PropTrack):**
- Calculations happen on server
- Formulas not exposed to browser
- Only results sent to frontend
- Backend code not accessible to users
