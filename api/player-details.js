// api/player-details.js - Get detailed player analysis including game log and H2H
import { list } from '@vercel/blob';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { playerId, type = 'skater', opponent = null, lineValue = 0 } = req.query;

    if (!playerId) {
      return res.status(400).json({ error: 'playerId is required' });
    }

    // Fetch cached data
    const { blobs } = await list({ prefix: 'nhl-cache.json' });
    if (blobs.length === 0) throw new Error('No cache found');

    const blobResponse = await fetch(`${blobs[0].url}?t=${Date.now()}`);
    const cacheData = await blobResponse.json();

    const isGoalie = type === 'goalie';
    const players = isGoalie ? cacheData.allGoalies : cacheData.allPlayers;
    const gameLogs = isGoalie ? cacheData.goalieGameLogs : cacheData.gameLogs;

    // Find the player
    const player = players.find(p => p.playerId === parseInt(playerId));
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // Get game log
    const gameLog = gameLogs[playerId];
    const games = gameLog?.gameLog || [];

    // Calculate H2H stats if opponent provided
    let h2hStats = null;
    if (opponent) {
      h2hStats = calculateH2HStats(games, opponent, isGoalie, parseFloat(lineValue));
    }

    // Process game log with enhanced data
    const processedGames = games.map(game => {
      const gameData = {
        gameId: game.gameId,
        gameDate: game.gameDate,
        opponent: game.opponentAbbrev,
        homeRoad: game.homeRoadFlag,
        teamAbbrev: game.teamAbbrev
      };

      if (isGoalie) {
        const saves = (game.shotsAgainst || 0) - (game.goalsAgainst || 0);
        return {
          ...gameData,
          decision: game.decision,
          saves,
          shotsAgainst: game.shotsAgainst || 0,
          goalsAgainst: game.goalsAgainst || 0,
          savePct: game.savePct || 0,
          toi: game.toi
        };
      } else {
        return {
          ...gameData,
          goals: game.goals || 0,
          assists: game.assists || 0,
          points: game.points || 0,
          shots: game.shots || 0,
          plusMinus: game.plusMinus || 0,
          pim: game.pim || 0,
          powerPlayGoals: game.powerPlayGoals || 0,
          powerPlayPoints: game.powerPlayPoints || 0,
          gameWinningGoals: game.gameWinningGoals || 0,
          toi: game.toi
        };
      }
    });

    // Get opponent info from team data
    const opponentInfo = opponent ? getOpponentInfo(opponent, cacheData.teamShotData) : null;

    res.setHeader('Cache-Control', 'public, max-age=300');
    
    return res.status(200).json({
      player: {
        playerId: player.playerId,
        name: isGoalie ? player.goalieFullName : player.skaterFullName,
        team: player.teamAbbrevs,
        position: isGoalie ? 'G' : player.positionCode,
        gamesPlayed: player.gamesPlayed
      },
      seasonStats: isGoalie ? {
        wins: player.wins,
        losses: player.losses,
        otLosses: player.otLosses,
        saves: player.saves,
        savePct: player.savePct,
        goalsAgainstAverage: player.goalsAgainstAverage,
        shutouts: player.shutouts
      } : {
        goals: player.goals,
        assists: player.assists,
        points: player.points,
        shots: player.shots,
        pointsPerGame: player.pointsPerGame,
        powerPlayGoals: player.powerPlayGoals,
        powerPlayPoints: player.powerPlayPoints
      },
      games: processedGames,
      h2hStats,
      opponentInfo,
      meta: {
        totalGames: processedGames.length,
        lastUpdated: cacheData.lastUpdated
      }
    });
    
  } catch (error) {
    console.error('Error fetching player details:', error);
    return res.status(500).json({
      error: 'Failed to fetch player details',
      message: error.message
    });
  }
}

function calculateH2HStats(games, opponentAbbrev, isGoalie, lineValue) {
  // Team abbreviation mappings
  const teamMappings = {
    'Toronto Maple Leafs': 'TOR', 'Boston Bruins': 'BOS', 'Tampa Bay Lightning': 'TBL',
    'Florida Panthers': 'FLA', 'Montreal Canadiens': 'MTL', 'Ottawa Senators': 'OTT',
    'Buffalo Sabres': 'BUF', 'Detroit Red Wings': 'DET', 'New York Rangers': 'NYR',
    'New York Islanders': 'NYI', 'New Jersey Devils': 'NJD', 'Pittsburgh Penguins': 'PIT',
    'Washington Capitals': 'WSH', 'Philadelphia Flyers': 'PHI', 'Columbus Blue Jackets': 'CBJ',
    'Carolina Hurricanes': 'CAR', 'Nashville Predators': 'NSH', 'Winnipeg Jets': 'WPG',
    'Minnesota Wild': 'MIN', 'Colorado Avalanche': 'COL', 'Dallas Stars': 'DAL',
    'Chicago Blackhawks': 'CHI', 'St. Louis Blues': 'STL', 'Vegas Golden Knights': 'VGK',
    'Edmonton Oilers': 'EDM', 'Calgary Flames': 'CGY', 'Vancouver Canucks': 'VAN',
    'Seattle Kraken': 'SEA', 'San Jose Sharks': 'SJS', 'Anaheim Ducks': 'ANA',
    'Los Angeles Kings': 'LAK', 'Arizona Coyotes': 'ARI', 'Utah Hockey Club': 'UTA'
  };

  // Find abbreviation for opponent (handle both full name and abbrev)
  let targetAbbrev = opponentAbbrev;
  if (opponentAbbrev.length > 3) {
    targetAbbrev = teamMappings[opponentAbbrev] || opponentAbbrev;
  }

  // Filter games against this opponent
  const h2hGames = games.filter(g => g.opponentAbbrev === targetAbbrev);

  if (h2hGames.length === 0) {
    return {
      gamesPlayed: 0,
      stats: null,
      hitRate: 0
    };
  }

  if (isGoalie) {
    // Calculate goalie H2H stats
    let totalSaves = 0;
    let totalShotsAgainst = 0;
    let totalGoalsAgainst = 0;
    let wins = 0;
    let losses = 0;
    let otLosses = 0;

    h2hGames.forEach(game => {
      const saves = (game.shotsAgainst || 0) - (game.goalsAgainst || 0);
      totalSaves += saves;
      totalShotsAgainst += game.shotsAgainst || 0;
      totalGoalsAgainst += game.goalsAgainst || 0;
      
      if (game.decision === 'W') wins++;
      else if (game.decision === 'L') losses++;
      else if (game.decision === 'O') otLosses++;
    });

    const avgSaves = totalSaves / h2hGames.length;
    const avgSavePct = totalShotsAgainst > 0 ? (totalSaves / totalShotsAgainst) : 0;

    // Calculate hit rate if line value provided
    let hitRate = 0;
    if (lineValue > 0) {
      const hits = h2hGames.filter(game => {
        const saves = (game.shotsAgainst || 0) - (game.goalsAgainst || 0);
        return saves > lineValue;
      }).length;
      hitRate = (hits / h2hGames.length) * 100;
    }

    return {
      gamesPlayed: h2hGames.length,
      stats: {
        avgSaves: avgSaves.toFixed(1),
        avgSavePct: (avgSavePct * 100).toFixed(1),
        record: `${wins}-${losses}-${otLosses}`,
        totalShotsAgainst,
        totalGoalsAgainst
      },
      hitRate: Math.round(hitRate)
    };
  } else {
    // Calculate skater H2H stats
    let totalGoals = 0;
    let totalAssists = 0;
    let totalPoints = 0;
    let totalShots = 0;

    h2hGames.forEach(game => {
      totalGoals += game.goals || 0;
      totalAssists += game.assists || 0;
      totalPoints += game.points || 0;
      totalShots += game.shots || 0;
    });

    // Calculate hit rate if line value provided
    let hitRate = 0;
    if (lineValue > 0) {
      const hits = h2hGames.filter(game => (game.points || 0) > lineValue).length;
      hitRate = (hits / h2hGames.length) * 100;
    }

    return {
      gamesPlayed: h2hGames.length,
      stats: {
        avgGoals: (totalGoals / h2hGames.length).toFixed(2),
        avgAssists: (totalAssists / h2hGames.length).toFixed(2),
        avgPoints: (totalPoints / h2hGames.length).toFixed(2),
        avgShots: (totalShots / h2hGames.length).toFixed(2),
        totalGoals,
        totalAssists,
        totalPoints,
        totalShots
      },
      hitRate: Math.round(hitRate)
    };
  }
}

function getOpponentInfo(opponentAbbrev, teamShotData) {
  if (!teamShotData || teamShotData.length === 0) return null;

  // Find team in shot data (handle both abbreviations and full names)
  const team = teamShotData.find(t => 
    t.abbrev === opponentAbbrev || 
    t.teamFullName === opponentAbbrev ||
    t.teamFullName.includes(opponentAbbrev)
  );

  if (!team) return null;

  return {
    teamName: team.teamFullName,
    shotsPerGame: team.shotsPerGame.toFixed(1),
    shotsAgainstPerGame: team.shotsAgainstPerGame.toFixed(1),
    offensiveRank: team.rank,
    defensiveRank: team.defensiveRank,
    gamesPlayed: team.gamesPlayed
  };
}
