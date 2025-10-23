// api/calculate-hit-rates.js - Proprietary hit rate calculation algorithm
// Calculates success rates for different line values

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
      games, 
      lineValue, 
      statType = 'points',
      isGoalie = false 
    } = req.body;

    if (!games || lineValue === undefined) {
      return res.status(400).json({ error: 'Missing required data' });
    }

    // PROPRIETARY: Hit rate calculation algorithm
    const hitRateData = calculateHitRate(games, lineValue, statType, isGoalie);
    
    return res.status(200).json({
      success: true,
      ...hitRateData,
      metadata: {
        totalGames: games.length,
        lineValue,
        statType,
        isGoalie,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Hit rate calculation error:', error);
    return res.status(500).json({
      error: 'Failed to calculate hit rate',
      message: error.message
    });
  }
}

// PROPRIETARY: Hit rate calculation with advanced analytics
function calculateHitRate(games, lineValue, statType, isGoalie) {
  let hits = 0;
  let pushes = 0;
  let misses = 0;
  let totalStat = 0;
  
  const recentGames = games.slice(0, Math.min(10, games.length));
  const last5Games = games.slice(0, Math.min(5, games.length));
  const last3Games = games.slice(0, Math.min(3, games.length));
  
  let recentHits = 0;
  let last5Hits = 0;
  let last3Hits = 0;
  
  const gameResults = games.map((game, idx) => {
    let statValue = 0;
    
    if (isGoalie) {
      // For goalies: calculate saves
      const shotsAgainst = game.shotsAgainst || 0;
      const goalsAgainst = game.goalsAgainst || 0;
      statValue = shotsAgainst - goalsAgainst;
    } else {
      // For skaters
      if (statType === 'points') statValue = game.points || 0;
      else if (statType === 'goals') statValue = game.goals || 0;
      else if (statType === 'assists') statValue = game.assists || 0;
      else if (statType === 'shots') statValue = game.shots || 0;
    }
    
    totalStat += statValue;
    
    let result = 'miss';
    if (statValue > lineValue) {
      hits++;
      result = 'hit';
      if (idx < 10) recentHits++;
      if (idx < 5) last5Hits++;
      if (idx < 3) last3Hits++;
    } else if (statValue === lineValue) {
      pushes++;
      result = 'push';
    } else {
      misses++;
    }
    
    return {
      date: game.gameDate,
      opponent: game.opponentAbbrev,
      value: statValue,
      result: result
    };
  });
  
  const totalGames = games.length;
  const hitRate = totalGames > 0 ? (hits / totalGames) * 100 : 0;
  const recentHitRate = recentGames.length > 0 ? (recentHits / recentGames.length) * 100 : 0;
  const last5HitRate = last5Games.length > 0 ? (last5Hits / last5Games.length) * 100 : 0;
  const last3HitRate = last3Games.length > 0 ? (last3Hits / last3Games.length) * 100 : 0;
  
  // PROPRIETARY: Trend analysis
  const trendScore = calculateTrendScore(gameResults, lineValue);
  
  // PROPRIETARY: Confidence score based on consistency and trend
  const confidenceScore = calculateConfidenceScore(
    hitRate, 
    recentHitRate, 
    last5HitRate,
    totalGames,
    trendScore
  );
  
  // PROPRIETARY: Expected value calculation
  const avgValue = totalGames > 0 ? totalStat / totalGames : 0;
  const expectedMargin = avgValue - lineValue;
  const expectedMarginPct = lineValue > 0 ? (expectedMargin / lineValue) * 100 : 0;
  
  return {
    hitRate: hitRate.toFixed(1),
    recentHitRate: recentHitRate.toFixed(1),
    last5HitRate: last5HitRate.toFixed(1),
    last3HitRate: last3HitRate.toFixed(1),
    hits,
    pushes,
    misses,
    avgValue: avgValue.toFixed(2),
    expectedMargin: expectedMargin.toFixed(2),
    expectedMarginPct: expectedMarginPct.toFixed(1),
    trendScore: trendScore.toFixed(1),
    confidenceScore: confidenceScore.toFixed(1),
    gameResults: gameResults.slice(0, 15) // Return last 15 games
  };
}

// PROPRIETARY: Trend scoring algorithm
function calculateTrendScore(gameResults, lineValue) {
  if (gameResults.length < 5) return 50;
  
  const recentGames = gameResults.slice(0, Math.min(10, gameResults.length));
  
  // Calculate weighted trend (more recent = higher weight)
  let weightedScore = 0;
  let totalWeight = 0;
  
  recentGames.forEach((game, idx) => {
    const weight = recentGames.length - idx; // Most recent has highest weight
    const margin = game.value - lineValue;
    const marginScore = margin > 0 ? Math.min(100, (margin / lineValue) * 100) : 
                                     Math.max(-100, (margin / lineValue) * 100);
    
    weightedScore += marginScore * weight;
    totalWeight += weight;
  });
  
  const trendScore = 50 + (weightedScore / totalWeight); // Normalized around 50
  return Math.max(0, Math.min(100, trendScore));
}

// PROPRIETARY: Confidence scoring algorithm
function calculateConfidenceScore(hitRate, recentHitRate, last5HitRate, totalGames, trendScore) {
  // Factors:
  // 1. Sample size (more games = more confidence)
  // 2. Consistency between season and recent performance
  // 3. Trend direction
  
  const sampleSizeScore = Math.min(100, (totalGames / 20) * 100); // Max at 20 games
  
  const consistencyScore = 100 - Math.abs(hitRate - recentHitRate); // Lower diff = higher score
  
  const trendWeight = trendScore > 50 ? 1.1 : 0.9; // Positive trend increases confidence
  
  const confidenceScore = (
    (sampleSizeScore * 0.4) +
    (consistencyScore * 0.3) +
    (hitRate * 0.2) +
    (trendScore * 0.1)
  ) * trendWeight;
  
  return Math.max(0, Math.min(100, confidenceScore));
}
