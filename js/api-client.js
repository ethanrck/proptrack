// js/api-client.js - API client for PropTrack backend

import { API_BASE_URL } from './config.js';

class PropTrackAPI {
    constructor(baseUrl) {
        this.baseUrl = baseUrl || API_BASE_URL;
    }

    /**
     * Get cached NHL data from backend
     */
    async getCachedData() {
        try {
            const response = await fetch(`${this.baseUrl}/api/get-data`);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch cached data: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error fetching cached data:', error);
            throw error;
        }
    }

    /**
     * Calculate player rankings via protected backend API
     */
    async calculatePlayerRankings(players, gameLogs, bettingOdds, teamShotData, statType, sortBy = 'l10', minGames = 5) {
        try {
            const response = await fetch(`${this.baseUrl}/api/calculate-rankings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    players,
                    gameLogs,
                    bettingOdds,
                    teamShotData,
                    statType,
                    sortBy,
                    minGames
                })
            });

            if (!response.ok) {
                throw new Error(`Rankings API error: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error calculating rankings:', error);
            throw error;
        }
    }

    /**
     * Calculate goalie rankings via protected backend API
     */
    async calculateGoalieRankings(goalies, goalieGameLogs, bettingOdds, teamShotData, sortBy = 'l10', minGames = 3) {
        try {
            const response = await fetch(`${this.baseUrl}/api/calculate-goalie-rankings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    goalies,
                    goalieGameLogs,
                    bettingOdds,
                    teamShotData,
                    sortBy,
                    minGames
                })
            });

            if (!response.ok) {
                throw new Error(`Goalie rankings API error: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error calculating goalie rankings:', error);
            throw error;
        }
    }

    /**
     * Calculate hit rate for a specific player and line via protected backend API
     */
    async calculateHitRate(games, lineValue, statType, isGoalie = false) {
        try {
            const response = await fetch(`${this.baseUrl}/api/calculate-hit-rates`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    games,
                    lineValue,
                    statType,
                    isGoalie
                })
            });

            if (!response.ok) {
                throw new Error(`Hit rate API error: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error calculating hit rate:', error);
            throw error;
        }
    }

    /**
     * Proxy request to NHL API
     */
    async fetchNHL(endpoint) {
        try {
            const response = await fetch(`${this.baseUrl}/api/nhl?endpoint=${encodeURIComponent(endpoint)}`);
            
            if (!response.ok) {
                throw new Error(`NHL API error: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error fetching from NHL API:', error);
            throw error;
        }
    }

    /**
     * Fetch team schedule for a specific month
     */
    async fetchTeamSchedule(teamAbbrev, year, month) {
        const monthStr = `${year}-${String(month).padStart(2, '0')}`;
        const endpoint = `/v1/club-schedule/${teamAbbrev}/month/${monthStr}`;
        return this.fetchNHL(endpoint);
    }
}

// Create singleton instance
const api = new PropTrackAPI();

export default api;
