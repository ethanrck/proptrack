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

// Current sport state
let currentSport = 'nhl';

/**
 * Get saved sport from localStorage or default to NHL
 */
function getSavedSport() {
    try {
        return localStorage.getItem('dangledata-sport') || 'nhl';
    } catch (e) {
        return 'nhl';
    }
}

/**
 * Save current sport to localStorage
 */
function saveSport(sport) {
    try {
        localStorage.setItem('dangledata-sport', sport);
    } catch (e) {
        console.error('Failed to save sport preference:', e);
    }
}

/**
 * Update sport toggle button text
 */
function updateSportToggleButton() {
    const btn = document.getElementById('sport-toggle-btn');
    if (btn) {
        if (currentSport === 'nhl') {
            btn.innerHTML = '🏈 NFL';
        } else {
            btn.innerHTML = '🏒 NHL';
        }
    }
}

/**
 * Switch between NHL and NFL
 */
async function switchSport() {
    const newSport = currentSport === 'nhl' ? 'nfl' : 'nhl';
    currentSport = newSport;
    saveSport(newSport);
    updateSportToggleButton();
    
    // Close any open modals
    closeModal();
    
    // Clear current display
    const container = document.getElementById('playersContainer');
    const playerGrid = document.getElementById('player-grid');
    const filtersContainer = document.getElementById('filters-container');
    const nhlWatchlist = document.getElementById('watchlistContainer');
    const nflWatchlist = document.getElementById('nfl-watchlist-container');
    
    if (newSport === 'nfl') {
        // Hide NHL elements, show NFL elements
        if (container) container.style.display = 'none';
        if (playerGrid) {
            playerGrid.style.display = 'grid';
            playerGrid.innerHTML = '<div class="loading">Loading NFL data...</div>';
        }
        if (nhlWatchlist) nhlWatchlist.style.display = 'none';
        if (nflWatchlist) nflWatchlist.style.display = 'block';
        
        // Dynamically import and initialize NFL module
        try {
            const { initNFL } = await import('./nfl/nfl-main.js');
            await initNFL();
        } catch (error) {
            console.error('Failed to load NFL module:', error);
            if (playerGrid) {
                playerGrid.innerHTML = `<div class="error">Failed to load NFL data: ${error.message}</div>`;
            }
        }
    } else {
        // Hide NFL elements, show NHL elements
        if (playerGrid) playerGrid.style.display = 'none';
        if (container) {
            container.style.display = 'grid';
            container.innerHTML = '<div class="loading">Loading NHL data...</div>';
        }
        if (nflWatchlist) nflWatchlist.style.display = 'none';
        if (nhlWatchlist) nhlWatchlist.style.display = 'block';
        
        // Restore NHL filters
        if (filtersContainer) {
            filtersContainer.innerHTML = getNHLFiltersHTML();
        }
        
        // Clean up NFL
        try {
            const { cleanupNFL } = await import('./nfl/nfl-main.js');
            cleanupNFL();
        } catch (e) {
            // NFL module might not be loaded yet
        }
        
        // Re-initialize NHL filters and load data
        initFilters();
        await loadCachedData();
    }
}

/**
 * Get NHL filters HTML
 */
function getNHLFiltersHTML() {
    return `
        <!-- Search & Filters -->
        <div class="controls">
            <input type="text" id="searchPlayer" placeholder="Search players..." oninput="window.proptrack.filterPlayers()">
            <select id="gameFilter" onchange="window.proptrack.filterPlayers()" style="padding: 10px; font-size: 16px; border: 2px solid var(--input-border); border-radius: 8px; background: var(--container-bg); color: var(--text-primary); min-width: 250px;">
                <option value="">All Games</option>
            </select>
        </div>
        
        <!-- Checkboxes -->
        <div class="controls">
            <div class="control-group">
                <input type="checkbox" id="hideNoLines" onchange="window.proptrack.filterPlayers()" checked>
                <label for="hideNoLines">Hide players without betting lines</label>
            </div>
            
            <div class="control-group">
                <input type="checkbox" id="hideStartedGames" onchange="window.proptrack.filterPlayers()">
                <label for="hideStartedGames">Hide games that have started</label>
            </div>
        </div>
        
        <!-- Stat Selection -->
        <div style="background: var(--card-bg); padding: 20px; border-radius: 10px; margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 10px; font-weight: 600; color: var(--text-primary);">Select Stat:</label>
            <div class="stat-buttons">
                <button class="stat-button active" onclick="window.proptrack.selectStat('points')">Points</button>
                <button class="stat-button" onclick="window.proptrack.selectStat('goals')">Goals</button>
                <button class="stat-button" onclick="window.proptrack.selectStat('assists')">Assists</button>
                <button class="stat-button" onclick="window.proptrack.selectStat('shots')">Shots</button>
                <button class="stat-button" onclick="window.proptrack.selectStat('saves')">Goalie Saves</button>
                <button class="stat-button" onclick="window.proptrack.selectStat('team_totals')">Team Totals</button>
            </div>
        </div>
        
        <!-- Line Filter -->
        <div id="lineFilterSection" style="background: var(--card-bg); padding: 20px; border-radius: 10px; margin-bottom: 20px; display: none;">
            <label style="display: block; margin-bottom: 10px; font-weight: 600; color: var(--text-primary);">Filter by Line:</label>
            <div class="line-filter-buttons" id="lineFilterButtons">
                <!-- Populated dynamically -->
            </div>
        </div>
    `;
}

/**
 * Initialize the application
 */
async function init() {
    console.log(`${APP_CONFIG.name} v${APP_CONFIG.version} initializing...`);
    
    // Get saved sport preference
    currentSport = getSavedSport();
    
    // Initialize theme
    theme.init();
    
    // Initialize sport toggle button
    updateSportToggleButton();
    
    // Get containers
    const nhlContainer = document.getElementById('playersContainer');
    const nflContainer = document.getElementById('player-grid');
    const nhlWatchlist = document.getElementById('watchlistContainer');
    const nflWatchlist = document.getElementById('nfl-watchlist-container');
    
    // Load data based on current sport
    if (currentSport === 'nfl') {
        // Hide NHL, show NFL containers
        if (nhlContainer) nhlContainer.style.display = 'none';
        if (nflContainer) nflContainer.style.display = 'grid';
        if (nhlWatchlist) nhlWatchlist.style.display = 'none';
        if (nflWatchlist) nflWatchlist.style.display = 'block';
        
        try {
            const { initNFL } = await import('./nfl/nfl-main.js');
            await initNFL();
        } catch (error) {
            console.error('Failed to load NFL module:', error);
            // Fall back to NHL
            currentSport = 'nhl';
            saveSport('nhl');
            updateSportToggleButton();
            
            if (nhlContainer) nhlContainer.style.display = 'grid';
            if (nflContainer) nflContainer.style.display = 'none';
            if (nhlWatchlist) nhlWatchlist.style.display = 'block';
            if (nflWatchlist) nflWatchlist.style.display = 'none';
            
            watchlistUI.init();
            initModal();
            initFilters();
            await loadCachedData();
        }
    } else {
        // Show NHL, hide NFL containers
        if (nhlContainer) nhlContainer.style.display = 'grid';
        if (nflContainer) nflContainer.style.display = 'none';
        if (nhlWatchlist) nhlWatchlist.style.display = 'block';
        if (nflWatchlist) nflWatchlist.style.display = 'none';
        
        // Initialize NHL components
        watchlistUI.init();
        initModal();
        initFilters();
        await loadCachedData();
    }
    
    console.log(`${APP_CONFIG.name} initialized successfully`);
}

/**
 * Load cached data from backend (NHL)
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
        state.setTeamSchedules(data.teamSchedules || {});
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
    
    // Sport switching
    switchSport,
    getCurrentSport: () => currentSport,
    
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
        const arrow = headerElement.querySelector('.collapse-arrow');
        
        if (content) {
            if (content.style.display === 'none') {
                content.style.display = 'block';
                if (arrow) arrow.style.transform = 'rotate(180deg)';
            } else {
                content.style.display = 'none';
                if (arrow) arrow.style.transform = 'rotate(0deg)';
            }
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
    loadCachedData,
    switchSport
};
