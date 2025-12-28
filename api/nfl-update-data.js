// api/nfl-update-data.js - Vercel serverless function to update NFL data

import { put } from '@vercel/blob';

const ESPN_ATHLETES_URL = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams';
const ESPN_SCOREBOARD_URL = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';
const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';

const NFL_ODDS_MARKETS = [
    'player_pass_yds',
    'player_pass_tds', 
    'player_rush_yds',
    'player_reception_yds',
    'player_receptions',
    'player_anytime_td'
];

export default async function handler(request) {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new Response('Unauthorized', { status: 401 });
    }

    console.log('Starting NFL data update...');
    
    try {
        // 1. Get today's games
        const todaysGames = await fetchTodaysGames();
        console.log(`Found ${todaysGames.length} games today`);
        
        if (todaysGames.length === 0) {
            console.log('No NFL games today, skipping update');
            return new Response(JSON.stringify({ 
                message: 'No NFL games today',
                gamesFound: 0 
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // 2. Get teams playing today
        const teamsPlaying = new Set();
        todaysGames.forEach(game => {
            teamsPlaying.add(game.homeTeam);
            teamsPlaying.add(game.awayTeam);
        });
        
        // 3. Fetch players from teams playing today
        const players = await fetchPlayersForTeams(Array.from(teamsPlaying));
        console.log(`Found ${players.length} players from teams playing today`);
        
        // 4. Fetch game logs for players
        const gameLogs = await fetchGameLogs(players);
        console.log(`Fetched game logs for ${Object.keys(gameLogs).length} players`);
        
        // 5. Fetch betting odds
        const bettingOdds = await fetchBettingOdds(todaysGames);
        console.log(`Fetched betting odds for ${Object.keys(bettingOdds).length} players`);
        
        // 6. Combine and save data
        const data = {
            players,
            gameLogs,
            bettingOdds,
            todaysGames,
            lastUpdated: new Date().toISOString()
        };
        
        // Save to blob storage
        const blob = await put('nfl-data.json', JSON.stringify(data), {
            access: 'public',
            contentType: 'application/json'
        });
        
        console.log('NFL data update complete');
        
        return new Response(JSON.stringify({
            success: true,
            gamesFound: todaysGames.length,
            playersFound: players.length,
            blobUrl: blob.url
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
        
    } catch (error) {
        console.error('Error updating NFL data:', error);
        return new Response(JSON.stringify({ 
            error: 'Failed to update NFL data',
            message: error.message 
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

/**
 * Fetch today's NFL games from ESPN
 */
async function fetchTodaysGames() {
    try {
        const response = await fetch(ESPN_SCOREBOARD_URL);
        const data = await response.json();
        
        const games = data.events?.map(event => {
            const competition = event.competitions?.[0];
            const homeTeam = competition?.competitors?.find(c => c.homeAway === 'home');
            const awayTeam = competition?.competitors?.find(c => c.homeAway === 'away');
            
            return {
                id: event.id,
                name: event.name,
                startTime: event.date,
                homeTeam: homeTeam?.team?.abbreviation,
                awayTeam: awayTeam?.team?.abbreviation,
                homeTeamId: homeTeam?.team?.id,
                awayTeamId: awayTeam?.team?.id,
                status: event.status?.type?.name
            };
        }) || [];
        
        return games;
    } catch (error) {
        console.error('Error fetching games:', error);
        return [];
    }
}

/**
 * Fetch players for specific teams
 */
async function fetchPlayersForTeams(teamAbbreviations) {
    const players = [];
    
    for (const teamAbbr of teamAbbreviations) {
        try {
            const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${teamAbbr}/roster`;
            const response = await fetch(url);
            const data = await response.json();
            
            // Get skill position players
            const skillPositions = ['QB', 'RB', 'WR', 'TE', 'FB'];
            
            data.athletes?.forEach(group => {
                group.items?.forEach(player => {
                    const position = player.position?.abbreviation;
                    if (skillPositions.includes(position)) {
                        players.push({
                            id: player.id,
                            name: player.fullName,
                            team: teamAbbr,
                            position: position,
                            number: player.jersey,
                            gamesPlayed: 0, // Will be updated from game logs
                            seasonStats: {}
                        });
                    }
                });
            });
        } catch (error) {
            console.error(`Error fetching roster for ${teamAbbr}:`, error);
        }
    }
    
    return players;
}

/**
 * Fetch game logs for players
 */
async function fetchGameLogs(players) {
    const gameLogs = {};
    const currentYear = new Date().getFullYear();
    
    // Batch requests to avoid rate limiting
    const batchSize = 10;
    for (let i = 0; i < players.length; i += batchSize) {
        const batch = players.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async (player) => {
            try {
                const url = `https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/athletes/${player.id}/gamelog?season=${currentYear}`;
                const response = await fetch(url);
                const data = await response.json();
                
                const logs = [];
                let totalGames = 0;
                const seasonStats = {
                    passingYards: 0,
                    passingTouchdowns: 0,
                    passingAttempts: 0,
                    completions: 0,
                    interceptions: 0,
                    rushingYards: 0,
                    rushingTouchdowns: 0,
                    rushingAttempts: 0,
                    receivingYards: 0,
                    receptions: 0,
                    receivingTouchdowns: 0,
                    targets: 0,
                    totalTouchdowns: 0
                };
                
                // Parse game log entries
                const entries = data.seasonTypes?.[0]?.categories?.[0]?.events || [];
                
                entries.forEach(entry => {
                    const stats = parseGameStats(entry.stats);
                    
                    // Check if bye week (no stats)
                    const isByeWeek = !stats || Object.values(stats).every(v => v === 0);
                    
                    logs.push({
                        week: entry.week,
                        opponent: entry.opponent?.abbreviation,
                        result: entry.gameResult,
                        date: entry.gameDate,
                        isByeWeek,
                        stats
                    });
                    
                    if (!isByeWeek) {
                        totalGames++;
                        // Accumulate season stats
                        Object.keys(stats).forEach(key => {
                            if (seasonStats[key] !== undefined) {
                                seasonStats[key] += stats[key] || 0;
                            }
                        });
                    }
                });
                
                // Calculate total TDs
                seasonStats.totalTouchdowns = 
                    (seasonStats.passingTouchdowns || 0) + 
                    (seasonStats.rushingTouchdowns || 0) + 
                    (seasonStats.receivingTouchdowns || 0);
                
                // Calculate completion percentage
                if (seasonStats.passingAttempts > 0) {
                    seasonStats.completionPct = 
                        ((seasonStats.completions / seasonStats.passingAttempts) * 100).toFixed(1);
                }
                
                // Calculate yards per carry
                if (seasonStats.rushingAttempts > 0) {
                    seasonStats.yardsPerCarry = 
                        (seasonStats.rushingYards / seasonStats.rushingAttempts).toFixed(1);
                }
                
                gameLogs[player.id] = logs;
                
                // Update player with games played and season stats
                player.gamesPlayed = totalGames;
                player.seasonStats = seasonStats;
                
            } catch (error) {
                console.error(`Error fetching game log for ${player.name}:`, error);
                gameLogs[player.id] = [];
            }
        }));
        
        // Small delay between batches
        if (i + batchSize < players.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    
    return gameLogs;
}

/**
 * Parse game stats from ESPN format
 */
function parseGameStats(statsArray) {
    if (!statsArray || !Array.isArray(statsArray)) return {};
    
    const stats = {};
    
    // ESPN stat indices (may vary, this is a common mapping)
    const statMapping = {
        0: 'completions',
        1: 'passingAttempts', 
        3: 'passingYards',
        4: 'passingTouchdowns',
        5: 'interceptions',
        13: 'rushingAttempts',
        14: 'rushingYards',
        15: 'rushingTouchdowns',
        20: 'receptions',
        21: 'targets',
        22: 'receivingYards',
        23: 'receivingTouchdowns'
    };
    
    statsArray.forEach((value, index) => {
        const statName = statMapping[index];
        if (statName) {
            stats[statName] = parseFloat(value) || 0;
        }
    });
    
    // Calculate total TDs for this game
    stats.totalTouchdowns = 
        (stats.passingTouchdowns || 0) + 
        (stats.rushingTouchdowns || 0) + 
        (stats.receivingTouchdowns || 0);
    
    return stats;
}

/**
 * Fetch betting odds from The Odds API
 */
async function fetchBettingOdds(todaysGames) {
    const apiKey = process.env.NFL_ODDS_API_KEY;
    if (!apiKey) {
        console.log('No NFL_ODDS_API_KEY configured');
        return {};
    }
    
    const bettingOdds = {};
    
    for (const game of todaysGames) {
        try {
            // Get event odds
            const marketsParam = NFL_ODDS_MARKETS.join(',');
            const url = `${ODDS_API_BASE}/sports/americanfootball_nfl/events/${game.id}/odds?apiKey=${apiKey}&regions=us&markets=${marketsParam}&oddsFormat=american`;
            
            const response = await fetch(url);
            if (!response.ok) continue;
            
            const data = await response.json();
            
            // Parse odds for each bookmaker
            data.bookmakers?.forEach(bookmaker => {
                bookmaker.markets?.forEach(market => {
                    market.outcomes?.forEach(outcome => {
                        const playerName = outcome.description || outcome.name;
                        if (!playerName) return;
                        
                        if (!bettingOdds[playerName]) {
                            bettingOdds[playerName] = {};
                        }
                        
                        const propType = marketToPropType(market.key);
                        if (!propType) return;
                        
                        // Handle anytime TD (no line)
                        if (propType === 'anytime_td') {
                            bettingOdds[playerName][propType] = {
                                price: outcome.price,
                                bookmaker: bookmaker.key
                            };
                        } else {
                            // O/U props
                            if (!bettingOdds[playerName][propType]) {
                                bettingOdds[playerName][propType] = [];
                            }
                            
                            const line = outcome.point;
                            let existing = bettingOdds[playerName][propType].find(o => o.line === line);
                            
                            if (!existing) {
                                existing = { line, bookmaker: bookmaker.key };
                                bettingOdds[playerName][propType].push(existing);
                            }
                            
                            if (outcome.name === 'Over') {
                                existing.overOdds = outcome.price;
                            } else if (outcome.name === 'Under') {
                                existing.underOdds = outcome.price;
                            }
                        }
                    });
                });
            });
        } catch (error) {
            console.error(`Error fetching odds for game ${game.id}:`, error);
        }
    }
    
    return bettingOdds;
}

/**
 * Map Odds API market key to our prop type
 */
function marketToPropType(marketKey) {
    const mapping = {
        'player_pass_yds': 'passing_yards',
        'player_pass_tds': 'passing_tds',
        'player_rush_yds': 'rushing_yards',
        'player_reception_yds': 'receiving_yards',
        'player_receptions': 'receptions',
        'player_anytime_td': 'anytime_td'
    };
    return mapping[marketKey];
}
