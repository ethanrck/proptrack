// api/calculate-rankings.js - Proprietary player ranking algorithm
// This endpoint calculates player rankings using proprietary formulas

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      players, 
      gameLogs, 
      bettingOdds, 
      teamShotData,
      statType = 'points',
      sortBy = 'l10',
      minGames = 5 
    } = req.body;

    if (!players || !gameLogs) {
      return res.status(400).json({ error: 'Missing required data' });
    }

    // PROPRIETARY CALCULATION: Player ranking algorithm
    const rankedPlayers = players.map(player => {
      const playerGameLog = gameLogs[player.playerId];
      
      if (!playerGameLog?.gameLog || playerGameLog.gameLog.length === 0) {
        return null;
      }

      const games = playerGameLog.gameLog;
      const gamesPlayed = games.length;

      if (gamesPlayed < minGames) {
        return null;
      }

      // Calculate statistics based on stat type
      const last10Games = games.slice(0, Math.min(10, gamesPlayed));
      const last5Games = games.slice(0, Math.min(5, gamesPlayed));
      
      let seasonTotal = 0;
      let last10Total = 0;
      let last5Total = 0;
      let last3Total = 0;
      
      games.forEach((game, idx) => {
        let statValue = 0;
        if (statType === 'points') statValue = game.points || 0;
        else if (statType === 'goals') statValue = game.goals || 0;
        else if (statType === 'assists') statValue = game.assists || 0;
        else if (statType === 'shots') statValue = game.shots || 0;
        
        seasonTotal += statValue;
        if (idx < 10) last10Total += statValue;
        if (idx < 5) last5Total += statValue;
        if (idx < 3) last3Total += statValue;
      });

      const seasonAvg = seasonTotal / gamesPlayed;
      const last10Avg = last10Total / Math.min(10, gamesPlayed);
      const last5Avg = last5Total / Math.min(5, gamesPlayed);
      const last3Avg = last3Total / Math.min(3, gamesPlayed);

      // PROPRIETARY: Composite score calculation with weighted factors
      const trendScore = (last5Avg / (seasonAvg + 0.01)) * 100;
      const consistencyScore = calculateConsistency(games, statType);
      const momentumScore = (last3Avg / (last10Avg + 0.01)) * 100;
      
      // PROPRIETARY: Weighted composite score formula
      const compositeScore = (
        (last10Avg * 0.35) +
        (last5Avg * 0.25) +
        (seasonAvg * 0.15) +
        (trendScore * 0.15) +
        (consistencyScore * 0.05) +
        (momentumScore * 0.05)
      );

      // Get betting odds if available
      const odds = bettingOdds?.[player.playerId];
      
      // Get next opponent and matchup data
      const nextGame = playerGameLog.nextOpponent || null;
      const matchupScore = nextGame ? calculateMatchupScore(nextGame, teamShotData, statType) : null;

      return {
        playerId: player.playerId,
        name: `${player.firstName.default} ${player.lastName.default}`,
        team: player.teamAbbrev,
        position: player.positionCode,
        gamesPlayed,
        seasonAvg: seasonAvg.toFixed(2),
        last10Avg: last10Avg.toFixed(2),
        last5Avg: last5Avg.toFixed(2),
        last3Avg: last3Avg.toFixed(2),
        compositeScore: compositeScore.toFixed(2),
        trendScore: trendScore.toFixed(1),
        consistencyScore: consistencyScore.toFixed(1),
        momentumScore: momentumScore.toFixed(1),
        odds: odds || null,
        nextOpponent: nextGame?.opponentName || null,
        matchupScore: matchupScore,
        games: games // Include for hit rate calculations
      };
    }).filter(p => p !== null);

    // Sort based on requested criteria
    let sorted = [...rankedPlayers];
    if (sortBy === 'l10') {
      sorted.sort((a, b) => parseFloat(b.last10Avg) - parseFloat(a.last10Avg));
    } else if (sortBy === 'l5') {
      sorted.sort((a, b) => parseFloat(b.last5Avg) - parseFloat(a.last5Avg));
    } else if (sortBy === 'season') {
      sorted.sort((a, b) => parseFloat(b.seasonAvg) - parseFloat(a.seasonAvg));
    } else if (sortBy === 'composite') {
      sorted.sort((a, b) => parseFloat(b.compositeScore) - parseFloat(a.compositeScore));
    }

    return res.status(200).json({
      success: true,
      players: sorted,
      metadata: {
        totalPlayers: sorted.length,
        statType,
        sortBy,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Rankings calculation error:', error);
    return res.status(500).json({
      error: 'Failed to calculate rankings',
      message: error.message
    });
  }
}

// PROPRIETARY: Consistency scoring algorithm
function calculateConsistency(games, statType) {
  if (games.length < 5) return 50;
  
  const recentGames = games.slice(0, Math.min(10, games.length));
  const values = recentGames.map(game => {
    if (statType === 'points') return game.points || 0;
    if (statType === 'goals') return game.goals || 0;
    if (statType === 'assists') return game.assists || 0;
    if (statType === 'shots') return game.shots || 0;
    return 0;
  });
  
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  
  // Lower standard deviation = higher consistency score
  const coefficientOfVariation = stdDev / (avg + 0.1);
  const consistencyScore = Math.max(0, Math.min(100, 100 - (coefficientOfVariation * 50)));
  
  return consistencyScore;
}

// PROPRIETARY: Matchup difficulty scoring
function calculateMatchupScore(nextGame, teamShotData, statType) {
  if (!teamShotData || teamShotData.length === 0) return null;
  
  const opponentTeam = teamShotData.find(t => 
    t.teamFullName === nextGame.opponentName ||
    t.teamFullName.includes(nextGame.opponentName) ||
    nextGame.opponentName.includes(t.teamFullName)
  );
  
  if (!opponentTeam) return null;
  
  // For shots, easier matchup = team allows MORE shots
  // For other stats, easier matchup = team allows MORE shots (more opportunities)
  const difficultyRank = statType === 'shots' ? 
    (33 - opponentTeam.defensiveRank) : // Inverse for shots (lower rank = harder)
    opponentTeam.defensiveRank; // Normal for other stats
  
  // Score from 0-100 (higher = better matchup)
  const matchupScore = ((32 - difficultyRank) / 32) * 100;
  
  return {
    score: matchupScore.toFixed(1),
    defensiveRank: opponentTeam.defensiveRank,
    shotsAgainstPerGame: opponentTeam.shotsAgainstPerGame.toFixed(1)
  };
}
