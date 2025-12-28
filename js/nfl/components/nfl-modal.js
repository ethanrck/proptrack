// js/nfl/components/nfl-modal.js - NFL game log modal

import { nflState } from '../nfl-state.js';
import { NFL_PROP_TYPES, NFL_HIT_RATE_GAMES } from '../nfl-constants.js';
import { getPlayerGameInfo } from '../nfl-api-client.js';
import { formatOdds } from '../../utils.js';

/**
 * Show game log modal for a player
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
    
    // Get current line value from odds
    const playerOdds = player.odds || nflState.bettingOdds[player.name]?.[propType];
    let lineValue = propConfig?.isAnytime ? 0.5 : (playerOdds?.line ?? playerOdds?.[0]?.line ?? 0);
    
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'game-log-modal';
    modal.id = 'nfl-game-log-modal';
    modal.style.display = 'flex';
    modal.onclick = (e) => {
        if (e.target === modal) closeNFLModal();
    };
    
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close-modal" onclick="window.nflProptrack.closeModal()">&times;</span>
            
            <div class="modal-header" style="margin-bottom: 20px;">
                <h2 style="margin: 0; color: var(--text-primary);">${player.name}</h2>
                <p style="margin: 5px 0; color: var(--text-secondary);">${player.team} - ${player.position} | GP: ${player.gamesPlayed || 0}</p>
                ${gameInfo ? `<p style="margin: 5px 0; color: var(--accent-color);">🏈 ${gameInfo.isHome ? 'vs' : '@'} ${gameInfo.opponent}</p>` : ''}
            </div>
            
            ${renderNFLThisGame(player, propType, gameInfo)}
            
            ${renderNFLSeasonStats(player, propType, lineValue)}
            
            <div class="modal-section" style="margin-top: 20px;">
                <h3 style="color: var(--text-primary); margin-bottom: 15px;">📊 Game Log (Last ${NFL_HIT_RATE_GAMES} Games)</h3>
                ${renderNFLGameLogTable(gameLog, propType, lineValue)}
            </div>
            
            ${renderNFLAvailableLines(player, propType)}
        </div>
    `;
    
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
}

/**
 * Render "This Game" section with opponent defensive info
 */
function renderNFLThisGame(player, propType, gameInfo) {
    if (!gameInfo) return '';
    
    const propConfig = NFL_PROP_TYPES[propType];
    const opponent = gameInfo.opponent;
    
    // Get opponent defensive stats
    const defenseStats = nflState.teamDefense?.[opponent];
    
    let defenseInfo = '';
    let defenseValue = '';
    let defenseRank = '';
    let rankSuffix = '';
    
    if (defenseStats) {
        if (propType === 'passing_yards' || propType === 'passing_tds') {
            defenseValue = defenseStats.passYardsAllowed?.toFixed(1) || '0';
            defenseRank = defenseStats.passYardsRank || 16;
            defenseInfo = `${opponent} allows ${defenseValue} pass yds/gm`;
        } else if (propType === 'rushing_yards') {
            defenseValue = defenseStats.rushYardsAllowed?.toFixed(1) || '0';
            defenseRank = defenseStats.rushYardsRank || 16;
            defenseInfo = `${opponent} allows ${defenseValue} rush yds/gm`;
        } else if (propType === 'receiving_yards' || propType === 'receptions') {
            defenseValue = defenseStats.passYardsAllowed?.toFixed(1) || '0';
            defenseRank = defenseStats.passYardsRank || 16;
            defenseInfo = `${opponent} allows ${defenseValue} pass yds/gm`;
        } else if (propType === 'anytime_td') {
            defenseValue = defenseStats.pointsAllowed?.toFixed(1) || '0';
            defenseRank = defenseStats.pointsRank || 16;
            defenseInfo = `${opponent} allows ${defenseValue} pts/gm`;
        }
        
        // Add rank suffix
        if (defenseRank === 1) rankSuffix = 'st';
        else if (defenseRank === 2) rankSuffix = 'nd';
        else if (defenseRank === 3) rankSuffix = 'rd';
        else rankSuffix = 'th';
        
        // Color based on rank (higher rank = worse defense = green for offense)
        const rankColor = defenseRank >= 20 ? '#27ae60' : defenseRank >= 10 ? '#f39c12' : '#e74c3c';
        
        defenseInfo = `${defenseInfo} | <span style="color: ${rankColor}; font-weight: bold;">Rank: ${defenseRank}${rankSuffix}</span>`;
    } else {
        defenseInfo = `Playing ${opponent}`;
    }
    
    return `
        <div class="modal-section" style="background: var(--card-bg); padding: 15px; border-radius: 10px; margin-bottom: 15px;">
            <h3 style="color: var(--text-primary); margin: 0 0 10px 0;">🎯 This Game</h3>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; text-align: center;">
                <div>
                    <div style="color: var(--text-secondary); font-size: 0.85em;">Matchup</div>
                    <div style="color: var(--text-primary); font-weight: bold; font-size: 1.1em;">${gameInfo.isHome ? 'vs' : '@'} ${opponent}</div>
                </div>
                <div>
                    <div style="color: var(--text-secondary); font-size: 0.85em;">Opponent Defense</div>
                    <div style="color: var(--text-primary); font-size: 1em;">${defenseInfo}</div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render season stats summary
 */
function renderNFLSeasonStats(player, propType, lineValue) {
    const propConfig = NFL_PROP_TYPES[propType];
    if (!propConfig) return '';
    
    const gamesPlayed = player.gamesPlayed || 0;
    
    const stats = propConfig.stats.map(statConfig => {
        const value = player.seasonStats?.[statConfig.key] || 0;
        const displayValue = statConfig.perGame && gamesPlayed > 0 
            ? (value / gamesPlayed).toFixed(1)
            : typeof value === 'number' ? value.toFixed(1) : value;
        return {
            label: statConfig.label,
            value: displayValue,
            total: value
        };
    });
    
    // Get hit rate
    const hitRateData = nflState.calculateHitRate(player.id, propConfig.statKey, lineValue);
    
    let rateClass = 'hit-rate-poor';
    if (hitRateData.rate >= 80) rateClass = 'hit-rate-excellent';
    else if (hitRateData.rate >= 60) rateClass = 'hit-rate-good';
    else if (hitRateData.rate >= 40) rateClass = 'hit-rate-medium';
    
    return `
        <div class="modal-section" style="background: var(--card-bg); padding: 15px; border-radius: 10px;">
            <h3 style="color: var(--text-primary); margin: 0 0 15px 0;">📈 Season Stats</h3>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; text-align: center;">
                <div>
                    <div style="color: var(--text-secondary); font-size: 0.85em;">Hit Rate vs ${lineValue}</div>
                    <div class="${rateClass}" style="font-weight: bold; font-size: 1.3em;">${hitRateData.rate.toFixed(1)}%</div>
                </div>
                <div>
                    <div style="color: var(--text-secondary); font-size: 0.85em;">Record</div>
                    <div style="color: var(--text-primary); font-weight: bold; font-size: 1.3em;">${hitRateData.hits}/${hitRateData.total}</div>
                </div>
                <div>
                    <div style="color: var(--text-secondary); font-size: 0.85em;">${stats[0]?.label || 'Avg'}</div>
                    <div style="color: var(--text-primary); font-weight: bold; font-size: 1.3em;">${stats[0]?.value || '-'}</div>
                </div>
                <div>
                    <div style="color: var(--text-secondary); font-size: 0.85em;">Season Total</div>
                    <div style="color: var(--text-primary); font-weight: bold; font-size: 1.3em;">${Math.round(stats[0]?.total) || '-'}</div>
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
    if (!propConfig) return '<p style="color: var(--text-secondary);">No game log available</p>';
    
    const statKey = propConfig.statKey;
    const recentGames = gameLog.slice(0, NFL_HIT_RATE_GAMES);
    
    if (recentGames.length === 0) {
        return '<p style="color: var(--text-secondary);">No recent games available</p>';
    }
    
    const rows = recentGames.map(game => {
        if (game.isByeWeek) {
            return `
                <tr style="background: var(--card-bg);">
                    <td style="padding: 10px; border-bottom: 1px solid var(--input-border);">Week ${game.week}</td>
                    <td colspan="4" style="padding: 10px; border-bottom: 1px solid var(--input-border); text-align: center; color: var(--text-secondary); font-style: italic;">
                        BYE WEEK
                    </td>
                </tr>
            `;
        }
        
        const statValue = game.stats?.[statKey] || 0;
        const hit = statValue > lineValue;
        const hitColor = hit ? '#27ae60' : '#e74c3c';
        const hitBg = hit ? 'rgba(39, 174, 96, 0.1)' : 'rgba(231, 76, 60, 0.1)';
        
        return `
            <tr style="background: ${hitBg};">
                <td style="padding: 10px; border-bottom: 1px solid var(--input-border);">Week ${game.week}</td>
                <td style="padding: 10px; border-bottom: 1px solid var(--input-border);">${game.opponent || '-'}</td>
                <td style="padding: 10px; border-bottom: 1px solid var(--input-border);">${game.result || '-'}</td>
                <td style="padding: 10px; border-bottom: 1px solid var(--input-border); font-weight: bold; color: ${hitColor};">${statValue}</td>
                <td style="padding: 10px; border-bottom: 1px solid var(--input-border); color: ${hitColor}; font-weight: bold;">${hit ? '✓ HIT' : '✗ MISS'}</td>
            </tr>
        `;
    }).join('');
    
    return `
        <table style="width: 100%; border-collapse: collapse; color: var(--text-primary);">
            <thead>
                <tr style="background: var(--card-bg);">
                    <th style="padding: 10px; text-align: left; border-bottom: 2px solid var(--input-border);">Week</th>
                    <th style="padding: 10px; text-align: left; border-bottom: 2px solid var(--input-border);">Opponent</th>
                    <th style="padding: 10px; text-align: left; border-bottom: 2px solid var(--input-border);">Result</th>
                    <th style="padding: 10px; text-align: left; border-bottom: 2px solid var(--input-border);">${propConfig.label}</th>
                    <th style="padding: 10px; text-align: left; border-bottom: 2px solid var(--input-border);">vs ${lineValue}</th>
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
    if (propConfig?.isAnytime) {
        // Show anytime TD odds
        const odds = player.odds || nflState.bettingOdds[player.name]?.[propType];
        if (!odds) return '';
        
        const price = odds.price || odds.odds;
        if (!price) return '';
        
        return `
            <div class="modal-section" style="margin-top: 20px;">
                <h3 style="color: var(--text-primary); margin-bottom: 15px;">💰 Anytime TD Odds</h3>
                <div style="background: var(--warning-bg); padding: 15px; border-radius: 8px; text-align: center;">
                    <span style="color: #e67e22; font-weight: bold; font-size: 1.3em;">
                        Anytime TD: ${formatOdds(price)}
                    </span>
                </div>
            </div>
        `;
    }
    
    const playerOdds = player.odds || nflState.bettingOdds[player.name]?.[propType];
    if (!playerOdds) return '';
    
    const lines = Array.isArray(playerOdds) ? playerOdds : [playerOdds];
    
    if (lines.length === 0) return '';
    
    const rows = lines.map(lineData => {
        const hitRateData = nflState.calculateHitRate(player.id, propConfig.statKey, lineData.line);
        
        let rateClass = '';
        if (hitRateData.rate >= 80) rateClass = 'color: #27ae60;';
        else if (hitRateData.rate >= 60) rateClass = 'color: #2ecc71;';
        else if (hitRateData.rate >= 40) rateClass = 'color: #f39c12;';
        else rateClass = 'color: #e74c3c;';
        
        return `
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid var(--input-border); font-weight: bold;">${lineData.line}</td>
                <td style="padding: 10px; border-bottom: 1px solid var(--input-border); color: #27ae60;">${lineData.overOdds ? formatOdds(lineData.overOdds) : '-'}</td>
                <td style="padding: 10px; border-bottom: 1px solid var(--input-border); color: #e74c3c;">${lineData.underOdds ? formatOdds(lineData.underOdds) : '-'}</td>
                <td style="padding: 10px; border-bottom: 1px solid var(--input-border); ${rateClass} font-weight: bold;">${hitRateData.rate.toFixed(1)}%</td>
                <td style="padding: 10px; border-bottom: 1px solid var(--input-border);">${hitRateData.hits}/${hitRateData.total}</td>
            </tr>
        `;
    }).join('');
    
    return `
        <div class="modal-section" style="margin-top: 20px;">
            <h3 style="color: var(--text-primary); margin-bottom: 15px;">💰 Available Lines</h3>
            <table style="width: 100%; border-collapse: collapse; color: var(--text-primary);">
                <thead>
                    <tr style="background: var(--card-bg);">
                        <th style="padding: 10px; text-align: left; border-bottom: 2px solid var(--input-border);">Line</th>
                        <th style="padding: 10px; text-align: left; border-bottom: 2px solid var(--input-border);">Over</th>
                        <th style="padding: 10px; text-align: left; border-bottom: 2px solid var(--input-border);">Under</th>
                        <th style="padding: 10px; text-align: left; border-bottom: 2px solid var(--input-border);">Hit Rate</th>
                        <th style="padding: 10px; text-align: left; border-bottom: 2px solid var(--input-border);">Record</th>
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
