import L from "leaflet";
import { useEffect, useRef, useState } from "react";
import { CircleMarker, MapContainer, Marker, Polygon, Polyline, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import routesData from "./data/routes.json";
import stopsData from "./data/stops.json";

// Helper function to check if a stop is on a route's path
const isStopOnRoute = (stop, routePath, threshold = 50) => {
  // Check if any point in the route path is within threshold meters of the stop
  for (let i = 0; i < routePath.length; i += 2) {
    const routeLat = routePath[i];
    const routeLng = routePath[i + 1];
    const distance = calculateDistance(stop.lat, stop.lon, routeLat, routeLng);
    if (distance < threshold) {
      return true;
    }
  }
  return false;
};

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

function ZoomControl() {
  const map = useMap();
  
  useEffect(() => {
    const zoomControl = L.control.zoom({ position: 'bottomright' });
    zoomControl.addTo(map);
    
    return () => {
      zoomControl.remove();
    };
  }, [map]);
  
  return null;
}

const yaleCenter = [41.3083, -72.9279];

const userIcon = L.divIcon({
  className: 'custom-user-icon',
  html: '<div style="background-color: #0066CC; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5);"></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

// Endpoint for ALL buildings in the "Buildings" category
const BUILDINGS_URL =
  "https://api.concept3d.com/categories/52707?map=1910&children&key=0001085cc708b9cef47080f064612ca5";

export default function CampusMap({
  onSelectBuilding,
  selectedBuildingId,
  onBuildingsLoaded,
  enabledRoutes = {},
  highlightedBuildings = [],
  routeSchedules = [],
  currentTime = new Date(),
  directionPath = null,
  directionType = null,
  shuttleRouteColor = null
}) {
  const [buildings, setBuildings] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [shuttleRoutes, setShuttleRoutes] = useState([]);
  const [shuttleStops, setShuttleStops] = useState([]);
  const mapRef = useRef(null);

  // -------------------------
  // 1️⃣ Load buildings + user location
  // -------------------------
  useEffect(() => {
    async function loadBuildings() {
      try {
        const res = await fetch(BUILDINGS_URL);
        const data = await res.json();

        const locations = data.children?.locations || [];

        const withShapes = locations.filter(
          (loc) =>
            loc.shape &&
            loc.shape.type === "polygon" &&
            Array.isArray(loc.shape.paths)
        );

        setBuildings(withShapes);
      } catch (err) {
        console.error("Error loading buildings:", err);
      }

      // Get user location
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation([pos.coords.latitude, pos.coords.longitude]);
        },
        (err) => {
          console.warn("Geolocation permission denied:", err);
        }
      );
    }

    loadBuildings();
  }, []);

  // -------------------------
  // 1.5️⃣ Load shuttle routes and stops from JSON files
  // -------------------------
  useEffect(() => {
    // Process routes - convert flat path array to [lat, lng] pairs
    const processedRoutes = routesData.map(route => {
      const coordinates = [];
      for (let i = 0; i < route.path.length; i += 2) {
        coordinates.push([route.path[i], route.path[i + 1]]);
      }
      return {
        id: route.id,
        name: route.name,
        color: `#${route.color}`,
        coordinates
      };
    });
    
    // Process stops
    const processedStops = stopsData.map(stop => ({
      id: stop.id,
      name: stop.name,
      position: [stop.lat, stop.lon]
    }));
    
    console.log('Loaded shuttle routes:', processedRoutes.length);
    console.log('Loaded shuttle stops:', processedStops.length);
    
    setShuttleRoutes(processedRoutes);
    setShuttleStops(processedStops);
  }, []);

  // -------------------------
  // 2️⃣ Send buildings list to parent (App.jsx)
  // -------------------------
  useEffect(() => {
    if (buildings.length > 0) {
      onBuildingsLoaded?.(buildings);
    }
  }, [buildings, onBuildingsLoaded]);

  // Pan/zoom to selected building when it changes
  useEffect(() => {
    if (!mapRef.current || !selectedBuildingId) return;
    const b = buildings.find((x) => x.id === selectedBuildingId);
    if (!b || !b.shape?.paths || b.shape.paths.length === 0) return;

    // compute centroid of polygon
    const pts = b.shape.paths;
    let latSum = 0;
    let lngSum = 0;
    pts.forEach(([lat, lng]) => {
      latSum += lat;
      lngSum += lng;
    });
    const centerLat = latSum / pts.length;
    const centerLng = lngSum / pts.length;

    try {
      mapRef.current.setView([centerLat, centerLng], 18, { animate: true });
    } catch (err) {
      console.warn('Could not set map view', err);
    }
  }, [selectedBuildingId, buildings]);

  return (
    <MapContainer
      center={yaleCenter}
      zoom={16}
      whenCreated={(mapInstance) => { mapRef.current = mapInstance; }}
      style={{ height: "100%", width: "100%" }}
      zoomControl={false}
    >
      <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
      <ZoomControl />

      {userLocation && (
        <Marker position={userLocation} icon={userIcon}>
          <Popup>You are here</Popup>
        </Marker>
      )}

      {buildings.map((b) => {
        if (!b.id || !b.shape?.paths) return null;

        const positions = b.shape.paths.map(([lat, lng]) => [lat, lng]);
        const name = b.name || `Building ${b.id}`;

        const isSelected =
          selectedBuildingId != null && b.id === selectedBuildingId;
        const isHighlighted = highlightedBuildings.includes(b.id);

        return (
          <Polygon
            key={b.id}
            positions={positions}
            pathOptions={{
              color: isSelected ? "#00356b" : isHighlighted ? "#1a73e8" : "#5293be",
              weight: isSelected ? 3 : isHighlighted ? 3 : 2,
              fillColor: isSelected ? "#002050" : isHighlighted ? "#4285f4" : "#9cc1da",
              fillOpacity: isSelected ? 0.85 : isHighlighted ? 0.75 : 0.7,
            }}
            eventHandlers={{
              click: () => {
                onSelectBuilding?.({
                  id: b.id,
                  name,
                  lat: b.lat,
                  lng: b.lng,
                  shape: b.shape,
                });
              },
            }}
          >
            <Tooltip>{name}</Tooltip>
          </Polygon>
        );
      })}

      {/* 🚍 Shuttle Routes */}
      {shuttleRoutes.filter(route => enabledRoutes[route.id]).map((route) => (
        <Polyline
          key={route.id}
          positions={route.coordinates}
          pathOptions={{
            color: route.color,
            weight: 4,
            opacity: 0.7,
          }}
          pane="overlayPane"
        >
          <Tooltip>{route.name}</Tooltip>
        </Polyline>
      ))}

      {/* 🚏 Shuttle Stops - drawn on top of everything */}
      {shuttleStops.map((stop) => {
        // Find which routes serve this stop
        const servingRoutes = routesData
          .filter(route => isStopOnRoute(stop, route.path))
          .map(route => {
            const routeSchedule = routeSchedules.find(r => r.id === route.id);
            return {
              id: route.id,
              name: route.name,
              shortName: route.short_name,
              color: `#${route.color}`,
              schedule: routeSchedule
            };
          })
          .filter(route => route.schedule && enabledRoutes[route.id]); // Only show enabled routes

        // Calculate next arrival time (simulate with frequency)
        const getNextArrival = (routeSchedule) => {
          if (!routeSchedule || !routeSchedule.schedule) return null;
          
          const now = currentTime;
          const currentDay = now.getDay();
          const currentMinutes = now.getHours() * 60 + now.getMinutes();
          
          // Check if route is active now
          if (!routeSchedule.schedule.days.includes(currentDay)) return null;
          
          const [startHour, startMin] = routeSchedule.schedule.startTime.split(':').map(Number);
          const [endHour, endMin] = routeSchedule.schedule.endTime.split(':').map(Number);
          const startMinutes = startHour * 60 + startMin;
          const endMinutes = endHour * 60 + endMin;
          
          if (currentMinutes < startMinutes || currentMinutes > endMinutes) return null;
          
          // Simulate shuttle frequency (every 15 minutes)
          const frequency = 15;
          const nextArrivalOffset = frequency - (currentMinutes % frequency);
          return nextArrivalOffset;
        };

        return (
          <CircleMarker
            key={stop.id}
            center={stop.position}
            radius={5}
            pathOptions={{
              color: '#FFFFFF',
              fillColor: '#000000',
              fillOpacity: 0.9,
              weight: 2,
            }}
            pane="markerPane"
          >
            <Popup maxWidth={250}>
              <div style={{ padding: '8px', fontFamily: 'system-ui, sans-serif' }}>
                <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px', color: '#202124' }}>
                  {stop.name}
                </div>
                
                {servingRoutes.length > 0 ? (
                  <div>
                    {servingRoutes.map(route => {
                      const waitTime = getNextArrival(route);
                      return (
                        <div
                          key={route.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '6px 0',
                            borderTop: '1px solid #e0e0e0',
                          }}
                        >
                          <div
                            style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '50%',
                              backgroundColor: route.color,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'white',
                              fontSize: '10px',
                              fontWeight: 'bold',
                              flexShrink: 0,
                            }}
                          >
                            {route.shortName}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '13px', fontWeight: '500', color: '#202124' }}>
                              {route.name}
                            </div>
                            {waitTime !== null ? (
                              <div style={{ fontSize: '12px', color: '#5f6368' }}>
                                <span style={{ fontWeight: '600', color: '#1a73e8' }}>{waitTime} min</span>
                                {' • '}
                                {new Date(currentTime.getTime() + waitTime * 60000).toLocaleTimeString('en-US', {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                  hour12: true
                                })}
                              </div>
                            ) : (
                              <div style={{ fontSize: '11px', color: '#d93025' }}>
                                Not currently running
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ fontSize: '13px', color: '#5f6368', marginTop: '4px' }}>
                    No active routes at this stop
                  </div>
                )}
              </div>
            </Popup>
          </CircleMarker>
        );
      })}

      {/* Direction Path Visualization */}
      {directionPath && (
        <>
          {directionType === 'walking' ? (
            // Walking route - single line from origin to destination
            <>
              <Polyline
                positions={directionPath}
                pathOptions={{
                  color: '#1a73e8',
                  weight: 6,
                  opacity: 0.8,
                  dashArray: '10, 10',
                }}
                pane="overlayPane"
              >
                <Tooltip>Walking route</Tooltip>
              </Polyline>
              {/* Origin - Green */}
              <CircleMarker
                center={directionPath[0]}
                radius={8}
                pathOptions={{
                  color: '#34a853',
                  fillColor: '#34a853',
                  fillOpacity: 1,
                  weight: 3,
                }}
                pane="markerPane"
              >
                <Tooltip>Origin</Tooltip>
              </CircleMarker>
              {/* Destination - Red */}
              <CircleMarker
                center={directionPath[1]}
                radius={8}
                pathOptions={{
                  color: '#ea4335',
                  fillColor: '#ea4335',
                  fillOpacity: 1,
                  weight: 3,
                }}
                pane="markerPane"
              >
                <Tooltip>Destination</Tooltip>
              </CircleMarker>
            </>
          ) : directionType === 'shuttle' ? (
            // Shuttle route - straight lines with markers
            <>
              {/* Walk to pickup stop - dashed line */}
              <Polyline
                positions={[directionPath[0], directionPath[1]]}
                pathOptions={{
                  color: '#1a73e8',
                  weight: 5,
                  opacity: 0.7,
                  dashArray: '10, 5',
                }}
                pane="overlayPane"
              >
                <Tooltip>Walk to Yuttle stop</Tooltip>
              </Polyline>
              
              {/* Yuttle ride - straight line between stops */}
              <Polyline
                positions={[directionPath[1], directionPath[2]]}
                pathOptions={{
                  color: shuttleRouteColor || '#1a73e8',
                  weight: 6,
                  opacity: 0.8,
                }}
                pane="overlayPane"
              >
                <Tooltip>Yuttle ride</Tooltip>
              </Polyline>
              
              {/* Walk from dropoff stop to destination - dashed line */}
              <Polyline
                positions={[directionPath[2], directionPath[3]]}
                pathOptions={{
                  color: '#1a73e8',
                  weight: 5,
                  opacity: 0.7,
                  dashArray: '10, 5',
                }}
                pane="overlayPane"
              >
                <Tooltip>Walk to destination</Tooltip>
              </Polyline>
              
              {/* Marker 1: Origin - Green */}
              <CircleMarker
                center={directionPath[0]}
                radius={8}
                pathOptions={{
                  color: '#34a853',
                  fillColor: '#34a853',
                  fillOpacity: 1,
                  weight: 3,
                }}
                pane="markerPane"
              >
                <Tooltip>1. Origin</Tooltip>
              </CircleMarker>
              
              {/* Marker 2: Pickup Stop - Shuttle Color */}
              <CircleMarker
                center={directionPath[1]}
                radius={8}
                pathOptions={{
                  color: shuttleRouteColor || '#fbbc04',
                  fillColor: shuttleRouteColor || '#fbbc04',
                  fillOpacity: 1,
                  weight: 3,
                }}
                pane="markerPane"
              >
                <Tooltip>2. Board Yuttle here</Tooltip>
              </CircleMarker>
              
              {/* Marker 3: Dropoff Stop - Yuttle Color */}
              <CircleMarker
                center={directionPath[2]}
                radius={8}
                pathOptions={{
                  color: shuttleRouteColor || '#4285f4',
                  fillColor: shuttleRouteColor || '#4285f4',
                  fillOpacity: 1,
                  weight: 3,
                }}
                pane="markerPane"
              >
                <Tooltip>3. Get off here</Tooltip>
              </CircleMarker>
              
              {/* Marker 4: Destination - Red */}
              <CircleMarker
                center={directionPath[3]}
                radius={8}
                pathOptions={{
                  color: '#ea4335',
                  fillColor: '#ea4335',
                  fillOpacity: 1,
                  weight: 3,
                }}
                pane="markerPane"
              >
                <Tooltip>4. Destination</Tooltip>
              </CircleMarker>
            </>
          ) : null}
        </>
      )}
    </MapContainer>
  );
}
