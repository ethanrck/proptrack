// js/main.js - Main entry point for PropTrack

import { APP_CONFIG } from './config.js';
import state from './state.js';
import api from './api-client.js';
import theme from './components/theme.js';
import watchlistUI from './components/watchlist.js';
import { initModal, showGameLog, showTeamLog, closeModal } from './components/modal.js';
import { 
    initFilters, 
    selectStat, 
    filterPlayers, 
    populateGameFilter, 
    populateLineFilter,
    setLineFilter 
} from './components/filters.js';
import { displayPlayers, displayTeams } from './components/display.js';

/**
 * Initialize the application
 */
async function init() {
    console.log(`${APP_CONFIG.name} v${APP_CONFIG.version} initializing...`);
    
    // Initialize theme
    theme.init();
    
    // Initialize watchlist
    watchlistUI.init();
    
    // Initialize modal
    initModal();
    
    // Initialize filters
    initFilters();
    
    // Load data
    await loadCachedData();
    
    console.log(`${APP_CONFIG.name} initialized successfully`);
}

/**
 * Load cached data from backend
 */
async function loadCachedData() {
    const container = document.getElementById('playersContainer');
    const statusDiv = document.getElementById('apiStatus');
    
    if (container) {
        container.innerHTML = '<div class="loading">Loading all players from cache...</div>';
    }
    
    try {
        const data = await api.getCachedData();
        
        // Update state
        state.setPlayers(data.allPlayers || []);
        state.setGoalies(data.allGoalies || []);
        state.setGameLogs(data.gameLogs || {});
        state.setGoalieGameLogs(data.goalieGameLogs || {});
        state.setTeamShotData(data.teamShotData || []);
        state.setBettingOdds(data.bettingOdds || {});
        
        // Set initial filtered players
        state.setFilteredPlayers([...state.allPlayersData]);
        
        // Update status
        if (statusDiv) {
            const bettingLinesCount = data.stats?.bettingLinesLoaded || 0;
            const goalieCount = state.allGoaliesData.length;
            const teamCount = state.teamShotData.length;
            
            statusDiv.innerHTML = `✅ Loaded ${state.allPlayersData.length} players | ${goalieCount} goalies | ${teamCount} teams | ${data.stats.gameLogsLoaded} game logs | ${bettingLinesCount} betting lines | Last updated: ${new Date(data.lastUpdated).toLocaleString()}`;
            statusDiv.style.background = 'var(--success-bg)';
            statusDiv.style.color = 'var(--success-text)';
        }
        
        // Initialize UI
        filterPlayers();
        populateGameFilter();
        populateLineFilter();
        
    } catch (error) {
        console.error('Error loading data:', error);
        
        if (container) {
            container.innerHTML = `<div class="error"><strong>Error loading cached data:</strong> ${error.message}</div>`;
        }
        
        if (statusDiv) {
            statusDiv.innerHTML = `❌ Error loading data: ${error.message}`;
            statusDiv.style.background = 'var(--error-bg)';
            statusDiv.style.color = 'var(--error-text)';
        }
    }
}

// ============================================
// Global API - Expose functions to window
// ============================================

window.proptrack = {
    // Theme
    toggleDarkMode: () => theme.toggle(),
    
    // Stat selection
    selectStat,
    
    // Filters
    filterPlayers,
    setLineFilter,
    
    // Watchlist
    addToWatchlist: (playerId, playerName, statType, line, odds, game, gameTime, overUnder) => {
        return watchlistUI.add(playerId, playerName, statType, line, odds, game, gameTime, overUnder);
    },
    removeFromWatchlist: (playerId, statType) => {
        watchlistUI.remove(playerId, statType);
    },
    clearWatchlist: () => watchlistUI.clear(),
    toggleWatchlist: () => watchlistUI.toggle(),
    
    // Parlay
    toggleParlaySelection: (playerId, statType) => {
        state.toggleParlaySelection(playerId, statType);
        watchlistUI.render();
    },
    addAllToParlay: () => {
        state.addAllToParlay();
        watchlistUI.render();
    },
    clearParlaySelection: () => {
        state.clearParlaySelection();
        watchlistUI.render();
    },
    
    // Modal
    showGameLog,
    showTeamLog,
    closeModal,
    
    // Collapsible sections
    toggleAvailableLines: (headerElement) => {
        const content = headerElement.nextElementSibling;
        const arrow = headerElement.querySelector('.toggle-arrow');
        const subtitle = headerElement.querySelector('.collapsible-subtitle');
        const columnHeaders = content?.querySelector('.collapsible-column-headers');
        
        if (content?.classList.contains('expanded')) {
            content.classList.remove('expanded');
            arrow?.classList.remove('expanded');
            if (subtitle) subtitle.style.display = '';
            if (columnHeaders) columnHeaders.style.display = 'none';
        } else {
            content?.classList.add('expanded');
            arrow?.classList.add('expanded');
            if (subtitle) subtitle.style.display = 'none';
            if (columnHeaders) columnHeaders.style.display = 'block';
        }
    },
    
    // Data access (for debugging)
    getState: () => state,
    refreshData: loadCachedData
};

// ============================================
// Initialize on DOM ready
// ============================================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export default {
    init,
    loadCachedData
};
