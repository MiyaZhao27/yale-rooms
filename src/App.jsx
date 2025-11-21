import { useState } from "react";
import CampusMap from "./CampusMap";
import SearchBar from "./SearchBar";


export default function App() {
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [time, setTime] = useState("");
  const [date, setDate] = useState("");
  const [allBuildings, setAllBuildings] = useState([]);


  return (
    <div style={{ display: "flex", height: "100vh", width: "100vw" }}>
      {/* LEFT: map */}
      <div style={{ flex: 2 }}>
        <CampusMap
  selectedBuildingId={selectedBuilding?.id}
  onSelectBuilding={setSelectedBuilding}
  onBuildingsLoaded={setAllBuildings}
/>

      </div>

      {/* RIGHT: info / booking panel */}
      <div
        style={{
          flex: 1,
          borderLeft: "1px solid #ddd",
          padding: "1rem",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <h2>25live alive again</h2>

        <h3>Search Buildings</h3>
<SearchBar
  buildings={allBuildings}
  onSelect={(b) => setSelectedBuilding(b)}
/>


        {selectedBuilding ? (
          <>
            <p>
              <strong>Building:</strong> {selectedBuilding.name}
            </p>
            <p>
              <strong>ID:</strong> {selectedBuilding.id}
            </p>

            <label>
              Date:{" "}
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>

            <br />

            <label>
              Time:{" "}
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </label>


            <button
              onClick={() => {
                const payload = {
                  buildingId: selectedBuilding.id,
                  buildingName: selectedBuilding.name,
                  lat: selectedBuilding.lat,
                  lng: selectedBuilding.lng,
                  date,
                  time,
                };


                console.log("SEND TO AVAILABILITY TABLE:", payload);

                // 👇 Your friend will handle using this data:
                // setSearchCriteria(payload);
              }}
            >
              Check availability
            </button>

          </>
        ) : (
          <p>Click a building on the map to select it.</p>
        )}
      </div>
    </div>
  );
}
