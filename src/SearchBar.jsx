import { useState } from "react";

export default function SearchBar({ buildings, onSelect }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = buildings.filter(b =>
    b.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        placeholder="Search for a building..."
        style={{
          width: "100%",
          padding: "8px",
          border: "1px solid #ccc",
          borderRadius: "4px"
        }}
      />

      {open && query.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "40px",
            left: 0,
            right: 0,
            border: "1px solid #ccc",
            background: "white",
            zIndex: 999,
            maxHeight: "200px",
            overflowY: "auto"
          }}
        >
          {filtered.map((b) => (
            <div
              key={b.id}
              onClick={() => {
                setQuery(b.name);
                setOpen(false);
                onSelect(b); // Sends building to App
              }}
              style={{
                padding: "8px",
                cursor: "pointer",
                borderBottom: "1px solid #eee"
              }}
            >
              {b.name}
            </div>
          ))}

          {filtered.length === 0 && (
            <div style={{ padding: "8px", color: "#888" }}>
              No buildings found
            </div>
          )}
        </div>
      )}
    </div>
  );
}
