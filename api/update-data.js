// api/update-data.js - Cron job to fetch and cache NHL data + betting odds + dynamic scheduling
// OPTIMIZED: Uses FREE /events endpoint with time filters to get only today's games,
// then fetches odds only for those games (instead of all upcoming games)
// Typical savings: 40-80 credits per update depending on schedule
import { put } from '@vercel/blob';
import { Client } from '@upstash/qstash';

export default async function handler(req, res) {
  // Accept secret via Authorization header OR URL parameter
  const authHeader = req.headers.authorization;
  const secretParam = req.query.secret;
  
  // Extract secret from either source
  const providedSecret = authHeader?.replace('Bearer ', '') || secretParam;
  
  if (providedSecret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('Starting daily NHL data update...');
    const startTime = Date.now();
    const season = '20252026';

    // Step 1: Fetch ALL player stats (paginated)
    console.log('Fetching all player stats...');
    let allPlayers = [];
    let start = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      const statsUrl = `https://api.nhle.com/stats/rest/en/skater/summary?limit=${limit}&start=${start}&cayenneExp=seasonId=${season}`;
      const statsResponse = await fetch(statsUrl);
      const statsData = await statsResponse.json();
      const players = statsData.data || [];

      if (players.length === 0) {
        hasMore = false;
      } else {
        allPlayers = allPlayers.concat(players);
        start += limit;
        if (players.length < limit) hasMore = false;
      }
    }

    const playersWithGames = allPlayers.filter(p => (p.gamesPlayed || 0) > 0);
    console.log(`Found ${playersWithGames.length} active players (${Date.now() - startTime}ms)`);

    // Step 2: Fetch ALL goalie stats (paginated)
    console.log('Fetching all goalie stats...');
    let allGoalies = [];
    start = 0;
    hasMore = true;

    while (hasMore) {
      const goalieUrl = `https://api.nhle.com/stats/rest/en/goalie/summary?limit=${limit}&start=${start}&cayenneExp=seasonId=${season}`;
      const goalieResponse = await fetch(goalieUrl);
      const goalieData = await goalieResponse.json();
      const goalies = goalieData.data || [];

      if (goalies.length === 0) {
        hasMore = false;
      } else {
        allGoalies = allGoalies.concat(goalies);
        start += limit;
        if (goalies.length < limit) hasMore = false;
      }
    }

    const goaliesWithGames = allGoalies.filter(g => (g.gamesPlayed || 0) > 0);
    console.log(`Found ${goaliesWithGames.length} active goalies (${Date.now() - startTime}ms)`);

    // Step 3: Fetch team stats for shot volume rankings
    console.log('Fetching team stats...');
    const teamStatsUrl = `https://api.nhle.com/stats/rest/en/team/summary?cayenneExp=seasonId=${season}`;
    const teamStatsResponse = await fetch(teamStatsUrl);
    const teamStatsData = await teamStatsResponse.json();
    const teamStats = teamStatsData.data || [];

    // Calculate shots per game (offensive) and shots against per game (defensive) and rank teams
    const teamShotData = teamStats.map(team => ({
      abbrev: team.teamCommonName || team.teamFullName,
      teamFullName: team.teamFullName,
      shotsPerGame: (team.shotsForPerGame || 0),
      shotsAgainstPerGame: (team.shotsAgainstPerGame || 0),
      gamesPlayed: team.gamesPlayed || 0
    })).sort((a, b) => b.shotsPerGame - a.shotsPerGame);

    // Add rank (1 = most shots FOR)
    teamShotData.forEach((team, index) => {
      team.rank = index + 1;
    });
    
    // Add defensive rank (1 = allows most shots AGAINST - worst defense)
    const sortedByDefense = [...teamShotData].sort((a, b) => b.shotsAgainstPerGame - a.shotsAgainstPerGame);
    sortedByDefense.forEach((team, index) => {
      const originalTeam = teamShotData.find(t => t.teamFullName === team.teamFullName);
      originalTeam.defensiveRank = index + 1;
    });

    console.log(`Loaded stats for ${teamShotData.length} teams (${Date.now() - startTime}ms)`);

    // Step 4: Fetch betting odds (TODAY'S GAMES ONLY) - OPTIMIZED VERSION
    console.log('Fetching betting odds...');
    let bettingOdds = {};
    let oddsError = null;
    let nextGameTime = null;
    let oddsCreditsUsed = null;
    let todaysGamesCount = 0;

    try {
      const oddsApiKey = process.env.ODDS_API_KEY;
      if (oddsApiKey && oddsApiKey !== 'YOUR_ODDS_API_KEY_HERE') {
        // Get current date/time in Eastern Time
        // Eastern Time is UTC-5 (EST) or UTC-4 (EDT depending on DST)
        const nowUTC = new Date();
        const nowETString = nowUTC.toLocaleString('en-US', { timeZone: 'America/New_York' });
        const nowET = new Date(nowETString);
        
        console.log(`Current time in ET: ${nowETString}`);
        console.log(`Current time in UTC: ${nowUTC.toISOString()}`);
        
        // Get midnight and end of day in Eastern Time
        const todayStartET = new Date(nowET.getFullYear(), nowET.getMonth(), nowET.getDate(), 0, 0, 0);
        const todayEndET = new Date(nowET.getFullYear(), nowET.getMonth(), nowET.getDate(), 23, 59, 59);
        
        // Convert these ET times to UTC
        // We need to find the UTC equivalent of midnight ET and 11:59:59 PM ET
        const todayStartETString = todayStartET.toLocaleString('en-US', { timeZone: 'America/New_York' });
        const todayEndETString = todayEndET.toLocaleString('en-US', { timeZone: 'America/New_York' });
        
        // Get the difference between ET and UTC (in hours)
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/New_York',
          hour: 'numeric',
          hour12: false,
          timeZoneName: 'short'
        });
        
        // Simpler approach: Calculate offset
        // Eastern is UTC-5 (EST) or UTC-4 (EDT)
        // We'll add hours to get the UTC time that corresponds to midnight ET
        const currentMonth = nowET.getMonth();
        const isDST = currentMonth >= 2 && currentMonth <= 10; // Rough DST check (March-November)
        const offsetHours = isDST ? 4 : 5; // EDT is UTC-4, EST is UTC-5
        
        // Midnight ET in UTC
        const todayStartUTC = new Date(Date.UTC(
          nowET.getFullYear(),
          nowET.getMonth(),
          nowET.getDate(),
          offsetHours, // Add offset to get UTC time
          0,
          0
        ));
        
        // 11:59:59 PM ET in UTC
        const todayEndUTC = new Date(Date.UTC(
          nowET.getFullYear(),
          nowET.getMonth(),
          nowET.getDate(),
          23 + offsetHours, // Add offset to get UTC time
          59,
          59
        ));
        
        console.log(`Eastern Time Calendar Day: ${nowET.toLocaleDateString('en-US')}`);
        console.log(`Start of day ET: 00:00:00 (UTC: ${todayStartUTC.toISOString()})`);
        console.log(`End of day ET: 23:59:59 (UTC: ${todayEndUTC.toISOString()})`);
        
        // Step 4a: Get ALL upcoming events (no time filter - it's free and reliable)
        const eventsUrl = `https://api.the-odds-api.com/v4/sports/icehockey_nhl/events?apiKey=${oddsApiKey}`;
        
        console.log('Fetching all upcoming events (free call)...');
        const eventsResponse = await fetch(eventsUrl);
        
        if (!eventsResponse.ok) {
          const errorText = await eventsResponse.text();
          console.error('Events API error response:', errorText);
          throw new Error(`Events API error ${eventsResponse.status}: ${errorText}`);
        }

        const allEvents = await eventsResponse.json();
        console.log(`Fetched ${allEvents.length} total upcoming events`);
        
        // Filter to today's games (calendar day in Eastern Time)
        const todaysGames = allEvents.filter(event => {
          const gameTimeUTC = new Date(event.commence_time);
          // Check if game is within today's calendar day in ET
          return gameTimeUTC >= todayStartUTC && gameTimeUTC <= todayEndUTC;
        });
        
        todaysGamesCount = todaysGames.length;
        console.log(`Found ${todaysGamesCount} games today (Eastern Time calendar day)`);
        
        // Log game times for debugging
        todaysGames.forEach(game => {
          const gameTimeET = new Date(game.commence_time).toLocaleString('en-US', { 
            timeZone: 'America/New_York',
            weekday: 'short',
            month: 'short', 
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          });
          console.log(`  - ${game.home_team} vs ${game.away_team} at ${gameTimeET} ET`);
        });

        if (todaysGames.length === 0) {
          console.log('No games today, skipping odds fetch');
          oddsCreditsUsed = { remaining: null, used: null, lastCost: 0 };
        } else {
          // Set nextGameTime to the first game today
          const sortedGames = todaysGames.sort((a, b) => 
            new Date(a.commence_time) - new Date(b.commence_time)
          );
          nextGameTime = sortedGames[0].commence_time;
          console.log(`First game today: ${new Date(nextGameTime).toLocaleString()}`);

          // Step 4b: Fetch odds for only today's games (5 credits per game)
          // Old method fetched ALL upcoming games, new method only fetches today's games
          console.log(`Fetching odds for ${todaysGamesCount} games (${todaysGamesCount * 5} credits)...`);
          
          const gamePromises = todaysGames.map(async event => {
            const eventId = event.id;
            const propsUrl = `https://api.the-odds-api.com/v4/sports/icehockey_nhl/events/${eventId}/odds?apiKey=${oddsApiKey}&regions=us&markets=player_points,player_goal_scorer_anytime,player_assists,player_shots_on_goal,player_total_saves&oddsFormat=american`;
            
            try {
              const propsResponse = await fetch(propsUrl);
              if (!propsResponse.ok) return null;
              
              // Track credits from first successful response
              if (!oddsCreditsUsed) {
                const remaining = propsResponse.headers.get('x-requests-remaining');
                const used = propsResponse.headers.get('x-requests-used');
                const lastCost = propsResponse.headers.get('x-requests-last');
                oddsCreditsUsed = { remaining: parseInt(remaining), used: parseInt(used), lastCost: parseInt(lastCost) };
                console.log(`💰 Credits - Remaining: ${remaining}, Used: ${used}, Cost per game: ${lastCost}`);
              }
              
              const data = await propsResponse.json();
              return { event, data };
            } catch (e) {
              return null;
            }
          });

          const allPropsData = await Promise.all(gamePromises);
          
          // Process all games at once
          for (const result of allPropsData) {
            if (!result) continue;
            const { event, data: propsData } = result;

            const bookmaker = propsData.bookmakers?.[0];
            if (!bookmaker) continue;

            bookmaker.markets?.forEach(market => {
              market.outcomes?.forEach(outcome => {
                const playerName = outcome.description;
                if (!playerName) return;
                if (!bettingOdds[playerName]) bettingOdds[playerName] = {};

                if (outcome.name === 'Over' && outcome.point !== undefined) {
                  if (market.key === 'player_points' && !bettingOdds[playerName].points) {
                    bettingOdds[playerName].points = {
                      line: outcome.point,
                      odds: outcome.price,
                      bookmaker: bookmaker.title,
                      game: `${event.home_team} vs ${event.away_team}`,
                      gameTime: event.commence_time
                    };
                  } else if (market.key === 'player_assists' && !bettingOdds[playerName].assists) {
                    bettingOdds[playerName].assists = {
                      line: outcome.point,
                      odds: outcome.price,
                      bookmaker: bookmaker.title,
                      game: `${event.home_team} vs ${event.away_team}`,
                      gameTime: event.commence_time
                    };
                  } else if (market.key === 'player_shots_on_goal' && !bettingOdds[playerName].shots) {
                    bettingOdds[playerName].shots = {
                      line: outcome.point,
                      odds: outcome.price,
                      bookmaker: bookmaker.title,
                      game: `${event.home_team} vs ${event.away_team}`,
                      gameTime: event.commence_time
                    };
                  } else if (market.key === 'player_total_saves' && !bettingOdds[playerName].saves) {
                    bettingOdds[playerName].saves = {
                      line: outcome.point,
                      odds: outcome.price,
                      bookmaker: bookmaker.title,
                      game: `${event.home_team} vs ${event.away_team}`,
                      gameTime: event.commence_time
                    };
                  }
                } else if (market.key === 'player_goal_scorer_anytime' && outcome.name === 'Yes') {
                  if (!bettingOdds[playerName].goals) {
                    bettingOdds[playerName].goals = {
                      line: 0.5,
                      odds: outcome.price,
                      bookmaker: bookmaker.title,
                      game: `${event.home_team} vs ${event.away_team}`,
                      gameTime: event.commence_time,
                      type: 'anytime_scorer'
                    };
                  }
                }
              });
            });
          }
        }
        console.log(`✅ Loaded betting lines for ${Object.keys(bettingOdds).length} players (${Date.now() - startTime}ms)`);
        if (oddsCreditsUsed && todaysGamesCount > 0) {
          console.log(`💰 Total credits used for odds: ~${todaysGamesCount * 5} (${todaysGamesCount} games × 5 credits)`);
        }
      } else {
        oddsError = 'ODDS_API_KEY not set';
      }
    } catch (error) {
      oddsError = error.message;
      console.error('❌ Odds error:', error);
    }

    // Step 5: Fetch ALL player game logs
    console.log('Fetching game logs for ALL players...');
    const gameLogsData = {};
    let successCount = 0;
    let errorCount = 0;

    const batchSize = 100;
    for (let i = 0; i < playersWithGames.length; i += batchSize) {
      const batch = playersWithGames.slice(i, i + batchSize);
      
      const results = await Promise.allSettled(
        batch.map(async player => {
          const gameLogUrl = `https://api-web.nhle.com/v1/player/${player.playerId}/game-log/${season}/2`;
          const response = await fetch(gameLogUrl);
          if (response.ok) {
            const gameLog = await response.json();
            if (gameLog?.gameLog?.length > 0) {
              return { playerId: player.playerId, gameLog };
            }
          }
          throw new Error('No data');
        })
      );
      
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          gameLogsData[result.value.playerId] = result.value.gameLog;
          successCount++;
        } else {
          errorCount++;
        }
      });
      
      console.log(`Processed ${Math.min(i + batchSize, playersWithGames.length)}/${playersWithGames.length} players`);
      
      if (i + batchSize < playersWithGames.length) {
        await new Promise(r => setTimeout(r, 100));
      }
    }

    console.log(`Player game logs: ${successCount} success, ${errorCount} errors (${Date.now() - startTime}ms)`);

    // Step 6: Fetch ALL goalie game logs
    console.log('Fetching game logs for ALL goalies...');
    const goalieGameLogsData = {};
    let goalieSuccessCount = 0;
    let goalieErrorCount = 0;

    for (let i = 0; i < goaliesWithGames.length; i += batchSize) {
      const batch = goaliesWithGames.slice(i, i + batchSize);
      
      const goalieResults = await Promise.allSettled(
        batch.map(async goalie => {
          const gameLogUrl = `https://api-web.nhle.com/v1/player/${goalie.playerId}/game-log/${season}/2`;
          const response = await fetch(gameLogUrl);
          if (response.ok) {
            const gameLog = await response.json();
            if (gameLog?.gameLog?.length > 0) {
              return { playerId: goalie.playerId, gameLog };
            }
          }
          throw new Error('No data');
        })
      );
      
      goalieResults.forEach(result => {
        if (result.status === 'fulfilled') {
          goalieGameLogsData[result.value.playerId] = result.value.gameLog;
          goalieSuccessCount++;
        } else {
          goalieErrorCount++;
        }
      });
      
      console.log(`Processed ${Math.min(i + batchSize, goaliesWithGames.length)}/${goaliesWithGames.length} goalies`);
      
      if (i + batchSize < goaliesWithGames.length) {
        await new Promise(r => setTimeout(r, 100));
      }
    }

    console.log(`Goalie game logs: ${goalieSuccessCount} success, ${goalieErrorCount} errors (${Date.now() - startTime}ms)`);

    // Step 7: Schedule dynamic pre-game update with QStash
    if (nextGameTime && process.env.QSTASH_TOKEN) {
      try {
        const qstash = new Client({
          token: process.env.QSTASH_TOKEN,
        });
        
        const gameTime = new Date(nextGameTime);
        const oneHourBefore = new Date(gameTime.getTime() - (60 * 60 * 1000));
        const now = new Date();
        
        // Only schedule if the game is more than 1 hour away
        if (oneHourBefore > now) {
          // Cancel any existing scheduled jobs first (to avoid duplicates)
          try {
            const schedules = await qstash.schedules.list();
            for (const schedule of schedules) {
              if (schedule.destination?.includes('/api/update-data')) {
                await qstash.schedules.delete(schedule.scheduleId);
                console.log(`Cancelled existing schedule: ${schedule.scheduleId}`);
              }
            }
          } catch (e) {
            console.log('No existing schedules to cancel');
          }
          
          // Schedule new update
          const scheduleId = await qstash.schedules.create({
            destination: `https://nhl-player-tracker.vercel.app/api/update-data`,
            cron: `${oneHourBefore.getUTCMinutes()} ${oneHourBefore.getUTCHours()} ${oneHourBefore.getUTCDate()} ${oneHourBefore.getUTCMonth() + 1} *`,
            headers: {
              "Authorization": `Bearer ${process.env.CRON_SECRET}`
            }
          });
          
          console.log(`✅ Scheduled pre-game update for ${oneHourBefore.toLocaleString()} (Schedule ID: ${scheduleId})`);
        } else {
          console.log('Next game is less than 1 hour away, skipping schedule');
        }
      } catch (qstashError) {
        console.error('QStash scheduling error:', qstashError);
        // Don't fail the whole update if scheduling fails
      }
    }

    // Step 8: Save to Vercel Blob
    const cacheData = {
      lastUpdated: new Date().toISOString(),
      nextGameTime,
      season,
      allPlayers: playersWithGames,
      allGoalies: goaliesWithGames,
      gameLogs: gameLogsData,
      goalieGameLogs: goalieGameLogsData,
      teamShotData: teamShotData,
      bettingOdds,
      stats: {
        totalPlayers: playersWithGames.length,
        totalGoalies: goaliesWithGames.length,
        gameLogsLoaded: successCount,
        goalieLogsLoaded: goalieSuccessCount,
        errors: errorCount + goalieErrorCount,
        bettingLinesLoaded: Object.keys(bettingOdds).length,
        oddsError,
        oddsCredits: oddsCreditsUsed
      }
    };

    const blob = await put('nhl-cache.json', JSON.stringify(cacheData), {
      access: 'public',
      addRandomSuffix: false
    });

    const totalTime = Date.now() - startTime;
    console.log(`✅ Total execution time: ${totalTime}ms`);

    return res.status(200).json({
      success: true,
      message: 'NHL data updated successfully',
      lastUpdated: cacheData.lastUpdated,
      nextGameTime: nextGameTime ? new Date(nextGameTime).toLocaleString() : 'No games found',
      executionTime: `${totalTime}ms`,
      stats: cacheData.stats,
      blobUrl: blob.url,
      optimization: {
        note: 'Using /events (free) + time filters to fetch only today\'s games',
        oldMethod: 'Fetched ALL upcoming games (~88 credits for 16-18 games)',
        newMethod: `Fetched only today's games (varies: ~5-60 credits depending on schedule)`,
        savings: 'Up to 80% reduction on busy days with many games across the week'
      }
    });
  } catch (error) {
    console.error('Update error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
