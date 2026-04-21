import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { locationManager, LocationState } from '../services/LocationManager';
import { RouteInfo } from '../services/RouteService';
import { PoiMarker } from '../services/PoiService';

type Coordinate = { latitude: number; longitude: number; };

type MapComponentProps = {
  route?: RouteInfo | null;
  destination?: Coordinate | null;
  recordedPath?: LocationState[];
  poiMarkers?: PoiMarker[];
  onUserPan?: () => void;
};

export interface MapComponentRef {
  recenterToUser: () => void;
  focusOn: (coord: Coordinate) => void;
}

const ecoMidnightStyle = [
  { "elementType": "geometry", "stylers": [{ "color": "#242f3e" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#242f3e" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#746855" }] },
  { "featureType": "administrative.locality", "elementType": "labels.text.fill", "stylers": [{ "color": "#d59563" }] },
  { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#34D399" }] },
  { "featureType": "poi.park", "elementType": "geometry", "stylers": [{ "color": "#263c3f" }] },
  { "featureType": "poi.park", "elementType": "labels.text.fill", "stylers": [{ "color": "#6b9a76" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#38414e" }] },
  { "featureType": "road", "elementType": "geometry.stroke", "stylers": [{ "color": "#212a37" }] },
  { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "color": "#9ca5b1" }] },
  { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#746855" }] },
  { "featureType": "road.highway", "elementType": "geometry.stroke", "stylers": [{ "color": "#1f2835" }] },
  { "featureType": "road.highway", "elementType": "labels.text.fill", "stylers": [{ "color": "#f3d19c" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#17263c" }] },
  { "featureType": "water", "elementType": "labels.text.fill", "stylers": [{ "color": "#515c6d" }] },
  { "featureType": "water", "elementType": "labels.text.stroke", "stylers": [{ "color": "#17263c" }] }
];

export const MapComponent = forwardRef<MapComponentRef, MapComponentProps>(
  ({ route, destination, recordedPath, poiMarkers, onUserPan }, ref) => {
    const mapRef = useRef<MapView>(null);

    useImperativeHandle(ref, () => ({
      recenterToUser: () => {
        const loc = locationManager.getLocation();
        if (loc && mapRef.current) {
          mapRef.current.animateToRegion({
            latitude: loc.latitude,
            longitude: loc.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }, 600);
        }
      },
      focusOn: (coord: Coordinate) => {
        if (mapRef.current) {
          mapRef.current.animateToRegion({
            latitude: coord.latitude,
            longitude: coord.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }, 600);
        }
      }
    }));

    useEffect(() => {
      locationManager.getCurrentLocation().then(loc => {
        if (loc && mapRef.current) {
          mapRef.current.animateToRegion({
            latitude: loc.latitude,
            longitude: loc.longitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }, 400);
        }
      });
    }, []);

    useEffect(() => {
      if (route && route.coordinates.length > 0 && mapRef.current) {
        mapRef.current.fitToCoordinates(route.coordinates, {
          edgePadding: { top: 100, right: 50, bottom: 400, left: 50 },
          animated: true,
        });
      }
    }, [route]);

    useEffect(() => {
      if (recordedPath && recordedPath.length > 0 && mapRef.current) {
        mapRef.current.animateToRegion({
          latitude: recordedPath[recordedPath.length - 1].latitude,
          longitude: recordedPath[recordedPath.length - 1].longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }, 500);
      }
    }, [recordedPath]);

    return (
      <View style={styles.container}>
        <MapView
          ref={mapRef}
          style={styles.map}
          customMapStyle={ecoMidnightStyle}
          initialRegion={{
            latitude: 12.9716,
            longitude: 77.5946,
            latitudeDelta: 0.15,
            longitudeDelta: 0.15,
          }}
          showsUserLocation={true}
          showsMyLocationButton={false}
          onPanDrag={onUserPan}
        >
          {destination && (
            <Marker coordinate={destination} title="Destination" pinColor="red" />
          )}

          {route && route.coordinates.length > 0 && (
            <Polyline
              coordinates={route.coordinates}
              strokeColor="#34D399"
              strokeWidth={5}
              lineCap="round"
              lineJoin="round"
            />
          )}

          {recordedPath && recordedPath.length > 1 && (
            <Polyline
              coordinates={recordedPath}
              strokeColor="#EF4444"
              strokeWidth={4}
              lineCap="round"
              lineJoin="round"
            />
          )}

          {poiMarkers && poiMarkers.map(poi => (
            <Marker
              key={poi.id}
              coordinate={{ latitude: poi.latitude, longitude: poi.longitude }}
              title={poi.name}
              description={poi.type === 'ev_charger' ? '⚡ EV Charging' : poi.type === 'bike_station' ? '🚲 Bike Hub' : poi.type === 'police' ? '🚓 Police Station' : '🏥 Hospital'}
              pinColor={poi.type === 'ev_charger' ? '#A78BFA' : poi.type === 'bike_station' ? '#38BDF8' : poi.type === 'police' ? '#3B82F6' : '#EF4444'}
            />
          ))}
        </MapView>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
});
