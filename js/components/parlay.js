// js/components/parlay.js - Parlay calculator functionality

import state from '../state.js';
import { formatOdds } from '../utils.js';

/**
 * Convert American odds to decimal odds
 */
export function americanToDecimal(americanOdds) {
    if (americanOdds > 0) {
        return (americanOdds / 100) + 1;
    }
    return (100 / Math.abs(americanOdds)) + 1;
}

/**
 * Convert decimal odds back to American
 */
export function decimalToAmerican(decimalOdds) {
    if (decimalOdds >= 2) {
        return Math.round((decimalOdds - 1) * 100);
    }
    return Math.round(-100 / (decimalOdds - 1));
}

/**
 * Calculate combined parlay odds from array of American odds
 */
export function calculateParlayOdds(americanOddsArray) {
    if (americanOddsArray.length === 0) return null;
    if (americanOddsArray.length === 1) return americanOddsArray[0];
    
    // Convert to decimal, multiply, convert back
    const decimalOdds = americanOddsArray.map(americanToDecimal);
    const totalDecimal = decimalOdds.reduce((acc, odds) => acc * odds, 1);
    
    return decimalToAmerican(totalDecimal);
}

/**
 * Calculate potential payout for a bet
 */
export function calculatePayout(americanOdds, bet = 100) {
    if (americanOdds > 0) {
        return bet + (bet * americanOdds / 100);
    }
    return bet + (bet * 100 / Math.abs(americanOdds));
}

/**
 * Render parlay calculator HTML
 */
export function renderParlayCalculator() {
    const container = document.getElementById('parlayCalculator');
    if (!container) return;
    
    const { watchlist, selectedParlayPlayers } = state;
    
    if (selectedParlayPlayers.length < 2) {
        container.innerHTML = selectedParlayPlayers.length === 1 
            ? '<div style="text-align: center; padding: 10px; color: var(--text-secondary); font-size: 0.9em;">Select 2+ players to build a parlay</div>'
            : '';
        return;
    }
    
    const selectedItems = watchlist.filter(item => 
        selectedParlayPlayers.includes(`${item.playerId}-${item.statType}`)
    );
    
    const oddsArray = selectedItems.map(item => item.odds);
    const parlayOdds = calculateParlayOdds(oddsArray);
    const payout = calculatePayout(parlayOdds, 100);
    const profit = payout - 100;
    const formattedParlayOdds = formatOdds(parlayOdds);
    
    container.innerHTML = `
        <div class="parlay-calculator">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <div class="parlay-title" style="margin: 0;">🎯 Parlay Calculator</div>
                <button onclick="window.proptrack.clearParlaySelection()" 
                        style="background: none; border: none; color: var(--warning-text); cursor: pointer; font-size: 0.9em; text-decoration: underline;">
                    Clear
                </button>
            </div>
            <div class="parlay-odds">${formattedParlayOdds}</div>
            <div class="parlay-payout">
                $100 bet wins <strong>$${profit.toFixed(2)}</strong> 
                (total payout: $${payout.toFixed(2)})
            </div>
            <div class="parlay-legs">${selectedParlayPlayers.length}-leg parlay</div>
        </div>
    `;
}

export default {
    calculateParlayOdds,
    calculatePayout,
    renderParlayCalculator
};
