// js/nfl/components/nfl-filters.js - NFL filter controls

import { nflState } from '../nfl-state.js';
import { NFL_PROP_TYPES } from '../nfl-constants.js';
import { getAvailableLines } from '../nfl-api-client.js';

/**
 * Render prop type selector
 */
export function renderNFLPropTypeSelector() {
    const currentProp = nflState.currentPropType;
    
    const buttons = Object.entries(NFL_PROP_TYPES).map(([key, config]) => {
        const isActive = key === currentProp;
        return `
            <button class="stat-button ${isActive ? 'active' : ''}" 
                    onclick="window.nflProptrack.setPropType('${key}')">
                ${config.label}
            </button>
        `;
    }).join('');
    
    return `
        <div class="stat-buttons">
            ${buttons}
        </div>
    `;
}

/**
 * Render line filter - buttons if they fit, dropdown if too many
 */
export function renderNFLLineFilters() {
    const currentProp = nflState.currentPropType;
    const propConfig = NFL_PROP_TYPES[currentProp];
    
    // Don't show line filters for anytime props
    if (propConfig?.isAnytime) {
        return '';
    }
    
    const lines = getAvailableLines(currentProp);
    const currentFilter = nflState.currentLineFilter;
    
    if (lines.length === 0) {
        return '';
    }
    
    // Calculate if buttons would fit - assume ~70px per button, ~1200px container width
    const buttonWidth = 70;
    const containerWidth = 1200;
    const maxButtons = Math.floor(containerWidth / buttonWidth) - 2; // -2 for "All Lines" and padding
    
    // Use dropdown if more than maxButtons lines
    if (lines.length > maxButtons) {
        const options = lines.map(line => `
            <option value="${line}" ${currentFilter === line ? 'selected' : ''}>${line}</option>
        `).join('');
        
        return `
            <div id="lineFilterSection" style="background: var(--card-bg); padding: 20px; border-radius: 10px; margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 10px; font-weight: 600; color: var(--text-primary);">Filter by Line:</label>
                <select id="nfl-line-filter" onchange="window.nflProptrack.setLineFilter(this.value)" 
                        style="padding: 10px; font-size: 16px; border: 2px solid var(--input-border); border-radius: 8px; background: var(--container-bg); color: var(--text-primary); min-width: 150px;">
                    <option value="all" ${currentFilter === 'all' ? 'selected' : ''}>All Lines</option>
                    ${options}
                </select>
            </div>
        `;
    }
    
    // Use buttons if they fit
    const allButton = `
        <button class="line-filter-button ${currentFilter === 'all' ? 'active' : ''}"
                onclick="window.nflProptrack.setLineFilter('all')">
            All Lines
        </button>
    `;
    
    const lineButtons = lines.map(line => `
        <button class="line-filter-button ${currentFilter === line ? 'active' : ''}"
                onclick="window.nflProptrack.setLineFilter(${line})">
            ${line}
        </button>
    `).join('');
    
    return `
        <div id="lineFilterSection" style="background: var(--card-bg); padding: 20px; border-radius: 10px; margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 10px; font-weight: 600; color: var(--text-primary);">Filter by Line:</label>
            <div class="line-filter-buttons">
                ${allButton}
                ${lineButtons}
            </div>
        </div>
    `;
}

/**
 * Render game filter dropdown with times
 */
export function renderNFLGameFilter() {
    const games = nflState.todaysGames;
    
    if (!games || games.length === 0) {
        return '<option value="">No games today</option>';
    }
    
    const gameOptions = games.map(game => {
        const time = game.startTime ? new Date(game.startTime).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        }) : '';
        
        return `<option value="${game.id}">${game.awayTeam} @ ${game.homeTeam} - ${time}</option>`;
    }).join('');
    
    return `
        <option value="">All Games</option>
        ${gameOptions}
    `;
}

/**
 * Render all filters - NO Today's Games section at top
 */
export function renderNFLFilters() {
    return `
        <!-- Search & Game Filter -->
        <div class="controls">
            <input type="text" id="nfl-player-search" class="search-input" placeholder="Search players..." 
                   oninput="window.nflProptrack.handleSearch(this.value)"
                   style="padding: 10px; font-size: 16px; border: 2px solid var(--input-border); border-radius: 8px; background: var(--container-bg); color: var(--text-primary); flex: 1; max-width: 300px;">
            <select id="nfl-game-filter" onchange="window.nflProptrack.filterByGame(this.value)" 
                    style="padding: 10px; font-size: 16px; border: 2px solid var(--input-border); border-radius: 8px; background: var(--container-bg); color: var(--text-primary); min-width: 300px;">
                ${renderNFLGameFilter()}
            </select>
        </div>
        
        <!-- Stat Selection -->
        <div style="background: var(--card-bg); padding: 20px; border-radius: 10px; margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 10px; font-weight: 600; color: var(--text-primary);">Select Prop Type:</label>
            ${renderNFLPropTypeSelector()}
        </div>
        
        <!-- Line Filter -->
        ${renderNFLLineFilters()}
    `;
}
