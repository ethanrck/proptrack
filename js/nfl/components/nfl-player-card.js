// js/nfl/components/nfl-player-card.js - NFL player card rendering

import { nflState } from '../nfl-state.js';
import { NFL_PROP_TYPES, NFL_HIT_RATE_GAMES } from '../nfl-constants.js';
import { getPlayerGameInfo } from '../nfl-api-client.js';
import { formatOdds, escapeName } from '../../utils.js';

/**
 * Render a single NFL player card
 */
export function renderNFLPlayerCard(player, propType) {
    const propConfig = NFL_PROP_TYPES[propType];
    if (!propConfig) return '';
    
    const { name, team, position, gamesPlayed, id } = player;
    const odds = player.odds;
    const gameInfo = getPlayerGameInfo(id);
    
    // Get stats for display
    const stats = propConfig.stats.map(statConfig => {
        const value = player.seasonStats?.[statConfig.key] || 0;
        const displayValue = statConfig.perGame && gamesPlayed > 0 
            ? (value / gamesPlayed).toFixed(1)
            : typeof value === 'number' ? value.toFixed(1) : value;
        return {
            label: statConfig.label,
            value: displayValue
        };
    });
    
    // Build odds display
    let oddsDisplay = '';
    const escapedName = escapeName(name);
    const game = gameInfo ? `${gameInfo.isHome ? 'vs' : '@'} ${gameInfo.opponent}` : '';
    const gameTime = gameInfo?.gameTime || '';
    
    if (propConfig.isAnytime) {
        // Anytime TD display
        const price = odds?.price || odds?.odds;
        if (price) {
            const formattedOdds = formatOdds(price);
            oddsDisplay = `
                <div class="odds-box-anytime" onclick="event.stopPropagation(); window.nflProptrack.addToWatchlist(${id}, '${escapedName}', '${propType}', 0.5, ${price}, '${game}', '${gameTime}')">
                    Anytime TD ${formattedOdds}
                </div>
            `;
        }
    } else {
        // O/U display - matching NHL styling exactly
        const line = odds?.line ?? odds?.[0]?.line;
        const overOdds = odds?.overOdds ?? odds?.[0]?.overOdds;
        const underOdds = odds?.underOdds ?? odds?.[0]?.underOdds;
        
        if (line !== undefined) {
            oddsDisplay = `
                <div class="odds-box">
                    <div style="font-weight: bold; font-size: 1.45em; color: #e67e22; pointer-events: none;">${line}</div>
                    ${overOdds != null ? `
                        <div onclick="event.stopPropagation(); window.nflProptrack.addToWatchlist(${id}, '${escapedName}', '${propType}', ${line}, ${overOdds}, '${game}', '${gameTime}', 'over')" 
                             style="color: #27ae60; font-size: 1.05em; cursor: pointer; padding: 1px 6px; border-radius: 3px; transition: all 0.2s;" 
                             onmouseover="this.style.background='#27ae60'; this.style.color='white';" 
                             onmouseout="this.style.background=''; this.style.color='#27ae60';">
                            O ${formatOdds(overOdds)}
                        </div>
                    ` : ''}
                    ${underOdds != null ? `
                        <div onclick="event.stopPropagation(); window.nflProptrack.addToWatchlist(${id}, '${escapedName}', '${propType}', ${line}, ${underOdds}, '${game}', '${gameTime}', 'under')" 
                             style="color: #e74c3c; font-size: 1.05em; cursor: pointer; padding: 1px 6px; border-radius: 3px; transition: all 0.2s;" 
                             onmouseover="this.style.background='#e74c3c'; this.style.color='white';" 
                             onmouseout="this.style.background=''; this.style.color='#e74c3c';">
                            U ${formatOdds(underOdds)}
                        </div>
                    ` : ''}
                </div>
            `;
        }
    }
    
    return `
        <div class="player-card" onclick="window.nflProptrack.showGameLog(${id})">
            <div class="player-header">
                <div class="player-info">
                    <div class="player-name">${name}</div>
                    <div class="player-team">${team} - ${position} | GP: ${gamesPlayed}</div>
                </div>
                ${oddsDisplay}
            </div>
            <div class="player-stats">
                ${stats.map(stat => `
                    <div class="stat">
                        <div class="stat-label">${stat.label}</div>
                        <div class="stat-value">${stat.value}</div>
                    </div>
                `).join('')}
            </div>
            <div class="hit-rate-display" id="nfl-hitrate-${id}">
                <div class="stat-label">Calculating...</div>
            </div>
        </div>
    `;
}

/**
 * Update hit rate display for a player
 */
export function updateNFLHitRate(playerId, propType, lineValue) {
    const propConfig = NFL_PROP_TYPES[propType];
    if (!propConfig) return;
    
    const statKey = propConfig.statKey;
    const hitRateData = nflState.calculateHitRate(playerId, statKey, lineValue, NFL_HIT_RATE_GAMES);
    
    const element = document.getElementById(`nfl-hitrate-${playerId}`);
    if (!element) return;
    
    const { rate, hits, total } = hitRateData;
    
    let rateClass = 'hit-rate-poor';
    if (rate >= 80) rateClass = 'hit-rate-excellent';
    else if (rate >= 60) rateClass = 'hit-rate-good';
    else if (rate >= 40) rateClass = 'hit-rate-medium';
    
    element.innerHTML = `
        <div class="stat-label">Last ${total} Games vs ${lineValue}</div>
        <div class="hit-rate-value ${rateClass}">${rate.toFixed(1)}% (${hits}/${total})</div>
    `;
}

/**
 * Render all player cards for a prop type
 */
export function renderNFLPlayerCards(players, propType) {
    return players.map(player => renderNFLPlayerCard(player, propType)).join('');
}
