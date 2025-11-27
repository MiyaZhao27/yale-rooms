import { useEffect, useRef, useState } from "react";
import CampusMap from "./CampusMap";
import SearchBar from "./SearchBar";
import routesData from "./data/routes.json";
import stopsData from "./data/stops.json";


export default function App() {
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [time, setTime] = useState(() => {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  });
  const [date, setDate] = useState("2025-11-26"); // Default to today
  const [allBuildings, setAllBuildings] = useState([]);
  const [roomData, setRoomData] = useState(null);
  const [aaccRooms, setAaccRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showRouteSidebar, setShowRouteSidebar] = useState(false);
  const [enabledRoutes, setEnabledRoutes] = useState({});
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [highlightedBuildings, setHighlightedBuildings] = useState([]);
  const [categoryBuildings, setCategoryBuildings] = useState([]);
  const [showRoutePlanner, setShowRoutePlanner] = useState(false);
  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);
  const [routeResults, setRouteResults] = useState(null);
  const [departureDate, setDepartureDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
  });
  const [departureTime, setDepartureTime] = useState(() => {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  });
  const [selectedRouteOption, setSelectedRouteOption] = useState(null);
  const [originSearch, setOriginSearch] = useState("");
  const [destinationSearch, setDestinationSearch] = useState("");
  const [showOriginResults, setShowOriginResults] = useState(false);
  const [showDestinationResults, setShowDestinationResults] = useState(false);

  // Combine buildings and stops for location search
  const allLocations = [
    ...allBuildings.map(b => ({ type: 'building', id: b.id, name: b.name, lat: b.lat, lng: b.lng })),
    ...stopsData.map(s => ({ type: 'stop', id: s.id, name: s.name, lat: s.lat, lng: s.lon }))
  ];

  // Filter locations based on search
  const filteredOriginLocations = originSearch.trim() === "" ? [] : 
    allLocations.filter(loc => loc.name.toLowerCase().includes(originSearch.toLowerCase())).slice(0, 8);
  
  const filteredDestinationLocations = destinationSearch.trim() === "" ? [] : 
    allLocations.filter(loc => loc.name.toLowerCase().includes(destinationSearch.toLowerCase())).slice(0, 8);

  // Load AACC room data when building is selected
  // Load AACC room data when building or date changes
  // We fetch the per-room AACC JSON files from `public/data` and filter
  // reservations to only those overlapping the currently selected `date`.
  useEffect(() => {
    if (!selectedBuilding) {
      setAaccRooms([]);
      return;
    }

    const buildingName = selectedBuilding.name.toLowerCase();
    const isAACC = buildingName.includes('295') ||
                   buildingName.includes('297') ||
                   buildingName.includes('crown') ||
                   buildingName.includes('asian american');

    if (!isAACC) {
      setAaccRooms([]);
      return;
    }

    setLoading(true);
    const roomFiles = ['aacc101', 'aacc103', 'aacc104', 'aacc105', 'aacc203', 'aacc210', 'aacc302', 'aacc303'];

    // compute day range for the selected date (local)
    const dayStart = new Date(`${date}T00:00:00`);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    Promise.all(
      roomFiles.map(room =>
        fetch(`/data/${room}.json`)
          .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
          })
          .then(data => {
            const allReservations = data.space_reservations?.space_reservation || [];
            // keep only reservations that overlap the selected date
            const reservationsForDate = allReservations.filter(r => {
              const start = new Date(r.reservation_start_dt);
              const end = new Date(r.reservation_end_dt);
              return end > dayStart && start < dayEnd;
            });

            return { room, reservationsForDate };
          })
          .catch(err => {
            console.error(`Error loading ${room}:`, err);
            return null;
          })
      )
    ).then(results => {
      setAaccRooms(results.filter(Boolean));
      setLoading(false);
    });
  }, [selectedBuilding, date]);

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('[data-search-container]')) {
        setShowOriginResults(false);
        setShowDestinationResults(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Load room availability data when date changes
  useEffect(() => {
    if (!date) return;
    
    setLoading(true);
    fetch(`/data/${date}.json`)
      .then(res => res.json())
      .then(json => {
        setRoomData(json);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error loading room data:", err);
        setRoomData(null);
        setLoading(false);
      });
  }, [date]);

  // Filter rooms by selected building
  const getFilteredRooms = () => {
    if (!roomData?.subjects || !selectedBuilding) return [];
    
    // Extract building abbreviation from building name
    // e.g., "Bass Library" -> "BASSLB", "Arthur K Watson Hall" -> "AKW"
    const buildingName = selectedBuilding.name.toLowerCase();
    
    // Common building name mappings
    const buildingMap = {
      'bass library': 'BASSLB',
      'bass': 'BASSLB',
      'arthur k watson': 'AKW',
      'watson': 'AKW',
      'dow': 'DOW',
      'sterling': 'SML',
      'memorial library': 'SML',
      'becton': 'BCT',
      'becton center': 'BCT',
    };
    
    // Find matching abbreviation
    let buildingPrefix = null;
    for (const [key, value] of Object.entries(buildingMap)) {
      if (buildingName.includes(key)) {
        buildingPrefix = value;
        break;
      }
    }
    
    // If no mapping found, try to extract first letters from name
    if (!buildingPrefix) {
      buildingPrefix = selectedBuilding.name
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase();
    }
    
    // Filter rooms that start with the building prefix
    return roomData.subjects.filter(room => 
      room.itemName.toUpperCase().startsWith(buildingPrefix)
    );
  };

  // Category definitions
  const categories = {
    'yale-hospitality': {
      name: 'Yale Hospitality',
      icon: '🍽️',
      buildings: [
        'Berkeley College', 'Branford College', 'Davenport College', 'Ezra Stiles College',
        'Grace Hopper College', 'Jonathan Edwards College', 'Morse College', 'Pauli Murray College',
        'Pierson College', 'Saybrook College', 'Silliman College', 'Timothy Dwight College',
        'Trumbull College', 'Benjamin Franklin College', 'Steep Cafe', 'Elm', 'The Ivy',
        'Becton', 'Bow Wow', 'Commons'
      ]
    },
    'student-kitchens': {
      name: 'Student Kitchens',
      icon: '🔪',
      buildings: [
        'Berkeley College', 'Branford College', 'Davenport College', 'Ezra Stiles College',
        'Grace Hopper College', 'Jonathan Edwards College', 'Morse College', 'Pauli Murray College',
        'Pierson College', 'Saybrook College', 'Silliman College', 'Timothy Dwight College',
        'Trumbull College', 'Benjamin Franklin College', '295-297 Crown Street'
      ]
    },
    'study-rooms': {
      name: 'Study Rooms',
      icon: '📚',
      buildings: ['Bass Library', 'Marx Science and Social Science Library', 'William L. Harkness Hall']
    },
    'cultural-centers': {
      name: 'Cultural Centers',
      icon: '🎭',
      buildings: ['295-297 Crown Street', 'Afro-American Cultural Center']
    },
    'academic-buildings': {
      name: 'Academic Buildings',
      icon: '🏛️',
      buildings: [
        'Bass Library', 'Sterling Memorial Library', 'William L. Harkness Hall',
        'Arthur K Watson Hall', 'Luce Hall', 'Sheffield Sterling Strathcona Hall',
        'Yale Science Building', 'Kline Biology Tower', 'Becton Engineering',
        'Dunham Laboratory', 'Environmental Science Center', 'Osborn Memorial Laboratories',
        'Sloane Physics Laboratory', 'Mason Laboratory', 'Humanities Quadrangle'
      ]
    }
  };

  const routeDefinitions = [
    { id: 1, name: "Blue - Weekday Daytime", color: "4472C4", schedule: { days: [1,2,3,4,5], startTime: "7:00", endTime: "18:00" } },
    { id: 2, name: "Orange - Weekday Daytime", color: "ED7D31", schedule: { days: [1,2,3,4,5], startTime: "7:00", endTime: "18:00" } },
    { id: 3, name: "Red - Weekday Daytime", color: "FF0000", schedule: { days: [1,2,3,4,5], startTime: "7:00", endTime: "18:00" } },
    { id: 4, name: "Blue - Weekend Daytime", color: "4472C4", schedule: { days: [0,6], startTime: "7:00", endTime: "18:00" } },
    { id: 6, name: "Weekend Grocery (to Trader Joes)", color: "000000", schedule: { days: [0,6], startTime: "7:00", endTime: "17:00" } },
    { id: 8, name: "Pink - VA Hospital / Med School", color: "DB1AD2", schedule: { days: [1,2,3,4,5], startTime: "6:00", endTime: "18:30" } },
    { id: 9, name: "Green - West Campus", color: "70AD46", schedule: { days: [0,1,2,3,4,5,6], startTime: "5:30", endTime: "18:40" } },
    { id: 10, name: "Purple - West Campus", color: "6F30A1", schedule: { days: [0,1,2,3,4,5,6], startTime: "5:30", endTime: "23:45" } },
    { id: 13, name: "Orange - Night", color: "ED7D31", schedule: { days: [0,1,2,3,4,5,6], startTime: "18:00", endTime: "23:59" } },
    { id: 14, name: "Weekend Grocery (to Hamden)", color: "000000", schedule: { days: [0,6], startTime: "7:00", endTime: "17:00" } },
    { id: 15, name: "Brown Connector", color: "8E664D", schedule: { days: [1,2,3,4,5], startTime: "6:00", endTime: "19:00" } },
    { id: 16, name: "Blue West", color: "3498DB", schedule: { days: [0,1,2,3,4,5,6], startTime: "18:00", endTime: "23:59" } },
    { id: 17, name: "Orange East", color: "ED7D31", schedule: { days: [0,1,2,3,4,5,6], startTime: "18:00", endTime: "23:59" } },
    { id: 18, name: "Gold Route", color: "FFD700", schedule: { days: [1,2,3,4,5], startTime: "8:00", endTime: "18:00" } },
  ];

  const isRouteActive = (route, checkDate, checkTime) => {
    if (!checkDate || !checkTime) return false;
    
    const targetDate = new Date(checkDate);
    const dayOfWeek = targetDate.getDay(); // 0 = Sunday, 6 = Saturday
    
    // Check if route operates on this day
    if (!route.schedule.days.includes(dayOfWeek)) return false;
    
    // Parse time strings to minutes since midnight for comparison
    const timeToMinutes = (timeStr) => {
      const [hours, minutes] = timeStr.split(':').map(Number);
      return hours * 60 + minutes;
    };
    
    const currentMinutes = timeToMinutes(checkTime);
    const startMinutes = timeToMinutes(route.schedule.startTime);
    const endMinutes = timeToMinutes(route.schedule.endTime);
    
    // Handle midnight crossing (e.g., 18:00 - 23:59 means 6pm to midnight)
    if (endMinutes < startMinutes) {
      return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
    }
    
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  };

  const getScheduleText = (route) => {
    const daysMap = {
      '0,1,2,3,4,5,6': 'Daily',
      '1,2,3,4,5': 'M - F',
      '0,6': 'Sat - Sun'
    };
    const daysKey = route.schedule.days.join(',');
    const daysText = daysMap[daysKey] || route.schedule.days.map(d => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]).join(', ');
    
    return `${route.schedule.startTime} - ${route.schedule.endTime === '24:00' ? '12am' : route.schedule.endTime}, ${daysText}`;
  };

  // Separate routes into active and inactive based on selected date/time
  const activeRoutes = routeDefinitions.filter(route => isRouteActive(route, date, time));
  const inactiveRoutes = routeDefinitions.filter(route => !isRouteActive(route, date, time));

  // Track previous date/time to detect changes
  const prevDateTime = useRef({ date, time });

  // Auto-enable all active routes when date/time changes
  useEffect(() => {
    // Only auto-enable if date or time has actually changed
    if (prevDateTime.current.date !== date || prevDateTime.current.time !== time) {
      const newEnabledRoutes = {};
      activeRoutes.forEach(route => {
        newEnabledRoutes[route.id] = true;
      });
      setEnabledRoutes(newEnabledRoutes);
      prevDateTime.current = { date, time };
    }
  }, [date, time, activeRoutes]);

  const toggleRoute = (routeId) => {
    setEnabledRoutes(prev => ({
      ...prev,
      [routeId]: !prev[routeId]
    }));
  };

  const selectAllRoutes = () => {
    const allEnabled = {};
    routeDefinitions.forEach(route => {
      if (route.id !== null && !route.separator) {
        allEnabled[route.id] = true;
      }
    });
    setEnabledRoutes(allEnabled);
  };

  const selectNoneRoutes = () => {
    setEnabledRoutes({});
  };

  const handleCategoryClick = (categoryKey) => {
    if (selectedCategory === categoryKey) {
      // Deselect if clicking the same category
      setSelectedCategory(null);
      setHighlightedBuildings([]);
      setCategoryBuildings([]);
    } else {
      setSelectedCategory(categoryKey);
      const category = categories[categoryKey];
      // Find buildings that match the category
      const matchingBuildings = allBuildings.filter(building =>
        category.buildings.some(catBuilding =>
          building.name.toLowerCase().includes(catBuilding.toLowerCase())
        )
      );
      setHighlightedBuildings(matchingBuildings.map(b => b.id));
      setCategoryBuildings(matchingBuildings);
    }
  };

  // Calculate distance between two lat/lng points (Haversine formula)
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Earth radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  };

  // Calculate route options
  const calculateRoutes = () => {
    if (!origin || !destination) return;

    console.log('Calculating routes from', origin.name, 'to', destination.name);
    console.log('Departure:', departureDate, departureTime);

    // Walking time (assuming 5 km/h = 1.39 m/s)
    const walkingSpeed = 1.39; // meters per second
    const directDistance = calculateDistance(origin.lat, origin.lng, destination.lat, destination.lng);
    const walkingTime = Math.round(directDistance / walkingSpeed / 60); // minutes

    // Find nearest stops to origin and destination
    let nearestOriginStop = null;
    let minOriginDist = Infinity;
    let nearestDestStop = null;
    let minDestDist = Infinity;

    stopsData.forEach(stop => {
      const distToOrigin = calculateDistance(origin.lat, origin.lng, stop.lat, stop.lon);
      const distToDest = calculateDistance(destination.lat, destination.lng, stop.lat, stop.lon);
      
      if (distToOrigin < minOriginDist) {
        minOriginDist = distToOrigin;
        nearestOriginStop = stop;
      }
      if (distToDest < minDestDist) {
        minDestDist = distToDest;
        nearestDestStop = stop;
      }
    });

    console.log('Nearest origin stop:', nearestOriginStop?.name);
    console.log('Nearest dest stop:', nearestDestStop?.name);

    // Walking time to/from stops
    const walkToStopTime = Math.round(minOriginDist / walkingSpeed / 60);
    const walkFromStopTime = Math.round(minDestDist / walkingSpeed / 60);

    // Find which shuttle route connects these stops
    const isStopOnRoute = (stop, routePath, threshold = 75) => {
      // Stricter threshold to ensure stops are actually on the route
      for (let i = 0; i < routePath.length; i += 2) {
        const routeLat = routePath[i];
        const routeLng = routePath[i + 1];
        const distance = calculateDistance(stop.lat, stop.lon, routeLat, routeLng);
        if (distance < threshold) return true;
      }
      return false;
    };

    // Find active routes that serve both stops
    const activeRoutes = routeDefinitions.filter(rd => isRouteActive(rd, departureDate, departureTime));
    let connectingRoute = null;
    let bestMatchDistance = Infinity;
    
    // Try to find the best route that serves both stops
    for (const routeDef of activeRoutes) {
      const routeData = routesData.find(r => r.id === routeDef.id);
      if (routeData) {
        const originOnRoute = isStopOnRoute(nearestOriginStop, routeData.path);
        const destOnRoute = isStopOnRoute(nearestDestStop, routeData.path);
        
        if (originOnRoute && destOnRoute) {
          // Find the closest points on the route to each stop
          let minOriginDist = Infinity;
          let minDestDist = Infinity;
          let originIndex = -1;
          let destIndex = -1;
          
          for (let i = 0; i < routeData.path.length; i += 2) {
            const distToOrigin = calculateDistance(nearestOriginStop.lat, nearestOriginStop.lon, routeData.path[i], routeData.path[i + 1]);
            const distToDest = calculateDistance(nearestDestStop.lat, nearestDestStop.lon, routeData.path[i], routeData.path[i + 1]);
            
            if (distToOrigin < minOriginDist) {
              minOriginDist = distToOrigin;
              originIndex = i;
            }
            if (distToDest < minDestDist) {
              minDestDist = distToDest;
              destIndex = i;
            }
          }
          
          // Make sure the destination comes after the origin on the route path
          if (originIndex < destIndex && (minOriginDist + minDestDist) < bestMatchDistance) {
            bestMatchDistance = minOriginDist + minDestDist;
            connectingRoute = { ...routeDef, short_name: routeData.short_name };
          }
        }
      }
    }

    // Calculate shuttle option
    let shuttleOption = null;
    if (connectingRoute) {
      // Estimate shuttle distance (straight line between stops)
      const shuttleDistance = calculateDistance(
        nearestOriginStop.lat, nearestOriginStop.lon,
        nearestDestStop.lat, nearestDestStop.lon
      );

      // Estimate shuttle time (average speed ~15 km/h = 4.17 m/s)
      const shuttleSpeed = 4.17;
      const shuttleTime = Math.round(shuttleDistance / shuttleSpeed / 60);

      // Average wait time for shuttle (5-10 minutes)
      const waitTime = 7;

      const totalShuttleTime = walkToStopTime + waitTime + shuttleTime + walkFromStopTime;

      shuttleOption = {
        totalTime: totalShuttleTime,
        walkToStop: walkToStopTime,
        waitTime: waitTime,
        rideTime: shuttleTime,
        walkFromStop: walkFromStopTime,
        originStop: nearestOriginStop,
        destStop: nearestDestStop,
        distance: Math.round(shuttleDistance),
        route: connectingRoute,
        path: [
          [origin.lat, origin.lng],
          [nearestOriginStop.lat, nearestOriginStop.lon],
          [nearestDestStop.lat, nearestDestStop.lon],
          [destination.lat, destination.lng]
        ]
      };
    }

    setRouteResults({
      walking: {
        time: walkingTime,
        distance: Math.round(directDistance),
        path: [[origin.lat, origin.lng], [destination.lat, destination.lng]]
      },
      shuttle: shuttleOption
    });
    setSelectedRouteOption(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", width: "100vw" }}>
      {/* TOP: Category buttons */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "12px 16px",
        backgroundColor: "white",
        borderBottom: "1px solid #e0e0e0",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        zIndex: 1001,
      }}>
        {Object.entries(categories).map(([key, category]) => (
          <button
            key={key}
            onClick={() => handleCategoryClick(key)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 16px",
              backgroundColor: selectedCategory === key ? "#1a73e8" : "white",
              color: selectedCategory === key ? "white" : "#5f6368",
              border: `1px solid ${selectedCategory === key ? "#1a73e8" : "#dadce0"}`,
              borderRadius: "20px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "500",
              transition: "all 0.2s",
              whiteSpace: "nowrap",
            }}
          >
            <span>{category.icon}</span>
            <span>{category.name}</span>
          </button>
        ))}
      </div>

      {/* MAIN: Map and sidebar */}
      <div style={{ display: "flex", flex: 1, position: "relative" }}>
        {/* Category buildings list sidebar */}
        {selectedCategory && categoryBuildings.length > 0 && (
          <div style={{
            width: "350px",
            backgroundColor: "white",
            borderRight: "1px solid #e0e0e0",
            overflowY: "auto",
            zIndex: 1000,
          }}>
            <div style={{
              padding: "16px",
              borderBottom: "1px solid #e0e0e0",
              position: "sticky",
              top: 0,
              backgroundColor: "white",
              zIndex: 1,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "600" }}>
                  {categories[selectedCategory].name}
                </h3>
                <button
                  onClick={() => {
                    setSelectedCategory(null);
                    setCategoryBuildings([]);
                    setHighlightedBuildings([]);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: "24px",
                    cursor: "pointer",
                    color: "#666",
                    padding: "0",
                  }}
                >
                  ×
                </button>
              </div>
              <p style={{ margin: "4px 0 0 0", fontSize: "14px", color: "#5f6368" }}>
                {categoryBuildings.length} {categoryBuildings.length === 1 ? 'location' : 'locations'}
              </p>
            </div>
            <div>
              {categoryBuildings.map((building) => {
                const roomCount = roomData ? getFilteredRooms().filter(room => 
                  room.itemName.toLowerCase().includes(building.name.split(' ')[0].toLowerCase())
                ).length : 0;
                
                return (
                  <div
                    key={building.id}
                    onClick={() => setSelectedBuilding(building)}
                    style={{
                      padding: "16px",
                      borderBottom: "1px solid #e0e0e0",
                      cursor: "pointer",
                      backgroundColor: selectedBuilding?.id === building.id ? "#f0f7ff" : "white",
                      transition: "background-color 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      if (selectedBuilding?.id !== building.id) {
                        e.currentTarget.style.backgroundColor = "#f8f9fa";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedBuilding?.id !== building.id) {
                        e.currentTarget.style.backgroundColor = "white";
                      }
                    }}
                  >
                    <div style={{ fontSize: "16px", fontWeight: "500", color: "#202124", marginBottom: "4px" }}>
                      {building.name}
                    </div>
                    {roomData && roomCount > 0 && (
                      <div style={{ fontSize: "13px", color: "#5f6368" }}>
                        {roomCount} {roomCount === 1 ? 'room' : 'rooms'} available
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Building details panel when category is selected */}
        {selectedBuilding && selectedCategory && (
          <div style={{
            width: "400px",
            backgroundColor: "white",
            borderRight: "1px solid #e0e0e0",
            overflowY: "auto",
            zIndex: 999,
          }}>
            <div style={{ padding: "16px" }}>
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "start",
                marginBottom: "12px"
              }}>
                <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "600" }}>
                  {selectedBuilding.name}
                </h2>
                <button
                  onClick={() => setSelectedBuilding(null)}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: "24px",
                    cursor: "pointer",
                    padding: "0",
                    color: "#666"
                  }}
                >
                  ×
                </button>
              </div>
              <p style={{ margin: "4px 0", fontSize: "14px", color: "#666" }}>
                <strong>ID:</strong> {selectedBuilding.id}
              </p>

              <div style={{ marginTop: "16px", marginBottom: "16px" }}>
                <label style={{ display: "block", marginBottom: "8px" }}>
                  <span style={{ fontSize: "14px", fontWeight: "500", color: "#333" }}>Date</span>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    style={{
                      display: "block",
                      width: "100%",
                      padding: "8px",
                      marginTop: "4px",
                      border: "1px solid #dadce0",
                      borderRadius: "4px",
                      fontSize: "14px"
                    }}
                  />
                </label>

                <label style={{ display: "block", marginBottom: "8px" }}>
                  <span style={{ fontSize: "14px", fontWeight: "500", color: "#333" }}>Time</span>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    style={{
                      display: "block",
                      width: "100%",
                      padding: "8px",
                      marginTop: "4px",
                      border: "1px solid #dadce0",
                      borderRadius: "4px",
                      fontSize: "14px"
                    }}
                  />
                </label>

                <button
                  onClick={() => {
                    const now = new Date();
                    const year = now.getFullYear();
                    const month = (now.getMonth() + 1).toString().padStart(2, '0');
                    const day = now.getDate().toString().padStart(2, '0');
                    const hours = now.getHours().toString().padStart(2, '0');
                    const minutes = now.getMinutes().toString().padStart(2, '0');
                    setDate(`${year}-${month}-${day}`);
                    setTime(`${hours}:${minutes}`);
                  }}
                  style={{
                    padding: "8px 16px",
                    background: "#1a73e8",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: "500"
                  }}
                >
                  Now
                </button>
              </div>

              <div style={{ borderTop: "1px solid #e0e0e0", marginTop: "16px", paddingTop: "16px" }}>
                <h3 style={{ fontSize: "16px", fontWeight: "600", margin: "0 0 12px 0" }}>Room Availability</h3>

                {loading ? (
                  <p style={{ color: "#666", fontSize: "14px" }}>Loading availability...</p>
                ) : aaccRooms.length > 0 ? (
                  <div style={{ maxHeight: "50vh", overflowY: "auto" }}>
                    {aaccRooms.map(({ room, data }) => {
                      const roomNumber = room.replace('aacc', '');
                      const reservations = data.space_reservations?.space_reservation || [];
                      
                      return (
                        <div
                          key={room}
                          style={{
                            border: "1px solid #e0e0e0",
                            borderRadius: "4px",
                            padding: "12px",
                            marginBottom: "8px",
                            background: "#f9f9f9",
                          }}
                        >
                          <div style={{ 
                            fontSize: "16px", 
                            marginBottom: "8px",
                            color: "#333",
                            fontWeight: "600"
                          }}>
                            Room {roomNumber}
                          </div>
                          
                          {reservations.length > 0 ? (
                            reservations.map((res, i) => {
                              const startDate = new Date(res.event_start);
                              const endDate = new Date(res.event_end);
                              const startTime = startDate.toLocaleTimeString('en-US', { 
                                hour: 'numeric', 
                                minute: '2-digit',
                                hour12: true 
                              });
                              const endTime = endDate.toLocaleTimeString('en-US', { 
                                hour: 'numeric', 
                                minute: '2-digit',
                                hour12: true 
                              });
                              
                              return (
                                <div
                                  key={i}
                                  style={{
                                    fontSize: "13px",
                                    padding: "6px 0",
                                    borderTop: i > 0 ? "1px solid #e0e0e0" : "none",
                                    paddingTop: i > 0 ? "6px" : "0",
                                  }}
                                >
                                  <div style={{ color: "#d9534f", fontWeight: "500" }}>
                                    Reserved
                                  </div>
                                  <div style={{ color: "#666" }}>
                                    {startTime} → {endTime}
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <div style={{ color: "#5cb85c", fontSize: "14px", marginTop: "4px" }}>
                              ✓ No reservations
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : !roomData ? (
                  <p style={{ color: "#999", fontSize: "14px" }}>No availability data for this date.</p>
                ) : (
                  <div style={{ maxHeight: "50vh", overflowY: "auto" }}>
                    {(() => {
                      const filteredRooms = getFilteredRooms();
                      return filteredRooms.length > 0 ? (
                        filteredRooms.map((room) => (
                          <div
                            key={room.itemId}
                            style={{
                              border: "1px solid #e0e0e0",
                              borderRadius: "4px",
                              padding: "12px",
                              marginBottom: "8px",
                              background: "#f9f9f9",
                            }}
                          >
                            <div style={{ 
                              fontSize: "16px", 
                              marginBottom: "8px",
                              color: "#333",
                              fontWeight: "600"
                            }}>
                              {room.itemName}
                            </div>
                            
                            {room.items && room.items.length > 0 ? (
                              <div style={{ marginTop: "8px" }}>
                                {room.items.map((event, i) => {
                                  const startHour = Math.floor(event.start);
                                  const startMin = Math.round((event.start - startHour) * 60);
                                  const endHour = Math.floor(event.end);
                                  const endMin = Math.round((event.end - endHour) * 60);
                                  
                                  const startTime = `${startHour}:${startMin.toString().padStart(2, '0')}`;
                                  const endTime = `${endHour === 24 ? 0 : endHour}:${endMin.toString().padStart(2, '0')}`;
                                  
                                  return (
                                    <div
                                      key={i}
                                      style={{
                                        fontSize: "13px",
                                        padding: "6px 0",
                                        borderTop: i > 0 ? "1px solid #e0e0e0" : "none",
                                        paddingTop: i > 0 ? "6px" : "0",
                                      }}
                                    >
                                      <div style={{ color: "#d9534f", fontWeight: "500" }}>
                                        {event.itemName}
                                      </div>
                                      <div style={{ color: "#666" }}>
                                        {startTime} → {endTime}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div style={{ color: "#5cb85c", fontSize: "14px", marginTop: "4px" }}>
                                ✓ Available all day
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <p style={{ color: "#999", fontSize: "14px" }}>No rooms found for this building.</p>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Map */}
        <div style={{ flex: 1, position: "relative" }}>
          <CampusMap
            selectedBuildingId={selectedBuilding?.id}
            onSelectBuilding={setSelectedBuilding}
            onBuildingsLoaded={setAllBuildings}
            enabledRoutes={enabledRoutes}
            highlightedBuildings={highlightedBuildings}
            routeSchedules={routeDefinitions}
            currentTime={new Date(`${date}T${time}`)}
            directionPath={selectedRouteOption && routeResults ? routeResults[selectedRouteOption].path : null}
            directionType={selectedRouteOption}
            shuttleRouteColor={selectedRouteOption === 'shuttle' && routeResults?.shuttle?.route ? `#${routeResults.shuttle.route.color}` : null}
          />

          {/* Search bar - top left */}
          <div style={{
            position: "absolute",
            top: "16px",
            left: "16px",
            zIndex: 1000,
            width: "400px",
            backgroundColor: "white",
            borderRadius: "8px",
            boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
          }}>
            <SearchBar
              buildings={allBuildings}
              onSelect={(b) => setSelectedBuilding(b)}
            />
          </div>

          {/* Directions Button - below search */}
          <button
            onClick={() => {
              setShowRoutePlanner(!showRoutePlanner);
              setRouteResults(null);
            }}
            style={{
              position: "absolute",
              top: "80px",
              left: "16px",
              zIndex: 1000,
              backgroundColor: "white",
              border: "2px solid #1a73e8",
              borderRadius: "8px",
              padding: "10px 16px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600",
              boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
              color: "#000000",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            🚶→🚍 Get Directions
          </button>

          {/* Route Toggle Button - bottom left */}
          <button
            onClick={() => setShowRouteSidebar(!showRouteSidebar)}
            style={{
              position: "absolute",
              bottom: "20px",
              left: "20px",
              zIndex: 1000,
              backgroundColor: "white",
              border: "2px solid #ccc",
              borderRadius: "4px",
              padding: "8px 12px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600",
              boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
            }}
          >
            🚍 Routes
          </button>

        {/* Route Sidebar */}
        {showRouteSidebar && (
          <div
            style={{
              position: "absolute",
              bottom: "70px",
              left: "20px",
              zIndex: 1000,
              backgroundColor: "white",
              border: "2px solid #ccc",
              borderRadius: "8px",
              width: "300px",
              maxHeight: "70vh",
              overflowY: "auto",
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
              fontFamily: "system-ui, sans-serif",
            }}
          >
            <div style={{ padding: "8px 12px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "600" }}>
                Select Routes
              </h3>
              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  onClick={selectAllRoutes}
                  style={{
                    padding: "3px 8px",
                    fontSize: "11px",
                    backgroundColor: "#2563eb",
                    color: "white",
                    border: "none",
                    borderRadius: "3px",
                    cursor: "pointer",
                    fontWeight: "600",
                  }}
                >
                  All
                </button>
                <button
                  onClick={selectNoneRoutes}
                  style={{
                    padding: "3px 8px",
                    fontSize: "11px",
                    backgroundColor: "#ccc",
                    color: "#333",
                    border: "none",
                    borderRadius: "3px",
                    cursor: "pointer",
                    fontWeight: "600",
                  }}
                >
                  None
                </button>
              </div>
            </div>
            <div style={{ padding: "4px" }}>
              {/* Active Routes Section */}
              {activeRoutes.length > 0 && (
                <>
                  <div
                    style={{
                      borderTop: "1px solid #ddd",
                      margin: "4px 0",
                      padding: "3px 6px",
                      fontSize: "10px",
                      color: "#22c55e",
                      fontWeight: "600",
                      textTransform: "uppercase",
                    }}
                  >
                    ACTIVE
                  </div>
                  {activeRoutes.map((route) => (
                    <div
                      key={route.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        padding: "6px",
                        borderRadius: "3px",
                        cursor: "pointer",
                        backgroundColor: enabledRoutes[route.id] ? "#f0f8ff" : "transparent",
                      }}
                      onClick={() => toggleRoute(route.id)}
                    >
                      <div
                        style={{
                          width: "10px",
                          height: "10px",
                          borderRadius: "50%",
                          backgroundColor: route.color,
                          marginRight: "8px",
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "12px", fontWeight: "500", color: "#333" }}>
                          {route.name}
                        </div>
                        <div style={{ fontSize: "10px", color: "#666", marginTop: "1px" }}>
                          {getScheduleText(route)}
                        </div>
                      </div>
                      <div
                        style={{
                          width: "36px",
                          height: "20px",
                          borderRadius: "10px",
                          backgroundColor: enabledRoutes[route.id] ? "#2563eb" : "#ccc",
                          position: "relative",
                          transition: "background-color 0.2s",
                          marginLeft: "6px",
                        }}
                      >
                        <div
                          style={{
                            width: "16px",
                            height: "16px",
                            borderRadius: "50%",
                            backgroundColor: "white",
                            position: "absolute",
                            top: "2px",
                            left: enabledRoutes[route.id] ? "18px" : "2px",
                            transition: "left 0.2s",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </>
              )}
              
              {/* Inactive Routes Section */}
              {inactiveRoutes.length > 0 && (
                <>
                  <div
                    style={{
                      borderTop: "1px solid #ddd",
                      margin: "4px 0",
                      padding: "3px 6px",
                      fontSize: "10px",
                      color: "#999",
                      fontWeight: "600",
                      textTransform: "uppercase",
                    }}
                  >
                    INACTIVE
                  </div>
                  {inactiveRoutes.map((route) => (
                    <div
                      key={route.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        padding: "6px",
                        borderRadius: "3px",
                        cursor: "pointer",
                        backgroundColor: enabledRoutes[route.id] ? "#f0f8ff" : "transparent",
                        opacity: 0.6,
                      }}
                      onClick={() => toggleRoute(route.id)}
                    >
                      <div
                        style={{
                          width: "10px",
                          height: "10px",
                          borderRadius: "50%",
                          backgroundColor: route.color,
                          marginRight: "8px",
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "12px", fontWeight: "500", color: "#333" }}>
                          {route.name}
                        </div>
                        <div style={{ fontSize: "10px", color: "#666", marginTop: "1px" }}>
                          {getScheduleText(route)}
                        </div>
                      </div>
                      <div
                        style={{
                          width: "36px",
                          height: "20px",
                          borderRadius: "10px",
                          backgroundColor: enabledRoutes[route.id] ? "#2563eb" : "#ccc",
                          position: "relative",
                          transition: "background-color 0.2s",
                          marginLeft: "6px",
                        }}
                      >
                        <div
                          style={{
                            width: "16px",
                            height: "16px",
                            borderRadius: "50%",
                            backgroundColor: "white",
                            position: "absolute",
                            top: "2px",
                            left: enabledRoutes[route.id] ? "18px" : "2px",
                            transition: "left 0.2s",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </>
              )}
              
              {/* Inactive Routes Section */}
              {inactiveRoutes.length > 0 && (
                <>
                  <div
                    style={{
                      borderTop: "1px solid #ddd",
                      margin: "4px 0",
                      padding: "3px 6px",
                      fontSize: "10px",
                      color: "#999",
                      fontWeight: "600",
                      textTransform: "uppercase",
                    }}
                  >
                    INACTIVE
                  </div>
                  {inactiveRoutes.map((route) => (
                    <div
                      key={route.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        padding: "6px",
                        borderRadius: "3px",
                        cursor: "pointer",
                        backgroundColor: enabledRoutes[route.id] ? "#f0f8ff" : "transparent",
                        opacity: 0.6,
                      }}
                      onClick={() => toggleRoute(route.id)}
                    >
                      <div
                        style={{
                          width: "10px",
                          height: "10px",
                          borderRadius: "50%",
                          backgroundColor: route.color,
                          marginRight: "8px",
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "12px", fontWeight: "500", color: "#333" }}>
                          {route.name}
                        </div>
                        <div style={{ fontSize: "10px", color: "#666", marginTop: "1px" }}>
                          {getScheduleText(route)}
                        </div>
                      </div>
                    <div
                      style={{
                        width: "36px",
                        height: "20px",
                        borderRadius: "10px",
                        backgroundColor: enabledRoutes[route.id] ? "#2563eb" : "#ccc",
                        position: "relative",
                        transition: "background-color 0.2s",
                        marginLeft: "6px",
                      }}
                    >
                      <div
                        style={{
                          width: "16px",
                          height: "16px",
                          borderRadius: "50%",
                          backgroundColor: "white",
                          position: "absolute",
                          top: "2px",
                          left: enabledRoutes[route.id] ? "18px" : "2px",
                          transition: "left 0.2s",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                        }}
                      />
                    </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        )}
      </div>

        {/* Building details panel - left side popup or right side if category sidebar is open */}
        {selectedBuilding && !selectedCategory && (
          <div
            style={{
              position: "absolute",
              top: "80px",
              left: "16px",
              zIndex: 1000,
              width: "400px",
              maxHeight: "calc(100vh - 120px)",
              backgroundColor: "white",
              borderRadius: "8px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
              overflowY: "auto",
              fontFamily: "system-ui, sans-serif",
            }}
          >
            <div style={{ padding: "16px" }}>
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "start",
                marginBottom: "12px"
              }}>
                <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "600" }}>
                  {selectedBuilding.name}
                </h2>
                <button
                  onClick={() => setSelectedBuilding(null)}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: "24px",
                    cursor: "pointer",
                    padding: "0",
                    color: "#666"
                  }}
                >
                  ×
                </button>
              </div>
              <p style={{ margin: "4px 0", fontSize: "14px", color: "#666" }}>
                <strong>ID:</strong> {selectedBuilding.id}
              </p>

            <div style={{ marginTop: "16px", marginBottom: "16px" }}>
              <label style={{ display: "block", marginBottom: "8px" }}>
                <span style={{ fontSize: "14px", fontWeight: "500", color: "#333" }}>Date</span>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  style={{
                    display: "block",
                    width: "100%",
                    padding: "8px",
                    marginTop: "4px",
                    border: "1px solid #dadce0",
                    borderRadius: "4px",
                    fontSize: "14px"
                  }}
                />
              </label>

              <label style={{ display: "block", marginBottom: "8px" }}>
                <span style={{ fontSize: "14px", fontWeight: "500", color: "#333" }}>Time</span>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  style={{
                    display: "block",
                    width: "100%",
                    padding: "8px",
                    marginTop: "4px",
                    border: "1px solid #dadce0",
                    borderRadius: "4px",
                    fontSize: "14px"
                  }}
                />
              </label>

              <button
                onClick={() => {
                  const now = new Date();
                  const year = now.getFullYear();
                  const month = (now.getMonth() + 1).toString().padStart(2, '0');
                  const day = now.getDate().toString().padStart(2, '0');
                  const hours = now.getHours().toString().padStart(2, '0');
                  const minutes = now.getMinutes().toString().padStart(2, '0');
                  setDate(`${year}-${month}-${day}`);
                  setTime(`${hours}:${minutes}`);
                }}
                style={{
                  padding: "8px 16px",
                  background: "#1a73e8",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "500"
                }}
              >
                Now
              </button>
            </div>

            <div style={{ borderTop: "1px solid #e0e0e0", marginTop: "16px", paddingTop: "16px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: "600", margin: "0 0 12px 0" }}>Room Availability</h3>

            
            {loading ? (
              <p style={{ color: "#666", fontSize: "14px" }}>Loading availability...</p>
            ) : aaccRooms.length > 0 ? (
              // Display AACC rooms
              <div style={{ maxHeight: "50vh", overflowY: "auto" }}>
                {aaccRooms.map(({ room, data }) => {
                  const roomNumber = room.replace('aacc', '');
                  const reservations = data.space_reservations?.space_reservation || [];
                  
                  return (
                    <div
                      key={room}
                      style={{
                        border: "1px solid #ddd",
                        borderRadius: "4px",
                        padding: "0.75rem",
                        marginBottom: "0.5rem",
                        background: "#f9f9f9",
                      }}
                    >
                      <div style={{ 
                        fontSize: "1.1em", 
                        marginBottom: "0.5rem",
                        color: "#333",
                        fontWeight: "600"
                      }}>
                        Room {roomNumber}
                      </div>
                      
                      {reservations.length > 0 ? (
                        <div style={{ marginTop: "0.5rem" }}>
                          {reservations.slice(0, 5).map((reservation, i) => {
                            const startDate = new Date(reservation.reservation_start_dt);
                            const endDate = new Date(reservation.reservation_end_dt);
                            const eventName = reservation.event?.event_name || 'Reserved';
                            
                            return (
                              <div
                                key={i}
                                style={{
                                  fontSize: "0.85em",
                                  padding: "0.25rem 0",
                                  borderTop: i > 0 ? "1px solid #eee" : "none",
                                  paddingTop: i > 0 ? "0.25rem" : "0",
                                }}
                              >
                                <div style={{ color: "#d9534f", fontWeight: "500" }}>
                                  {eventName}
                                </div>
                                <div style={{ color: "#666", fontSize: "0.9em" }}>
                                  {startDate.toLocaleDateString()} {startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} → {endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              </div>
                            );
                          })}
                          {reservations.length > 5 && (
                            <div style={{ fontSize: "0.8em", color: "#999", marginTop: "0.5rem" }}>
                              +{reservations.length - 5} more reservations
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ color: "#5cb85c", fontSize: "0.9em", marginTop: "0.25rem" }}>
                          ✓ No reservations
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : !roomData ? (
              <p style={{ color: "#999" }}>No availability data for this date.</p>
            ) : (
              <div style={{ maxHeight: "50vh", overflowY: "auto" }}>
                {(() => {
                  const filteredRooms = getFilteredRooms();
                  return filteredRooms.length > 0 ? (
                    filteredRooms.map((room) => (
                    <div
                      key={room.itemId}
                      style={{
                        border: "1px solid #ddd",
                        borderRadius: "4px",
                        padding: "0.75rem",
                        marginBottom: "0.5rem",
                        background: "#f9f9f9",
                      }}
                    >
                      <div style={{ 
                        fontSize: "1.1em", 
                        marginBottom: "0.5rem",
                        color: "#333",
                        fontWeight: "600"
                      }}>
                        {room.itemName}
                      </div>
                      
                      {room.items && room.items.length > 0 ? (
                        <div style={{ marginTop: "0.5rem" }}>
                          {room.items.map((event, i) => {
                            // Convert decimal time to readable format
                            const startHour = Math.floor(event.start);
                            const startMin = Math.round((event.start - startHour) * 60);
                            const endHour = Math.floor(event.end);
                            const endMin = Math.round((event.end - endHour) * 60);
                            
                            const startTime = `${startHour}:${startMin.toString().padStart(2, '0')}`;
                            const endTime = `${endHour === 24 ? 0 : endHour}:${endMin.toString().padStart(2, '0')}`;
                            
                            return (
                              <div
                                key={i}
                                style={{
                                  fontSize: "0.85em",
                                  padding: "0.25rem 0",
                                  borderTop: i > 0 ? "1px solid #eee" : "none",
                                  paddingTop: i > 0 ? "0.25rem" : "0",
                                }}
                              >
                                <div style={{ color: "#d9534f", fontWeight: "500" }}>
                                  {event.itemName}
                                </div>
                                <div style={{ color: "#666" }}>
                                  {startTime} → {endTime}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{ color: "#5cb85c", fontSize: "0.9em", marginTop: "0.25rem" }}>
                          ✓ Available all day
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <p style={{ color: "#999" }}>No rooms found for this building.</p>
                );
                })()}
              </div>
            )}
            </div>
            </div>
          </div>
        )}

        {/* Route Planner Panel */}
        {showRoutePlanner && (
          <div
            style={{
              position: "absolute",
              top: "130px",
              left: selectedCategory && categoryBuildings.length > 0 ? "366px" : "16px",
              zIndex: 1000,
              width: "400px",
              maxHeight: "calc(100vh - 160px)",
              backgroundColor: "white",
              borderRadius: "8px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
              overflowY: "auto",
              fontFamily: "system-ui, sans-serif",
            }}
          >
            <div style={{ padding: "16px" }}>
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "16px"
              }}>
                <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "600", color: "#000000" }}>
                  Get Directions
                </h2>
                <button
                  onClick={() => {
                    setShowRoutePlanner(false);
                    setOrigin(null);
                    setDestination(null);
                    setRouteResults(null);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: "24px",
                    cursor: "pointer",
                    padding: "0",
                    color: "#666"
                  }}
                >
                  ×
                </button>
              </div>

              {/* When to Leave Section */}
              <div style={{ marginBottom: "16px", padding: "12px", backgroundColor: "#f8f9fa", borderRadius: "8px" }}>
                <div style={{ fontSize: "14px", fontWeight: "600", color: "#333", marginBottom: "8px" }}>
                  When to Leave
                </div>
                <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                  <div style={{ flex: 1 }}>
                    <input
                      type="date"
                      value={departureDate}
                      onChange={(e) => setDepartureDate(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px",
                        border: "1px solid #dadce0",
                        borderRadius: "4px",
                        fontSize: "13px",
                        backgroundColor: "white",
                        color: "#202124"
                      }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <input
                      type="time"
                      value={departureTime}
                      onChange={(e) => setDepartureTime(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px",
                        border: "1px solid #dadce0",
                        borderRadius: "4px",
                        fontSize: "13px",
                        backgroundColor: "white",
                        color: "#202124"
                      }}
                    />
                  </div>
                </div>
                <button
                  onClick={() => {
                    const now = new Date();
                    setDepartureDate(`${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`);
                    setDepartureTime(`${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`);
                  }}
                  style={{
                    padding: "6px 12px",
                    backgroundColor: "white",
                    color: "#1a73e8",
                    border: "1px solid #1a73e8",
                    borderRadius: "4px",
                    fontSize: "13px",
                    fontWeight: "500",
                    cursor: "pointer"
                  }}
                >
                  Now
                </button>
              </div>

              {/* Origin Input */}
              <div data-search-container style={{ marginBottom: "12px", position: "relative" }}>
                <label style={{ fontSize: "14px", fontWeight: "500", color: "#333", display: "block", marginBottom: "4px" }}>
                  Starting Point
                </label>
                <input
                  type="text"
                  placeholder="Search for a building or bus stop..."
                  value={origin ? origin.name : originSearch}
                  onChange={(e) => {
                    setOriginSearch(e.target.value);
                    setOrigin(null);
                    setShowOriginResults(true);
                    setRouteResults(null);
                  }}
                  onFocus={() => setShowOriginResults(true)}
                  style={{
                    width: "100%",
                    padding: "10px",
                    border: "1px solid #dadce0",
                    borderRadius: "4px",
                    fontSize: "14px",
                    backgroundColor: "white",
                    color: "#202124"
                  }}
                />
                {showOriginResults && filteredOriginLocations.length > 0 && !origin && (
                  <div style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    right: 0,
                    backgroundColor: "white",
                    border: "1px solid #dadce0",
                    borderTop: "none",
                    borderRadius: "0 0 4px 4px",
                    maxHeight: "200px",
                    overflowY: "auto",
                    zIndex: 1000,
                    boxShadow: "0 2px 6px rgba(0,0,0,0.1)"
                  }}>
                    {filteredOriginLocations.map((loc, idx) => (
                      <div
                        key={`${loc.type}-${loc.id}`}
                        onClick={() => {
                          setOrigin({ lat: loc.lat, lng: loc.lng, name: loc.name });
                          setOriginSearch("");
                          setShowOriginResults(false);
                          setRouteResults(null);
                        }}
                        style={{
                          padding: "10px",
                          cursor: "pointer",
                          borderBottom: idx < filteredOriginLocations.length - 1 ? "1px solid #f0f0f0" : "none",
                          backgroundColor: "white",
                          fontSize: "14px",
                          color: "#202124"
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#f1f3f4"}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "white"}
                      >
                        <div style={{ fontWeight: "500" }}>{loc.name}</div>
                        <div style={{ fontSize: "12px", color: "#5f6368", marginTop: "2px" }}>
                          {loc.type === 'stop' ? '🚌 Bus Stop' : '🏢 Building'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Destination Input */}
              <div data-search-container style={{ marginBottom: "16px", position: "relative" }}>
                <label style={{ fontSize: "14px", fontWeight: "500", color: "#333", display: "block", marginBottom: "4px" }}>
                  Destination
                </label>
                <input
                  type="text"
                  placeholder="Search for a building or bus stop..."
                  value={destination ? destination.name : destinationSearch}
                  onChange={(e) => {
                    setDestinationSearch(e.target.value);
                    setDestination(null);
                    setShowDestinationResults(true);
                    setRouteResults(null);
                  }}
                  onFocus={() => setShowDestinationResults(true)}
                  style={{
                    width: "100%",
                    padding: "10px",
                    border: "1px solid #dadce0",
                    borderRadius: "4px",
                    fontSize: "14px",
                    backgroundColor: "white",
                    color: "#202124"
                  }}
                />
                {showDestinationResults && filteredDestinationLocations.length > 0 && !destination && (
                  <div style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    right: 0,
                    backgroundColor: "white",
                    border: "1px solid #dadce0",
                    borderTop: "none",
                    borderRadius: "0 0 4px 4px",
                    maxHeight: "200px",
                    overflowY: "auto",
                    zIndex: 1000,
                    boxShadow: "0 2px 6px rgba(0,0,0,0.1)"
                  }}>
                    {filteredDestinationLocations.map((loc, idx) => (
                      <div
                        key={`${loc.type}-${loc.id}`}
                        onClick={() => {
                          setDestination({ lat: loc.lat, lng: loc.lng, name: loc.name });
                          setDestinationSearch("");
                          setShowDestinationResults(false);
                          setRouteResults(null);
                        }}
                        style={{
                          padding: "10px",
                          cursor: "pointer",
                          borderBottom: idx < filteredDestinationLocations.length - 1 ? "1px solid #f0f0f0" : "none",
                          backgroundColor: "white",
                          fontSize: "14px",
                          color: "#202124"
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#f1f3f4"}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "white"}
                      >
                        <div style={{ fontWeight: "500" }}>{loc.name}</div>
                        <div style={{ fontSize: "12px", color: "#5f6368", marginTop: "2px" }}>
                          {loc.type === 'stop' ? '🚌 Bus Stop' : '🏢 Building'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Calculate Button */}
              <button
                onClick={calculateRoutes}
                disabled={!origin || !destination}
                style={{
                  width: "100%",
                  padding: "12px",
                  backgroundColor: (!origin || !destination) ? "#ccc" : "#1a73e8",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  fontSize: "16px",
                  fontWeight: "600",
                  cursor: (!origin || !destination) ? "not-allowed" : "pointer",
                  marginBottom: "16px"
                }}
              >
                Get Directions
              </button>

              {/* Results */}
              {routeResults && (
                <div>
                  <div style={{ borderTop: "1px solid #e0e0e0", paddingTop: "16px" }}>
                    {/* Walking Option */}
                    <div 
                      onClick={() => {
                        setSelectedRouteOption('walking');
                        // Disable all shuttle routes when showing walking
                        setEnabledRoutes({});
                      }}
                      style={{
                        border: selectedRouteOption === 'walking' ? "2px solid #1a73e8" : "2px solid #e0e0e0",
                        borderRadius: "8px",
                        padding: "16px",
                        marginBottom: "12px",
                        backgroundColor: selectedRouteOption === 'walking' ? "#f0f7ff" : "#f8f9fa",
                        cursor: "pointer",
                        transition: "all 0.2s"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                        <span style={{ fontSize: "24px" }}>🚶</span>
                        <div>
                          <div style={{ fontSize: "18px", fontWeight: "600", color: "#202124" }}>
                            {routeResults.walking.time} min
                          </div>
                          <div style={{ fontSize: "12px", color: "#5f6368" }}>
                            Walking • {(routeResults.walking.distance * 0.000621371).toFixed(2)} mi
                          </div>
                        </div>
                      </div>
                      <div style={{ fontSize: "13px", color: "#5f6368" }}>
                        Direct walk to destination
                      </div>
                    </div>

                    {/* Shuttle Option - only show if available */}
                    {routeResults.shuttle && (
                      <div 
                        onClick={() => {
                          setSelectedRouteOption('shuttle');
                          // Enable the shuttle route on the map
                          setEnabledRoutes({ [routeResults.shuttle.route.id]: true });
                        }}
                        style={{
                          border: selectedRouteOption === 'shuttle' ? "2px solid #1a73e8" : "2px solid #e0e0e0",
                          borderRadius: "8px",
                          padding: "16px",
                          backgroundColor: selectedRouteOption === 'shuttle' ? "#f0f7ff" : "#f8f9fa",
                          cursor: "pointer",
                          transition: "all 0.2s"
                        }}
                      >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                        <span style={{ fontSize: "24px" }}>🚍</span>
                        <div>
                          <div style={{ fontSize: "18px", fontWeight: "600", color: "#202124" }}>
                            {routeResults.shuttle.totalTime} min
                          </div>
                          <div style={{ fontSize: "12px", color: "#5f6368" }}>
                            Walk + Yuttle + Walk
                          </div>
                        </div>
                      </div>

                      {/* Step by step */}
                      <div style={{ fontSize: "13px", color: "#5f6368", marginLeft: "8px" }}>
                        <div style={{ marginBottom: "8px", display: "flex", alignItems: "start", gap: "8px" }}>
                          <div style={{ 
                            width: "20px", 
                            height: "20px", 
                            backgroundColor: "#34a853", 
                            borderRadius: "50%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "white",
                            fontSize: "12px",
                            fontWeight: "bold",
                            flexShrink: 0
                          }}>1</div>
                          <div>
                            <div style={{ fontWeight: "500", color: "#202124" }}>
                              Start at {origin.name}
                            </div>
                            <div>Walk {routeResults.shuttle.walkToStop} min to {routeResults.shuttle.originStop.name}</div>
                          </div>
                        </div>

                        <div style={{ marginBottom: "8px", display: "flex", alignItems: "start", gap: "8px" }}>
                          <div style={{ 
                            width: "20px", 
                            height: "20px", 
                            backgroundColor: `#${routeResults.shuttle.route.color}`, 
                            borderRadius: "50%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "white",
                            fontSize: "12px",
                            fontWeight: "bold",
                            flexShrink: 0
                          }}>2</div>
                          <div>
                            <div style={{ fontWeight: "500", color: "#202124" }}>
                              Board Yuttle {routeResults.shuttle.route.short_name} at {routeResults.shuttle.originStop.name}
                            </div>
                            <div>Wait ~{routeResults.shuttle.waitTime} min for {routeResults.shuttle.route.name}</div>
                          </div>
                        </div>

                        <div style={{ marginBottom: "8px", display: "flex", alignItems: "start", gap: "8px" }}>
                          <div style={{ 
                            width: "20px", 
                            height: "20px", 
                            backgroundColor: `#${routeResults.shuttle.route.color}`, 
                            borderRadius: "50%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "white",
                            fontSize: "12px",
                            fontWeight: "bold",
                            flexShrink: 0
                          }}>3</div>
                          <div>
                            <div style={{ fontWeight: "500", color: "#202124" }}>
                              Get off at {routeResults.shuttle.destStop.name}
                            </div>
                            <div>{routeResults.shuttle.rideTime} min ride • {(routeResults.shuttle.distance * 0.000621371).toFixed(2)} mi</div>
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "start", gap: "8px" }}>
                          <div style={{ 
                            width: "20px", 
                            height: "20px", 
                            backgroundColor: "#ea4335", 
                            borderRadius: "50%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "white",
                            fontSize: "12px",
                            fontWeight: "bold",
                            flexShrink: 0
                          }}>4</div>
                          <div>
                            <div style={{ fontWeight: "500", color: "#202124" }}>
                              Arrive at {destination.name}
                            </div>
                            <div>Walk {routeResults.shuttle.walkFromStop} min from stop</div>
                          </div>
                        </div>
                      </div>

                      <div style={{ 
                        marginTop: "12px", 
                        padding: "8px", 
                        backgroundColor: "#e8f4fd", 
                        borderRadius: "4px",
                        fontSize: "12px",
                        color: "#1967d2"
                      }}>
                        💡 {routeResults.shuttle.totalTime < routeResults.walking.time 
                          ? `Save ${routeResults.walking.time - routeResults.shuttle.totalTime} min by taking the Yuttle!`
                          : routeResults.shuttle.totalTime === routeResults.walking.time
                          ? "Both options take about the same time"
                          : `Walking is ${routeResults.shuttle.totalTime - routeResults.walking.time} min faster`}
                      </div>
                    </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
