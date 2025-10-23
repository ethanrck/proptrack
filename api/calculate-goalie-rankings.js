// api/calculate-goalie-rankings.js - Proprietary goalie ranking algorithm

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
      goalies, 
      goalieGameLogs, 
      bettingOdds, 
      teamShotData,
      sortBy = 'l10',
      minGames = 3 
    } = req.body;

    if (!goalies || !goalieGameLogs) {
      return res.status(400).json({ error: 'Missing required data' });
    }

    // PROPRIETARY CALCULATION: Goalie ranking algorithm
    const rankedGoalies = goalies.map(goalie => {
      const goalieGameLog = goalieGameLogs[goalie.playerId];
      
      if (!goalieGameLog?.gameLog || goalieGameLog.gameLog.length === 0) {
        return null;
      }

      const games = goalieGameLog.gameLog;
      const gamesPlayed = games.length;

      if (gamesPlayed < minGames) {
        return null;
      }

      // Calculate saves statistics
      const last10Games = games.slice(0, Math.min(10, gamesPlayed));
      const last5Games = games.slice(0, Math.min(5, gamesPlayed));
      
      let seasonTotalSaves = 0;
      let seasonTotalShots = 0;
      let last10TotalSaves = 0;
      let last5TotalSaves = 0;
      let last3TotalSaves = 0;
      
      let qualityStartCount = 0; // Games with SV% > .915
      let highVolumeCount = 0;   // Games with 30+ shots
      
      games.forEach((game, idx) => {
        const shotsAgainst = game.shotsAgainst || 0;
        const goalsAgainst = game.goalsAgainst || 0;
        const saves = shotsAgainst - goalsAgainst;
        
        seasonTotalSaves += saves;
        seasonTotalShots += shotsAgainst;
        
        if (idx < 10) last10TotalSaves += saves;
        if (idx < 5) last5TotalSaves += saves;
        if (idx < 3) last3TotalSaves += saves;
        
        // Quality start: SV% > .915
        const svPct = shotsAgainst > 0 ? (saves / shotsAgainst) : 0;
        if (svPct > 0.915) qualityStartCount++;
        if (shotsAgainst >= 30) highVolumeCount++;
      });

      const seasonAvgSaves = seasonTotalSaves / gamesPlayed;
      const last10AvgSaves = last10TotalSaves / Math.min(10, gamesPlayed);
      const last5AvgSaves = last5TotalSaves / Math.min(5, gamesPlayed);
      const last3AvgSaves = last3TotalSaves / Math.min(3, gamesPlayed);
      
      const seasonSvPct = seasonTotalShots > 0 ? (seasonTotalSaves / seasonTotalShots) : 0;
      const qualityStartPct = (qualityStartCount / gamesPlayed) * 100;
      const highVolumePct = (highVolumeCount / gamesPlayed) * 100;

      // PROPRIETARY: Goalie-specific composite score
      const workloadScore = (seasonAvgSaves / 35) * 100; // Normalized to 35 saves
      const trendScore = (last5AvgSaves / (seasonAvgSaves + 0.01)) * 100;
      const qualityScore = seasonSvPct * 100;
      const consistencyScore = calculateGoalieConsistency(games);
      const momentumScore = (last3AvgSaves / (last10AvgSaves + 0.01)) * 100;
      
      // PROPRIETARY: Weighted composite score formula for goalies
      const compositeScore = (
        (last10AvgSaves * 0.30) +
        (last5AvgSaves * 0.25) +
        (seasonAvgSaves * 0.15) +
        (qualityScore * 0.10) +
        (workloadScore * 0.10) +
        (trendScore * 0.05) +
        (consistencyScore * 0.05)
      );

      // Get betting odds if available
      const odds = bettingOdds?.[goalie.playerId];
      
      // Get next opponent and matchup data
      const nextGame = goalieGameLog.nextOpponent || null;
      const matchupScore = nextGame ? calculateGoalieMatchupScore(nextGame, teamShotData) : null;

      return {
        playerId: goalie.playerId,
        name: `${goalie.firstName.default} ${goalie.lastName.default}`,
        team: goalie.teamAbbrev,
        gamesPlayed,
        seasonAvgSaves: seasonAvgSaves.toFixed(1),
        last10AvgSaves: last10AvgSaves.toFixed(1),
        last5AvgSaves: last5AvgSaves.toFixed(1),
        last3AvgSaves: last3AvgSaves.toFixed(1),
        seasonSvPct: (seasonSvPct * 100).toFixed(1),
        compositeScore: compositeScore.toFixed(2),
        workloadScore: workloadScore.toFixed(1),
        trendScore: trendScore.toFixed(1),
        qualityScore: qualityScore.toFixed(1),
        consistencyScore: consistencyScore.toFixed(1),
        momentumScore: momentumScore.toFixed(1),
        qualityStartPct: qualityStartPct.toFixed(1),
        highVolumePct: highVolumePct.toFixed(1),
        odds: odds || null,
        nextOpponent: nextGame?.opponentName || null,
        matchupScore: matchupScore,
        games: games // Include for hit rate calculations
      };
    }).filter(g => g !== null);

    // Sort based on requested criteria
    let sorted = [...rankedGoalies];
    if (sortBy === 'l10') {
      sorted.sort((a, b) => parseFloat(b.last10AvgSaves) - parseFloat(a.last10AvgSaves));
    } else if (sortBy === 'l5') {
      sorted.sort((a, b) => parseFloat(b.last5AvgSaves) - parseFloat(a.last5AvgSaves));
    } else if (sortBy === 'season') {
      sorted.sort((a, b) => parseFloat(b.seasonAvgSaves) - parseFloat(a.seasonAvgSaves));
    } else if (sortBy === 'composite') {
      sorted.sort((a, b) => parseFloat(b.compositeScore) - parseFloat(a.compositeScore));
    }

    return res.status(200).json({
      success: true,
      goalies: sorted,
      metadata: {
        totalGoalies: sorted.length,
        sortBy,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Goalie rankings calculation error:', error);
    return res.status(500).json({
      error: 'Failed to calculate goalie rankings',
      message: error.message
    });
  }
}

// PROPRIETARY: Goalie consistency scoring algorithm
function calculateGoalieConsistency(games) {
  if (games.length < 3) return 50;
  
  const recentGames = games.slice(0, Math.min(10, games.length));
  const saves = recentGames.map(game => {
    const shotsAgainst = game.shotsAgainst || 0;
    const goalsAgainst = game.goalsAgainst || 0;
    return shotsAgainst - goalsAgainst;
  });
  
  const avg = saves.reduce((a, b) => a + b, 0) / saves.length;
  const variance = saves.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / saves.length;
  const stdDev = Math.sqrt(variance);
  
  // Lower standard deviation = higher consistency score
  const coefficientOfVariation = stdDev / (avg + 0.1);
  const consistencyScore = Math.max(0, Math.min(100, 100 - (coefficientOfVariation * 40)));
  
  return consistencyScore;
}

// PROPRIETARY: Goalie matchup difficulty scoring
function calculateGoalieMatchupScore(nextGame, teamShotData) {
  if (!teamShotData || teamShotData.length === 0) return null;
  
  const opponentTeam = teamShotData.find(t => 
    t.teamFullName === nextGame.opponentName ||
    t.teamFullName.includes(nextGame.opponentName) ||
    nextGame.opponentName.includes(t.teamFullName)
  );
  
  if (!opponentTeam) return null;
  
  // For goalies: easier matchup = team generates FEWER shots (offensive rank closer to 32)
  const difficultyRank = opponentTeam.rank; // Lower rank = more shots = harder for goalie
  
  // Score from 0-100 (higher = better matchup for goalie)
  const matchupScore = ((32 - difficultyRank) / 32) * 100;
  
  return {
    score: matchupScore.toFixed(1),
    offensiveRank: opponentTeam.rank,
    shotsPerGame: opponentTeam.shotsPerGame.toFixed(1)
  };
}
