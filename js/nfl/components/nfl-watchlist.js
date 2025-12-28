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
    
    // Remove empty class when adding
    const container = document.getElementById('nfl-watchlist-container');
    if (container) {
        container.classList.remove('empty');
    }
    
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
 * Render NFL watchlist - matches NHL styling
 */
export function renderNFLWatchlist() {
    const container = document.getElementById('nfl-watchlist-container');
    if (!container) return;
    
    const watchlist = nflState.watchlist;
    
    // Toggle empty class - this is key for the NHL-style collapse
    if (watchlist.length === 0) {
        container.classList.add('empty');
    } else {
        container.classList.remove('empty');
    }
    
    // Build watchlist items HTML
    let itemsHTML = '';
    if (watchlist.length > 0) {
        itemsHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <div style="font-size: 0.9em; color: var(--text-secondary);">
                    Click odds to add to watchlist
                </div>
                <button onclick="window.nflProptrack.clearWatchlist()" 
                        style="background: var(--error-bg); color: var(--error-text); border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer; font-size: 0.85em;">
                    Clear All
                </button>
            </div>
        `;
        
        itemsHTML += watchlist.map((item, index) => {
            const propConfig = NFL_PROP_TYPES[item.propType];
            const propLabel = propConfig?.label || item.propType;
            const formattedOdds = formatOdds(item.odds);
            
            // Format line display
            let lineDisplay;
            if (item.propType === 'anytime_td') {
                lineDisplay = 'Anytime TD';
            } else if (item.direction === 'over') {
                lineDisplay = `O ${formattedOdds} (${item.line} ${propLabel})`;
            } else if (item.direction === 'under') {
                lineDisplay = `U ${formattedOdds} (${item.line} ${propLabel})`;
            } else {
                lineDisplay = `${item.line} ${propLabel}`;
            }
            
            return `
                <div class="watchlist-item" style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: var(--card-bg); border-radius: 8px; margin-bottom: 8px;">
                    <div>
                        <div style="font-weight: bold; color: var(--text-primary);">${item.playerName}</div>
                        <div style="font-size: 0.85em; color: var(--text-secondary);">${lineDisplay}</div>
                        ${item.game ? `<div style="font-size: 0.8em; color: var(--text-secondary);">${item.game}</div>` : ''}
                    </div>
                    <button onclick="window.nflProptrack.removeFromWatchlist(${index})" 
                            style="background: #e74c3c; color: white; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; font-size: 14px; line-height: 1;">
                        ×
                    </button>
                </div>
            `;
        }).join('');
    }
    
    // Use same structure as NHL watchlist with proper class names
    container.innerHTML = `
        <div class="watchlist-header" onclick="window.toggleNFLWatchlist()">
            <div class="watchlist-title">
                🏈 NFL Watchlist <span id="nfl-watchlist-count">(${watchlist.length})</span>
            </div>
            <div class="watchlist-toggle">▲</div>
        </div>
        <div class="watchlist-content" id="nfl-watchlist-items">
            ${itemsHTML}
        </div>
    `;
    
    // Add toggle function to window
    window.toggleNFLWatchlist = function() {
        const cont = document.getElementById('nfl-watchlist-container');
        if (cont && !cont.classList.contains('empty')) {
            cont.classList.toggle('minimized');
            const isMinimized = cont.classList.contains('minimized');
            localStorage.setItem('nfl-watchlistMinimized', isMinimized);
            // Update toggle arrow
            const toggle = cont.querySelector('.watchlist-toggle');
            if (toggle) {
                toggle.textContent = isMinimized ? '▼' : '▲';
            }
        }
    };
    
    // Restore minimized state (only if not empty)
    if (watchlist.length > 0) {
        const isMinimized = localStorage.getItem('nfl-watchlistMinimized') === 'true';
        if (isMinimized) {
            container.classList.add('minimized');
            const toggle = container.querySelector('.watchlist-toggle');
            if (toggle) toggle.textContent = '▼';
        }
    }
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
        container.classList.toggle('minimized');
    }
}
