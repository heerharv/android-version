// PoiService.ts — Free Overpass API for POIs

export type PoiType = 'ev_charger' | 'bike_station' | 'police' | 'hospital';

export interface PoiMarker {
  id: string;
  latitude: number;
  longitude: number;
  type: PoiType;
  name: string;
}

const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter'
];

async function queryOverpass(query: string, type: PoiType, defaultName: string): Promise<PoiMarker[]> {
  for (const url of OVERPASS_URLS) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
      });
      
      if (!response.ok) continue; // Try next URL if rate limited

      const text = await response.text();
      if (text.startsWith('<')) continue; // It's an HTML error page

      const json = JSON.parse(text);
      const elements = json.elements || [];
      
      return elements.map((el: any) => ({
        id: String(el.id),
        latitude: el.lat || el.center?.lat,
        longitude: el.lon || el.center?.lon,
        type: type,
        name: el.tags?.name || defaultName,
      })).filter((m: any) => m.latitude && m.longitude);
    } catch (e) {
      console.warn(`Failed on ${url}:`, e);
    }
  }
  
  console.warn(`All Overpass APIs failed to fetch ${type}`);
  return [];
}

// Increased radius to 15km to ensure we find results
export async function fetchEvChargers(lat: number, lon: number, radiusMeters = 15000): Promise<PoiMarker[]> {
  const query = `
    [out:json][timeout:15];
    nwr["amenity"="charging_station"](around:${radiusMeters},${lat},${lon});
    out center;
  `;
  return queryOverpass(query, 'ev_charger', 'EV Charging Station');
}

export async function fetchBikeStations(lat: number, lon: number, radiusMeters = 15000): Promise<PoiMarker[]> {
  const query = `
    [out:json][timeout:15];
    nwr["amenity"="bicycle_rental"](around:${radiusMeters},${lat},${lon});
    out center;
  `;
  return queryOverpass(query, 'bike_station', 'Bike Station');
}

export async function fetchPoliceStations(lat: number, lon: number, radiusMeters = 15000): Promise<PoiMarker[]> {
  const query = `
    [out:json][timeout:15];
    nwr["amenity"="police"](around:${radiusMeters},${lat},${lon});
    out center;
  `;
  return queryOverpass(query, 'police', 'Police Station');
}

export async function fetchHospitals(lat: number, lon: number, radiusMeters = 15000): Promise<PoiMarker[]> {
  const query = `
    [out:json][timeout:15];
    nwr["amenity"="hospital"](around:${radiusMeters},${lat},${lon});
    out center;
  `;
  return queryOverpass(query, 'hospital', 'Hospital');
}
