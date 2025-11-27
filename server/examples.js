// Example: How to inspect 25Live and get the correct API data
// This is a reference for what data structure to expect

/**
 * EXAMPLE 1: What you might see in 25Live's Network tab
 * 
 * Request:
 * GET https://25live.collegenet.com/25live/data/yale/run/locations.json?parent_id=54321
 * 
 * Response might look like:
 */
const example25LiveResponse = {
  // Option A: Direct array
  locations: [
    {
      location_id: 12345,
      formal_name: "Bass Library L73",
      informal_name: "BASSLB L73",
      capacity: 18,
      space_type: "Study Room",
      features: ["Whiteboard", "Screen"],
      max_capacity: 18
    }
  ],
  
  // Option B: Nested structure
  data: {
    locations: [
      // ... room objects
    ]
  },
  
  // Option C: Single location
  location: {
    location_id: 12345,
    formal_name: "Bass Library L73"
  }
};

/**
 * EXAMPLE 2: What the backend returns to your frontend
 * 
 * The backend wraps the 25Live response in a standard format:
 */
const backendResponse = {
  success: true,
  buildingId: "54321",
  rooms: [
    // This is the raw 25Live data
    // The structure depends on what 25Live returns
  ]
};

/**
 * EXAMPLE 3: How to adjust the frontend to match your data
 * 
 * In App.jsx, around line 50-60, you have:
 */
const frontendCode = `
// Extract rooms from the response
if (data.success && data.rooms) {
  // Adjust this based on actual 25Live structure
  
  // If 25Live returns: { locations: [...] }
  const roomsList = data.rooms.locations || data.rooms;
  
  // If 25Live returns: { data: { locations: [...] } }
  const roomsList = data.rooms.data?.locations || data.rooms;
  
  // If 25Live returns a direct array
  const roomsList = Array.isArray(data.rooms) ? data.rooms : [data.rooms];
  
  setRooms(roomsList);
}
`;

/**
 * EXAMPLE 4: Building IDs
 * 
 * Your map uses Concept3D building IDs, but 25Live might use different IDs.
 * You may need to create a mapping:
 */
const buildingIdMapping = {
  // Concept3D ID -> 25Live ID
  "52707": "12345",  // Example: Bass Library
  "52708": "12346",  // Example: Sterling Library
  // Add more mappings as needed
};

// Then in server/index.js, translate the ID:
const translate25LiveId = (concept3dId) => {
  return buildingIdMapping[concept3dId] || concept3dId;
};

/**
 * EXAMPLE 5: Complete flow with real data
 */
async function exampleCompleteFlow() {
  // 1. User clicks building on map
  const building = {
    id: "52707",  // From Concept3D
    name: "Bass Library"
  };
  
  // 2. Frontend makes request
  const response = await fetch(
    `http://localhost:3001/api/rooms/${building.id}`,
    {
      headers: {
        'X-Auth-Cookie': document.cookie  // Passes 25Live session
      }
    }
  );
  
  // 3. Backend gets the request and queries 25Live
  // server/index.js does:
  // GET https://25live.collegenet.com/.../locations.json?parent_id=52707
  
  // 4. 25Live returns room data (example):
  const live25Response = {
    locations: [
      {
        location_id: 789,
        formal_name: "BASSLB L73",
        capacity: 18,
        space_type: "Group Study",
        available: true
      }
    ]
  };
  
  // 5. Backend wraps and returns to frontend:
  const backendResponse = {
    success: true,
    buildingId: "52707",
    rooms: live25Response  // The full 25Live response
  };
  
  // 6. Frontend extracts and displays:
  const rooms = backendResponse.rooms.locations;  // Adjust based on structure
  rooms.forEach(room => {
    console.log(`${room.formal_name} - Capacity: ${room.capacity}`);
  });
}

/**
 * DEBUGGING TIPS
 */

// 1. Check what the backend is receiving from 25Live
// Add this to server/index.js after the axios call:
console.log('25Live Response:', JSON.stringify(response.data, null, 2));

// 2. Check what the frontend is receiving
// Add this to App.jsx after the fetch:
console.log('Backend Response:', data);

// 3. Test the API directly in your browser
// While logged into 25Live, open a new tab and visit:
// http://localhost:3001/api/rooms/SOME_BUILDING_ID

// 4. Use the browser's Network tab
// See exactly what's being sent and received

/**
 * COMMON API PATTERNS FROM 25LIVE
 */

// Pattern 1: Get locations by parent building
// GET /locations.json?parent_id={buildingId}

// Pattern 2: Get availability for a location
// GET /availability.json?location_id={roomId}&date={date}

// Pattern 3: Search locations
// GET /locations.json?search={query}&space_type={type}

// Pattern 4: Get schedule for a location
// GET /schedule.json?location_id={roomId}&start={start}&end={end}

/**
 * NEXT STEPS
 * 
 * 1. Log into 25Live in your browser
 * 2. Open DevTools Network tab
 * 3. Click on a building in 25Live
 * 4. Find the API request that returns room data
 * 5. Copy that exact URL structure
 * 6. Update server/index.js with the correct endpoint
 * 7. Adjust App.jsx to match the response structure
 * 8. Test with npm run dev:all
 */
