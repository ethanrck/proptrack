// js/components/filters.js - Filter and search functionality

import state from '../state.js';
import { getMainLine, hasGameStarted, getLinesArray } from '../utils.js';
import { displayPlayers, displayTeams } from './display.js';

/**
 * Initialize filter event listeners
 */
export function initFilters() {
    const searchInput = document.getElementById('searchPlayer');
    if (searchInput) {
        searchInput.addEventListener('input', () => filterPlayers());
    }
}

/**
 * Select stat type and update UI
 */
export function selectStat(stat) {
    state.setStatType(stat);
    
    // Update button states
    document.querySelectorAll('.stat-button').forEach(btn => {
        btn.classList.remove('active');
        const btnText = btn.textContent.toLowerCase();
        if ((stat === btnText) || 
            (stat === 'saves' && btnText.includes('goalie')) ||
            (stat === 'team_totals' && btnText.includes('team'))) {
            btn.classList.add('active');
        }
    });
    
    // Update filtered players based on mode
    if (state.isTeamTotalsMode) {
        state.setFilteredPlayers([]);
    } else if (state.isGoalieMode) {
        state.setFilteredPlayers([...state.allGoaliesData]);
    } else {
        state.setFilteredPlayers([...state.allPlayersData]);
    }
    
    // Reset filters
    const gameFilter = document.getElementById('gameFilter');
    if (gameFilter) gameFilter.value = '';
    state.setLineFilter('');
    
    populateGameFilter();
    populateLineFilter();
    
    if (state.isTeamTotalsMode) {
        displayTeams();
    } else {
        filterPlayers();
    }
}

/**
 * Filter players based on search and checkbox criteria
 */
export function filterPlayers() {
    const searchTerm = document.getElementById('searchPlayer')?.value.toLowerCase() || '';
    const hideNoLines = document.getElementById('hideNoLines')?.checked ?? true;
    const hideStartedGames = document.getElementById('hideStartedGames')?.checked ?? false;
    const selectedGame = document.getElementById('gameFilter')?.value || '';
    const selectedLine = state.selectedLineFilter;
    
    const sourceData = state.getCurrentDataSource();
    const statType = state.currentStatType;
    const bettingOdds = state.bettingOdds;
    const isGoalie = state.isGoalieMode;
    const currentTime = new Date();
    
    const filtered = sourceData.filter(player => {
        // Name search
        const fullName = isGoalie 
            ? `${player.goalieFullName || ''}`.toLowerCase()
            : `${player.skaterFullName || ''}`.toLowerCase();
        const matchesSearch = searchTerm === '' || fullName.includes(searchTerm);
        
        // Get player odds
        const name = isGoalie 
            ? (player.goalieFullName || 'Unknown Goalie')
            : (player.skaterFullName || 'Unknown Player');
        const playerOdds = bettingOdds[name];
        
        // Check if player has lines
        const hasLine = playerOdds && Array.isArray(playerOdds[statType]) && playerOdds[statType].length > 0;
        const passesLineFilter = !hideNoLines || hasLine;
        
        // Check for upcoming games
        let hasUpcomingGame = true;
        if (hideStartedGames && hasLine) {
            hasUpcomingGame = playerOdds[statType].some(lineObj => {
                if (lineObj.gameTime) {
                    return new Date(lineObj.gameTime) > currentTime;
                }
                return true;
            });
        }
        
        // Game filter
        let passesGameFilter = true;
        if (selectedGame && hasLine) {
            passesGameFilter = playerOdds[statType].some(lineObj => lineObj.game === selectedGame);
        }
        
        // Betting line filter
        let passesBettingLineFilter = true;
        if (selectedLine && hasLine) {
            passesBettingLineFilter = playerOdds[statType].some(lineObj => lineObj.line == parseFloat(selectedLine));
        }
        
        return matchesSearch && passesLineFilter && passesGameFilter && passesBettingLineFilter && hasUpcomingGame;
    });
    
    state.setFilteredPlayers(filtered);
    displayPlayers();
}

/**
 * Populate game filter dropdown
 */
export function populateGameFilter() {
    const gameFilter = document.getElementById('gameFilter');
    if (!gameFilter) return;
    
    const uniqueGames = new Set();
    const bettingOdds = state.bettingOdds;
    
    Object.values(bettingOdds).forEach(playerOdds => {
        Object.values(playerOdds).forEach(statOdds => {
            if (Array.isArray(statOdds)) {
                statOdds.forEach(lineObj => {
                    if (lineObj.game) {
                        uniqueGames.add(lineObj.game);
                    }
                });
            }
        });
    });
    
    // Sort games by time
    const gamesWithTime = Array.from(uniqueGames).map(game => {
        let gameTime = null;
        Object.values(bettingOdds).forEach(playerOdds => {
            Object.values(playerOdds).forEach(statOdds => {
                if (Array.isArray(statOdds)) {
                    statOdds.forEach(lineObj => {
                        if (lineObj.game === game && lineObj.gameTime) {
                            gameTime = lineObj.gameTime;
                        }
                    });
                }
            });
        });
        return { game, gameTime };
    }).filter(g => g.gameTime)
      .sort((a, b) => new Date(a.gameTime) - new Date(b.gameTime));
    
    gameFilter.innerHTML = '<option value="">All Games</option>';
    gamesWithTime.forEach(({ game, gameTime }) => {
        const timeStr = new Date(gameTime).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit'
        });
        gameFilter.innerHTML += `<option value="${game}">${game} (${timeStr})</option>`;
    });
}

/**
 * Populate line filter buttons
 */
export function populateLineFilter() {
    const container = document.getElementById('lineFilterButtons');
    const section = document.getElementById('lineFilterSection');
    if (!container || !section) return;
    
    const statType = state.currentStatType;
    const bettingOdds = state.bettingOdds;
    
    if (state.isTeamTotalsMode) {
        // Get unique lines from team totals
        const uniqueLines = new Set();
        Object.values(bettingOdds).forEach(teamOdds => {
            if (teamOdds.team_totals) {
                teamOdds.team_totals.forEach(lineObj => uniqueLines.add(lineObj.line));
            }
            if (teamOdds.alternate_team_totals) {
                teamOdds.alternate_team_totals.forEach(lineObj => uniqueLines.add(lineObj.line));
            }
        });
        
        const sortedLines = Array.from(uniqueLines).sort((a, b) => a - b);
        
        if (sortedLines.length > 1) {
            section.style.display = 'block';
            container.innerHTML = `
                <button class="line-filter-button all-lines active" onclick="window.proptrack.setLineFilter('')">All Lines</button>
                ${sortedLines.map(line => `
                    <button class="line-filter-button" onclick="window.proptrack.setLineFilter('${line}')">${line}</button>
                `).join('')}
            `;
        } else {
            section.style.display = 'none';
        }
        return;
    }
    
    // For player stats
    const uniqueLines = new Set();
    Object.values(bettingOdds).forEach(playerOdds => {
        const lines = getLinesArray(playerOdds, statType);
        lines.forEach(lineObj => {
            if (lineObj.line !== undefined) {
                uniqueLines.add(lineObj.line);
            }
        });
    });
    
    const sortedLines = Array.from(uniqueLines).sort((a, b) => a - b);
    
    if (sortedLines.length > 1) {
        section.style.display = 'block';
        
        // For non-shots, show common lines as buttons
        let buttonsHtml = `<button class="line-filter-button all-lines active" onclick="window.proptrack.setLineFilter('')">All Lines</button>`;
        
        if (statType !== 'shots') {
            const commonLines = sortedLines.filter(l => l <= 2.5);
            commonLines.forEach(line => {
                buttonsHtml += `<button class="line-filter-button" onclick="window.proptrack.setLineFilter('${line}')">${line}</button>`;
            });
            
            // Add dropdown for higher lines
            const higherLines = sortedLines.filter(l => l > 2.5);
            if (higherLines.length > 0) {
                buttonsHtml += `
                    <select class="line-filter-dropdown" onchange="window.proptrack.setLineFilter(this.value)">
                        <option value="">More Lines...</option>
                        ${higherLines.map(l => `<option value="${l}">${l}+</option>`).join('')}
                    </select>
                `;
            }
        } else {
            // For shots, show all as buttons or dropdown
            if (sortedLines.length <= 8) {
                sortedLines.forEach(line => {
                    buttonsHtml += `<button class="line-filter-button" onclick="window.proptrack.setLineFilter('${line}')">${line}</button>`;
                });
            } else {
                buttonsHtml += `
                    <select class="line-filter-dropdown" onchange="window.proptrack.setLineFilter(this.value)">
                        <option value="">Select Line...</option>
                        ${sortedLines.map(l => `<option value="${l}">${l}+</option>`).join('')}
                    </select>
                `;
            }
        }
        
        container.innerHTML = buttonsHtml;
    } else {
        section.style.display = 'none';
    }
}

/**
 * Set line filter value
 */
export function setLineFilter(value) {
    state.setLineFilter(value);
    
    // Update button states
    document.querySelectorAll('.line-filter-button').forEach(btn => {
        btn.classList.remove('active');
        if (value === '' && btn.classList.contains('all-lines')) {
            btn.classList.add('active');
        } else if (btn.textContent === value || btn.textContent === `${value}`) {
            btn.classList.add('active');
        }
    });
    
    // Update dropdown if exists
    const dropdown = document.querySelector('.line-filter-dropdown');
    if (dropdown && !document.querySelector(`.line-filter-button[onclick*="'${value}'"]`)) {
        dropdown.value = value;
    }
    
    if (state.isTeamTotalsMode) {
        displayTeams();
    } else {
        filterPlayers();
    }
}

export default {
    initFilters,
    selectStat,
    filterPlayers,
    populateGameFilter,
    populateLineFilter,
    setLineFilter
};
