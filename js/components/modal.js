// js/components/modal.js - Modal functionality for game logs

import state from '../state.js';
import { 
    getMainLine, 
    getStatValue, 
    getHitRateColor,
    normalizeTeamName,
    parseLocalDate,
    getOrdinal,
    formatOdds,
    escapeName
} from '../utils.js';
import { ABBREV_TO_FULL, TEAM_MASCOTS, TEAM_ABBREV_MAP } from '../constants.js';
import api from '../api-client.js';

/**
 * Show game log modal for a player
 */
export function showGameLog(playerId) {
    const isGoalie = state.isGoalieMode;
    const gameLogs = state.getCurrentGameLogs();
    const playerSource = isGoalie ? state.allGoaliesData : state.allPlayersData;
    const gameLog = gameLogs[playerId];
    
    if (!gameLog?.gameLog?.length) {
        alert('Game log not available for this player');
        return;
    }
    
    const player = playerSource.find(p => p.playerId === playerId);
    const name = isGoalie 
        ? (player.goalieFullName || 'Unknown Goalie')
        : (player.skaterFullName || 'Unknown Player');
    
    const bettingOdds = state.bettingOdds;
    const statType = state.currentStatType;
    const selectedLine = state.selectedLineFilter;
    const teamShotData = state.teamShotData;
    
    let lineValue = 0.5;
    let nextOpponent = null;
    const playerOdds = bettingOdds[name];
    
    if (playerOdds?.[statType]?.length) {
        let lineObj = selectedLine 
            ? playerOdds[statType].find(l => l.line == parseFloat(selectedLine))
            : null;
        
        if (!lineObj) {
            lineObj = getMainLine(playerOdds[statType]);
        }
        
        if (lineObj) {
            lineValue = lineObj.line;
            const gameStr = lineObj.game;
            const teams = gameStr.split(' vs ');
            const playerTeamFull = player.teamAbbrevs;
            
            // Determine opponent
            const playerTeamNormalized = normalizeTeamName(playerTeamFull);
            let opponentFull = null;
            
            for (const team of teams) {
                const teamNormalized = normalizeTeamName(team);
                if (!teamNormalized.includes(playerTeamNormalized) && 
                    !playerTeamNormalized.includes(teamNormalized)) {
                    opponentFull = team;
                    break;
                }
            }
            
            if (opponentFull) {
                nextOpponent = {
                    name: opponentFull,
                    abbrev: TEAM_ABBREV_MAP[opponentFull] || opponentFull.substring(0, 3).toUpperCase()
                };
            }
        }
    }
    
    // Filter games
    let games = gameLog.gameLog;
    if (isGoalie) {
        games = games.filter(game => {
            const shotsAgainst = game.shotsAgainst || 0;
            const gamesStarted = game.gamesStarted || 0;
            return gamesStarted > 0 || shotsAgainst > 0;
        });
    }
    
    // Limit to last 10 games
    games = games.slice(0, 10);
    
    // Calculate stats
    let hits = 0;
    let totalValue = 0;
    
    const gameRows = games.map(game => {
        let statValue = getStatValue(game, statType, isGoalie);
        totalValue += statValue;
        
        const hit = statValue > lineValue;
        if (hit) hits++;
        
        const opponent = game.opponentAbbrev || 'N/A';
        const homeAway = game.homeRoadFlag === 'H' ? 'vs' : '@';
        const gameDate = parseLocalDate(game.gameDate).toLocaleDateString();
        
        // Get opponent rank badge
        let rankBadge = '';
        const oppTeamName = ABBREV_TO_FULL[opponent];
        let oppTeamData = teamShotData.find(t => t.teamFullName === oppTeamName);
        
        if (!oppTeamData) {
            oppTeamData = teamShotData.find(t => 
                t.abbrev === opponent || 
                t.teamFullName.includes(opponent) ||
                normalizeTeamName(t.teamFullName) === normalizeTeamName(oppTeamName || '')
            );
        }
        
        if (oppTeamData) {
            const mascot = TEAM_MASCOTS[oppTeamData.teamFullName] || opponent;
            
            if (isGoalie) {
                // For goalies: show opponent's shots taken (more shots = more save opportunities but harder)
                const shotsFor = oppTeamData.shotsPerGame?.toFixed(1) || 'N/A';
                const rank = oppTeamData.rank;
                let badgeColor = '#27ae60'; // green = easy (low shots)
                if (rank <= 10) badgeColor = '#e74c3c'; // red = hard (high shots)
                else if (rank <= 22) badgeColor = '#f39c12'; // yellow = medium
                rankBadge = `<span style="background: ${badgeColor}; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.8em; font-weight: bold; margin-left: 5px;">${mascot} take ${shotsFor}/g</span>`;
            } else if (statType === 'shots') {
                // For skaters: show opponent's shots against (what they allow)
                const shotsAgainst = oppTeamData.shotsAgainstPerGame?.toFixed(1) || 'N/A';
                const rank = oppTeamData.defensiveRank;
                let badgeColor = '#e74c3c'; // red = hard (low shots allowed)
                if (rank <= 10) badgeColor = '#27ae60'; // green = easy (high shots allowed)
                else if (rank <= 22) badgeColor = '#f39c12'; // yellow = medium
                rankBadge = `<span style="background: ${badgeColor}; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.8em; font-weight: bold; margin-left: 5px;">${mascot} allow ${shotsAgainst}/g</span>`;
            }
        }
        
        if (isGoalie) {
            const shotsAgainst = game.shotsAgainst || 0;
            const goalsAgainst = game.goalsAgainst || 0;
            const saves = shotsAgainst - goalsAgainst;
            const savePct = game.savePctg ? (game.savePctg * 100).toFixed(1) + '%' : 'N/A';
            
            return `
                <tr class="${hit ? 'hit' : 'miss'}">
                    <td>${gameDate}</td>
                    <td>${homeAway} ${opponent} ${rankBadge}</td>
                    <td>${saves}</td>
                    <td>${shotsAgainst}</td>
                    <td>${goalsAgainst}</td>
                    <td>${savePct}</td>
                    <td>${game.decision || 'N/A'}</td>
                </tr>
            `;
        } else {
            return `
                <tr class="${hit ? 'hit' : 'miss'}">
                    <td>${gameDate}</td>
                    <td>${homeAway} ${opponent} ${statType === 'shots' ? rankBadge : ''}</td>
                    <td>${game.goals || 0}</td>
                    <td>${game.assists || 0}</td>
                    <td>${game.points || 0}</td>
                    <td>${game.shots || 0}</td>
                </tr>
            `;
        }
    }).join('');
    
    const hitRate = games.length > 0 ? ((hits / games.length) * 100).toFixed(1) : 0;
    const avgValue = games.length > 0 ? (totalValue / games.length).toFixed(2) : 0;
    const colorClass = getHitRateColor(parseFloat(hitRate));
    
    // Build H2H section if we have next opponent
    let h2hSection = '';
    if (nextOpponent) {
        const h2hStats = calculateH2HStats(games, nextOpponent.abbrev, statType, lineValue, isGoalie);
        if (h2hStats) {
            h2hSection = renderH2HSection(h2hStats, nextOpponent, lineValue);
        }
    }
    
    // Build Available Lines section as table
    let availableLinesSection = '';
    if (playerOdds?.[statType]?.length > 0) {
        const allLines = playerOdds[statType];
        const escapedName = escapeName(name);
        const allGames = gameLog.gameLog.slice(0, 10); // Use last 10 games for hit rate calc
        
        // Calculate hit rate for each line
        const linesWithHitRate = allLines.map(l => {
            let hits = 0;
            allGames.forEach(g => {
                const statValue = getStatValue(g, statType, isGoalie);
                if (statValue > l.line) hits++;
            });
            const lineHitRate = allGames.length > 0 ? ((hits / allGames.length) * 100).toFixed(1) : 0;
            return { ...l, hitRate: lineHitRate, hits, total: allGames.length };
        });
        
        const tableRows = linesWithHitRate.map(l => {
            const overOdds = l.overOdds != null ? formatOdds(l.overOdds) : null;
            const underOdds = l.underOdds != null ? formatOdds(l.underOdds) : null;
            const game = l.game || 'N/A';
            const gameTime = l.gameTime || '';
            const bookmaker = l.bookmaker || 'Unknown';
            const isAnytime = l.type === 'anytime_scorer';
            const hrColorClass = getHitRateColor(parseFloat(l.hitRate));
            
            let oddsHtml = '';
            if (isAnytime) {
                oddsHtml = `<span onclick="event.stopPropagation(); window.proptrack.addToWatchlist(${player.playerId}, '${escapedName}', '${statType}', ${l.line}, ${l.overOdds || l.underOdds}, '${game}', '${gameTime}')" 
                    style="background: #e67e22; color: white; padding: 4px 10px; border-radius: 15px; cursor: pointer; font-weight: 600; font-size: 0.85em;">
                    Anytime ${formatOdds(l.overOdds || l.underOdds)}
                </span>`;
            } else {
                if (overOdds) {
                    oddsHtml += `<span onclick="event.stopPropagation(); window.proptrack.addToWatchlist(${player.playerId}, '${escapedName}', '${statType}', ${l.line}, ${l.overOdds}, '${game}', '${gameTime}', 'over')" 
                        style="border: 2px solid #27ae60; color: #27ae60; padding: 4px 10px; border-radius: 15px; cursor: pointer; font-weight: 600; font-size: 0.85em; margin-right: 6px;">
                        O ${overOdds}
                    </span>`;
                }
                if (underOdds) {
                    oddsHtml += `<span onclick="event.stopPropagation(); window.proptrack.addToWatchlist(${player.playerId}, '${escapedName}', '${statType}', ${l.line}, ${l.underOdds}, '${game}', '${gameTime}', 'under')" 
                        style="border: 2px solid #e74c3c; color: #e74c3c; padding: 4px 10px; border-radius: 15px; cursor: pointer; font-weight: 600; font-size: 0.85em;">
                        U ${underOdds}
                    </span>`;
                }
            }
            
            return `
                <tr style="border-bottom: 1px solid var(--input-border);">
                    <td style="padding: 12px; font-weight: bold; font-size: 1.2em; color: white;">${isAnytime ? 'AG' : l.line}</td>
                    <td style="padding: 12px;">${oddsHtml}</td>
                    <td style="padding: 12px; color: var(--text-secondary);">${bookmaker}</td>
                    <td style="padding: 12px; font-weight: bold;" class="${hrColorClass}">${l.hitRate}%</td>
                    <td style="padding: 12px; color: var(--text-secondary);">(${l.hits}/${l.total})</td>
                </tr>
            `;
        }).join('');
        
        availableLinesSection = `
            <div style="background: var(--container-bg); border: 1px solid var(--input-border); border-radius: 8px; margin: 15px 0; overflow: hidden;">
                <div onclick="window.proptrack.toggleAvailableLines(this)" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 15px; cursor: pointer; user-select: none;">
                    <span style="font-weight: 600; color: white;">Available Lines (${allLines.length})</span>
                    <span class="collapse-arrow" style="transition: transform 0.2s;">▼</span>
                </div>
                <div class="available-lines-content" style="display: none; border-top: 1px solid var(--input-border);">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="border-bottom: 1px solid var(--input-border); background: var(--card-bg);">
                                <th style="padding: 10px 12px; text-align: left; color: var(--text-secondary); font-weight: 600;">Line</th>
                                <th style="padding: 10px 12px; text-align: left; color: var(--text-secondary); font-weight: 600;">Odds</th>
                                <th style="padding: 10px 12px; text-align: left; color: var(--text-secondary); font-weight: 600;">Bookmaker</th>
                                <th style="padding: 10px 12px; text-align: left; color: var(--text-secondary); font-weight: 600;">Hit Rate</th>
                                <th style="padding: 10px 12px; text-align: left; color: var(--text-secondary); font-weight: 600;">Record</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRows}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }
    
    // Build This Game section with shot volume info
    let thisGameSection = '';
    if (playerOdds?.[statType]?.length > 0) {
        const lineObj = getMainLine(playerOdds[statType]);
        if (lineObj && lineObj.game) {
            const gameTime = lineObj.gameTime ? new Date(lineObj.gameTime).toLocaleString('en-US', {
                weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
            }) : '';
            const bookmaker = lineObj.bookmaker || 'Unknown';
            
            // Get opponent shot volume info
            let shotVolumeInfo = '';
            if (nextOpponent && (statType === 'shots' || isGoalie)) {
                const oppStats = teamShotData.find(t => 
                    t.teamFullName === nextOpponent.name ||
                    nextOpponent.name.includes(t.teamFullName?.split(' ').pop() || '') ||
                    t.teamFullName?.includes(nextOpponent.name.split(' ').pop())
                );
                
                if (oppStats) {
                    if (statType === 'shots') {
                        const shotsAgainst = oppStats.shotsAgainstPerGame?.toFixed(1) || 'N/A';
                        const rank = oppStats.defensiveRank || 'N/A';
                        const rankOrdinal = getOrdinal(rank);
                        let badgeColor = rank <= 10 ? '#27ae60' : (rank <= 22 ? '#f39c12' : '#e74c3c');
                        shotVolumeInfo = `
                            <div style="margin-top: 10px; text-align: center;">
                                <span style="background: ${badgeColor}; color: white; padding: 4px 10px; border-radius: 5px; font-weight: 600;">
                                    🎯 ${TEAM_MASCOTS[nextOpponent.name] || nextOpponent.name.split(' ').pop()} allow ${shotsAgainst} shots/game | ${rankOrdinal} most
                                </span>
                            </div>
                        `;
                    } else if (isGoalie) {
                        const shotsFor = oppStats.shotsPerGame?.toFixed(1) || 'N/A';
                        const rank = oppStats.rank || 'N/A';
                        const rankOrdinal = getOrdinal(rank);
                        let badgeColor = rank <= 10 ? '#e74c3c' : (rank <= 22 ? '#f39c12' : '#27ae60');
                        shotVolumeInfo = `
                            <div style="margin-top: 10px; text-align: center;">
                                <span style="background: ${badgeColor}; color: white; padding: 4px 10px; border-radius: 5px; font-weight: 600;">
                                    🎯 ${TEAM_MASCOTS[nextOpponent.name] || nextOpponent.name.split(' ').pop()} take ${shotsFor} shots/game | ${rankOrdinal} most
                                </span>
                            </div>
                        `;
                    }
                }
            }
            
            thisGameSection = `
                <div style="background: var(--card-bg); border: 2px solid var(--card-hover-border); border-radius: 10px; padding: 15px; margin: 15px 0; text-align: center;">
                    <div style="color: #e67e22; font-weight: bold; font-size: 0.9em;">🏒 This Game</div>
                    <div style="font-size: 1.1em; font-weight: bold; margin: 8px 0; color: white;">${lineObj.game}</div>
                    <div style="color: var(--text-secondary); font-size: 0.9em;">${gameTime}</div>
                    <div style="color: var(--text-secondary); font-size: 0.85em;">Odds from ${bookmaker}</div>
                    ${shotVolumeInfo}
                </div>
            `;
        }
    }
    
    // Badge color legend for shots/saves
    let badgeLegend = '';
    if (statType === 'shots' || isGoalie) {
        badgeLegend = `
            <div style="margin: 15px 0; padding: 12px 15px; background: var(--card-bg); border: 1px solid var(--input-border); border-radius: 8px; font-size: 0.85em;">
                <span style="font-weight: 600; color: white;">Badge Colors:</span>
                <span style="background: #27ae60; color: white; padding: 2px 6px; border-radius: 3px; margin-left: 10px;">#1-10</span> 
                <span style="color: var(--text-secondary);">${isGoalie ? 'Fewest shots (harder)' : 'Allow most shots (easier)'}</span>
                <span style="background: #f39c12; color: white; padding: 2px 6px; border-radius: 3px; margin-left: 10px;">#11-22</span> 
                <span style="color: var(--text-secondary);">Medium</span>
                <span style="background: #e74c3c; color: white; padding: 2px 6px; border-radius: 3px; margin-left: 10px;">#23-32</span> 
                <span style="color: var(--text-secondary);">${isGoalie ? 'Most shots (easier)' : 'Allow fewest shots (harder)'}</span>
            </div>
        `;
    }
    
    // Build modal content
    const modal = document.getElementById('gameLogModal');
    const modalContent = document.getElementById('modalContent');
    
    // Get season stat total
    let seasonStatLabel = isGoalie ? 'Season Saves' : `Season ${statType.charAt(0).toUpperCase() + statType.slice(1)}`;
    let seasonStatValue = 0;
    if (isGoalie) {
        seasonStatValue = player.saves || 0;
    } else if (statType === 'points') {
        seasonStatValue = player.points || 0;
    } else if (statType === 'goals') {
        seasonStatValue = player.goals || 0;
    } else if (statType === 'assists') {
        seasonStatValue = player.assists || 0;
    } else if (statType === 'shots') {
        seasonStatValue = player.shots || 0;
    }
    
    modalContent.innerHTML = `
        <h2 style="color: white;">${name}</h2>
        <p style="color: var(--text-secondary);">${player.teamAbbrevs} - ${isGoalie ? 'G' : player.positionCode || 'N/A'}</p>
        
        <div class="summary-stats">
            <div class="summary-card">
                <div class="summary-label">Hit Rate</div>
                <div class="summary-value ${colorClass}">${hitRate}%</div>
            </div>
            <div class="summary-card">
                <div class="summary-label">Hits</div>
                <div class="summary-value">${hits}/${games.length}</div>
            </div>
            <div class="summary-card">
                <div class="summary-label">${seasonStatLabel}</div>
                <div class="summary-value">${seasonStatValue}</div>
            </div>
        </div>
        
        ${availableLinesSection}
        
        ${thisGameSection}
        
        ${h2hSection}
        
        <h3 style="color: white;">Last ${games.length} Games</h3>
        ${badgeLegend}
        <table>
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Opponent</th>
                    ${isGoalie ? `
                        <th>Saves</th>
                        <th>SA</th>
                        <th>GA</th>
                        <th>SV%</th>
                        <th>Dec</th>
                    ` : `
                        <th>G</th>
                        <th>A</th>
                        <th>P</th>
                        <th>SOG</th>
                    `}
                </tr>
            </thead>
            <tbody>
                ${gameRows}
            </tbody>
        </table>
    `;
    
    modal.style.display = 'block';
}

/**
 * Calculate head-to-head stats against an opponent
 */
function calculateH2HStats(games, opponent, statType, lineValue, isGoalie) {
    const h2hGames = games.filter(game => game.opponentAbbrev === opponent);
    if (h2hGames.length === 0) return null;
    
    // Calculate hit rate for H2H games
    let h2hHits = 0;
    h2hGames.forEach(g => {
        const statValue = getStatValue(g, statType, isGoalie);
        if (statValue > lineValue) h2hHits++;
    });
    const hitRate = ((h2hHits / h2hGames.length) * 100).toFixed(1);
    
    if (isGoalie) {
        let totalSaves = 0, totalShotsAgainst = 0, totalGoalsAgainst = 0;
        let wins = 0, losses = 0;
        
        h2hGames.forEach(game => {
            const shotsAgainst = game.shotsAgainst || 0;
            const goalsAgainst = game.goalsAgainst || 0;
            totalSaves += shotsAgainst - goalsAgainst;
            totalShotsAgainst += shotsAgainst;
            totalGoalsAgainst += goalsAgainst;
            if (game.decision === 'W') wins++;
            if (game.decision === 'L') losses++;
        });
        
        return {
            games: h2hGames.length,
            avgSaves: (totalSaves / h2hGames.length).toFixed(1),
            avgShotsAgainst: (totalShotsAgainst / h2hGames.length).toFixed(1),
            avgGoalsAgainst: (totalGoalsAgainst / h2hGames.length).toFixed(2),
            avgSavePct: ((totalSaves / totalShotsAgainst) * 100).toFixed(1),
            wins,
            losses,
            hitRate,
            isGoalie: true,
            opponentAbbrev: opponent
        };
    } else {
        let totalGoals = 0, totalAssists = 0, totalPoints = 0, totalShots = 0;
        
        h2hGames.forEach(game => {
            totalGoals += game.goals || 0;
            totalAssists += game.assists || 0;
            totalPoints += game.points || 0;
            totalShots += game.shots || 0;
        });
        
        return {
            games: h2hGames.length,
            avgGoals: (totalGoals / h2hGames.length).toFixed(2),
            avgAssists: (totalAssists / h2hGames.length).toFixed(2),
            avgPoints: (totalPoints / h2hGames.length).toFixed(2),
            avgShots: (totalShots / h2hGames.length).toFixed(2),
            totalGoals,
            totalAssists,
            totalPoints,
            hitRate,
            isGoalie: false
        };
    }
}

/**
 * Render H2H section HTML
 */
function renderH2HSection(stats, opponent, lineValue) {
    const oppName = opponent.name;
    const hitRateColorClass = getHitRateColor(parseFloat(stats.hitRate || 0));
    
    if (stats.isGoalie) {
        return `
            <div style="background: var(--card-bg); border: 2px solid var(--card-hover-border); border-radius: 10px; padding: 15px; margin: 15px 0;">
                <div style="text-align: center; margin-bottom: 15px;">
                    <span style="color: #e67e22; font-weight: bold;">🏒 Head-to-Head vs ${oppName} this season</span>
                </div>
                <div class="h2h-stats">
                    <div class="h2h-stat">
                        <div class="h2h-stat-label">Games</div>
                        <div class="h2h-stat-value">${stats.games}</div>
                    </div>
                    <div class="h2h-stat">
                        <div class="h2h-stat-label">Avg Saves</div>
                        <div class="h2h-stat-value">${stats.avgSaves}</div>
                    </div>
                    <div class="h2h-stat">
                        <div class="h2h-stat-label">Avg SA</div>
                        <div class="h2h-stat-value">${stats.avgShotsAgainst}</div>
                    </div>
                    <div class="h2h-stat">
                        <div class="h2h-stat-label">SV%</div>
                        <div class="h2h-stat-value">${stats.avgSavePct}%</div>
                    </div>
                    <div class="h2h-stat">
                        <div class="h2h-stat-label">Record</div>
                        <div class="h2h-stat-value">${stats.wins}-${stats.losses}</div>
                    </div>
                    ${stats.hitRate !== undefined ? `
                    <div class="h2h-stat">
                        <div class="h2h-stat-label">Hit Rate vs ${lineValue}</div>
                        <div class="h2h-stat-value ${hitRateColorClass}">${stats.hitRate}%</div>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
    } else {
        return `
            <div style="background: var(--card-bg); border: 2px solid var(--card-hover-border); border-radius: 10px; padding: 15px; margin: 15px 0;">
                <div style="text-align: center; margin-bottom: 15px;">
                    <span style="color: #e67e22; font-weight: bold;">🏒 Head-to-Head vs ${oppName} this season</span>
                </div>
                <div class="h2h-stats">
                    <div class="h2h-stat">
                        <div class="h2h-stat-label">Games</div>
                        <div class="h2h-stat-value">${stats.games}</div>
                    </div>
                    <div class="h2h-stat">
                        <div class="h2h-stat-label">Avg Goals</div>
                        <div class="h2h-stat-value">${stats.avgGoals}</div>
                    </div>
                    <div class="h2h-stat">
                        <div class="h2h-stat-label">Avg Assists</div>
                        <div class="h2h-stat-value">${stats.avgAssists}</div>
                    </div>
                    <div class="h2h-stat">
                        <div class="h2h-stat-label">Avg Points</div>
                        <div class="h2h-stat-value">${stats.avgPoints}</div>
                    </div>
                    <div class="h2h-stat">
                        <div class="h2h-stat-label">Avg Shots</div>
                        <div class="h2h-stat-value">${stats.avgShots}</div>
                    </div>
                    ${stats.hitRate !== undefined ? `
                    <div class="h2h-stat">
                        <div class="h2h-stat-label">Hit Rate vs ${lineValue}</div>
                        <div class="h2h-stat-value ${hitRateColorClass}">${stats.hitRate}%</div>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
    }
}

/**
 * Show team game log modal
 */
export async function showTeamLog(teamName, game) {
    const modal = document.getElementById('gameLogModal');
    const modalContent = document.getElementById('modalContent');
    const teamShotData = state.teamShotData;
    const bettingOdds = state.bettingOdds;
    
    // Find team stats
    const teamStats = teamShotData.find(t => 
        t.teamFullName === teamName || 
        t.abbrev === teamName ||
        t.teamFullName.includes(teamName)
    );
    
    if (!teamStats) {
        modalContent.innerHTML = `<h2>${teamName}</h2><p>Team stats not found.</p>`;
        modal.style.display = 'block';
        return;
    }
    
    const teamAbbrev = TEAM_ABBREV_MAP[teamStats.teamFullName] || 
                      TEAM_ABBREV_MAP[teamName] || 
                      teamStats.abbrev;
    
    // Show loading
    modalContent.innerHTML = `<h2>${teamName}</h2><p>Loading game history...</p>`;
    modal.style.display = 'block';
    
    // Fetch games
    let allCompletedGames = state.getTeamSchedule(teamAbbrev);
    
    if (!allCompletedGames) {
        allCompletedGames = [];
        const currentDate = new Date();
        
        for (let i = 0; i < 3 && allCompletedGames.length < 15; i++) {
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
                console.error(`Error fetching schedule:`, e);
            }
        }
        
        state.cacheTeamSchedule(teamAbbrev, allCompletedGames);
    }
    
    // Sort and take recent games
    allCompletedGames.sort((a, b) => new Date(b.gameDate) - new Date(a.gameDate));
    const games = allCompletedGames.slice(0, 15);
    
    // Get betting lines
    const teamOdds = bettingOdds[teamName];
    const allLines = [];
    if (teamOdds?.team_totals) allLines.push(...teamOdds.team_totals);
    if (teamOdds?.alternate_team_totals) allLines.push(...teamOdds.alternate_team_totals);
    
    // Get line value for hit/miss calculation
    const selectedLine = state.selectedLineFilter;
    let lineValue = 2.5; // default
    if (selectedLine) {
        lineValue = parseFloat(selectedLine);
    } else if (allLines.length > 0) {
        const mainLine = getMainLine(allLines);
        if (mainLine) lineValue = mainLine.line;
    }
    
    // Get opponent info from game string
    const teams = game.split(' vs ');
    const opponentFull = teams.find(t => !t.includes(teamName.split(' ').pop()));
    const oppTeamStats = opponentFull ? teamShotData.find(t => 
        t.teamFullName === opponentFull ||
        t.teamFullName.includes(opponentFull) ||
        opponentFull.includes(t.abbrev)
    ) : null;
    
    // Build game rows with hit/miss coloring
    let hits = 0;
    const gameRows = games.map(g => {
        const isHome = g.homeTeam.abbrev === teamAbbrev;
        const teamScore = isHome ? g.homeTeam.score : g.awayTeam.score;
        const oppScore = isHome ? g.awayTeam.score : g.homeTeam.score;
        const oppAbbrev = isHome ? g.awayTeam.abbrev : g.homeTeam.abbrev;
        const result = teamScore > oppScore ? 'W' : (teamScore < oppScore ? 'L' : 'T');
        const gameDate = parseLocalDate(g.gameDate).toLocaleDateString();
        const hit = teamScore > lineValue;
        if (hit) hits++;
        
        return `
            <tr class="${hit ? 'hit' : 'miss'}">
                <td>${gameDate}</td>
                <td>${isHome ? 'vs' : '@'} ${oppAbbrev}</td>
                <td>${teamScore}</td>
                <td>${result}</td>
            </tr>
        `;
    }).join('');
    
    // Calculate hit rate
    const hitRate = games.length > 0 ? ((hits / games.length) * 100).toFixed(1) : 0;
    const hitRateColorClass = getHitRateColor(parseFloat(hitRate));
    
    // Render modal
    modalContent.innerHTML = `
        <h2 style="color: white;">${teamName}</h2>
        <p style="color: var(--text-secondary);">vs ${opponentFull || 'Unknown'}</p>
        
        <div class="summary-stats">
            <div class="summary-card">
                <div class="summary-label">Current Line</div>
                <div class="summary-value" style="color: #e67e22;">${lineValue}</div>
            </div>
            <div class="summary-card">
                <div class="summary-label">Hit Rate (Last ${games.length})</div>
                <div class="summary-value ${hitRateColorClass}">${hitRate}%</div>
            </div>
            <div class="summary-card">
                <div class="summary-label">Season Avg Goals/Game</div>
                <div class="summary-value">${teamStats.goalsPerGame.toFixed(1)}</div>
            </div>
            ${oppTeamStats ? `
                <div class="summary-card">
                    <div class="summary-label">${oppTeamStats.abbrev} Allows/Game</div>
                    <div class="summary-value">${oppTeamStats.goalsAgainstPerGame.toFixed(1)}</div>
                </div>
            ` : ''}
        </div>
        
        <h3 style="color: white;">Last ${games.length} Games vs ${lineValue}</h3>
        <table>
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Opponent</th>
                    <th>Goals</th>
                    <th>Result</th>
                </tr>
            </thead>
            <tbody>
                ${gameRows || '<tr><td colspan="4">No games available</td></tr>'}
            </tbody>
        </table>
    `;
}

/**
 * Close the modal
 */
export function closeModal() {
    const modal = document.getElementById('gameLogModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

/**
 * Initialize modal event listeners
 */
let modalInitialized = false;
export function initModal() {
    // Only add event listeners once
    if (modalInitialized) return;
    modalInitialized = true;
    
    // Close on overlay click
    window.addEventListener('click', (event) => {
        const modal = document.getElementById('gameLogModal');
        if (event.target === modal) {
            closeModal();
        }
    });
    
    // Close on escape key
    window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            const modal = document.getElementById('gameLogModal');
            if (modal && modal.style.display !== 'none') {
                closeModal();
            }
        }
    });
}

export default {
    showGameLog,
    showTeamLog,
    closeModal,
    initModal
};
