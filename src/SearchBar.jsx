import { useState } from "react";

export default function SearchBar({ buildings, onSelect }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  // Map of abbreviations to full building names (case-insensitive partial matches)
  const abbrevMap = {
    'hq': 'humanities quadrangle',
    'basslb': 'bass library',
    'bass': 'bass',
    'akw': 'arthur k watson',
    'watson': 'watson',
    'wlh': 'w l harkness',
    'harkness': 'harkness',
    'ysb': 'yale science building',
    'science': 'science building',
    'dow': 'dow',
    'sml': 'sterling memorial',
    'sterling': 'sterling',
    'bct': 'becton',
    'becton': 'becton',
    'dl': 'dunham',
    'dunham': 'dunham',
    'esc': 'environmental science',
    'hlh': 'helen hadley',
    'hhh': 'helen hadley',
    'hadley': 'hadley',
    'co': 'commons',
    'commons': 'commons',
    // Cultural Centers
    'aacc': '295', // Asian American Cultural Center
    '295': '295',
    '297': '295',
    '295-297': '295',
    'la casa': '301 crown',
    'casa': '301 crown',
    '301': '301 crown',
    'nacc': '26 high',
    '26 high': '26 high',
    '26': '26 high',
    'menacc': '305',
    '305': '305',
    'afam': '211 park',
    'afam house': '211 park',
    'the house': '211 park',
    '211': '211 park',
    '211 park': '211 park',
    // Other buildings
    'crown': 'crown',
    'kroon': 'kroon',
    'kh': 'kroon',
    'lc': 'linsly',
    'lcl': 'linsly chittenden',
    'loria': 'loria',
    'luce': 'luce',
    'mason': 'mason',
    'ml': 'mason',
    'pierson': 'pierson',
    'sage': 'sage',
    'slb': 'sterling law',
    'law': 'law buildings',
    'ssh': 'social science',
    'ssss': 'social science',
    'wr': 'william l harkness',
    'wlh': 'william l harkness',
    'evt': 'evans',
    'evans': 'evans',
    'cs': 'computer science',
    'akg': 'a k',
    'sp': 'sloane physics',
    'spl': 'sloane physics',
    'kbl': 'kline biology',
    'kb': 'kline biology',
    'kline': 'kline',
  };

  const filtered = buildings
    .filter(b => {
      const lowerQuery = query.toLowerCase().trim();
      const lowerName = b.name.toLowerCase();
      
      if (!lowerQuery) return true; // Show all if empty
      
      // Match full name
      if (lowerName.includes(lowerQuery)) return true;
      
      // Check if query matches any abbreviation, then check if building name contains the expansion
      for (const [abbrev, fullName] of Object.entries(abbrevMap)) {
        if (abbrev.startsWith(lowerQuery) || lowerQuery === abbrev) {
          if (lowerName.includes(fullName)) return true;
        }
      }
      
      return false;
    })
    .sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            const first = filtered[0];
            if (first) {
              setQuery(first.name);
              setOpen(false);
              onSelect(first);
            }
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
        placeholder="Search buildings"
        style={{
          width: "100%",
          padding: "12px 16px",
          border: "none",
          borderRadius: "8px",
          fontSize: "16px",
          outline: "none"
        }}
      />

      {open && (
        <div
          style={{
            position: "absolute",
            top: "52px",
            left: 0,
            right: 0,
            background: "white",
            zIndex: 999,
            maxHeight: "300px",
            overflowY: "auto",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            marginTop: "4px"
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
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#f0f0f0";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "white";
              }}
              style={{
                padding: "12px 16px",
                cursor: "pointer",
                borderBottom: filtered.length > 1 ? "1px solid #e0e0e0" : "none",
                transition: "background-color 0.1s",
                color: "#202124",
                fontSize: "14px"
              }}
            >
              {b.name}
            </div>
          ))}

          {filtered.length === 0 && (
            <div style={{ padding: "12px 16px", color: "#5f6368", fontSize: "14px" }}>
              No buildings found
            </div>
          )}
        </div>
      )}
    </div>
  );
}
