// js/nfl/nfl-main.js - NFL main module

import { nflState } from './nfl-state.js';
import { fetchNFLData } from './nfl-api-client.js';
import { displayNFLPlayers, showNFLLoading, showNFLError, renderNFLHeader } from './components/nfl-display.js';
import { showNFLGameLog, closeNFLModal } from './components/nfl-modal.js';
import { addToNFLWatchlist, removeFromNFLWatchlist, clearNFLWatchlist, renderNFLWatchlist } from './components/nfl-watchlist.js';

/**
 * Initialize NFL module
 */
export async function initNFL() {
    console.log('Initializing NFL module...');
    
    // Set up global handlers
    window.nflProptrack = {
        setPropType,
        setLineFilter,
        handleSearch,
        showGameLog: showNFLGameLog,
        closeModal: closeNFLModal,
        addToWatchlist: addToNFLWatchlist,
        removeFromWatchlist: removeFromNFLWatchlist,
        clearWatchlist: clearNFLWatchlist,
        refresh: refreshNFL
    };
    
    // Show loading state
    showNFLLoading();
    
    try {
        // Fetch data
        await fetchNFLData();
        
        // Update header
        const headerInfo = document.getElementById('header-info');
        if (headerInfo) {
            headerInfo.innerHTML = renderNFLHeader();
        }
        
        // Render watchlist
        renderNFLWatchlist();
        
        // Display players
        await displayNFLPlayers();
        
        console.log('NFL module initialized successfully');
    } catch (error) {
        console.error('Failed to initialize NFL:', error);
        showNFLError(error.message);
    }
}

/**
 * Set prop type and refresh display
 */
async function setPropType(propType) {
    nflState.setPropType(propType);
    nflState.setLineFilter('all'); // Reset line filter when changing prop
    await displayNFLPlayers();
}

/**
 * Set line filter and refresh display
 */
async function setLineFilter(filter) {
    nflState.setLineFilter(filter);
    await displayNFLPlayers();
}

/**
 * Handle search input
 */
async function handleSearch(value) {
    // Debounce search
    clearTimeout(window.nflSearchTimeout);
    window.nflSearchTimeout = setTimeout(async () => {
        await displayNFLPlayers();
    }, 300);
}

/**
 * Refresh NFL data
 */
async function refreshNFL() {
    showNFLLoading();
    try {
        await fetchNFLData();
        await displayNFLPlayers();
    } catch (error) {
        showNFLError(error.message);
    }
}

/**
 * Clean up NFL module when switching away
 */
export function cleanupNFL() {
    // Close any open modals
    closeNFLModal();
    
    // Clear search timeout
    if (window.nflSearchTimeout) {
        clearTimeout(window.nflSearchTimeout);
    }
}
