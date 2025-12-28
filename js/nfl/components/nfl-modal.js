// js/nfl/components/nfl-modal.js - NFL game log modal

import { nflState } from '../nfl-state.js';
import { NFL_PROP_TYPES, NFL_HIT_RATE_GAMES } from '../nfl-constants.js';

/**
 * Show game log modal for a player
 */
export function showNFLGameLog(playerId) {
    const player = nflState.players.find(p => p.id === playerId);
    if (!player) return;
    
    const gameLog = nflState.getPlayerGameLog(playerId);
    const propType = nflState.currentPropType;
    const propConfig = NFL_PROP_TYPES[propType];
    
    // Get current line value
    const playerOdds = player.odds || nflState.bettingOdds[playerId]?.[propType];
    let lineValue = propConfig?.isAnytime ? 0.5 : (playerOdds?.line ?? playerOdds?.[0]?.line ?? 0);
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'nfl-game-log-modal';
    modal.onclick = (e) => {
        if (e.target === modal) closeNFLModal();
    };
    
    modal.innerHTML = `
        <div class="modal-content">
            <button class="modal-close" onclick="window.nflProptrack.closeModal()">&times;</button>
            
            <div class="modal-header">
                <h2>${player.name}</h2>
                <p>${player.team} - ${player.position} | GP: ${player.gamesPlayed}</p>
            </div>
            
            ${renderNFLSeasonStats(player, propType)}
            
            <div class="modal-section">
                <h3>Game Log (Last ${NFL_HIT_RATE_GAMES} Games)</h3>
                ${renderNFLGameLogTable(gameLog, propType, lineValue)}
            </div>
            
            ${renderNFLAvailableLines(player, propType)}
        </div>
    `;
    
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
}

/**
 * Render season stats summary
 */
function renderNFLSeasonStats(player, propType) {
    const propConfig = NFL_PROP_TYPES[propType];
    if (!propConfig) return '';
    
    const stats = propConfig.stats.map(statConfig => {
        const value = player.seasonStats?.[statConfig.key] || 0;
        const displayValue = statConfig.perGame && player.gamesPlayed > 0 
            ? (value / player.gamesPlayed).toFixed(1)
            : typeof value === 'number' ? value.toFixed(1) : value;
        return {
            label: statConfig.label,
            value: displayValue,
            total: value
        };
    });
    
    // Get hit rate
    const playerOdds = player.odds || nflState.bettingOdds[player.id]?.[propType];
    const lineValue = propConfig.isAnytime ? 0.5 : (playerOdds?.line ?? playerOdds?.[0]?.line ?? 0);
    const hitRateData = nflState.calculateHitRate(player.id, propConfig.statKey, lineValue);
    
    let rateClass = 'hit-rate-poor';
    if (hitRateData.rate >= 80) rateClass = 'hit-rate-excellent';
    else if (hitRateData.rate >= 60) rateClass = 'hit-rate-good';
    else if (hitRateData.rate >= 40) rateClass = 'hit-rate-medium';
    
    return `
        <div class="modal-section">
            <div class="summary-stats" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px;">
                <div class="summary-stat">
                    <div class="stat-label">Hit Rate</div>
                    <div class="stat-value ${rateClass}">${hitRateData.rate.toFixed(1)}%</div>
                </div>
                <div class="summary-stat">
                    <div class="stat-label">Hits</div>
                    <div class="stat-value">${hitRateData.hits}/${hitRateData.total}</div>
                </div>
                <div class="summary-stat">
                    <div class="stat-label">${stats[0]?.label || 'Stat'}</div>
                    <div class="stat-value">${stats[0]?.value || '-'}</div>
                </div>
                <div class="summary-stat">
                    <div class="stat-label">Season Total</div>
                    <div class="stat-value">${stats[0]?.total || '-'}</div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render game log table
 */
function renderNFLGameLogTable(gameLog, propType, lineValue) {
    const propConfig = NFL_PROP_TYPES[propType];
    if (!propConfig) return '<p>No game log available</p>';
    
    const statKey = propConfig.statKey;
    const recentGames = gameLog.slice(0, NFL_HIT_RATE_GAMES);
    
    if (recentGames.length === 0) {
        return '<p>No recent games available</p>';
    }
    
    const rows = recentGames.map(game => {
        if (game.isByeWeek) {
            return `
                <tr class="bye-week-row">
                    <td>Week ${game.week}</td>
                    <td colspan="4" style="text-align: center; color: #a0aec0; font-style: italic;">
                        BYE WEEK
                    </td>
                </tr>
            `;
        }
        
        const statValue = game.stats?.[statKey] || 0;
        const hit = statValue > lineValue;
        const hitClass = hit ? 'hit' : 'miss';
        
        return `
            <tr class="${hitClass}">
                <td>Week ${game.week}</td>
                <td>${game.opponent || '-'}</td>
                <td>${game.result || '-'}</td>
                <td class="stat-cell ${hitClass}">${statValue}</td>
                <td class="${hitClass}">${hit ? '✓' : '✗'}</td>
            </tr>
        `;
    }).join('');
    
    return `
        <table class="game-log-table">
            <thead>
                <tr>
                    <th>Week</th>
                    <th>Opponent</th>
                    <th>Result</th>
                    <th>${propConfig.label}</th>
                    <th>vs ${lineValue}</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
        </table>
    `;
}

/**
 * Render available betting lines
 */
function renderNFLAvailableLines(player, propType) {
    const propConfig = NFL_PROP_TYPES[propType];
    if (propConfig?.isAnytime) return '';
    
    const playerOdds = player.odds || nflState.bettingOdds[player.id]?.[propType];
    if (!playerOdds) return '';
    
    const lines = Array.isArray(playerOdds) ? playerOdds : [playerOdds];
    
    if (lines.length === 0) return '';
    
    const rows = lines.map(lineData => {
        const hitRateData = nflState.calculateHitRate(player.id, propConfig.statKey, lineData.line);
        
        return `
            <tr>
                <td>${lineData.line}</td>
                <td style="color: #27ae60;">O ${lineData.overOdds ? (lineData.overOdds > 0 ? '+' : '') + lineData.overOdds : '-'}</td>
                <td style="color: #e74c3c;">U ${lineData.underOdds ? (lineData.underOdds > 0 ? '+' : '') + lineData.underOdds : '-'}</td>
                <td>${hitRateData.rate.toFixed(1)}%</td>
                <td>${hitRateData.hits}/${hitRateData.total}</td>
            </tr>
        `;
    }).join('');
    
    return `
        <div class="modal-section">
            <h3>Available Lines</h3>
            <table class="available-lines-table">
                <thead>
                    <tr>
                        <th>Line</th>
                        <th>Over</th>
                        <th>Under</th>
                        <th>Hit Rate</th>
                        <th>Record</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        </div>
    `;
}

/**
 * Close the modal
 */
export function closeNFLModal() {
    const modal = document.getElementById('nfl-game-log-modal');
    if (modal) {
        modal.remove();
        document.body.style.overflow = '';
    }
}
