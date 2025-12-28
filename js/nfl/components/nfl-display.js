// js/nfl/components/nfl-display.js - NFL main display rendering

import { nflState } from '../nfl-state.js';
import { NFL_PROP_TYPES, NFL_HIT_RATE_GAMES } from '../nfl-constants.js';
import { getPlayersWithOdds } from '../nfl-api-client.js';
import { renderNFLPlayerCards, updateNFLHitRate } from './nfl-player-card.js';
import { renderNFLFilters, renderNFLLineFilters } from './nfl-filters.js';

/**
 * Main display function for NFL
 */
export async function displayNFLPlayers() {
    const container = document.getElementById('player-grid');
    const filtersContainer = document.getElementById('filters-container');
    
    if (!container) return;
    
    const propType = nflState.currentPropType;
    const propConfig = NFL_PROP_TYPES[propType];
    
    // Render filters
    if (filtersContainer) {
        filtersContainer.innerHTML = renderNFLFilters();
    }
    
    // Get players with odds
    let players = getPlayersWithOdds(propType);
    
    if (players.length === 0) {
        container.innerHTML = `
            <div class="loading" style="grid-column: 1 / -1;">
                No ${propConfig?.label || 'props'} available for today's games.
                <br><br>
                <small>NFL games typically have props available on game days (Sunday, Monday, Thursday, Saturday).</small>
            </div>
        `;
        return;
    }
    
    // Apply game filter
    const gameFilter = nflState.currentGameFilter;
    if (gameFilter !== 'all') {
        const game = nflState.todaysGames.find(g => g.id === gameFilter);
        if (game) {
            players = players.filter(p => p.team === game.homeTeam || p.team === game.awayTeam);
        }
    }
    
    // Apply line filter
    const lineFilter = nflState.currentLineFilter;
    if (lineFilter !== 'all' && !propConfig?.isAnytime) {
        players = players.filter(p => {
            const odds = p.odds;
            if (Array.isArray(odds)) {
                return odds.some(o => o.line === lineFilter);
            }
            return odds?.line === lineFilter;
        });
    }
    
    // Apply search filter
    const searchInput = document.getElementById('nfl-player-search');
    if (searchInput && searchInput.value) {
        const searchTerm = searchInput.value.toLowerCase();
        players = players.filter(p => 
            p.name.toLowerCase().includes(searchTerm) ||
            p.team.toLowerCase().includes(searchTerm)
        );
    }
    
    // Calculate hit rates for sorting
    const lineFilter = nflState.currentLineFilter;
    players.forEach(player => {
        const odds = player.odds;
        let lineValue;
        
        if (propConfig?.isAnytime) {
            lineValue = 0.5;
        } else if (lineFilter !== 'all') {
            lineValue = lineFilter;
        } else if (Array.isArray(odds)) {
            lineValue = odds[0]?.line;
        } else {
            lineValue = odds?.line;
        }
        
        if (lineValue !== undefined) {
            const hitRateData = nflState.calculateHitRate(player.id, propConfig.statKey, lineValue);
            player.hitRate = hitRateData.rate;
            player.hitRateTotal = hitRateData.total;
        } else {
            player.hitRate = 0;
            player.hitRateTotal = 0;
        }
    });
    
    // Sort by hit rate (highest first), then by name for ties
    players.sort((a, b) => {
        // First sort by hit rate descending
        if (b.hitRate !== a.hitRate) {
            return b.hitRate - a.hitRate;
        }
        // Then by total games (more games = more reliable)
        if (b.hitRateTotal !== a.hitRateTotal) {
            return b.hitRateTotal - a.hitRateTotal;
        }
        // Then alphabetically
        return a.name.localeCompare(b.name);
    });
    
    if (players.length === 0) {
        container.innerHTML = `
            <div class="loading" style="grid-column: 1 / -1;">
                No players match your filters.
            </div>
        `;
        return;
    }
    
    // Render player cards
    container.innerHTML = renderNFLPlayerCards(players, propType);
    
    // Update hit rates display (already calculated above)
    players.forEach(player => {
        const odds = player.odds;
        let lineValue;
        
        if (propConfig?.isAnytime) {
            lineValue = 0.5;
        } else if (lineFilter !== 'all') {
            lineValue = lineFilter;
        } else if (Array.isArray(odds)) {
            lineValue = odds[0]?.line;
        } else {
            lineValue = odds?.line;
        }
        
        if (lineValue !== undefined) {
            updateNFLHitRate(player.id, propType, lineValue);
        }
    });
}

/**
 * Update hit rates for all displayed players
 */
async function updateAllNFLHitRates(players, propType, lineFilter) {
    const propConfig = NFL_PROP_TYPES[propType];
    
    for (const player of players) {
        const odds = player.odds;
        let lineValue;
        
        if (propConfig?.isAnytime) {
            lineValue = 0.5;
        } else if (lineFilter !== 'all') {
            lineValue = lineFilter;
        } else if (Array.isArray(odds)) {
            lineValue = odds[0]?.line;
        } else {
            lineValue = odds?.line;
        }
        
        if (lineValue !== undefined) {
            updateNFLHitRate(player.id, propType, lineValue);
        }
    }
}

/**
 * Render NFL header with last updated time
 */
export function renderNFLHeader() {
    const lastUpdated = nflState.lastUpdated;
    const games = nflState.todaysGames;
    
    let lastUpdatedText = '';
    if (lastUpdated) {
        lastUpdatedText = `Last updated: ${lastUpdated.toLocaleString()}`;
    }
    
    let gamesText = '';
    if (games && games.length > 0) {
        gamesText = `${games.length} game${games.length > 1 ? 's' : ''} today`;
    } else {
        gamesText = 'No games today';
    }
    
    return `
        <div class="header-info">
            <span class="games-today">${gamesText}</span>
            <span class="last-updated">${lastUpdatedText}</span>
        </div>
    `;
}

/**
 * Show loading state
 */
export function showNFLLoading() {
    const container = document.getElementById('player-grid');
    if (container) {
        container.innerHTML = `
            <div class="loading">
                <div class="loading-spinner"></div>
                Loading NFL data...
            </div>
        `;
    }
}

/**
 * Show error state
 */
export function showNFLError(message) {
    const container = document.getElementById('player-grid');
    if (container) {
        container.innerHTML = `
            <div class="error">
                <p>Error loading NFL data</p>
                <small>${message}</small>
                <br><br>
                <button onclick="window.nflProptrack.refresh()" class="refresh-button">
                    Try Again
                </button>
            </div>
        `;
    }
}

/**
 * Refresh line filters when prop type changes
 */
export function refreshNFLLineFilters() {
    const lineFiltersContainer = document.querySelector('.line-filters');
    if (lineFiltersContainer) {
        const parent = lineFiltersContainer.parentElement;
        lineFiltersContainer.remove();
        
        const newFilters = renderNFLLineFilters();
        if (newFilters) {
            parent.insertAdjacentHTML('beforeend', newFilters);
        }
    }
}
