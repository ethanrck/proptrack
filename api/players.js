// api/players.js - UPDATED VERSION with next opponent support
import { list } from '@vercel/blob';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const {
      stat = 'points',
      minGames = '5',
      searchName = '',
      favorites = '',
      hideZeros = 'false',
      sortBy = 'trend'
    } = req.query;

    const { blobs } = await list({ prefix: 'nhl-cache.json' });
    if (blobs.length === 0) throw new Error('No cache found');

    const blobResponse = await fetch(`${blobs[0].url}?t=${Date.now()}`);
    const cacheData = await blobResponse.json();

    const { allPlayers, gameLogs, teamShotData, bettingOdds, teamSchedules } = cacheData;
    const favoritesArray = favorites ? favorites.split(',').map(id => parseInt(id)) : [];

    const processedPlayers = allPlayers
      .filter(player => {
        if (player.gamesPlayed < parseInt(minGames)) return false;
        if (searchName && !player.skaterFullName.toLowerCase().includes(searchName.toLowerCase())) {
          return false;
        }
        if (favoritesArray.length > 0 && !favoritesArray.includes(player.playerId)) {
          return false;
        }
        return true;
      })
      .map(player => {
        const playerGameLog = gameLogs[player.playerId];
        const games = playerGameLog?.gameLog || [];
        
        const { hitRate, trend, last5Rate, last10Rate } = calculatePlayerStats(
          games,
          stat,
          hideZeros === 'true'
        );

        const bettingLine = bettingOdds[player.playerId];

        // Get next opponent from team schedule
        const nextOpponent = getNextOpponent(player.teamAbbrevs, teamSchedules, teamShotData);

        return {
          playerId: player.playerId,
          name: player.skaterFullName,
          team: player.teamAbbrevs,
          position: player.positionCode,
          gamesPlayed: player.gamesPlayed,
          seasonStats: {
            goals: player.goals,
            assists: player.assists,
            points: player.points,
            shots: player.shots,
            pointsPerGame: player.pointsPerGame
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
            goals: g.goals,
            assists: g.assists,
            points: g.points,
            shots: g.shots
          }))
        };
      });

    const sortedPlayers = sortPlayers(processedPlayers, sortBy, stat);

    res.setHeader('Cache-Control', 'public, max-age=300');
    
    return res.status(200).json({
      players: sortedPlayers,
      meta: {
        total: sortedPlayers.length,
        stat,
        minGames: parseInt(minGames),
        lastUpdated: cacheData.lastUpdated
      }
    });
    
  } catch (error) {
    console.error('Error processing players:', error);
    return res.status(500).json({
      error: 'Failed to process player data',
      message: error.message
    });
  }
}

function calculatePlayerStats(games, statType, hideZeros) {
  if (!games || games.length === 0) {
    return { hitRate: 0, trend: 0, last5Rate: 0, last10Rate: 0 };
  }

  const filteredGames = hideZeros 
    ? games.filter(g => getStatValue(g, statType) > 0)
    : games;

  if (filteredGames.length === 0) {
    return { hitRate: 0, trend: 0, last5Rate: 0, last10Rate: 0 };
  }

  const statValues = filteredGames.map(g => getStatValue(g, statType)).sort((a, b) => a - b);
  const median = calculateMedian(statValues);

  const overMedianCount = filteredGames.filter(g => getStatValue(g, statType) > median).length;
  const hitRate = (overMedianCount / filteredGames.length) * 100;

  const last5Games = filteredGames.slice(0, 5);
  const prev5Games = filteredGames.slice(5, 10);
  
  const last5Avg = last5Games.length > 0 
    ? last5Games.reduce((sum, g) => sum + getStatValue(g, statType), 0) / last5Games.length 
    : 0;
  const prev5Avg = prev5Games.length > 0 
    ? prev5Games.reduce((sum, g) => sum + getStatValue(g, statType), 0) / prev5Games.length 
    : last5Avg;

  const trend = prev5Avg > 0 ? ((last5Avg - prev5Avg) / prev5Avg) * 100 : 0;

  const last5Rate = calculateHitRateForGames(last5Games, statType, median);
  const last10Games = filteredGames.slice(0, 10);
  const last10Rate = calculateHitRateForGames(last10Games, statType, median);

  return {
    hitRate: Math.round(hitRate),
    trend: Math.round(trend),
    last5Rate,
    last10Rate,
    median
  };
}

function calculateHitRateForGames(games, statType, threshold) {
  if (games.length === 0) return 0;
  const hits = games.filter(g => getStatValue(g, statType) > threshold).length;
  return Math.round((hits / games.length) * 100);
}

function getStatValue(game, statType) {
  switch (statType) {
    case 'goals': return game.goals || 0;
    case 'assists': return game.assists || 0;
    case 'shots': return game.shots || 0;
    case 'points':
    default:
      return game.points || 0;
  }
}

function calculateMedian(arr) {
  if (arr.length === 0) return 0;
  const mid = Math.floor(arr.length / 2);
  return arr.length % 2 === 0 ? (arr[mid - 1] + arr[mid]) / 2 : arr[mid];
}

function getNextOpponent(playerTeamAbbrev, teamSchedules, teamShotData) {
  if (!teamSchedules || !playerTeamAbbrev) return null;
  
  // Handle cases where player might be on multiple teams (traded)
  const teams = playerTeamAbbrev.split('/');
  const currentTeam = teams[teams.length - 1].trim();
  
  const schedule = teamSchedules[currentTeam];
  if (!schedule || !schedule.nextOpponent) return null;
  
  return schedule.nextOpponent;
}

function sortPlayers(players, sortBy, stat) {
  switch (sortBy) {
    case 'trend':
      return players.sort((a, b) => b.trend - a.trend);
    case 'hitRate':
      return players.sort((a, b) => b.hitRate - a.hitRate);
    case 'last5':
      return players.sort((a, b) => b.last5Rate - a.last5Rate);
    case 'name':
      return players.sort((a, b) => a.name.localeCompare(b.name));
    case 'stat':
    default:
      return players.sort((a, b) => {
        const aValue = a.seasonStats[stat] || 0;
        const bValue = b.seasonStats[stat] || 0;
        return bValue - aValue;
      });
  }
}
