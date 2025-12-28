// js/nfl/nfl-state.js - NFL-specific state management

import { NFL_HIT_RATE_GAMES } from './nfl-constants.js';

class NFLState {
    constructor() {
        this.players = [];
        this.gameLogs = {};
        this.bettingOdds = {};
        this.todaysGames = [];
        this.currentPropType = 'passing_yards';
        this.currentLineFilter = 'all';
        this.isLoading = false;
        this.lastUpdated = null;
        this.watchlist = this.loadWatchlist();
        this.parlay = this.loadParlay();
    }

    setPlayers(players) {
        this.players = players;
    }

    setGameLogs(gameLogs) {
        this.gameLogs = gameLogs;
    }

    setBettingOdds(odds) {
        this.bettingOdds = odds;
    }

    setTodaysGames(games) {
        this.todaysGames = games;
    }

    setPropType(propType) {
        this.currentPropType = propType;
    }

    setLineFilter(filter) {
        this.currentLineFilter = filter;
    }

    setLoading(loading) {
        this.isLoading = loading;
    }

    setLastUpdated(date) {
        this.lastUpdated = date;
    }

    getPlayerGameLog(playerId) {
        return this.gameLogs[playerId] || [];
    }

    getPlayerOdds(playerName, propType) {
        const normalizedName = playerName.toLowerCase().trim();
        for (const [key, data] of Object.entries(this.bettingOdds)) {
            if (key.toLowerCase().includes(normalizedName)) {
                return data[propType] || null;
            }
        }
        return null;
    }

    // Calculate hit rate for last N games
    calculateHitRate(playerId, statKey, lineValue, numGames = NFL_HIT_RATE_GAMES) {
        const gameLog = this.getPlayerGameLog(playerId);
        if (!gameLog || gameLog.length === 0) {
            return { rate: 0, hits: 0, total: 0 };
        }

        // Filter out bye weeks and get last N games
        const validGames = gameLog
            .filter(g => !g.isByeWeek)
            .slice(0, numGames);

        if (validGames.length === 0) {
            return { rate: 0, hits: 0, total: 0 };
        }

        let hits = 0;
        validGames.forEach(game => {
            const statValue = game.stats?.[statKey] || 0;
            if (statValue > lineValue) {
                hits++;
            }
        });

        return {
            rate: (hits / validGames.length) * 100,
            hits: hits,
            total: validGames.length
        };
    }

    // Watchlist management
    loadWatchlist() {
        try {
            const saved = localStorage.getItem('proptrack-nfl-watchlist');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            return [];
        }
    }

    saveWatchlist() {
        try {
            localStorage.setItem('proptrack-nfl-watchlist', JSON.stringify(this.watchlist));
        } catch (e) {
            console.error('Failed to save NFL watchlist:', e);
        }
    }

    addToWatchlist(item) {
        const exists = this.watchlist.some(w => 
            w.playerId === item.playerId && 
            w.propType === item.propType &&
            w.line === item.line
        );
        if (!exists) {
            this.watchlist.push(item);
            this.saveWatchlist();
        }
    }

    removeFromWatchlist(index) {
        this.watchlist.splice(index, 1);
        this.saveWatchlist();
    }

    clearWatchlist() {
        this.watchlist = [];
        this.saveWatchlist();
    }

    // Parlay management
    loadParlay() {
        try {
            const saved = localStorage.getItem('proptrack-nfl-parlay');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            return [];
        }
    }

    saveParlay() {
        try {
            localStorage.setItem('proptrack-nfl-parlay', JSON.stringify(this.parlay));
        } catch (e) {
            console.error('Failed to save NFL parlay:', e);
        }
    }

    addToParlay(item) {
        const exists = this.parlay.some(p => 
            p.playerId === item.playerId && 
            p.propType === item.propType
        );
        if (!exists) {
            this.parlay.push(item);
            this.saveParlay();
        }
    }

    removeFromParlay(index) {
        this.parlay.splice(index, 1);
        this.saveParlay();
    }

    clearParlay() {
        this.parlay = [];
        this.saveParlay();
    }
}

export const nflState = new NFLState();
