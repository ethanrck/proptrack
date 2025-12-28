// api/nfl-get-data.js - Vercel serverless function to get NFL data from blob storage

import { list, get } from '@vercel/blob';

export const config = {
    runtime: 'edge',
};

export default async function handler(request) {
    try {
        // Try to get cached data from blob storage
        const blobUrl = process.env.NFL_BLOB_URL || 'nfl-data.json';
        
        let data = null;
        
        try {
            const response = await fetch(blobUrl);
            if (response.ok) {
                data = await response.json();
            }
        } catch (e) {
            console.log('No cached NFL data found, returning empty state');
        }
        
        // If no cached data, return empty structure
        if (!data) {
            data = {
                players: [],
                gameLogs: {},
                bettingOdds: {},
                todaysGames: [],
                lastUpdated: null
            };
        }
        
        return new Response(JSON.stringify(data), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
            },
        });
    } catch (error) {
        console.error('Error fetching NFL data:', error);
        return new Response(JSON.stringify({ 
            error: 'Failed to fetch NFL data',
            message: error.message 
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }
}
