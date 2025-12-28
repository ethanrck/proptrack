// js/state.js - Global state management for PropTrack

class AppState {
    constructor() {
        // Player data
        this.allPlayersData = [];
        this.allGoaliesData = [];
        this.filteredPlayers = [];
        
        // Game logs
        this.allGameLogs = {};
        this.allGoalieGameLogs = {};
        
        // Team data
        this.teamShotData = [];
        this.teamSchedules = {};  // Pre-cached from cron job
        this.teamScheduleCache = {};  // Runtime fallback cache
        
        // Betting data
        this.bettingOdds = {};
        
        // Hit rates cache
        this.playerHitRates = {};
        this.teamHitRates = {};
        
        // UI State
        this.currentStatType = 'points';
        this.isGoalieMode = false;
        this.isTeamTotalsMode = false;
        this.selectedLineFilter = '';
        
        // Watchlist
        this.watchlist = [];
        this.selectedParlayPlayers = [];
        
        // Subscribers for state changes
        this._subscribers = new Map();
    }
    
    // Subscribe to state changes
    subscribe(key, callback) {
        if (!this._subscribers.has(key)) {
            this._subscribers.set(key, []);
        }
        this._subscribers.get(key).push(callback);
        
        // Return unsubscribe function
        return () => {
            const callbacks = this._subscribers.get(key);
            const index = callbacks.indexOf(callback);
            if (index > -1) callbacks.splice(index, 1);
        };
    }
    
    // Notify subscribers of state change
    _notify(key, value) {
        if (this._subscribers.has(key)) {
            this._subscribers.get(key).forEach(cb => cb(value));
        }
    }
    
    // Setters with notification
    setPlayers(players) {
        this.allPlayersData = players.filter(p => (p.gamesPlayed || 0) > 0);
        this._notify('players', this.allPlayersData);
    }
    
    setGoalies(goalies) {
        this.allGoaliesData = goalies.filter(g => (g.gamesPlayed || 0) > 0);
        this._notify('goalies', this.allGoaliesData);
    }
    
    setGameLogs(logs) {
        this.allGameLogs = logs;
        this._notify('gameLogs', logs);
    }
    
    setGoalieGameLogs(logs) {
        this.allGoalieGameLogs = logs;
        this._notify('goalieGameLogs', logs);
    }
    
    setTeamShotData(data) {
        this.teamShotData = data;
        this._notify('teamShotData', data);
    }
    
    setTeamSchedules(schedules) {
        this.teamSchedules = schedules || {};
        this._notify('teamSchedules', this.teamSchedules);
    }
    
    setBettingOdds(odds) {
        this.bettingOdds = odds;
        this._notify('bettingOdds', odds);
    }
    
    setStatType(statType) {
        this.currentStatType = statType;
        this.isGoalieMode = statType === 'saves';
        this.isTeamTotalsMode = statType === 'team_totals';
        this._notify('statType', statType);
    }
    
    setLineFilter(filter) {
        this.selectedLineFilter = filter;
        this._notify('lineFilter', filter);
    }
    
    setFilteredPlayers(players) {
        this.filteredPlayers = players;
        this._notify('filteredPlayers', players);
    }
    
    // Watchlist methods
    loadWatchlist() {
        const saved = localStorage.getItem('nhlWatchlist');
        if (saved) {
            try {
                this.watchlist = JSON.parse(saved);
            } catch (e) {
                console.error('Error loading watchlist:', e);
                this.watchlist = [];
            }
        }
        this._notify('watchlist', this.watchlist);
    }
    
    saveWatchlist() {
        localStorage.setItem('nhlWatchlist', JSON.stringify(this.watchlist));
        this._notify('watchlist', this.watchlist);
    }
    
    addToWatchlist(item) {
        const exists = this.watchlist.find(w => 
            w.playerId === item.playerId && w.statType === item.statType
        );
        
        if (exists) {
            this.removeFromWatchlist(item.playerId, item.statType);
            return false;
        }
        
        this.watchlist.push({
            ...item,
            addedAt: new Date().toISOString()
        });
        this.saveWatchlist();
        return true;
    }
    
    removeFromWatchlist(playerId, statType) {
        this.watchlist = this.watchlist.filter(item => 
            !(item.playerId === playerId && item.statType === statType)
        );
        
        // Also remove from parlay selection
        const key = `${playerId}-${statType}`;
        this.selectedParlayPlayers = this.selectedParlayPlayers.filter(k => k !== key);
        
        this.saveWatchlist();
    }
    
    clearWatchlist() {
        this.watchlist = [];
        this.selectedParlayPlayers = [];
        this.saveWatchlist();
    }
    
    isInWatchlist(playerId, statType) {
        return this.watchlist.some(item => 
            item.playerId === playerId && item.statType === statType
        );
    }
    
    toggleParlaySelection(playerId, statType) {
        const key = `${playerId}-${statType}`;
        const index = this.selectedParlayPlayers.indexOf(key);
        
        if (index > -1) {
            this.selectedParlayPlayers.splice(index, 1);
        } else {
            this.selectedParlayPlayers.push(key);
        }
        
        this._notify('parlaySelection', this.selectedParlayPlayers);
    }
    
    addAllToParlay() {
        this.selectedParlayPlayers = this.watchlist.map(item => 
            `${item.playerId}-${item.statType}`
        );
        this._notify('parlaySelection', this.selectedParlayPlayers);
    }
    
    clearParlaySelection() {
        this.selectedParlayPlayers = [];
        this._notify('parlaySelection', this.selectedParlayPlayers);
    }
    
    // Get current data source based on mode
    getCurrentDataSource() {
        if (this.isGoalieMode) return this.allGoaliesData;
        return this.allPlayersData;
    }
    
    getCurrentGameLogs() {
        if (this.isGoalieMode) return this.allGoalieGameLogs;
        return this.allGameLogs;
    }
    
    // Cache team schedule data (runtime fallback)
    cacheTeamSchedule(teamAbbrev, games) {
        this.teamScheduleCache[teamAbbrev] = games;
    }
    
    // Get team schedule - checks pre-cached first, then runtime cache
    getTeamSchedule(teamAbbrev) {
        // First check pre-cached data from cron job
        if (this.teamSchedules[teamAbbrev]) {
            return this.teamSchedules[teamAbbrev];
        }
        // Then check runtime cache
        return this.teamScheduleCache[teamAbbrev] || null;
    }
}

// Create singleton instance
const state = new AppState();

export default state;
