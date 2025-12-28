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
            const rank = isGoalie ? oppTeamData.rank : oppTeamData.defensiveRank;
            let badgeColor = '#27ae60';
            
            if (isGoalie) {
                // For goalies: high rank = more shots = harder
                if (rank <= 10) badgeColor = '#e74c3c';
                else if (rank <= 22) badgeColor = '#f39c12';
            } else {
                // For skaters (shots): low defensive rank = gives up more shots = easier
                if (rank <= 10) badgeColor = '#27ae60';
                else if (rank <= 22) badgeColor = '#f39c12';
                else badgeColor = '#e74c3c';
            }
            
            rankBadge = `<span style="background: ${badgeColor}; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.85em; font-weight: bold; margin-left: 5px;">#${rank}</span>`;
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
        const h2hStats = calculateH2HStats(games, nextOpponent.abbrev);
        if (h2hStats) {
            h2hSection = renderH2HSection(h2hStats, nextOpponent);
        }
    }
    
    // Build modal content
    const modal = document.getElementById('gameLogModal');
    const modalContent = document.getElementById('modalContent');
    
    modalContent.innerHTML = `
        <h2 style="color: white;">${name}</h2>
        <p style="color: var(--text-secondary);">${player.teamAbbrevs} | GP: ${player.gamesPlayed}</p>
        
        <div class="summary-stats">
            <div class="summary-card">
                <div class="summary-label">Current Line</div>
                <div class="summary-value" style="color: #e67e22;">${lineValue}</div>
            </div>
            <div class="summary-card">
                <div class="summary-label">Hit Rate (Last ${games.length})</div>
                <div class="summary-value ${colorClass}">${hitRate}%</div>
            </div>
            <div class="summary-card">
                <div class="summary-label">Average ${isGoalie ? 'Saves' : statType.charAt(0).toUpperCase() + statType.slice(1)}</div>
                <div class="summary-value">${avgValue}</div>
            </div>
            <div class="summary-card">
                <div class="summary-label">Record vs Line</div>
                <div class="summary-value">${hits}/${games.length}</div>
            </div>
        </div>
        
        ${nextOpponent ? `
            <div style="background: var(--warning-bg); padding: 10px; border-radius: 8px; margin: 15px 0; text-align: center;">
                <span style="color: var(--warning-text);">🏒 Next Opponent: <strong>${nextOpponent.name}</strong></span>
            </div>
        ` : ''}
        
        ${h2hSection}
        
        <h3 style="color: white;">Last ${games.length} Games</h3>
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
function calculateH2HStats(games, opponent) {
    const h2hGames = games.filter(game => game.opponentAbbrev === opponent);
    if (h2hGames.length === 0) return null;
    
    const isGoalie = h2hGames[0].shotsAgainst !== undefined;
    
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
            isGoalie: false
        };
    }
}

/**
 * Render H2H section HTML
 */
function renderH2HSection(stats, opponent) {
    const oppName = opponent.name;
    
    if (stats.isGoalie) {
        return `
            <div class="h2h-section">
                <div class="h2h-title">🆚 Head-to-Head vs ${oppName} (${stats.games} games)</div>
                <div class="h2h-stats">
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
                </div>
            </div>
        `;
    } else {
        return `
            <div class="h2h-section">
                <div class="h2h-title">🆚 Head-to-Head vs ${oppName} (${stats.games} games)</div>
                <div class="h2h-stats">
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
    
    // Get opponent info from game string
    const teams = game.split(' vs ');
    const opponentFull = teams.find(t => !t.includes(teamName.split(' ').pop()));
    const oppTeamStats = opponentFull ? teamShotData.find(t => 
        t.teamFullName === opponentFull ||
        t.teamFullName.includes(opponentFull) ||
        opponentFull.includes(t.abbrev)
    ) : null;
    
    // Build game rows
    const gameRows = games.map(g => {
        const isHome = g.homeTeam.abbrev === teamAbbrev;
        const teamScore = isHome ? g.homeTeam.score : g.awayTeam.score;
        const oppScore = isHome ? g.awayTeam.score : g.homeTeam.score;
        const oppAbbrev = isHome ? g.awayTeam.abbrev : g.homeTeam.abbrev;
        const result = teamScore > oppScore ? 'W' : (teamScore < oppScore ? 'L' : 'T');
        const gameDate = parseLocalDate(g.gameDate).toLocaleDateString();
        
        return `
            <tr>
                <td>${gameDate}</td>
                <td>${isHome ? 'vs' : '@'} ${oppAbbrev}</td>
                <td>${teamScore}</td>
                <td>${result}</td>
            </tr>
        `;
    }).join('');
    
    // Render modal
    modalContent.innerHTML = `
        <h2 style="color: white;">${teamName}</h2>
        <p style="color: var(--text-secondary);">vs ${opponentFull || 'Unknown'}</p>
        
        <div class="summary-stats">
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
        
        <h3 style="color: white;">Last ${games.length} Games</h3>
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
export function initModal() {
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
            closeModal();
        }
    });
}

export default {
    showGameLog,
    showTeamLog,
    closeModal,
    initModal
};
