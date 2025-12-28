// js/nfl/components/nfl-modal.js - NFL game log modal (matching NHL style)

import { nflState } from '../nfl-state.js';
import { NFL_PROP_TYPES, NFL_HIT_RATE_GAMES } from '../nfl-constants.js';
import { getPlayerGameInfo } from '../nfl-api-client.js';
import { formatOdds, escapeName, getHitRateColor, getOrdinal } from '../../utils.js';

/**
 * Show game log modal for a player - matching NHL modal exactly
 */
export function showNFLGameLog(playerId) {
    const player = nflState.players.find(p => p.id === playerId || p.id === String(playerId));
    if (!player) {
        console.error('Player not found:', playerId);
        return;
    }
    
    const gameLog = nflState.getPlayerGameLog(playerId) || nflState.getPlayerGameLog(String(playerId)) || [];
    const propType = nflState.currentPropType;
    const propConfig = NFL_PROP_TYPES[propType];
    const gameInfo = getPlayerGameInfo(playerId);
    const escapedName = escapeName(player.name);
    
    // Get current line value from odds
    const playerOdds = player.odds || nflState.bettingOdds[player.name]?.[propType];
    let lineValue = propConfig?.isAnytime ? 0.5 : (playerOdds?.line ?? playerOdds?.[0]?.line ?? 0);
    
    // Filter to recent games (non-bye weeks)
    const recentGames = gameLog.filter(g => !g.isByeWeek).slice(0, 10);
    
    // Calculate hit rate
    let hits = 0;
    let totalValue = 0;
    const statKey = propConfig?.statKey;
    
    recentGames.forEach(game => {
        const statValue = game.stats?.[statKey] || 0;
        totalValue += statValue;
        if (statValue > lineValue) hits++;
    });
    
    const hitRate = recentGames.length > 0 ? ((hits / recentGames.length) * 100).toFixed(1) : 0;
    const colorClass = getHitRateColor(parseFloat(hitRate));
    
    // Get season stat total
    const seasonStatLabel = `Season ${propConfig?.label || 'Total'}`;
    const seasonStatValue = player.seasonStats?.[statKey] || 0;
    
    // Build game rows
    const gameRows = recentGames.map(game => {
        const statValue = game.stats?.[statKey] || 0;
        const hit = statValue > lineValue;
        const rowClass = hit ? 'hit' : 'miss';
        
        const opponent = game.opponent || 'N/A';
        const result = game.result || '-';
        const week = game.week || '-';
        
        // Get opponent defense badge
        let defBadge = '';
        const oppDefense = nflState.teamDefense?.[opponent];
        if (oppDefense) {
            let defValue, defRank;
            if (propType === 'passing_yards' || propType === 'passing_tds') {
                defValue = oppDefense.passYardsAllowed?.toFixed(1);
                defRank = oppDefense.passYardsRank;
            } else if (propType === 'rushing_yards') {
                defValue = oppDefense.rushYardsAllowed?.toFixed(1);
                defRank = oppDefense.rushYardsRank;
            } else if (propType === 'receiving_yards' || propType === 'receptions') {
                defValue = oppDefense.passYardsAllowed?.toFixed(1);
                defRank = oppDefense.passYardsRank;
            }
            
            if (defValue && defRank) {
                // Higher rank = worse defense = good for offense (green)
                let badgeColor = defRank >= 20 ? '#27ae60' : (defRank >= 10 ? '#f39c12' : '#e74c3c');
                defBadge = `<span style="background: ${badgeColor}; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.75em; font-weight: bold; margin-left: 5px;">${defRank}${getOrdinal(defRank).replace(defRank, '')}</span>`;
            }
        }
        
        return `
            <tr class="${rowClass}">
                <td>Wk ${week}</td>
                <td>${opponent}${defBadge}</td>
                <td>${result}</td>
                <td class="${rowClass}">${statValue}</td>
                <td class="${rowClass}">${hit ? '✓' : '✗'}</td>
            </tr>
        `;
    }).join('');
    
    // Build Available Lines section
    let availableLinesSection = '';
    const allLines = Array.isArray(playerOdds) ? playerOdds : (playerOdds ? [playerOdds] : []);
    
    if (allLines.length > 0 && !propConfig?.isAnytime) {
        const linesWithHitRate = allLines.map(l => {
            let lineHits = 0;
            recentGames.forEach(g => {
                const statValue = g.stats?.[statKey] || 0;
                if (statValue > l.line) lineHits++;
            });
            const lineHitRate = recentGames.length > 0 ? ((lineHits / recentGames.length) * 100).toFixed(1) : 0;
            return { ...l, hitRate: lineHitRate, hits: lineHits, total: recentGames.length };
        });
        
        const tableRows = linesWithHitRate.map(l => {
            const overOdds = l.overOdds != null ? formatOdds(l.overOdds) : null;
            const underOdds = l.underOdds != null ? formatOdds(l.underOdds) : null;
            const hrColorClass = getHitRateColor(parseFloat(l.hitRate));
            const game = gameInfo ? `${gameInfo.isHome ? 'vs' : '@'} ${gameInfo.opponent}` : '';
            const gameTime = gameInfo?.gameTime || '';
            
            let oddsHtml = '';
            if (overOdds) {
                oddsHtml += `<span onclick="event.stopPropagation(); window.nflProptrack.addToWatchlist(${player.id}, '${escapedName}', '${propType}', ${l.line}, ${l.overOdds}, '${game}', '${gameTime}', 'over')" 
                    style="border: 2px solid #27ae60; color: #27ae60; padding: 4px 10px; border-radius: 15px; cursor: pointer; font-weight: 600; font-size: 0.85em; margin-right: 6px;">
                    O ${overOdds}
                </span>`;
            }
            if (underOdds) {
                oddsHtml += `<span onclick="event.stopPropagation(); window.nflProptrack.addToWatchlist(${player.id}, '${escapedName}', '${propType}', ${l.line}, ${l.underOdds}, '${game}', '${gameTime}', 'under')" 
                    style="border: 2px solid #e74c3c; color: #e74c3c; padding: 4px 10px; border-radius: 15px; cursor: pointer; font-weight: 600; font-size: 0.85em;">
                    U ${underOdds}
                </span>`;
            }
            
            return `
                <tr style="border-bottom: 1px solid var(--input-border);">
                    <td style="padding: 12px; font-weight: bold; font-size: 1.2em; color: white;">${l.line}</td>
                    <td style="padding: 12px;">${oddsHtml}</td>
                    <td style="padding: 12px; font-weight: bold;" class="${hrColorClass}">${l.hitRate}%</td>
                    <td style="padding: 12px; color: var(--text-secondary);">(${l.hits}/${l.total})</td>
                </tr>
            `;
        }).join('');
        
        availableLinesSection = `
            <div style="background: var(--container-bg); border: 1px solid var(--input-border); border-radius: 8px; margin: 15px 0; overflow: hidden;">
                <div onclick="window.nflProptrack.toggleAvailableLines(this)" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 15px; cursor: pointer; user-select: none;">
                    <span style="font-weight: 600; color: white;">Available Lines (${allLines.length})</span>
                    <span class="collapse-arrow" style="transition: transform 0.2s;">▼</span>
                </div>
                <div class="available-lines-content" style="display: none; border-top: 1px solid var(--input-border);">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="border-bottom: 1px solid var(--input-border); background: var(--card-bg);">
                                <th style="padding: 10px 12px; text-align: left; color: var(--text-secondary); font-weight: 600;">Line</th>
                                <th style="padding: 10px 12px; text-align: left; color: var(--text-secondary); font-weight: 600;">Odds</th>
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
    
    // Build This Game section with opponent defense info
    let thisGameSection = '';
    if (gameInfo) {
        const opponent = gameInfo.opponent;
        const oppDefense = nflState.teamDefense?.[opponent];
        
        let defenseInfo = '';
        if (oppDefense) {
            let defValue, defRank, defLabel;
            if (propType === 'passing_yards' || propType === 'passing_tds') {
                defValue = oppDefense.passYardsAllowed?.toFixed(1);
                defRank = oppDefense.passYardsRank;
                defLabel = 'pass yds/gm';
            } else if (propType === 'rushing_yards') {
                defValue = oppDefense.rushYardsAllowed?.toFixed(1);
                defRank = oppDefense.rushYardsRank;
                defLabel = 'rush yds/gm';
            } else if (propType === 'receiving_yards' || propType === 'receptions') {
                defValue = oppDefense.passYardsAllowed?.toFixed(1);
                defRank = oppDefense.passYardsRank;
                defLabel = 'pass yds/gm';
            } else if (propType === 'anytime_td') {
                defValue = oppDefense.pointsAllowed?.toFixed(1);
                defRank = oppDefense.pointsRank;
                defLabel = 'pts/gm';
            }
            
            if (defValue && defRank) {
                // Higher rank = worse defense = good for offense (green)
                let badgeColor = defRank >= 20 ? '#27ae60' : (defRank >= 10 ? '#f39c12' : '#e74c3c');
                const rankOrdinal = getOrdinal(defRank);
                defenseInfo = `
                    <div style="margin-top: 10px; text-align: center;">
                        <span style="background: ${badgeColor}; color: white; padding: 4px 10px; border-radius: 5px; font-weight: 600;">
                            🎯 ${opponent} allows ${defValue} ${defLabel} | ${rankOrdinal} most
                        </span>
                    </div>
                `;
            }
        }
        
        const gameTime = gameInfo.gameTime ? new Date(gameInfo.gameTime).toLocaleString('en-US', {
            weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
        }) : '';
        
        thisGameSection = `
            <div style="background: var(--card-bg); border: 2px solid #e67e22; border-radius: 10px; padding: 15px; margin: 15px 0; text-align: center;">
                <div style="color: #e67e22; font-weight: bold; font-size: 0.9em;">🏈 This Game</div>
                <div style="font-size: 1.1em; font-weight: bold; margin: 8px 0; color: white;">${gameInfo.isHome ? 'vs' : '@'} ${opponent}</div>
                ${gameTime ? `<div style="color: var(--text-secondary); font-size: 0.9em;">${gameTime}</div>` : ''}
                ${defenseInfo}
            </div>
        `;
    }
    
    // Badge legend
    const badgeLegend = `
        <div style="margin: 15px 0; padding: 12px 15px; background: var(--card-bg); border: 1px solid var(--input-border); border-radius: 8px; font-size: 0.85em;">
            <span style="font-weight: 600; color: white;">Opponent Defense Rank:</span>
            <span style="background: #27ae60; color: white; padding: 2px 6px; border-radius: 3px; margin-left: 10px;">#20-32</span> 
            <span style="color: var(--text-secondary);">Allows most (easier)</span>
            <span style="background: #f39c12; color: white; padding: 2px 6px; border-radius: 3px; margin-left: 10px;">#10-19</span> 
            <span style="color: var(--text-secondary);">Medium</span>
            <span style="background: #e74c3c; color: white; padding: 2px 6px; border-radius: 3px; margin-left: 10px;">#1-9</span> 
            <span style="color: var(--text-secondary);">Allows least (harder)</span>
        </div>
    `;
    
    // Use the existing NHL modal structure
    const modal = document.getElementById('gameLogModal');
    const modalContent = document.getElementById('modalContent');
    
    if (!modal || !modalContent) {
        console.error('Modal elements not found');
        return;
    }
    
    modalContent.innerHTML = `
        <h2 style="color: white;">${player.name}</h2>
        <p style="color: var(--text-secondary);">${player.team} - ${player.position} | GP: ${player.gamesPlayed || 0}</p>
        
        <div class="summary-stats">
            <div class="summary-card">
                <div class="summary-label">Hit Rate vs ${lineValue}</div>
                <div class="summary-value ${colorClass}">${hitRate}%</div>
            </div>
            <div class="summary-card">
                <div class="summary-label">Hits</div>
                <div class="summary-value">${hits}/${recentGames.length}</div>
            </div>
            <div class="summary-card">
                <div class="summary-label">${seasonStatLabel}</div>
                <div class="summary-value">${Math.round(seasonStatValue)}</div>
            </div>
        </div>
        
        ${availableLinesSection}
        
        ${thisGameSection}
        
        <h3 style="color: white;">Last ${recentGames.length} Games</h3>
        ${badgeLegend}
        <table>
            <thead>
                <tr>
                    <th>Week</th>
                    <th>Opponent</th>
                    <th>Result</th>
                    <th>${propConfig?.label || 'Stat'}</th>
                    <th>vs ${lineValue}</th>
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
 * Toggle available lines section
 */
export function toggleNFLAvailableLines(element) {
    const content = element.nextElementSibling;
    const arrow = element.querySelector('.collapse-arrow');
    
    if (content.style.display === 'none') {
        content.style.display = 'block';
        arrow.style.transform = 'rotate(180deg)';
    } else {
        content.style.display = 'none';
        arrow.style.transform = 'rotate(0deg)';
    }
}

/**
 * Close the modal - uses the shared NHL modal
 */
export function closeNFLModal() {
    const modal = document.getElementById('gameLogModal');
    if (modal) {
        modal.style.display = 'none';
    }
}
