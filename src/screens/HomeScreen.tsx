import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, StyleSheet, TextInput, TouchableOpacity, Text,
  ActivityIndicator, Modal, FlatList, Animated, Easing, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { MapComponent, MapComponentRef } from '../components/MapComponent';
import { locationManager, LocationState } from '../services/LocationManager';
import { routeService, RouteInfo } from '../services/RouteService';
import { carbonEmissionForTrip, calculateTravelTime, formatEmissions } from '../utils/EmissionsCalculator';
import { ProfileScreen } from './ProfileScreen';
import { SafetyScreen } from './SafetyScreen';
import { RewardsScreen } from './RewardsScreen';
import { PlannerScreen } from './PlannerScreen';
import { EcoCoach } from '../components/EcoCoach';
import { weatherService, WeatherData } from '../services/WeatherService';
import { userDataManager } from '../services/UserDataManager';
import { fetchEvChargers, fetchBikeStations, fetchPoliceStations, fetchHospitals, PoiMarker, PoiType } from '../services/PoiService';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';

function getDistanceFromPath(path: LocationState[]): number {
  if (path.length < 2) return 0.01;
  let totalKm = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const p1 = path[i], p2 = path[i + 1];
    const dLat = (p2.latitude - p1.latitude) * (Math.PI / 180);
    const dLon = (p2.longitude - p1.longitude) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) ** 2
      + Math.cos(p1.latitude * Math.PI / 180) * Math.cos(p2.latitude * Math.PI / 180)
      * Math.sin(dLon / 2) ** 2;
    totalKm += 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  return totalKm;
}

export const HomeScreen: React.FC = () => {
  const mapRef = useRef<MapComponentRef>(null);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [destinationCoords, setDestinationCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedMode, setSelectedMode] = useState<string>('car');

  // Modals
  const [showProfile, setShowProfile] = useState(false);
  const [showSafety, setShowSafety] = useState(false);

  // Tabs
  const [activeTab, setActiveTab] = useState<'planner' | 'track' | 'rewards'>('planner');

  // Tracking
  const [isTracking, setIsTracking] = useState(false);
  const [recordedPath, setRecordedPath] = useState<LocationState[]>([]);

  const [poiMarkers, setPoiMarkers] = useState<PoiMarker[]>([]);
  const [activePoiFilter, setActivePoiFilter] = useState<PoiType | 'none'>('none');
  const [poiLoading, setPoiLoading] = useState(false);
  const [isTabPanelExpanded, setIsTabPanelExpanded] = useState(true);

  // Map pan / recenter button
  const [showRecenter, setShowRecenter] = useState(false);
  const recenterOpacity = useRef(new Animated.Value(0)).current;

  // Bottom sheet animation
  const sheetAnim = useRef(new Animated.Value(0)).current;
  const prevSheet = useRef<boolean>(false);

  // Phase 6: Weather state
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherAdvice, setWeatherAdvice] = useState<{ mode: string; reason: string } | null>(null);

  useEffect(() => {
    const loc = locationManager.getLocation();
    if (loc) {
      weatherService.getCurrentWeather(loc.latitude, loc.longitude).then(w => {
        setWeather(w);
        setWeatherAdvice(weatherService.getRecommendation(w));
      });
    }
  }, []);

  useEffect(() => {
    const hasSheet = routeInfo !== null;
    if (hasSheet !== prevSheet.current) {
      prevSheet.current = hasSheet;
      Animated.spring(sheetAnim, {
        toValue: hasSheet ? 1 : 0,
        useNativeDriver: true,
        bounciness: 8,
        speed: 12,
      }).start();
    }
  }, [routeInfo]);

  const sheetTranslateY = sheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [300, 0],
  });

  // POI tab slide
  const tabSlide = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.spring(tabSlide, {
      toValue: 1,
      useNativeDriver: true,
      bounciness: 6,
      speed: 14,
    }).start();
  }, [activeTab]);

  useEffect(() => {
    const unsubPath = locationManager.subscribePath(path => setRecordedPath(path));
    const interval = setInterval(() => setIsTracking(locationManager.getIsTracking()), 1000);
    return () => { unsubPath(); clearInterval(interval); };
  }, []);

  // Autocomplete debounce
  useEffect(() => {
    if (searchQuery.length < 3) { setSuggestions([]); return; }
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=4`);
        const data = await res.json();
        setSuggestions(data);
      } catch { }
    }, 600);
    return () => clearTimeout(id);
  }, [searchQuery]);

  const handleSuggestionSelect = async (item: any) => {
    setSearchQuery(item.name || item.display_name.split(',')[0]);
    setSuggestions([]);
    const dest = { latitude: parseFloat(item.lat), longitude: parseFloat(item.lon) };
    setDestinationCoords(dest);
    
    // Phase 6 improvement: Just pan to the location instead of immediately drawing a route
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    mapRef.current?.recenterToUser(); // We can implement a specific panTo function later, for now we just show the pin
  };

  const handleGetDirections = async () => {
    if (!destinationCoords) return;
    setIsFetching(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const currentLoc = locationManager.getLocation();
      if (currentLoc) {
        const route = await routeService.fetchDrivingRoute(currentLoc, destinationCoords);
        setRouteInfo(route);
      }
    } catch { alert('Error fetching route.'); }
    finally { setIsFetching(false); }
  };

  const handleSearchSubmit = async () => {
    if (!searchQuery) return;
    setIsFetching(true);
    setSuggestions([]);
    try {
      const geo = await Location.geocodeAsync(searchQuery);
      if (geo.length > 0) {
        const dest = { latitude: geo[0].latitude, longitude: geo[0].longitude };
        setDestinationCoords(dest);
        const currentLoc = locationManager.getLocation();
        if (currentLoc) {
          const route = await routeService.fetchDrivingRoute(currentLoc, dest);
          setRouteInfo(route);
        }
      } else alert('Location not found.');
    } catch { alert('Error fetching route.'); }
    finally { setIsFetching(false); }
  };

  const handlePoiFilter = async (type: PoiType) => {
    if (activePoiFilter === type) {
      setActivePoiFilter('none');
      setPoiMarkers([]);
      return;
    }
    const loc = locationManager.getLocation();
    if (!loc) { alert('Location not available yet.'); return; }
    setActivePoiFilter(type);
    setPoiLoading(true);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      let markers: PoiMarker[] = [];
      if (type === 'ev_charger') markers = await fetchEvChargers(loc.latitude, loc.longitude);
      else if (type === 'bike_station') markers = await fetchBikeStations(loc.latitude, loc.longitude);
      else if (type === 'police') markers = await fetchPoliceStations(loc.latitude, loc.longitude);
      else if (type === 'hospital') markers = await fetchHospitals(loc.latitude, loc.longitude);
      setPoiMarkers(markers);
    } catch { alert('Failed to load points of interest.'); }
    finally { setPoiLoading(false); }
  };

  const handleUserPan = useCallback(() => {
    if (!showRecenter) {
      setShowRecenter(true);
      Animated.timing(recenterOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    }
  }, [showRecenter]);

  const handleRecenter = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    mapRef.current?.recenterToUser();
    Animated.timing(recenterOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setShowRecenter(false));
  };

  const renderRouteOption = (mode: string, title: string, icon: string) => {
    if (!routeInfo) return null;
    let distance = routeInfo.distanceKm;
    if (mode === 'walk' || mode === 'bike') distance = routeService.simulateAlternativeMode(distance, 0.9);
    const duration = calculateTravelTime(mode, distance);
    const co2 = carbonEmissionForTrip(distance, mode);
    const isSelected = selectedMode === mode;
    return (
      <TouchableOpacity
        key={mode}
        style={[styles.routeOption, isSelected && styles.routeOptionSelected]}
        onPress={() => setSelectedMode(mode)}
      >
        <Text style={styles.routeIcon}>{icon}</Text>
        <Text style={[styles.routeTitle, isSelected && styles.textSelected]}>{title}</Text>
        <Text style={[styles.routeDetail, isSelected && styles.textSelected]}>{Math.round(duration)} min</Text>
        <Text style={[styles.routeEmissions, isSelected && styles.textSelected]}>{formatEmissions(co2)}</Text>
      </TouchableOpacity>
    );
  };

  const toggleTracking = async () => {
    if (isTracking) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      locationManager.stopLiveTracking();
      const distance = getDistanceFromPath(recordedPath);
      const success = await userDataManager.saveTrip(distance, 'two_wheeler');
      alert(success ? `EcoTrip Saved! You travelled ${distance.toFixed(2)} km.` : 'Trip finished, but failed to save.');
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      locationManager.startLiveTracking();
    }
    setIsTracking(!isTracking);
  };

  return (
    <SafeAreaView style={styles.container}>
      <MapComponent
        ref={mapRef}
        route={routeInfo}
        destination={destinationCoords}
        recordedPath={recordedPath}
        poiMarkers={poiMarkers}
        onUserPan={handleUserPan}
      />

      {/* ── Top Search Bar ── */}
      <View style={styles.topContainer}>
        <View style={styles.searchRow}>
          <View style={styles.searchContainer}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search places..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearchSubmit}
              placeholderTextColor="#999"
              returnKeyType="search"
            />
            {isFetching && <ActivityIndicator color="#0A84FF" style={{ marginLeft: 8 }} />}
          </View>
          <TouchableOpacity style={styles.profileButton} onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowProfile(true);
          }}>
            <Text style={styles.profileIcon}>👤</Text>
          </TouchableOpacity>
        </View>

        {/* Phase 6: Weather & Eco-Coach Row */}
        {!routeInfo && !suggestions.length && (
          <View style={{ marginTop: 12 }}>
            <EcoCoach />
            {weather && (
              <View style={styles.weatherBanner}>
                <Text style={styles.weatherIcon}>
                   {weather.condition === 'sunny' ? '☀️' : weather.condition === 'rainy' ? '🌧️' : '☁️'}
                </Text>
                <Text style={styles.weatherText}>{weatherAdvice?.reason}</Text>
              </View>
            )}
          </View>
        )}

        {/* Autocomplete Dropdown */}
        {suggestions.length > 0 && (
          <View style={styles.dropdown}>
            {suggestions.map((item, index) => (
              <TouchableOpacity key={index} style={styles.dropdownItem} onPress={() => handleSuggestionSelect(item)}>
                <Text style={styles.dropdownDot}>📍</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.dropdownTitle}>{item.name || item.display_name.split(',')[0]}</Text>
                  <Text style={styles.dropdownSubtitle} numberOfLines={1}>{item.display_name}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* POI Quick Filter Chips */}
        {!routeInfo && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
            <View style={styles.poiChipRow}>
              <TouchableOpacity
                style={[styles.poiChip, activePoiFilter === 'ev_charger' && styles.poiChipActiveEv]}
                onPress={() => handlePoiFilter('ev_charger')}
              >
                {poiLoading && activePoiFilter === 'ev_charger'
                  ? <ActivityIndicator size="small" color="#8B5CF6" />
                  : <Text style={styles.poiChipText}>⚡ EV Chargers</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.poiChip, activePoiFilter === 'bike_station' && styles.poiChipActiveBike]}
                onPress={() => handlePoiFilter('bike_station')}
              >
                {poiLoading && activePoiFilter === 'bike_station'
                  ? <ActivityIndicator size="small" color="#0EA5E9" />
                  : <Text style={styles.poiChipText}>🚲 Bikes</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.poiChip, activePoiFilter === 'police' && styles.poiChipActivePolice]}
                onPress={() => handlePoiFilter('police')}
              >
                {poiLoading && activePoiFilter === 'police'
                  ? <ActivityIndicator size="small" color="#3B82F6" />
                  : <Text style={styles.poiChipText}>🚓 Police</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.poiChip, activePoiFilter === 'hospital' && styles.poiChipActiveHospital]}
                onPress={() => handlePoiFilter('hospital')}
              >
                {poiLoading && activePoiFilter === 'hospital'
                  ? <ActivityIndicator size="small" color="#EF4444" />
                  : <Text style={styles.poiChipText}>🏥 Hospital</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </View>

      {/* ── SOS Button ── */}
      {!routeInfo && (
        <TouchableOpacity
          style={[styles.sosFloating, isTracking && { bottom: 220 }]}
          onPress={() => setShowSafety(true)}
        >
          <Text style={styles.sosFloatingIcon}>🛡️</Text>
        </TouchableOpacity>
      )}

      {/* ── Recenter Button ── */}
      {showRecenter && (
        <Animated.View style={[styles.recenterButton, { opacity: recenterOpacity }]}>
          <TouchableOpacity onPress={handleRecenter} style={styles.recenterInner}>
            <Text style={styles.recenterIcon}>🎯</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* ── Route Comparison Sheet (animated) ── */}
      {routeInfo && (
        <Animated.View style={[styles.bottomSheet, { transform: [{ translateY: sheetTranslateY }] }]}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Compare Routes</Text>
          <View style={styles.routesContainer}>
            {renderRouteOption('walk', 'Walk', '🚶')}
            {renderRouteOption('two_wheeler', 'Bike', '🛵')}
            {renderRouteOption('car', 'Car', '🚗')}
          </View>
          <TouchableOpacity
            style={styles.goButton}
            onPress={() => { setRouteInfo(null); setSearchQuery(''); }}
          >
            <Text style={styles.goButtonText}>GO ➜</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* ── Destination Preview (Like Google Maps) ── */}
      {destinationCoords && !routeInfo && (
        <Animated.View style={[styles.bottomSheet, { transform: [{ translateY: sheetTranslateY }] }]}>
          <Text style={styles.sheetTitle}>{searchQuery}</Text>
          <TouchableOpacity
            style={styles.goButton}
            onPress={handleGetDirections}
          >
            {isFetching ? <ActivityIndicator color="#fff" /> : <Text style={styles.goButtonText}>Directions ➜</Text>}
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* ── Tab Dashboard ── */}
      {!routeInfo && !destinationCoords && (
        <View style={[styles.tabPanel, !isTabPanelExpanded && { height: 60 }]}>
          <TouchableOpacity 
            style={styles.dragHandleContainer}
            onPress={() => setIsTabPanelExpanded(!isTabPanelExpanded)}
          >
            <View style={styles.sheetHandle} />
          </TouchableOpacity>
          <View style={styles.tabHeader}>
            {(['planner', 'track', 'rewards'] as const).map(tab => (
              <TouchableOpacity key={tab} onPress={() => setActiveTab(tab)} style={styles.tabBtn}>
                <Text style={[styles.tabBtnText, activeTab === tab && styles.tabBtnActive]}>
                  {tab === 'planner' ? '🗓️ Planner' : tab === 'track' ? '📍 Track' : '🏆 Rewards'}
                </Text>
                {activeTab === tab && <View style={styles.tabIndicator} />}
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.tabContent}>
            {activeTab === 'planner' && <PlannerScreen />}

            {activeTab === 'track' && (
              <View style={styles.trackTab}>
                <View style={styles.trackStatusBar}>
                  <View style={[styles.trackDot, isTracking && styles.trackDotActive]} />
                  <Text style={styles.trackStatusText}>
                    {isTracking ? `Live Tracking  •  ${recordedPath.length} points` : 'Ready to track'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.trackButton, isTracking && styles.trackButtonActive]}
                  onPress={toggleTracking}
                >
                  <Text style={styles.trackButtonText}>
                    {isTracking ? '⏹  STOP TRACKING' : '▶  START LIVE TRACK'}
                  </Text>
                </TouchableOpacity>
                {recordedPath.length > 1 && (
                  <Text style={styles.trackDistance}>
                    Distance so far: {getDistanceFromPath(recordedPath).toFixed(3)} km
                  </Text>
                )}
              </View>
            )}

            {activeTab === 'rewards' && <RewardsScreen />}
          </View>
        </View>
      )}

      {/* Modals */}
      <Modal visible={showProfile} animationType="slide">
        <ProfileScreen onClose={() => setShowProfile(false)} />
      </Modal>
      <Modal visible={showSafety} animationType="slide">
        <SafetyScreen onClose={() => setShowSafety(false)} />
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  // Top search
  topContainer: { position: 'absolute', top: 60, left: 16, right: 16, zIndex: 25 },
  searchRow: { flexDirection: 'row', alignItems: 'center' },
  searchContainer: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8,
  },
  searchIcon: { fontSize: 18, marginRight: 10 },
  searchInput: { flex: 1, fontSize: 16, color: '#111', fontWeight: '500' },
  profileButton: {
    backgroundColor: 'rgba(255,255,255,0.95)', padding: 14, borderRadius: 22, marginLeft: 12,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, elevation: 6,
  },
  profileIcon: { fontSize: 22 },

  // Dropdown
  dropdown: {
    backgroundColor: '#fff', borderRadius: 18, marginTop: 8, paddingVertical: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5,
  },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  dropdownDot: { fontSize: 18, marginRight: 10 },
  dropdownTitle: { fontSize: 15, fontWeight: '600', color: '#222' },
  dropdownSubtitle: { fontSize: 11, color: '#999', marginTop: 1 },

  // POI Chips
  poiChipRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 4, paddingBottom: 8 },
  poiChip: {
    backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 9,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, elevation: 3,
    borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  poiChipActiveEv: { backgroundColor: '#F3E8FF', borderColor: '#8B5CF6' },
  poiChipActiveBike: { backgroundColor: '#E0F2FE', borderColor: '#0EA5E9' },
  poiChipActivePolice: { backgroundColor: '#DBEAFE', borderColor: '#3B82F6' },
  poiChipActiveHospital: { backgroundColor: '#FEE2E2', borderColor: '#EF4444' },
  poiChipText: { fontSize: 13, fontWeight: '700', color: '#333' },

  // SOS
  sosFloating: {
    position: 'absolute', bottom: 220, right: 16, backgroundColor: '#FF3B30',
    width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center',
    shadowColor: '#FF3B30', shadowOpacity: 0.5, shadowRadius: 12, elevation: 8,
  },
  sosFloatingIcon: { fontSize: 22 },

  // Weather Banner
  weatherBanner: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
    marginTop: 4
  },
  weatherIcon: { fontSize: 18, marginRight: 8 },
  weatherText: { fontSize: 12, color: '#555', fontWeight: '600', flex: 1 },

  // Recenter
  recenterButton: {
    position: 'absolute', bottom: 280, left: 16,
  },
  recenterInner: {
    backgroundColor: '#fff', width: 48, height: 48, borderRadius: 24,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, elevation: 6,
  },
  recenterIcon: { fontSize: 22 },

  // Bottom sheet (route comparison)
  bottomSheet: {
    position: 'absolute', bottom: 30, left: 16, right: 16,
    backgroundColor: 'rgba(255,255,255,0.98)', borderRadius: 32, padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 15,
    zIndex: 30, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)',
  },
  sheetHandle: { width: 40, height: 5, backgroundColor: '#E5E7EB', borderRadius: 2.5, alignSelf: 'center', marginBottom: 20 },
  sheetTitle: { fontSize: 22, fontWeight: '800', color: '#111', marginBottom: 18, letterSpacing: -0.5 },
  routesContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  routeOption: {
    alignItems: 'center', backgroundColor: '#F5F7FA', paddingVertical: 14,
    paddingHorizontal: 12, borderRadius: 18, width: '30%',
    borderWidth: 1.5, borderColor: 'transparent',
  },
  routeOptionSelected: { backgroundColor: '#ECFDF5', borderColor: '#34D399' },
  routeIcon: { fontSize: 24, marginBottom: 6 },
  routeTitle: { fontSize: 13, fontWeight: '700', color: '#333', marginBottom: 3 },
  routeDetail: { fontSize: 11, color: '#666', marginBottom: 2 },
  routeEmissions: { fontSize: 11, color: '#10B981', fontWeight: '700' },
  textSelected: { color: '#059669' },
  goButton: {
    backgroundColor: '#111', borderRadius: 18, paddingVertical: 16, alignItems: 'center',
  },
  goButtonText: { color: '#fff', fontSize: 17, fontWeight: '800' },

  // Tab Panel
  tabPanel: {
    position: 'absolute', bottom: 24, left: 16, right: 16,
    backgroundColor: 'rgba(255,255,255,0.96)', borderRadius: 32,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 12,
    height: 420, zIndex: 25, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)',
  },
  dragHandleContainer: { width: '100%', alignItems: 'center', paddingTop: 14, paddingBottom: 6 },
  tabHeader: {
    flexDirection: 'row', paddingTop: 16, paddingHorizontal: 8,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F5',
  },
  tabBtn: { flex: 1, alignItems: 'center', paddingBottom: 12 },
  tabBtnText: { fontSize: 12, fontWeight: '600', color: '#999' },
  tabBtnActive: { color: '#111', fontWeight: '800' },
  tabIndicator: { position: 'absolute', bottom: 0, height: 3, width: '60%', backgroundColor: '#34D399', borderRadius: 2 },
  tabContent: { flex: 1 },

  // Track tab
  trackTab: { alignItems: 'center', padding: 24, gap: 16 },
  trackStatusBar: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  trackDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#D1D5DB' },
  trackDotActive: { backgroundColor: '#22C55E' },
  trackStatusText: { fontSize: 14, color: '#555', fontWeight: '600' },
  trackButton: {
    backgroundColor: '#34D399', paddingVertical: 14, paddingHorizontal: 36,
    borderRadius: 22, shadowColor: '#34D399', shadowOpacity: 0.5, shadowRadius: 10, elevation: 5,
  },
  trackButtonActive: { backgroundColor: '#EF4444', shadowColor: '#EF4444' },
  trackButtonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  trackDistance: { fontSize: 13, color: '#34D399', fontWeight: '700' },
});
