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

export default async function handler(request, response) {
    // Verify cron secret for security (accept header or query param)
    const authHeader = request.headers['authorization'] || request.headers['Authorization'];
    const querySecret = request.query?.secret;
    const cronSecret = process.env.CRON_SECRET;
    
    const isAuthorized = 
        authHeader === `Bearer ${cronSecret}` || 
        querySecret === cronSecret;
    
    if (!isAuthorized) {
        return response.status(401).send('Unauthorized');
    }

    console.log('Starting NFL data update...');
    
    try {
        // 1. Get today's games
        const todaysGames = await fetchTodaysGames();
        console.log(`Found ${todaysGames.length} games today`);
        
        if (todaysGames.length === 0) {
            console.log('No NFL games today, skipping update');
            return response.status(200).json({ 
                message: 'No NFL games today',
                gamesFound: 0 
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
        
        // 6. Fetch team defensive stats
        const teamDefense = await fetchTeamDefenseStats();
        console.log(`Fetched defensive stats for ${Object.keys(teamDefense).length} teams`);
        
        // 7. Combine and save data
        const data = {
            players,
            gameLogs,
            bettingOdds,
            todaysGames,
            teamDefense,
            lastUpdated: new Date().toISOString()
        };
        
        // Save to blob storage
        const blob = await put('nfl-data.json', JSON.stringify(data), {
            access: 'public',
            contentType: 'application/json'
        });
        
        console.log('NFL data update complete');
        
        return response.status(200).json({
            success: true,
            gamesFound: todaysGames.length,
            playersFound: players.length,
            blobUrl: blob.url
        });
        
    } catch (error) {
        console.error('Error updating NFL data:', error);
        return response.status(500).json({ 
            error: 'Failed to update NFL data',
            message: error.message 
        });
    }
}

/**
 * Fetch team defensive stats from ESPN
 */
async function fetchTeamDefenseStats() {
    const teamDefense = {};
    
    try {
        // Fetch team stats from ESPN
        const url = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams?limit=32';
        const response = await fetch(url);
        const data = await response.json();
        
        const teams = data.sports?.[0]?.leagues?.[0]?.teams || [];
        
        // Initialize stats for all teams
        for (const teamData of teams) {
            const team = teamData.team;
            const abbr = team.abbreviation;
            
            teamDefense[abbr] = {
                name: team.displayName,
                abbreviation: abbr,
                passYardsAllowed: 0,
                rushYardsAllowed: 0,
                pointsAllowed: 0,
                passYardsRank: 16,
                rushYardsRank: 16,
                pointsRank: 16
            };
        }
        
        // Fetch defensive stats
        const defenseUrl = 'https://site.web.api.espn.com/apis/v2/sports/football/nfl/standings?season=2024&type=0&level=3';
        const defResponse = await fetch(defenseUrl);
        
        if (defResponse.ok) {
            const defData = await defResponse.json();
            // Parse defensive stats from standings data
            // This is a fallback - actual defensive stats would need another endpoint
        }
        
        // Alternative: fetch from team stats page
        for (const abbr of Object.keys(teamDefense)) {
            try {
                const teamStatsUrl = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${abbr}/statistics`;
                const statsResponse = await fetch(teamStatsUrl);
                
                if (statsResponse.ok) {
                    const statsData = await statsResponse.json();
                    
                    // Look for defensive stats in the response
                    const defenseStats = statsData.results?.stats?.categories?.find(c => c.name === 'defensive') ||
                                        statsData.splits?.categories?.find(c => c.name === 'defensive');
                    
                    if (defenseStats) {
                        const stats = defenseStats.stats || [];
                        
                        const passYards = stats.find(s => s.name === 'netPassingYardsPerGame' || s.name === 'passingYardsAllowed');
                        const rushYards = stats.find(s => s.name === 'rushingYardsPerGame' || s.name === 'rushingYardsAllowed');
                        const points = stats.find(s => s.name === 'pointsAgainst' || s.name === 'pointsAllowed');
                        
                        if (passYards) teamDefense[abbr].passYardsAllowed = parseFloat(passYards.value) || 0;
                        if (rushYards) teamDefense[abbr].rushYardsAllowed = parseFloat(rushYards.value) || 0;
                        if (points) teamDefense[abbr].pointsAllowed = parseFloat(points.value) || 0;
                    }
                }
            } catch (e) {
                // Skip errors for individual teams
            }
        }
        
        // Calculate rankings (1 = best defense, 32 = worst)
        const teamList = Object.values(teamDefense);
        
        // Sort by pass yards allowed (ascending - lower is better defense)
        teamList.sort((a, b) => a.passYardsAllowed - b.passYardsAllowed);
        teamList.forEach((team, idx) => {
            teamDefense[team.abbreviation].passYardsRank = idx + 1;
        });
        
        // Sort by rush yards allowed
        teamList.sort((a, b) => a.rushYardsAllowed - b.rushYardsAllowed);
        teamList.forEach((team, idx) => {
            teamDefense[team.abbreviation].rushYardsRank = idx + 1;
        });
        
        // Sort by points allowed
        teamList.sort((a, b) => a.pointsAllowed - b.pointsAllowed);
        teamList.forEach((team, idx) => {
            teamDefense[team.abbreviation].pointsRank = idx + 1;
        });
        
    } catch (error) {
        console.error('Error fetching team defense stats:', error);
    }
    
    return teamDefense;
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
 * Fetch game logs for players using multiple ESPN API approaches
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
                
                // Try ESPN splits endpoint first (more reliable for game-by-game)
                let data = null;
                
                // Approach 1: Try the splits endpoint
                try {
                    const splitsUrl = `https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/athletes/${player.id}/splits?season=${currentYear}`;
                    const splitsResponse = await fetch(splitsUrl);
                    if (splitsResponse.ok) {
                        data = await splitsResponse.json();
                    }
                } catch (e) {
                    console.log(`Splits endpoint failed for ${player.name}`);
                }
                
                // Approach 2: Try the gamelog endpoint
                if (!data || !data.splitCategories) {
                    try {
                        const gamelogUrl = `https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/athletes/${player.id}/gamelog?season=${currentYear}`;
                        const gamelogResponse = await fetch(gamelogUrl);
                        if (gamelogResponse.ok) {
                            data = await gamelogResponse.json();
                        }
                    } catch (e) {
                        console.log(`Gamelog endpoint failed for ${player.name}`);
                    }
                }
                
                // Approach 3: Try the eventlog endpoint
                if (!data) {
                    try {
                        const eventlogUrl = `https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/athletes/${player.id}/eventlog?season=${currentYear}`;
                        const eventlogResponse = await fetch(eventlogUrl);
                        if (eventlogResponse.ok) {
                            data = await eventlogResponse.json();
                        }
                    } catch (e) {
                        console.log(`Eventlog endpoint failed for ${player.name}`);
                    }
                }
                
                if (data) {
                    // Parse based on structure found
                    parseESPNGameData(data, logs, seasonStats, player);
                }
                
                // Count non-bye week games
                totalGames = logs.filter(l => !l.isByeWeek).length;
                
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
 * Parse ESPN game data from various endpoint formats
 */
function parseESPNGameData(data, logs, seasonStats, player) {
    // Try splitCategories format (from splits endpoint)
    if (data.splitCategories) {
        const gameByGame = data.splitCategories.find(sc => 
            sc.name?.toLowerCase() === 'game-by-game' || 
            sc.displayName?.toLowerCase().includes('game')
        );
        
        if (gameByGame && gameByGame.splits) {
            gameByGame.splits.forEach((split, idx) => {
                const opponent = split.displayName || split.abbreviation || '-';
                const stats = parseStatsFromArray(split.stats, data.labels || gameByGame.labels);
                
                const hasStats = Object.values(stats).some(v => v > 0);
                
                logs.push({
                    week: idx + 1,
                    opponent: opponent,
                    result: '-',
                    date: null,
                    isByeWeek: !hasStats,
                    stats
                });
                
                if (hasStats) {
                    accumulateStats(seasonStats, stats);
                }
            });
        }
    }
    
    // Try seasonTypes format (from gamelog endpoint)
    if (data.seasonTypes && logs.length === 0) {
        const regularSeason = data.seasonTypes.find(st => 
            st.displayName === 'Regular Season' || st.categories
        ) || data.seasonTypes[0];
        
        if (regularSeason?.categories) {
            const categories = regularSeason.categories;
            
            // Process each category
            for (const category of categories) {
                const catName = (category.name || category.displayName || '').toLowerCase();
                const events = category.events || [];
                const catLabels = category.labels || [];
                
                events.forEach((event, idx) => {
                    // Find or create log entry for this week
                    const week = event.week || (idx + 1);
                    let logEntry = logs.find(l => l.week === week);
                    
                    if (!logEntry) {
                        const opponent = event.opponent?.abbreviation || 
                                       extractOpponent(event.atVs) ||
                                       '-';
                        logEntry = {
                            week,
                            opponent,
                            result: event.gameResult || event.score || '-',
                            date: event.gameDate || event.date,
                            isByeWeek: false,
                            stats: {}
                        };
                        logs.push(logEntry);
                    }
                    
                    // Parse stats based on category
                    const eventStats = event.stats || [];
                    catLabels.forEach((label, labelIdx) => {
                        const value = parseFloat(eventStats[labelIdx]) || 0;
                        const lbl = (label || '').toString().toLowerCase();
                        
                        assignStatByLabel(logEntry.stats, lbl, value, catName, player.position);
                    });
                });
            }
        }
    }
    
    // Try events format (from eventlog endpoint)
    if (data.events && logs.length === 0) {
        data.events.forEach((event, idx) => {
            const stats = event.stats || {};
            const opponent = event.opponent?.abbreviation || '-';
            
            logs.push({
                week: event.week || (idx + 1),
                opponent,
                result: event.result || event.gameResult || '-',
                date: event.date || event.gameDate,
                isByeWeek: false,
                stats
            });
            
            accumulateStats(seasonStats, stats);
        });
    }
    
    // Sort by week
    logs.sort((a, b) => a.week - b.week);
    
    // Mark bye weeks
    logs.forEach(log => {
        const hasStats = log.stats && Object.values(log.stats).some(v => v > 0);
        log.isByeWeek = !hasStats;
    });
    
    // Accumulate stats from logs into seasonStats
    if (logs.length > 0 && Object.values(seasonStats).every(v => v === 0)) {
        logs.forEach(log => {
            if (!log.isByeWeek) {
                accumulateStats(seasonStats, log.stats);
            }
        });
    }
}

/**
 * Parse stats from array using labels
 */
function parseStatsFromArray(statsArray, labels) {
    const stats = {};
    if (!statsArray || !Array.isArray(statsArray)) return stats;
    
    labels = labels || [];
    
    statsArray.forEach((value, idx) => {
        const label = (labels[idx] || '').toString().toLowerCase();
        const numValue = parseFloat(value) || 0;
        
        // Handle C/ATT format
        if (label === 'c/att' || label === 'cmp/att') {
            const parts = String(value).split('/');
            stats.completions = parseInt(parts[0]) || 0;
            stats.passingAttempts = parseInt(parts[1]) || 0;
        } else if (label === 'yds' || label === 'pass yds') {
            if (!stats.passingYards) stats.passingYards = numValue;
        } else if (label === 'td' || label === 'pass td') {
            if (!stats.passingTouchdowns) stats.passingTouchdowns = numValue;
        } else if (label === 'int') {
            stats.interceptions = numValue;
        } else if (label === 'car' || label === 'rush') {
            stats.rushingAttempts = numValue;
        } else if (label === 'rush yds') {
            stats.rushingYards = numValue;
        } else if (label === 'rush td') {
            stats.rushingTouchdowns = numValue;
        } else if (label === 'rec') {
            stats.receptions = numValue;
        } else if (label === 'rec yds') {
            stats.receivingYards = numValue;
        } else if (label === 'rec td') {
            stats.receivingTouchdowns = numValue;
        } else if (label === 'tgt' || label === 'tgts') {
            stats.targets = numValue;
        }
    });
    
    return stats;
}

/**
 * Assign stat value based on label and category context
 */
function assignStatByLabel(stats, label, value, catName, position) {
    if (label === 'c/att' || label === 'cmp/att') {
        // Already handled
        return;
    }
    
    const isPassing = catName.includes('pass');
    const isRushing = catName.includes('rush');
    const isReceiving = catName.includes('rec');
    
    if (label === 'yds') {
        if (isPassing) stats.passingYards = value;
        else if (isRushing) stats.rushingYards = value;
        else if (isReceiving) stats.receivingYards = value;
        else {
            // Guess based on position
            if (position === 'QB') stats.passingYards = value;
            else if (position === 'RB') stats.rushingYards = value;
            else stats.receivingYards = value;
        }
    } else if (label === 'td') {
        if (isPassing) stats.passingTouchdowns = value;
        else if (isRushing) stats.rushingTouchdowns = value;
        else if (isReceiving) stats.receivingTouchdowns = value;
        else {
            if (position === 'QB') stats.passingTouchdowns = value;
            else if (position === 'RB') stats.rushingTouchdowns = value;
            else stats.receivingTouchdowns = value;
        }
    } else if (label === 'int') {
        stats.interceptions = value;
    } else if (label === 'car' || label === 'att' && isRushing) {
        stats.rushingAttempts = value;
    } else if (label === 'rec') {
        stats.receptions = value;
    } else if (label === 'tgt' || label === 'tgts') {
        stats.targets = value;
    }
}

/**
 * Extract opponent from atVs string like "@ NYG" or "vs DAL"
 */
function extractOpponent(atVs) {
    if (!atVs) return null;
    const match = atVs.match(/(?:vs|@)\s*(\w+)/i);
    return match ? match[1] : null;
}

/**
 * Accumulate stats into season totals
 */
function accumulateStats(seasonStats, gameStats) {
    if (!gameStats) return;
    
    Object.keys(seasonStats).forEach(key => {
        if (gameStats[key] !== undefined) {
            seasonStats[key] += gameStats[key] || 0;
        }
    });
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
    
    try {
        // First, get events from The Odds API (their event IDs are different from ESPN)
        const eventsUrl = `${ODDS_API_BASE}/sports/americanfootball_nfl/events?apiKey=${apiKey}`;
        const eventsResponse = await fetch(eventsUrl);
        
        if (!eventsResponse.ok) {
            console.error('Failed to fetch NFL events from Odds API:', eventsResponse.status);
            return {};
        }
        
        const events = await eventsResponse.json();
        console.log(`Found ${events.length} events from Odds API`);
        
        // Filter to today's events
        const today = new Date().toISOString().split('T')[0];
        const todaysEvents = events.filter(event => {
            const eventDate = event.commence_time?.split('T')[0];
            return eventDate === today;
        });
        
        console.log(`Found ${todaysEvents.length} events for today`);
        
        // Fetch odds for each event
        for (const event of todaysEvents) {
            try {
                const marketsParam = NFL_ODDS_MARKETS.join(',');
                const url = `${ODDS_API_BASE}/sports/americanfootball_nfl/events/${event.id}/odds?apiKey=${apiKey}&regions=us&markets=${marketsParam}&oddsFormat=american`;
                
                const response = await fetch(url);
                if (!response.ok) {
                    console.log(`No odds for event ${event.id}: ${response.status}`);
                    continue;
                }
                
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
                console.error(`Error fetching odds for event ${event.id}:`, error);
            }
        }
    } catch (error) {
        console.error('Error fetching betting odds:', error);
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
