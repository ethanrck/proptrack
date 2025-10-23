// api-client.js - Client for backend API calls
// This file handles all communication with the PropTrack backend

class PropTrackAPI {
  constructor(baseUrl) {
    this.baseUrl = baseUrl || API_BASE_URL;
  }

  // Calculate player rankings with backend
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

  // Calculate goalie rankings with backend
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

  // Calculate hit rate for a specific player and line
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

  // Get cached NHL data
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
}

// Create global instance
const propTrackAPI = new PropTrackAPI();
