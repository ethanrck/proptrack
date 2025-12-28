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
    
    if (watchlist.length === 0) {
        container.innerHTML = `
            <div class="watchlist-empty">
                <p>No items in NFL watchlist</p>
                <small>Click on odds to add players to your watchlist</small>
            </div>
        `;
        return;
    }
    
    const items = watchlist.map((item, index) => {
        const propConfig = NFL_PROP_TYPES[item.propType];
        const propLabel = propConfig?.label || item.propType;
        const formattedOdds = formatOdds(item.odds);
        const directionLabel = item.direction ? (item.direction === 'over' ? 'O' : 'U') : '';
        
        return `
            <div class="watchlist-item">
                <div class="watchlist-item-info">
                    <div class="watchlist-player-name">${item.playerName}</div>
                    <div class="watchlist-prop">${propLabel} ${directionLabel} ${item.line} (${formattedOdds})</div>
                    <div class="watchlist-game">${item.game || ''}</div>
                </div>
                <button class="watchlist-remove" onclick="window.nflProptrack.removeFromWatchlist(${index})">
                    &times;
                </button>
            </div>
        `;
    }).join('');
    
    container.innerHTML = `
        <div class="watchlist-header">
            <h3>NFL Watchlist (${watchlist.length})</h3>
            <button class="watchlist-clear" onclick="window.nflProptrack.clearWatchlist()">
                Clear All
            </button>
        </div>
        <div class="watchlist-items">
            ${items}
        </div>
    `;
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
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
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
