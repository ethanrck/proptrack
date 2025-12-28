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
 * Render line filter buttons
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
    
    const allButton = `
        <button class="line-filter-button ${currentFilter === 'all' ? 'active' : ''}"
                onclick="window.nflProptrack.setLineFilter('all')"
                style="padding: 8px 16px;">
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
        <div class="line-filters">
            <span style="color: var(--text-secondary); margin-right: 10px;">Filter by line:</span>
            ${allButton}
            ${lineButtons}
        </div>
    `;
}

/**
 * Render position filter (optional)
 */
export function renderNFLPositionFilter() {
    const currentProp = nflState.currentPropType;
    const propConfig = NFL_PROP_TYPES[currentProp];
    
    if (!propConfig || propConfig.positions.length <= 1) {
        return '';
    }
    
    // For props that span multiple positions, show position filter
    const positions = propConfig.positions;
    
    return `
        <div class="position-filters" style="margin-top: 10px;">
            <span style="color: var(--text-secondary); margin-right: 10px;">Position:</span>
            <button class="line-filter-button active" onclick="window.nflProptrack.setPositionFilter('all')">
                All
            </button>
            ${positions.map(pos => `
                <button class="line-filter-button" onclick="window.nflProptrack.setPositionFilter('${pos}')">
                    ${pos}
                </button>
            `).join('')}
        </div>
    `;
}

/**
 * Render search box
 */
export function renderNFLSearch() {
    return `
        <div class="search-container">
            <input type="text" 
                   id="nfl-player-search" 
                   class="search-input" 
                   placeholder="Search players..."
                   oninput="window.nflProptrack.handleSearch(this.value)">
        </div>
    `;
}

/**
 * Render game filter (filter by matchup)
 */
export function renderNFLGameFilter() {
    const games = nflState.todaysGames;
    
    if (!games || games.length === 0) {
        return '';
    }
    
    const gameOptions = games.map(game => `
        <option value="${game.id}">${game.awayTeam} @ ${game.homeTeam}</option>
    `).join('');
    
    return `
        <div class="game-filter" style="margin-top: 10px;">
            <span style="color: var(--text-secondary); margin-right: 10px;">Game:</span>
            <select id="nfl-game-filter" onchange="window.nflProptrack.filterByGame(this.value)">
                <option value="all">All Games</option>
                ${gameOptions}
            </select>
        </div>
    `;
}

/**
 * Render all filters
 */
export function renderNFLFilters() {
    return `
        <div class="filters-container">
            ${renderNFLPropTypeSelector()}
            ${renderNFLSearch()}
            ${renderNFLLineFilters()}
        </div>
    `;
}
