// js/nfl/nfl-api-client.js - NFL API client for fetching data

import { nflState } from './nfl-state.js';

const API_BASE = '/api';

/**
 * Fetch all NFL data from our backend
 */
export async function fetchNFLData() {
    try {
        nflState.setLoading(true);
        
        const response = await fetch(`${API_BASE}/nfl-get-data`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.players) {
            nflState.setPlayers(data.players);
        }
        if (data.gameLogs) {
            nflState.setGameLogs(data.gameLogs);
        }
        if (data.bettingOdds) {
            nflState.setBettingOdds(data.bettingOdds);
        }
        if (data.todaysGames) {
            nflState.setTodaysGames(data.todaysGames);
        }
        if (data.lastUpdated) {
            nflState.setLastUpdated(new Date(data.lastUpdated));
        }
        
        return data;
    } catch (error) {
        console.error('Error fetching NFL data:', error);
        throw error;
    } finally {
        nflState.setLoading(false);
    }
}

/**
 * Get players with betting lines for today's games
 */
export function getPlayersWithOdds(propType) {
    const players = nflState.players;
    const odds = nflState.bettingOdds;
    const todaysGames = nflState.todaysGames;
    
    if (!players || !odds) return [];
    
    // Get team abbreviations playing today
    const teamsPlayingToday = new Set();
    todaysGames.forEach(game => {
        if (game.homeTeam) teamsPlayingToday.add(game.homeTeam);
        if (game.awayTeam) teamsPlayingToday.add(game.awayTeam);
    });
    
    // Filter players who have odds for this prop type and are playing today
    const playersWithOdds = [];
    
    for (const player of players) {
        // Check if player's team is playing today
        if (!teamsPlayingToday.has(player.team)) continue;
        
        // Check if player has odds for this prop type
        const playerOdds = odds[player.id] || odds[player.name];
        if (!playerOdds || !playerOdds[propType]) continue;
        
        playersWithOdds.push({
            ...player,
            odds: playerOdds[propType]
        });
    }
    
    return playersWithOdds;
}

/**
 * Get available line values for filtering
 */
export function getAvailableLines(propType) {
    const odds = nflState.bettingOdds;
    const lines = new Set();
    
    for (const playerOdds of Object.values(odds)) {
        if (playerOdds[propType]) {
            const propOdds = playerOdds[propType];
            if (Array.isArray(propOdds)) {
                propOdds.forEach(o => lines.add(o.line));
            } else if (propOdds.line !== undefined) {
                lines.add(propOdds.line);
            }
        }
    }
    
    return Array.from(lines).sort((a, b) => a - b);
}

/**
 * Format game time for display
 */
export function formatGameTime(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
}

/**
 * Get game info for a player
 */
export function getPlayerGameInfo(playerId) {
    const player = nflState.players.find(p => p.id === playerId);
    if (!player) return null;
    
    const game = nflState.todaysGames.find(g => 
        g.homeTeam === player.team || g.awayTeam === player.team
    );
    
    if (!game) return null;
    
    const isHome = game.homeTeam === player.team;
    const opponent = isHome ? game.awayTeam : game.homeTeam;
    
    return {
        opponent,
        isHome,
        gameTime: game.startTime,
        gameId: game.id
    };
}
