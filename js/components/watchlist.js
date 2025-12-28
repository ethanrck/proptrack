// js/components/watchlist.js - Watchlist UI component

import state from '../state.js';
import { formatOdds } from '../utils.js';
import { renderParlayCalculator } from './parlay.js';

class WatchlistUI {
    constructor() {
        this.isMinimized = false;
    }

    init() {
        // Load minimized state
        this.isMinimized = localStorage.getItem('watchlistMinimized') === 'true';
        
        const container = document.getElementById('watchlistContainer');
        if (container && this.isMinimized) {
            container.classList.add('minimized');
        }
        
        // Subscribe to state changes
        state.subscribe('watchlist', () => this.render());
        state.subscribe('parlaySelection', () => this.render());
        
        // Initial render
        state.loadWatchlist();
    }

    toggle() {
        const container = document.getElementById('watchlistContainer');
        if (!container) return;
        
        container.classList.toggle('minimized');
        this.isMinimized = container.classList.contains('minimized');
        localStorage.setItem('watchlistMinimized', this.isMinimized);
    }

    add(playerId, playerName, statType, line, odds, game, gameTime, overUnder) {
        const added = state.addToWatchlist({
            playerId,
            playerName,
            statType,
            line,
            odds,
            game,
            gameTime,
            overUnder: overUnder || null
        });
        
        // Open watchlist when adding
        if (added) {
            const container = document.getElementById('watchlistContainer');
            if (container && container.classList.contains('minimized')) {
                container.classList.remove('minimized');
                this.isMinimized = false;
                localStorage.setItem('watchlistMinimized', false);
            }
        }
        
        return added;
    }

    remove(playerId, statType) {
        state.removeFromWatchlist(playerId, statType);
    }

    clear() {
        if (confirm('Clear all players from watchlist?')) {
            state.clearWatchlist();
        }
    }

    render() {
        const container = document.getElementById('watchlistItems');
        const countSpan = document.getElementById('watchlistCount');
        
        if (!container) return;
        
        const { watchlist, selectedParlayPlayers } = state;
        
        // Update count with parlay badge
        if (countSpan) {
            if (selectedParlayPlayers.length >= 2) {
                countSpan.innerHTML = `(${watchlist.length}) <span class="parlay-badge">${selectedParlayPlayers.length} in parlay</span>`;
            } else {
                countSpan.textContent = `(${watchlist.length})`;
            }
        }
        
        if (watchlist.length === 0) {
            container.innerHTML = '<div class="watchlist-empty">⭐ Click on betting lines to add players to your watchlist</div>';
            renderParlayCalculator();
            return;
        }
        
        // Header with action buttons
        let html = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <div style="font-size: 0.9em; color: var(--text-secondary);">
                    Click to select for parlay
                </div>
                <div style="display: flex; gap: 8px;">
                    <button onclick="window.proptrack.addAllToParlay()" 
                            style="background: var(--button-bg); color: var(--button-text); border: 2px solid var(--button-text); padding: 5px 10px; border-radius: 5px; cursor: pointer; font-size: 0.85em; font-weight: 600; transition: all 0.3s;">
                        Add All to Parlay
                    </button>
                    <button onclick="window.proptrack.clearWatchlist()" 
                            style="background: var(--error-bg); color: var(--error-text); border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer; font-size: 0.85em;">
                        Clear All
                    </button>
                </div>
            </div>
        `;
        
        // Sort by most recently added
        const sortedWatchlist = [...watchlist].sort((a, b) => 
            new Date(b.addedAt) - new Date(a.addedAt)
        );
        
        // Render items
        html += sortedWatchlist.map(item => {
            const key = `${item.playerId}-${item.statType}`;
            const isSelected = selectedParlayPlayers.includes(key);
            const formattedOdds = formatOdds(item.odds);
            
            // Format line display
            let lineDisplay;
            if (item.statType === 'goals') {
                lineDisplay = 'Anytime Goal';
            } else if (item.overUnder === 'over') {
                lineDisplay = `O ${formattedOdds} (${item.line} ${item.statType})`;
            } else if (item.overUnder === 'under') {
                lineDisplay = `U ${formattedOdds} (${item.line} ${item.statType})`;
            } else {
                lineDisplay = `O/U ${item.line} ${item.statType}`;
            }
            
            return `
                <div class="watchlist-item ${isSelected ? 'selected' : ''}" 
                     onclick="window.proptrack.toggleParlaySelection('${item.playerId}', '${item.statType}')">
                    <div class="watchlist-item-info">
                        <div class="watchlist-item-name">${item.playerName}</div>
                        <div class="watchlist-item-line">${lineDisplay}</div>
                    </div>
                    <div class="watchlist-item-odds">${item.overUnder ? '' : formattedOdds}</div>
                    <button class="watchlist-item-remove" 
                            onclick="event.stopPropagation(); window.proptrack.removeFromWatchlist('${item.playerId}', '${item.statType}')">
                        ✕
                    </button>
                </div>
            `;
        }).join('');
        
        container.innerHTML = html;
        renderParlayCalculator();
    }
}

const watchlistUI = new WatchlistUI();

export default watchlistUI;
