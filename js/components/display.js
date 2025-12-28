// js/components/display.js - Display logic for players and teams

import state from '../state.js';
import { 
    getMainLine, 
    getStatValue, 
    createSafeId, 
    formatOdds,
    escapeName 
} from '../utils.js';
import { renderPlayerCard, updateAllHitRates } from './player-card.js';
import api from '../api-client.js';
import { TEAM_ABBREV_MAP, ABBREV_TO_FULL } from '../constants.js';

/**
 * Display players in the grid
 */
export function displayPlayers() {
    const container = document.getElementById('playersContainer');
    if (!container) return;
    
    const filteredPlayers = state.filteredPlayers;
    const selectedLine = state.selectedLineFilter;
    const isGoalie = state.isGoalieMode;
    const statType = state.currentStatType;
    const bettingOdds = state.bettingOdds;
    const gameLogs = state.getCurrentGameLogs();
    
    // Calculate hit rates for sorting
    const playersWithHitRates = filteredPlayers.map(player => {
        const name = isGoalie 
            ? (player.goalieFullName || 'Unknown Goalie')
            : (player.skaterFullName || 'Unknown Player');
        
        const playerOdds = bettingOdds[name];
        const hasLine = playerOdds && Array.isArray(playerOdds[statType]) && playerOdds[statType].length > 0;
        
        let lineValue = 0.5;
        if (hasLine) {
            if (selectedLine) {
                const matchingLine = playerOdds[statType].find(l => l.line == parseFloat(selectedLine));
                lineValue = matchingLine ? matchingLine.line : getMainLine(playerOdds[statType]).line;
            } else {
                lineValue = getMainLine(playerOdds[statType]).line;
            }
        }
        
        const gameLog = gameLogs[player.playerId];
        let hitRate = 0;
        let gamesPlayed = 0;
        
        if (gameLog?.gameLog?.length > 0) {
            let games = gameLog.gameLog;
            if (isGoalie) {
                games = games.filter(game => {
                    const shotsAgainst = game.shotsAgainst || 0;
                    const gamesStarted = game.gamesStarted || 0;
                    return gamesStarted > 0 || shotsAgainst > 0;
                });
            }
            games = games.slice(0, 10);
            gamesPlayed = games.length;
            
            let hits = 0;
            games.forEach(game => {
                const statValue = getStatValue(game, statType, isGoalie);
                if (statValue > lineValue) hits++;
            });
            
            hitRate = gamesPlayed > 0 ? (hits / gamesPlayed) * 100 : 0;
        }
        
        return { player, hasLine, hitRate, gamesPlayed };
    });
    
    // Remove duplicates
    const seenPlayerIds = new Set();
    const uniquePlayers = playersWithHitRates.filter(item => {
        if (seenPlayerIds.has(item.player.playerId)) return false;
        seenPlayerIds.add(item.player.playerId);
        return true;
    });
    
    // Sort: players with lines first, then by hit rate
    uniquePlayers.sort((a, b) => {
        if (a.hasLine && !b.hasLine) return -1;
        if (!a.hasLine && b.hasLine) return 1;
        
        if (a.hasLine && b.hasLine) {
            if (a.gamesPlayed >= 4 && b.gamesPlayed >= 4) {
                return b.hitRate - a.hitRate;
            }
            if (a.gamesPlayed >= 4 && b.gamesPlayed < 4) return -1;
            if (a.gamesPlayed < 4 && b.gamesPlayed >= 4) return 1;
            return (b.player.points || 0) - (a.player.points || 0);
        }
        
        return (b.player.points || 0) - (a.player.points || 0);
    });
    
    if (uniquePlayers.length === 0) {
        container.innerHTML = '<div class="loading">No players found.</div>';
        return;
    }
    
    // Render cards
    const html = uniquePlayers.map(({ player }) => 
        renderPlayerCard(player, selectedLine)
    ).join('');
    
    container.innerHTML = html;
    updateAllHitRates();
}

/**
 * Display teams in the grid (for team totals mode)
 */
export async function displayTeams() {
    const container = document.getElementById('playersContainer');
    if (!container) return;
    
    const hideStartedGames = document.getElementById('hideStartedGames')?.checked ?? false;
    const selectedGame = document.getElementById('gameFilter')?.value || '';
    const selectedLine = state.selectedLineFilter;
    const bettingOdds = state.bettingOdds;
    const currentTime = new Date();
    
    // Collect teams with betting lines
    const teamsMap = new Map();
    
    Object.keys(bettingOdds).forEach(teamKey => {
        const teamOdds = bettingOdds[teamKey];
        if (!teamOdds?.team_totals?.length) return;
        
        const firstLine = teamOdds.team_totals[0];
        const game = firstLine.game;
        const gameTime = firstLine.gameTime;
        
        // Apply filters
        if (selectedGame && game !== selectedGame) return;
        if (hideStartedGames && gameTime && new Date(gameTime) <= currentTime) return;
        
        // Combine all lines
        const allLines = [...teamOdds.team_totals];
        if (teamOdds.alternate_team_totals?.length) {
            allLines.push(...teamOdds.alternate_team_totals);
        }
        
        // Check line filter
        if (selectedLine && !allLines.some(l => l.line == parseFloat(selectedLine))) return;
        
        const key = `${teamKey}|${game}`;
        if (!teamsMap.has(key)) {
            teamsMap.set(key, {
                teamName: teamKey,
                game,
                gameTime,
                mainLines: teamOdds.team_totals,
                allLines
            });
        }
    });
    
    const teamsList = Array.from(teamsMap.values());
    
    if (teamsList.length === 0) {
        container.innerHTML = '<div class="loading">No team totals found for today\'s games.</div>';
        return;
    }
    
    // Sort by game time
    teamsList.sort((a, b) => new Date(a.gameTime) - new Date(b.gameTime));
    
    // Render team cards
    const html = teamsList.map(teamData => {
        const { teamName, game, gameTime, mainLines, allLines } = teamData;
        
        // Get display line
        let displayLine;
        if (selectedLine) {
            displayLine = allLines.find(l => l.line == parseFloat(selectedLine));
        }
        if (!displayLine) {
            displayLine = getMainLine(mainLines) || getMainLine(allLines);
        }
        
        if (!displayLine) return '';
        
        const overOdds = displayLine.overOdds != null ? formatOdds(displayLine.overOdds) : null;
        const underOdds = displayLine.underOdds != null ? formatOdds(displayLine.underOdds) : null;
        const teamId = createSafeId(`${teamName}-${game}`);
        const escapedTeamName = escapeName(teamName);
        
        return `
            <div class="player-card" onclick="window.proptrack.showTeamLog('${escapedTeamName}', '${game}')">
                <div class="player-header">
                    <div class="player-name" style="max-width: 60%; word-wrap: break-word;">${teamName}</div>
                    <div style="display: flex; flex-direction: column; align-items: center; line-height: 1.2; gap: 2px; background: var(--warning-bg); padding: 8px; border-radius: 6px;">
                        <div style="font-weight: bold; font-size: 1.5em; color: #e67e22; pointer-events: none;">${displayLine.line}</div>
                        ${overOdds != null ? `
                            <div onclick="event.stopPropagation(); window.proptrack.addToWatchlist('team-${createSafeId(teamName)}', '${escapedTeamName}', 'team_totals', ${displayLine.line}, ${displayLine.overOdds}, '${game}', '${gameTime}', 'over')" 
                                 style="color: #27ae60; font-size: 1.1em; cursor: pointer; padding: 2px 8px; border-radius: 3px; transition: all 0.2s;" 
                                 onmouseover="this.style.background='#27ae60'; this.style.color='white';" 
                                 onmouseout="this.style.background=''; this.style.color='#27ae60';">
                                O ${overOdds}
                            </div>
                        ` : ''}
                        ${underOdds != null ? `
                            <div onclick="event.stopPropagation(); window.proptrack.addToWatchlist('team-${createSafeId(teamName)}', '${escapedTeamName}', 'team_totals', ${displayLine.line}, ${displayLine.underOdds}, '${game}', '${gameTime}', 'under')" 
                                 style="color: #e74c3c; font-size: 1.1em; cursor: pointer; padding: 2px 8px; border-radius: 3px; transition: all 0.2s;" 
                                 onmouseover="this.style.background='#e74c3c'; this.style.color='white';" 
                                 onmouseout="this.style.background=''; this.style.color='#e74c3c';">
                                U ${underOdds}
                            </div>
                        ` : ''}
                    </div>
                </div>
                <div class="player-team">${game}</div>
                <div class="hit-rate-display" id="hitrate-${teamId}">
                    <div class="stat-label">Loading hit rate...</div>
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = html;
    
    // Calculate team hit rates
    await updateAllTeamHitRates(teamsList, selectedLine);
}

/**
 * Update hit rates for all displayed teams
 */
async function updateAllTeamHitRates(teamsList, selectedLine) {
    const teamShotData = state.teamShotData;
    
    const promises = teamsList.map(async (teamData) => {
        const { teamName, game, mainLines, allLines } = teamData;
        const teamId = createSafeId(`${teamName}-${game}`);
        const hitRateDiv = document.getElementById(`hitrate-${teamId}`);
        
        if (!hitRateDiv) return;
        
        // Find team stats
        const teamStats = teamShotData.find(t => 
            t.teamFullName === teamName || 
            t.abbrev === teamName ||
            t.teamFullName.includes(teamName)
        );
        
        if (!teamStats) {
            hitRateDiv.innerHTML = '<div class="stat-label">Team stats not found</div>';
            return;
        }
        
        const teamAbbrev = TEAM_ABBREV_MAP[teamStats.teamFullName] || 
                          TEAM_ABBREV_MAP[teamName] || 
                          teamStats.abbrev;
        
        if (!teamAbbrev) {
            hitRateDiv.innerHTML = '<div class="stat-label">Team abbreviation not found</div>';
            return;
        }
        
        // Get line value
        let displayLine;
        if (selectedLine) {
            displayLine = allLines.find(l => l.line == parseFloat(selectedLine));
        } else {
            displayLine = getMainLine(mainLines) || getMainLine(allLines);
        }
        
        if (!displayLine) {
            hitRateDiv.innerHTML = '<div class="stat-label">No line available</div>';
            return;
        }
        
        const lineValue = displayLine.line;
        
        try {
            // Check cache first
            let allCompletedGames = state.getTeamSchedule(teamAbbrev);
            
            if (!allCompletedGames) {
                allCompletedGames = [];
                const currentDate = new Date();
                
                // Fetch up to 3 months back
                for (let i = 0; i < 3 && allCompletedGames.length < 10; i++) {
                    const monthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
                    
                    try {
                        const data = await api.fetchTeamSchedule(
                            teamAbbrev,
                            monthDate.getFullYear(),
                            monthDate.getMonth() + 1
                        );
                        
                        if (data?.games) {
                            const completedGames = data.games.filter(g => 
                                (g.gameState === 'OFF' || g.gameState === 'FINAL') &&
                                g.homeTeam?.score !== undefined &&
                                g.awayTeam?.score !== undefined
                            );
                            allCompletedGames.push(...completedGames);
                        }
                    } catch (e) {
                        console.error(`Error fetching schedule for ${teamAbbrev}:`, e);
                    }
                }
                
                // Cache results
                state.cacheTeamSchedule(teamAbbrev, allCompletedGames);
            }
            
            // Sort by date and take last 10
            allCompletedGames.sort((a, b) => new Date(b.gameDate) - new Date(a.gameDate));
            const games = allCompletedGames.slice(0, 10);
            
            if (games.length === 0) {
                hitRateDiv.innerHTML = '<div class="stat-label">No game history found</div>';
                return;
            }
            
            // Calculate hit rate
            let hits = 0;
            games.forEach(game => {
                const isHome = game.homeTeam.abbrev === teamAbbrev;
                const teamScore = isHome ? game.homeTeam.score : game.awayTeam.score;
                if (teamScore > lineValue) hits++;
            });
            
            const hitRate = ((hits / games.length) * 100).toFixed(1);
            let colorClass = 'hit-rate-poor';
            if (hitRate >= 70) colorClass = 'hit-rate-excellent';
            else if (hitRate >= 50) colorClass = 'hit-rate-good';
            else if (hitRate >= 30) colorClass = 'hit-rate-medium';
            
            hitRateDiv.innerHTML = `
                <div class="stat-label">Last ${games.length} Games vs ${lineValue}</div>
                <div class="hit-rate-value ${colorClass}">${hitRate}% (${hits}/${games.length})</div>
            `;
            
        } catch (error) {
            console.error(`Error calculating team hit rate for ${teamName}:`, error);
            hitRateDiv.innerHTML = '<div class="stat-label">Error loading hit rate</div>';
        }
    });
    
    await Promise.all(promises);
}

export default {
    displayPlayers,
    displayTeams
};
