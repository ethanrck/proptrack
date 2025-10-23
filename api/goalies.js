// api/goalies.js - UPDATED VERSION with next opponent support
import { list } from '@vercel/blob';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const {
      stat = 'saves',
      minGames = '5',
      searchName = '',
      favorites = '',
      sortBy = 'trend'
    } = req.query;

    const { blobs } = await list({ prefix: 'nhl-cache.json' });
    if (blobs.length === 0) throw new Error('No cache found');

    const blobResponse = await fetch(`${blobs[0].url}?t=${Date.now()}`);
    const cacheData = await blobResponse.json();

    const { allGoalies, goalieGameLogs, teamShotData, bettingOdds, teamSchedules } = cacheData;
    const favoritesArray = favorites ? favorites.split(',').map(id => parseInt(id)) : [];

    const processedGoalies = allGoalies
      .filter(goalie => {
        if (goalie.gamesPlayed < parseInt(minGames)) return false;
        if (searchName && !goalie.goalieFullName.toLowerCase().includes(searchName.toLowerCase())) {
          return false;
        }
        if (favoritesArray.length > 0 && !favoritesArray.includes(goalie.playerId)) {
          return false;
        }
        return true;
      })
      .map(goalie => {
        const goalieGameLog = goalieGameLogs[goalie.playerId];
        const games = goalieGameLog?.gameLog || [];
        
        const { hitRate, trend, last5Rate, last10Rate } = calculateGoalieStats(games, stat);

        const bettingLine = bettingOdds[goalie.playerId];

        // Get next opponent from team schedule
        const nextOpponent = getNextOpponent(goalie.teamAbbrevs, teamSchedules, teamShotData);

        return {
          playerId: goalie.playerId,
          name: goalie.goalieFullName,
          team: goalie.teamAbbrevs,
          gamesPlayed: goalie.gamesPlayed,
          seasonStats: {
            wins: goalie.wins,
            losses: goalie.losses,
            otLosses: goalie.otLosses,
            saves: goalie.saves,
            savePct: goalie.savePct,
            goalsAgainstAverage: goalie.goalsAgainstAverage,
            shutouts: goalie.shutouts
          },
          hitRate,
          trend,
          last5Rate,
          last10Rate,
          bettingLine,
          nextOpponent,
          recentGames: games.slice(0, 5).map(g => ({
            date: g.gameDate,
            opponent: g.opponentAbbrev,
            decision: g.decision,
            saves: g.shotsAgainst - g.goalsAgainst,
            shotsAgainst: g.shotsAgainst,
            goalsAgainst: g.goalsAgainst,
            savePct: g.savePct
          }))
        };
      });

    const sortedGoalies = sortGoalies(processedGoalies, sortBy, stat);

    res.setHeader('Cache-Control', 'public, max-age=300');
    
    return res.status(200).json({
      goalies: sortedGoalies,
      meta: {
        total: sortedGoalies.length,
        stat,
        minGames: parseInt(minGames),
        lastUpdated: cacheData.lastUpdated
      }
    });
    
  } catch (error) {
    console.error('Error processing goalies:', error);
    return res.status(500).json({
      error: 'Failed to process goalie data',
      message: error.message
    });
  }
}

function calculateGoalieStats(games, statType) {
  if (!games || games.length === 0) {
    return { hitRate: 0, trend: 0, last5Rate: 0, last10Rate: 0 };
  }

  const gamesWithSaves = games.map(g => ({
    ...g,
    saves: (g.shotsAgainst || 0) - (g.goalsAgainst || 0)
  }));

  const statValues = gamesWithSaves.map(g => {
    switch (statType) {
      case 'saves': return g.saves;
      case 'savePct': return g.savePct || 0;
      case 'shotsAgainst': return g.shotsAgainst || 0;
      default: return g.saves;
    }
  }).sort((a, b) => a - b);

  const median = calculateMedian(statValues);

  const overMedianCount = gamesWithSaves.filter(g => {
    const value = statType === 'savePct' ? g.savePct : 
                  statType === 'shotsAgainst' ? g.shotsAgainst : 
                  g.saves;
    return value > median;
  }).length;
  
  const hitRate = (overMedianCount / gamesWithSaves.length) * 100;

  const last5Games = gamesWithSaves.slice(0, 5);
  const prev5Games = gamesWithSaves.slice(5, 10);
  
  const last5Avg = calculateAvgStat(last5Games, statType);
  const prev5Avg = calculateAvgStat(prev5Games, statType);

  const trend = prev5Avg > 0 ? ((last5Avg - prev5Avg) / prev5Avg) * 100 : 0;

  const last5Rate = calculateHitRateForGames(last5Games, statType, median);
  const last10Games = gamesWithSaves.slice(0, 10);
  const last10Rate = calculateHitRateForGames(last10Games, statType, median);

  return {
    hitRate: Math.round(hitRate),
    trend: Math.round(trend),
    last5Rate,
    last10Rate,
    median
  };
}

function calculateAvgStat(games, statType) {
  if (games.length === 0) return 0;
  const sum = games.reduce((acc, g) => {
    switch (statType) {
      case 'saves': return acc + g.saves;
      case 'savePct': return acc + (g.savePct || 0);
      case 'shotsAgainst': return acc + (g.shotsAgainst || 0);
      default: return acc + g.saves;
    }
  }, 0);
  return sum / games.length;
}

function calculateHitRateForGames(games, statType, threshold) {
  if (games.length === 0) return 0;
  const hits = games.filter(g => {
    const value = statType === 'savePct' ? g.savePct : 
                  statType === 'shotsAgainst' ? g.shotsAgainst : 
                  g.saves;
    return value > threshold;
  }).length;
  return Math.round((hits / games.length) * 100);
}

function calculateMedian(arr) {
  if (arr.length === 0) return 0;
  const mid = Math.floor(arr.length / 2);
  return arr.length % 2 === 0 ? (arr[mid - 1] + arr[mid]) / 2 : arr[mid];
}

function getNextOpponent(goalieTeamAbbrev, teamSchedules, teamShotData) {
  if (!teamSchedules || !goalieTeamAbbrev) return null;
  
  // Handle cases where goalie might be on multiple teams (traded)
  const teams = goalieTeamAbbrev.split('/');
  const currentTeam = teams[teams.length - 1].trim();
  
  const schedule = teamSchedules[currentTeam];
  if (!schedule || !schedule.nextOpponent) return null;
  
  return schedule.nextOpponent;
}

function sortGoalies(goalies, sortBy, stat) {
  switch (sortBy) {
    case 'trend':
      return goalies.sort((a, b) => b.trend - a.trend);
    case 'hitRate':
      return goalies.sort((a, b) => b.hitRate - a.hitRate);
    case 'last5':
      return goalies.sort((a, b) => b.last5Rate - a.last5Rate);
    case 'name':
      return goalies.sort((a, b) => a.name.localeCompare(b.name));
    case 'stat':
    default:
      return goalies.sort((a, b) => {
        const aValue = a.seasonStats[stat] || 0;
        const bValue = b.seasonStats[stat] || 0;
        return bValue - aValue;
      });
  }
}
