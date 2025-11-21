import { useEffect, useState } from "react";
import { Marker, Popup } from "react-leaflet";
import L from "leaflet";
import {
  MapContainer,
  TileLayer,
  Polygon,
  Tooltip,
} from "react-leaflet";

const yaleCenter = [41.3083, -72.9279];

const userIcon = L.icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
  iconSize: [30, 30],
});

// Endpoint for ALL buildings in the "Buildings" category
const BUILDINGS_URL =
  "https://api.concept3d.com/categories/52707?map=1910&children&key=0001085cc708b9cef47080f064612ca5";

export default function CampusMap({
  onSelectBuilding,
  selectedBuildingId,
  onBuildingsLoaded
}) {
  const [buildings, setBuildings] = useState([]);
  const [userLocation, setUserLocation] = useState(null);

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
  // 2️⃣ Send buildings list to parent (App.jsx)
  // -------------------------
  useEffect(() => {
    if (buildings.length > 0) {
      onBuildingsLoaded?.(buildings);
    }
  }, [buildings, onBuildingsLoaded]);

  return (
    <MapContainer
      center={yaleCenter}
      zoom={16}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />

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

        return (
          <Polygon
            key={b.id}
            positions={positions}
            pathOptions={{
              color: isSelected ? "#00356b" : "#5293be",
              weight: isSelected ? 3 : 2,
              fillColor: isSelected ? "#002050" : "#9cc1da",
              fillOpacity: isSelected ? 0.85 : 0.7,
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
    </MapContainer>
  );
}
