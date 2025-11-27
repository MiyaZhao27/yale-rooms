import axios from 'axios';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

/**
 * Get room availability for a specific building
 * The client will pass along authentication cookies/headers from their browser
 */
app.get('/api/rooms/:buildingId', async (req, res) => {
  const { buildingId } = req.params;
  const { date, time } = req.query;

  try {
    // 25Live API endpoint - you'll need to replace this with the actual endpoint
    // that you see in your browser's network tab when accessing 25Live
    const LIVE_25_API = process.env.LIVE_25_API_URL || 'https://25live.collegenet.com/25live/data/yale/run/';
    
    // Forward the authentication cookies from the client
    const authCookie = req.headers['x-auth-cookie'] || '';
    
    // Build the API request to 25Live
    // This is a generic structure - you'll need to adjust based on actual 25Live API
    const response = await axios.get(`${LIVE_25_API}locations.json`, {
      params: {
        parent_id: buildingId,
        // Add date/time filters if 25Live API supports them
        ...(date && { date }),
        ...(time && { time }),
      },
      headers: {
        'Cookie': authCookie,
        'User-Agent': req.headers['user-agent'],
        'Accept': 'application/json',
      },
      timeout: 10000,
    });

    // Return the rooms/locations data
    res.json({
      success: true,
      buildingId,
      rooms: response.data,
    });

  } catch (error) {
    console.error('Error fetching room data:', error.message);
    
    if (error.response) {
      // The 25Live API responded with an error
      return res.status(error.response.status).json({
        success: false,
        error: 'Failed to fetch room data from 25Live',
        details: error.response.data,
      });
    }
    
    // Network or other error
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
});

/**
 * Alternative endpoint: Proxy that forwards the entire request to 25Live
 * This is useful if you want the frontend to make the exact same calls it would make to 25Live
 */
app.all('/api/proxy/25live/*', async (req, res) => {
  const path = req.params[0];
  const LIVE_25_BASE = process.env.LIVE_25_BASE_URL || 'https://25live.collegenet.com';
  
  try {
    const response = await axios({
      method: req.method,
      url: `${LIVE_25_BASE}/${path}`,
      params: req.query,
      data: req.body,
      headers: {
        'Cookie': req.headers['x-auth-cookie'] || req.headers['cookie'] || '',
        'User-Agent': req.headers['user-agent'],
        'Accept': req.headers['accept'] || 'application/json',
      },
      timeout: 15000,
    });

    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('Proxy error:', error.message);
    
    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }
    
    res.status(500).json({
      success: false,
      error: 'Proxy request failed',
      message: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📍 Room availability endpoint: http://localhost:${PORT}/api/rooms/:buildingId`);
});
