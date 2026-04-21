import * as Location from 'expo-location';

export type LocationState = {
  latitude: number;
  longitude: number;
};

export class LocationManager {
  private static instance: LocationManager;
  private location: LocationState | null = null;
  private listeners: ((location: LocationState) => void)[] = [];
  
  // Tracking
  private isTracking: boolean = false;
  private recordedPath: LocationState[] = [];
  private pathListeners: ((path: LocationState[]) => void)[] = [];
  private watchSubscription: Location.LocationSubscription | null = null;

  private constructor() {}

  public static getInstance(): LocationManager {
    if (!LocationManager.instance) {
      LocationManager.instance = new LocationManager();
    }
    return LocationManager.instance;
  }

  public async requestPermissions(): Promise<boolean> {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.error('Permission to access location was denied');
      return false;
    }
    return true;
  }

  public async getCurrentLocation(): Promise<LocationState | null> {
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) return null;

    const loc = await Location.getCurrentPositionAsync({});
    this.updateLocation(loc.coords.latitude, loc.coords.longitude);
    return this.location;
  }
  
  public async startLiveTracking() {
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) return;
    
    this.isTracking = true;
    this.recordedPath = [];
    
    // Grab the starting point immediately
    try {
      const initialLoc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      this.updateLocation(initialLoc.coords.latitude, initialLoc.coords.longitude);
      this.recordedPath.push({ latitude: initialLoc.coords.latitude, longitude: initialLoc.coords.longitude });
      this.notifyPathListeners();
    } catch (e) {
      console.log("Could not get initial location", e);
    }

    this.watchSubscription = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Highest, timeInterval: 1000, distanceInterval: 1 },
      (loc) => {
        this.updateLocation(loc.coords.latitude, loc.coords.longitude);
        if (this.isTracking) {
           this.recordedPath.push({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
           this.notifyPathListeners();
        }
      }
    );
  }

  public stopLiveTracking() {
    this.isTracking = false;
    if (this.watchSubscription) {
      this.watchSubscription.remove();
      this.watchSubscription = null;
    }
  }

  private updateLocation(lat: number, lon: number) {
    this.location = { latitude: lat, longitude: lon };
    this.notifyListeners();
  }

  public getLocation(): LocationState | null { return this.location; }
  public getRecordedPath() { return this.recordedPath; }
  public getIsTracking() { return this.isTracking; }

  public subscribe(listener: (location: LocationState) => void) {
    this.listeners.push(listener);
    if (this.location) listener(this.location);
    return () => { this.listeners = this.listeners.filter((l) => l !== listener); };
  }
  
  public subscribePath(listener: (path: LocationState[]) => void) {
    this.pathListeners.push(listener);
    listener(this.recordedPath);
    return () => { this.pathListeners = this.pathListeners.filter((l) => l !== listener); };
  }

  private notifyListeners() {
    if (this.location) this.listeners.forEach((l) => l(this.location!));
  }
  private notifyPathListeners() {
    this.pathListeners.forEach((l) => l([...this.recordedPath]));
  }
}

export const locationManager = LocationManager.getInstance();
