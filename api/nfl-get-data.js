// api/nfl-get-data.js - Vercel serverless function to get NFL data from blob storage

import { list } from '@vercel/blob';

export default async function handler(request, response) {
    try {
        // Try to get cached data from blob storage
        const { blobs } = await list({ prefix: 'nfl-data' });
        
        let data = null;
        
        if (blobs.length > 0) {
            // Get the most recent blob
            const latestBlob = blobs[0];
            const blobResponse = await fetch(latestBlob.url);
            if (blobResponse.ok) {
                data = await blobResponse.json();
            }
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
        
        response.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
        return response.status(200).json(data);
        
    } catch (error) {
        console.error('Error fetching NFL data:', error);
        return response.status(500).json({ 
            error: 'Failed to fetch NFL data',
            message: error.message 
        });
    }
}
