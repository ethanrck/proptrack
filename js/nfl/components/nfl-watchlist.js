// js/nfl/components/nfl-watchlist.js - NFL watchlist management

import { nflState } from '../nfl-state.js';
import { NFL_PROP_TYPES } from '../nfl-constants.js';
import { formatOdds } from '../../utils.js';

/**
 * Add item to NFL watchlist
 */
export function addToNFLWatchlist(playerId, playerName, propType, line, odds, game, gameTime, direction = null) {
    const item = {
        playerId,
        playerName,
        propType,
        line,
        odds,
        game,
        gameTime,
        direction,
        addedAt: new Date().toISOString()
    };
    
    nflState.addToWatchlist(item);
    showNFLWatchlistNotification(`Added ${playerName} to watchlist`);
    renderNFLWatchlist();
}

/**
 * Remove item from NFL watchlist
 */
export function removeFromNFLWatchlist(index) {
    nflState.removeFromWatchlist(index);
    renderNFLWatchlist();
}

/**
 * Clear NFL watchlist
 */
export function clearNFLWatchlist() {
    if (confirm('Clear all items from NFL watchlist?')) {
        nflState.clearWatchlist();
        renderNFLWatchlist();
    }
}

/**
 * Render NFL watchlist
 */
export function renderNFLWatchlist() {
    const container = document.getElementById('nfl-watchlist-container');
    if (!container) return;
    
    const watchlist = nflState.watchlist;
    
    container.innerHTML = `
        <div class="watchlist-header" onclick="toggleNFLWatchlistContent()">
            <div class="watchlist-title">
                🏈 NFL Watchlist <span id="nfl-watchlist-count">(${watchlist.length})</span>
            </div>
            <div class="watchlist-toggle">▼</div>
        </div>
        <div class="watchlist-content" id="nfl-watchlist-content">
            ${watchlist.length === 0 ? `
                <div style="padding: 15px; color: var(--text-secondary); text-align: center;">
                    <p>No items in NFL watchlist</p>
                    <small>Click on odds to add players to your watchlist</small>
                </div>
            ` : `
                <div id="nfl-watchlist-items">
                    ${watchlist.map((item, index) => {
                        const propConfig = NFL_PROP_TYPES[item.propType];
                        const propLabel = propConfig?.label || item.propType;
                        const formattedOdds = formatOdds(item.odds);
                        const directionLabel = item.direction ? (item.direction === 'over' ? 'O' : 'U') : '';
                        
                        return `
                            <div class="watchlist-item" style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid var(--input-border);">
                                <div>
                                    <div style="font-weight: bold; color: var(--text-primary);">${item.playerName}</div>
                                    <div style="font-size: 0.9em; color: var(--text-secondary);">${propLabel} ${directionLabel} ${item.line} (${formattedOdds})</div>
                                    ${item.game ? `<div style="font-size: 0.8em; color: var(--text-secondary);">${item.game}</div>` : ''}
                                </div>
                                <button onclick="window.nflProptrack.removeFromWatchlist(${index})" 
                                        style="background: #e74c3c; color: white; border: none; border-radius: 4px; padding: 5px 10px; cursor: pointer;">
                                    ✕
                                </button>
                            </div>
                        `;
                    }).join('')}
                </div>
                <div style="padding: 10px; border-top: 1px solid var(--input-border);">
                    <button onclick="window.nflProptrack.clearWatchlist()" 
                            style="width: 100%; background: var(--button-bg); color: var(--button-text); border: 1px solid var(--input-border); border-radius: 4px; padding: 8px; cursor: pointer;">
                        Clear All
                    </button>
                </div>
            `}
        </div>
    `;
    
    // Add toggle function to window
    window.toggleNFLWatchlistContent = function() {
        const content = document.getElementById('nfl-watchlist-content');
        const toggle = container.querySelector('.watchlist-toggle');
        if (content) {
            if (content.style.display === 'none') {
                content.style.display = 'block';
                if (toggle) toggle.textContent = '▼';
            } else {
                content.style.display = 'none';
                if (toggle) toggle.textContent = '▲';
            }
        }
    };
}

/**
 * Show notification when adding to watchlist
 */
function showNFLWatchlistNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'watchlist-notification';
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #27ae60;
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        z-index: 10000;
        animation: slideIn 0.3s ease;
        font-weight: bold;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transition = 'opacity 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 2000);
}

/**
 * Toggle watchlist visibility
 */
export function toggleNFLWatchlist() {
    const container = document.getElementById('nfl-watchlist-container');
    if (container) {
        container.classList.toggle('hidden');
    }
}
