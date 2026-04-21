type Coordinate = {
  latitude: number;
  longitude: number;
};

export type RouteInfo = {
  distanceKm: number;    // Total distance in kilometers
  durationMin: number;   // Estimated driving duration in minutes
  coordinates: Coordinate[]; // Points for drawing polyline
};

export class RouteService {
  private static instance: RouteService;

  private constructor() {}

  public static getInstance(): RouteService {
    if (!RouteService.instance) {
      RouteService.instance = new RouteService();
    }
    return RouteService.instance;
  }

  /**
   * Fetches a driving route using the OSRM public API.
   * Note: This is an open-source alternative to Google Maps API for demo purposes.
   * Modes available in public OSRM are limited, so we default to driving.
   */
  public async fetchDrivingRoute(origin: Coordinate, destination: Coordinate): Promise<RouteInfo | null> {
    try {
      // OSRM format: lon,lat;lon,lat
      const url = `http://router.project-osrm.org/route/v1/driving/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?geometries=geojson&overview=full`;
      
      const response = await fetch(url);
      const data = await response.json();

      if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
        throw new Error('No route found');
      }

      const route = data.routes[0];
      const distanceKm = route.distance / 1000;
      const durationMin = route.duration / 60;

      // Extract coordinates from geometry (GeoJSON format: [longitude, latitude])
      const coordinates: Coordinate[] = route.geometry.coordinates.map((coord: [number, number]) => ({
        latitude: coord[1],
        longitude: coord[0],
      }));

      return {
        distanceKm,
        durationMin,
        coordinates,
      };
    } catch (error) {
      console.error('Error fetching route:', error);
      return null;
    }
  }

  // To simulate walk/bike in absence of dedicated keys, we can scale driving distance slightly and compute via EmissionsCalculator directly
  public simulateAlternativeMode(drivingDistanceKm: number, scaleFactor: number = 1.0): number {
     return drivingDistanceKm * scaleFactor;
  }
}

export const routeService = RouteService.getInstance();
