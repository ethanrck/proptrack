// js/utils.js - Utility functions for PropTrack

import { HIT_RATE_THRESHOLDS, MAJOR_BOOKMAKERS } from './constants.js';

/**
 * Get CSS class for hit rate color
 */
export function getHitRateColor(hitRate) {
    if (hitRate >= HIT_RATE_THRESHOLDS.EXCELLENT) return 'hit-rate-excellent';
    if (hitRate >= HIT_RATE_THRESHOLDS.GOOD) return 'hit-rate-good';
    if (hitRate >= HIT_RATE_THRESHOLDS.MEDIUM) return 'hit-rate-medium';
    return 'hit-rate-poor';
}

/**
 * Normalize team name for comparison
 */
export function normalizeTeamName(name) {
    return name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/St\./g, 'St')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

/**
 * Get ordinal suffix for a number
 */
export function getOrdinal(n) {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * Format American odds with + sign for positive
 */
export function formatOdds(odds) {
    return odds > 0 ? `+${odds}` : `${odds}`;
}

/**
 * Parse date string as local date (not UTC)
 */
export function parseLocalDate(dateStr) {
    const [year, month, day] = dateStr.split('-');
    return new Date(year, month - 1, day);
}

/**
 * Format date for display
 */
export function formatDate(date) {
    return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
    });
}

/**
 * Format game time for display
 */
export function formatGameTime(gameTime) {
    return new Date(gameTime).toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
}

/**
 * Get lines array from player odds (handles both old object and new array format)
 */
export function getLinesArray(playerOdds, statType) {
    if (!playerOdds || !playerOdds[statType]) {
        return [];
    }
    if (Array.isArray(playerOdds[statType])) {
        return playerOdds[statType];
    }
    return [playerOdds[statType]];
}

/**
 * Find the main/default line (not alternate) from an array of lines
 * Prioritizes non-alternate lines from major bookmakers
 */
export function getMainLine(linesArray) {
    if (!linesArray || linesArray.length === 0) return null;
    if (linesArray.length === 1) return linesArray[0];
    
    // Priority 1: Filter to non-alternate lines only if available
    const nonAlternateLines = linesArray.filter(lineObj => !lineObj.isAlternate);
    let linesToUse = nonAlternateLines.length > 0 ? nonAlternateLines : linesArray;
    
    if (linesToUse.length === 1) return linesToUse[0];
    
    // Priority 2: Major bookmakers that typically have the "main" line
    for (const bookmaker of MAJOR_BOOKMAKERS) {
        const mainLine = linesToUse.find(lineObj => 
            lineObj.bookmaker && lineObj.bookmaker.includes(bookmaker)
        );
        if (mainLine) return mainLine;
    }
    
    // Priority 3: Use frequency + median approach
    const lineFrequency = {};
    const lineValues = [];
    
    linesToUse.forEach(lineObj => {
        const lineValue = lineObj.line;
        lineFrequency[lineValue] = (lineFrequency[lineValue] || 0) + 1;
        lineValues.push(lineValue);
    });
    
    // Find the maximum frequency
    let maxFrequency = 0;
    const candidateLines = [];
    
    for (const [lineValue, frequency] of Object.entries(lineFrequency)) {
        if (frequency > maxFrequency) {
            maxFrequency = frequency;
            candidateLines.length = 0;
            candidateLines.push(parseFloat(lineValue));
        } else if (frequency === maxFrequency) {
            candidateLines.push(parseFloat(lineValue));
        }
    }
    
    // If there's a tie, pick the one closest to median
    let mainLineValue;
    if (candidateLines.length > 1) {
        const sortedValues = [...lineValues].sort((a, b) => a - b);
        const median = sortedValues[Math.floor(sortedValues.length / 2)];
        
        mainLineValue = candidateLines.reduce((closest, current) => {
            return Math.abs(current - median) < Math.abs(closest - median) ? current : closest;
        });
    } else {
        mainLineValue = candidateLines[0];
    }
    
    return linesToUse.find(lineObj => lineObj.line === mainLineValue);
}

/**
 * Calculate stat value from game based on stat type
 */
export function getStatValue(game, statType, isGoalie = false) {
    if (isGoalie) {
        const shotsAgainst = game.shotsAgainst || 0;
        const goalsAgainst = game.goalsAgainst || 0;
        return shotsAgainst - goalsAgainst; // saves
    }
    
    switch (statType) {
        case 'points': return game.points || 0;
        case 'goals': return game.goals || 0;
        case 'assists': return game.assists || 0;
        case 'shots': return game.shots || 0;
        default: return 0;
    }
}

/**
 * Calculate hit rate for games against a line
 */
export function calculateHitRate(games, lineValue, statType, isGoalie = false) {
    if (!games || games.length === 0) return { rate: 0, hits: 0, total: 0 };
    
    let hits = 0;
    games.forEach(game => {
        const statValue = getStatValue(game, statType, isGoalie);
        if (statValue > lineValue) hits++;
    });
    
    return {
        rate: (hits / games.length) * 100,
        hits,
        total: games.length
    };
}

/**
 * Escape single quotes for use in onclick handlers
 */
export function escapeName(name) {
    return name.replace(/'/g, "\\'");
}

/**
 * Create a safe ID from a string
 */
export function createSafeId(str) {
    return str.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');
}

/**
 * Debounce function for search inputs
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Check if a game has started based on game time
 */
export function hasGameStarted(gameTime) {
    if (!gameTime) return false;
    return new Date(gameTime) <= new Date();
}
