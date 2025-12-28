// js/components/player-card.js - Player card rendering component

import state from '../state.js';
import { 
    getHitRateColor, 
    getMainLine, 
    getStatValue, 
    escapeName,
    formatOdds 
} from '../utils.js';

/**
 * Render a single player card
 */
export function renderPlayerCard(player, selectedLine) {
    const isGoalie = state.isGoalieMode;
    const statType = state.currentStatType;
    const bettingOdds = state.bettingOdds;
    const teamShotData = state.teamShotData;
    
    const name = isGoalie 
        ? (player.goalieFullName || 'Unknown Goalie')
        : (player.skaterFullName || 'Unknown Player');
    
    const team = player.teamAbbrevs || 'N/A';
    const gamesPlayed = player.gamesPlayed || 0;
    const position = isGoalie ? 'G' : (player.positionCode || 'N/A');
    
    // Get stats based on player type
    let stat1Label, stat1Value, stat2Label, stat2Value, stat3Label, stat3Value;
    
    if (isGoalie) {
        stat1Label = 'Saves';
        stat1Value = player.saves || 0;
        stat2Label = 'GAA';
        stat2Value = (player.goalsAgainstAverage || 0).toFixed(2);
        stat3Label = 'SV%';
        stat3Value = (player.savePct || 0).toFixed(3);
    } else {
        stat1Label = 'Goals';
        stat1Value = player.goals || 0;
        stat2Label = 'Assists';
        stat2Value = player.assists || 0;
        stat3Label = 'Points';
        stat3Value = player.points || 0;
    }
    
    // Get betting odds display
    const playerOdds = bettingOdds[name];
    const hasLine = playerOdds && Array.isArray(playerOdds[statType]) && playerOdds[statType].length > 0;
    let oddsDisplay = '';
    let shotVolumeInfo = '';
    
    if (hasLine) {
        let oddsInfo;
        if (selectedLine) {
            oddsInfo = playerOdds[statType].find(l => l.line == parseFloat(selectedLine));
        }
        if (!oddsInfo) {
            oddsInfo = getMainLine(playerOdds[statType]);
        }
        
        if (oddsInfo) {
            const line = oddsInfo.line;
            const price = oddsInfo.overOdds || oddsInfo.underOdds || 0;
            const overOdds = oddsInfo.overOdds;
            const underOdds = oddsInfo.underOdds;
            const game = oddsInfo.game || 'N/A';
            const gameTime = oddsInfo.gameTime || '';
            const escapedName = escapeName(name);
            
            // Get opponent info for shot volume badges
            if ((statType === 'shots' || isGoalie) && game && game !== 'N/A') {
                const gameTeams = game.split(' vs ');
                let opponentName = null;
                
                for (const gameTeam of gameTeams) {
                    const teamNorm = gameTeam.toLowerCase().replace(/[^a-z]/g, '');
                    const playerTeamNorm = (player.teamAbbrevs || '').toLowerCase().replace(/[^a-z]/g, '');
                    if (!teamNorm.includes(playerTeamNorm) && !playerTeamNorm.includes(teamNorm.slice(0, 3))) {
                        opponentName = gameTeam;
                        break;
                    }
                }
                
                if (opponentName) {
                    const oppStats = teamShotData.find(t => 
                        t.teamFullName === opponentName ||
                        opponentName.includes(t.teamFullName.split(' ').pop()) ||
                        t.teamFullName.includes(opponentName.split(' ').pop())
                    );
                    
                    if (oppStats) {
                        if (statType === 'shots') {
                            // For shots: show opponent's shots against (what they allow)
                            const shotsAgainst = oppStats.shotsAgainstPerGame?.toFixed(1) || 'N/A';
                            const rank = oppStats.defensiveRank || 'N/A';
                            let badgeColor = rank <= 10 ? '#27ae60' : (rank <= 22 ? '#f39c12' : '#e74c3c');
                            shotVolumeInfo = `
                                <div style="font-size: 0.75em; color: var(--text-secondary); margin-top: 5px; text-align: center;">
                                    🎯 <span style="background: ${badgeColor}; color: white; padding: 1px 4px; border-radius: 3px;">${oppStats.teamFullName?.split(' ').pop() || 'Opp'} allow ${shotsAgainst}/g</span>
                                </div>
                            `;
                        } else if (isGoalie) {
                            // For goalies: show opponent's shots per game (what they take)
                            const shotsFor = oppStats.shotsPerGame?.toFixed(1) || 'N/A';
                            const rank = oppStats.rank || 'N/A';
                            let badgeColor = rank <= 10 ? '#e74c3c' : (rank <= 22 ? '#f39c12' : '#27ae60');
                            shotVolumeInfo = `
                                <div style="font-size: 0.75em; color: var(--text-secondary); margin-top: 5px; text-align: center;">
                                    🎯 <span style="background: ${badgeColor}; color: white; padding: 1px 4px; border-radius: 3px;">${oppStats.teamFullName?.split(' ').pop() || 'Opp'} take ${shotsFor}/g</span>
                                </div>
                            `;
                        }
                    }
                }
            }
            
            if (statType === 'goals' && oddsInfo.type === 'anytime_scorer') {
                const formattedOdds = formatOdds(price);
                oddsDisplay = `
                    <div class="odds-line" onclick="event.stopPropagation(); window.proptrack.addToWatchlist(${player.playerId}, '${escapedName}', '${statType}', ${line}, ${price}, '${game}', '${gameTime}')">
                        Anytime Goal ${formattedOdds}
                    </div>
                `;
            } else {
                oddsDisplay = `
                    <div style="display: flex; flex-direction: column; align-items: center; line-height: 1.2; gap: 2px; background: var(--warning-bg); padding: 8px; border-radius: 6px;">
                        <div style="font-weight: bold; font-size: 1.5em; color: #e67e22; pointer-events: none;">${line}</div>
                        ${overOdds != null ? `
                            <div onclick="event.stopPropagation(); window.proptrack.addToWatchlist(${player.playerId}, '${escapedName}', '${statType}', ${line}, ${overOdds}, '${game}', '${gameTime}', 'over')" 
                                 style="color: #27ae60; font-size: 1.1em; cursor: pointer; padding: 2px 8px; border-radius: 3px; transition: all 0.2s;" 
                                 onmouseover="this.style.background='#27ae60'; this.style.color='white';" 
                                 onmouseout="this.style.background=''; this.style.color='#27ae60';">
                                O ${formatOdds(overOdds)}
                            </div>
                        ` : ''}
                        ${underOdds != null ? `
                            <div onclick="event.stopPropagation(); window.proptrack.addToWatchlist(${player.playerId}, '${escapedName}', '${statType}', ${line}, ${underOdds}, '${game}', '${gameTime}', 'under')" 
                                 style="color: #e74c3c; font-size: 1.1em; cursor: pointer; padding: 2px 8px; border-radius: 3px; transition: all 0.2s;" 
                                 onmouseover="this.style.background='#e74c3c'; this.style.color='white';" 
                                 onmouseout="this.style.background=''; this.style.color='#e74c3c';">
                                U ${formatOdds(underOdds)}
                            </div>
                        ` : ''}
                    </div>
                `;
            }
        }
    }
    
    return `
        <div class="player-card" onclick="window.proptrack.showGameLog(${player.playerId})">
            <div class="player-header" style="align-items: center;">
                <div style="flex: 1;">
                    <div class="player-name">${name}</div>
                    <div class="player-team" style="margin-top: 2px; margin-bottom: 0;">${team} - ${position} | GP: ${gamesPlayed}</div>
                </div>
                ${oddsDisplay}
            </div>
            ${shotVolumeInfo}
            <div class="player-stats" style="margin-top: 10px;">
                <div class="stat">
                    <div class="stat-label">${stat1Label}</div>
                    <div class="stat-value">${stat1Value}</div>
                </div>
                <div class="stat">
                    <div class="stat-label">${stat2Label}</div>
                    <div class="stat-value">${stat2Value}</div>
                </div>
                <div class="stat">
                    <div class="stat-label">${stat3Label}</div>
                    <div class="stat-value">${stat3Value}</div>
                </div>
            </div>
            <div class="hit-rate-display" id="hitrate-${player.playerId}">
                <div class="stat-label">Calculating...</div>
            </div>
        </div>
    `;
}

/**
 * Update hit rate display for a player
 */
export function updatePlayerHitRate(playerId, lineValue) {
    const isGoalie = state.isGoalieMode;
    const statType = state.currentStatType;
    const gameLogs = state.getCurrentGameLogs();
    const bettingOdds = state.bettingOdds;
    
    const gameLog = gameLogs[playerId];
    const hitRateDiv = document.getElementById(`hitrate-${playerId}`);
    
    if (!hitRateDiv || !gameLog?.gameLog) return;
    
    let games = gameLog.gameLog;
    
    // Filter goalie games to only started games
    if (isGoalie) {
        games = games.filter(game => {
            const shotsAgainst = game.shotsAgainst || 0;
            const gamesStarted = game.gamesStarted || 0;
            return gamesStarted > 0 || shotsAgainst > 0;
        });
    }
    
    games = games.slice(0, 10);
    
    if (games.length === 0) {
        hitRateDiv.innerHTML = '<div class="stat-label">No games available</div>';
        return;
    }
    
    let hits = 0;
    games.forEach(game => {
        const statValue = getStatValue(game, statType, isGoalie);
        if (statValue > lineValue) hits++;
    });
    
    const hitRate = ((hits / games.length) * 100).toFixed(1);
    const colorClass = getHitRateColor(parseFloat(hitRate));
    
    hitRateDiv.innerHTML = `
        <div class="stat-label">Last ${games.length} Games vs ${lineValue}</div>
        <div class="hit-rate-value ${colorClass}">${hitRate}% (${hits}/${games.length})</div>
    `;
    
    // Cache hit rate
    state.playerHitRates[playerId] = parseFloat(hitRate);
}

/**
 * Update all visible player hit rates
 */
export function updateAllHitRates() {
    const isGoalie = state.isGoalieMode;
    const statType = state.currentStatType;
    const bettingOdds = state.bettingOdds;
    const selectedLine = state.selectedLineFilter;
    
    state.filteredPlayers.forEach(player => {
        const name = isGoalie 
            ? (player.goalieFullName || 'Unknown Goalie')
            : (player.skaterFullName || 'Unknown Player');
        
        const playerOdds = bettingOdds[name];
        let lineValue = 0.5;
        
        if (playerOdds && Array.isArray(playerOdds[statType]) && playerOdds[statType].length > 0) {
            if (selectedLine) {
                const matchingLine = playerOdds[statType].find(l => l.line == parseFloat(selectedLine));
                lineValue = matchingLine ? matchingLine.line : getMainLine(playerOdds[statType]).line;
            } else {
                lineValue = getMainLine(playerOdds[statType]).line;
            }
        }
        
        updatePlayerHitRate(player.playerId, lineValue);
    });
}

export default {
    renderPlayerCard,
    updatePlayerHitRate,
    updateAllHitRates
};
