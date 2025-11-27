# Yale Rooms - Backend Setup Guide

## Overview
This backend server acts as a proxy between your frontend and Yale's 25Live system to fetch room availability data for buildings.

## Architecture
- **Frontend**: React + Vite (runs on port 5173)
- **Backend**: Express.js (runs on port 3001)
- **Data Source**: Yale 25Live (accessed via CAS authentication)

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

This will install both frontend and backend dependencies:
- express, cors, axios, dotenv (backend)
- react, leaflet, etc. (frontend)
- concurrently (to run both servers)

### 2. Configure 25Live API Endpoints

Open the `.env` file and update the 25Live URLs:

```env
PORT=3001
LIVE_25_BASE_URL=https://25live.collegenet.com
LIVE_25_API_URL=https://25live.collegenet.com/25live/data/yale/run/
```

**To find the correct API endpoints:**
1. Log into Yale's 25Live system in your browser
2. Open Developer Tools (F12)
3. Go to the Network tab
4. Navigate to a building and look at the requests
5. Copy the API endpoint URLs you see

### 3. Running the Application

**Option 1: Run Both Servers Together (Recommended)**
```bash
npm run dev:all
```
This starts both the frontend and backend simultaneously.

**Option 2: Run Separately**

Terminal 1 (Backend):
```bash
npm run server
```

Terminal 2 (Frontend):
```bash
npm run dev
```

### 4. How It Works

1. **User clicks a building** on the map
2. **Frontend** (`App.jsx`) automatically calls the backend:
   ```
   GET http://localhost:3001/api/rooms/:buildingId?date=&time=
   ```
3. **Backend** (`server/index.js`) forwards the request to 25Live with your authentication
4. **Backend** returns the room data to the frontend
5. **Frontend** displays the rooms in the sidebar

### 5. Authentication

The backend expects authentication cookies from your browser session with 25Live:
- When you're logged into 25Live, your browser has session cookies
- The frontend passes these cookies to the backend via the `X-Auth-Cookie` header
- The backend forwards them to 25Live

**Important:** You must be logged into Yale's 25Live in your browser for this to work.

## API Endpoints

### `GET /api/rooms/:buildingId`
Fetches all rooms for a specific building.

**Parameters:**
- `buildingId` (path): The building ID from the map
- `date` (query, optional): Filter by date
- `time` (query, optional): Filter by time

**Response:**
```json
{
  "success": true,
  "buildingId": "12345",
  "rooms": [
    {
      "id": "room1",
      "name": "Room 101",
      "capacity": 30,
      "space_type": "Classroom"
    }
  ]
}
```

### `GET /api/proxy/25live/*`
Generic proxy endpoint that forwards any request to 25Live.

**Example:**
```
GET /api/proxy/25live/data/yale/run/locations.json
```

## Customization

### Adjusting the Room Data Structure

The backend returns whatever 25Live provides. You may need to adjust the frontend code in `App.jsx` to match the actual data structure:

```jsx
// Adjust this based on what 25Live returns
if (data.success && data.rooms) {
  setRooms(Array.isArray(data.rooms) ? data.rooms : [data.rooms]);
}
```

### Adding More Filters

You can add additional query parameters in `server/index.js`:

```javascript
params: {
  parent_id: buildingId,
  date: date,
  time: time,
  capacity_min: req.query.capacity,  // Add new filters
  available: req.query.available,
}
```

## Troubleshooting

### "Failed to fetch rooms" Error
1. Make sure the backend server is running (`npm run server`)
2. Check that you're logged into 25Live in your browser
3. Verify the API URLs in `.env` are correct
4. Check the browser console and server console for error details

### CORS Errors
The backend has CORS enabled for all origins. If you still get CORS errors, make sure the backend is running on port 3001.

### Authentication Issues
If you get 401/403 errors:
1. Log into Yale's 25Live system in your browser
2. Make sure you're on the same domain (yale.edu)
3. The cookies should automatically be sent with requests

## Next Steps

- Inspect the actual 25Live API response structure and adjust the room display code
- Add filtering by date/time in the UI
- Add availability status (green/red indicators)
- Cache room data to reduce API calls
- Add error retry logic
