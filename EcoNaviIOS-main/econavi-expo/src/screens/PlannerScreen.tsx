import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Platform
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Location from 'expo-location';
import { routeService } from '../services/RouteService';
import { carbonEmissionForTrip, calculateTravelTime, formatEmissions } from '../utils/EmissionsCalculator';

interface TravelSummary {
  destination: string;
  distanceKm: number;
  durationMin: number;
  co2Kg: number;
  mode: string;
  eta: Date;
}

interface AlternativeOption {
  mode: string;
  icon: string;
  durationMin: number;
  co2Kg: number;
}

const MODES = [
  { key: 'walk', label: 'Walk', icon: '🚶' },
  { key: 'two_wheeler', label: 'Bike', icon: '🛵' },
  { key: 'car', label: 'Car', icon: '🚗' },
  { key: 'transit', label: 'Bus', icon: '🚌' },
];

export const PlannerScreen: React.FC = () => {
  const [destination, setDestination] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [selectedMode, setSelectedMode] = useState('car');
  const [date, setDate] = useState(new Date());
  const [time, setTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [summary, setSummary] = useState<TravelSummary | null>(null);
  const [alternatives, setAlternatives] = useState<AlternativeOption[]>([]);

  // Debounced autocomplete
  const [debounceTimer, setDebounceTimer] = useState<any>(null);
  const handleDestinationChange = (text: string) => {
    setDestination(text);
    if (debounceTimer) clearTimeout(debounceTimer);
    if (text.length < 3) { setSuggestions([]); return; }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(text)}&limit=4`);
        const data = await res.json();
        setSuggestions(data);
      } catch {}
    }, 500);
    setDebounceTimer(timer);
  };

  const handleSuggestionSelect = (item: any) => {
    setDestination(item.display_name.split(',')[0]);
    setSuggestions([]);
  };

  const handleCalculate = async () => {
    if (!destination.trim()) return;
    setIsCalculating(true);
    setSummary(null);
    try {
      const geo = await Location.geocodeAsync(destination);
      if (!geo.length) { alert('Destination not found'); return; }

      const { getCurrentPositionAsync, Accuracy } = Location;
      const pos = await getCurrentPositionAsync({ accuracy: Accuracy.Balanced });
      const origin = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      const dest = { latitude: geo[0].latitude, longitude: geo[0].longitude };

      const route = await routeService.fetchDrivingRoute(origin, dest);
      const dist = route?.distanceKm ?? 5;
      const dur = calculateTravelTime(selectedMode, dist);
      const co2 = carbonEmissionForTrip(dist, selectedMode);

      const departureDt = new Date(date);
      departureDt.setHours(time.getHours(), time.getMinutes());
      const eta = new Date(departureDt.getTime() + dur * 60 * 1000);

      setSummary({
        destination: destination,
        distanceKm: dist,
        durationMin: Math.round(dur),
        co2Kg: co2,
        mode: selectedMode,
        eta,
      });

      // Alternatives
      const alts: AlternativeOption[] = MODES
        .filter(m => m.key !== selectedMode)
        .map(m => ({
          mode: m.label,
          icon: m.icon,
          durationMin: Math.round(calculateTravelTime(m.key, dist)),
          co2Kg: carbonEmissionForTrip(dist, m.key),
        }))
        .sort((a, b) => a.co2Kg - b.co2Kg);
      setAlternatives(alts);
    } catch (e) {
      console.error(e);
      alert('Failed to calculate route.');
    } finally {
      setIsCalculating(false);
    }
  };

  const formatTime = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const formatDate = (d: Date) => d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🗓️ Travel Planner</Text>
        <Text style={styles.headerSub}>Plan eco-friendly trips ahead</Text>
      </View>

      {/* Form card */}
      <View style={styles.card}>
        {/* Destination */}
        <Text style={styles.fieldLabel}>📍 Destination</Text>
        <TextInput
          style={styles.input}
          placeholder="Where are you going?"
          value={destination}
          onChangeText={handleDestinationChange}
          placeholderTextColor="#999"
        />
        {suggestions.length > 0 && (
          <View style={styles.suggestionBox}>
            {suggestions.map((s, i) => (
              <TouchableOpacity key={i} style={styles.suggestionItem} onPress={() => handleSuggestionSelect(s)}>
                <Text style={styles.suggestionText} numberOfLines={1}>📍 {s.display_name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Date */}
        <Text style={[styles.fieldLabel, { marginTop: 16 }]}>📅 Departure Date</Text>
        <TouchableOpacity style={styles.pickerButton} onPress={() => setShowDatePicker(true)}>
          <Text style={styles.pickerButtonText}>{formatDate(date)}</Text>
        </TouchableOpacity>
        {showDatePicker && (
          <DateTimePicker
            value={date}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            minimumDate={new Date()}
            onChange={(_, d) => { setShowDatePicker(false); if (d) setDate(d); }}
          />
        )}

        {/* Time */}
        <Text style={[styles.fieldLabel, { marginTop: 16 }]}>🕐 Departure Time</Text>
        <TouchableOpacity style={styles.pickerButton} onPress={() => setShowTimePicker(true)}>
          <Text style={styles.pickerButtonText}>{formatTime(time)}</Text>
        </TouchableOpacity>
        {showTimePicker && (
          <DateTimePicker
            value={time}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(_, t) => { setShowTimePicker(false); if (t) setTime(t); }}
          />
        )}

        {/* Transport Mode */}
        <Text style={[styles.fieldLabel, { marginTop: 16 }]}>🚀 Transport Mode</Text>
        <View style={styles.modesRow}>
          {MODES.map(m => (
            <TouchableOpacity
              key={m.key}
              style={[styles.modeChip, selectedMode === m.key && styles.modeChipActive]}
              onPress={() => setSelectedMode(m.key)}
            >
              <Text style={styles.modeIcon}>{m.icon}</Text>
              <Text style={[styles.modeLabel, selectedMode === m.key && styles.modeLabelActive]}>{m.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Calculate button */}
        <TouchableOpacity
          style={[styles.calcButton, (!destination || isCalculating) && styles.calcButtonDisabled]}
          onPress={handleCalculate}
          disabled={!destination || isCalculating}
        >
          {isCalculating
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.calcButtonText}>⚡ Calculate Impact</Text>
          }
        </TouchableOpacity>
      </View>

      {/* Summary card */}
      {summary && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Trip Summary</Text>
          <View style={styles.summaryGrid}>
            {[
              { label: 'Distance', value: `${summary.distanceKm.toFixed(1)} km` },
              { label: 'Duration', value: `${summary.durationMin} min` },
              { label: 'ETA', value: formatTime(summary.eta) },
              { label: 'CO₂', value: formatEmissions(summary.co2Kg) },
            ].map(item => (
              <View key={item.label} style={styles.summaryCell}>
                <Text style={styles.summaryCellVal}>{item.value}</Text>
                <Text style={styles.summaryCellLbl}>{item.label}</Text>
              </View>
            ))}
          </View>

          {/* CO2 bar */}
          <View style={styles.co2Bar}>
            <Text style={styles.co2Label}>🍃 Carbon Impact</Text>
            <View style={styles.co2Track}>
              <View style={[styles.co2Fill, {
                width: `${Math.min((summary.co2Kg / 2) * 100, 100)}%`,
                backgroundColor: summary.co2Kg < 0.5 ? '#34D399' : summary.co2Kg < 1.5 ? '#F59E0B' : '#EF4444',
              }]} />
            </View>
            <Text style={styles.co2Value}>{formatEmissions(summary.co2Kg)}</Text>
          </View>
        </View>
      )}

      {/* Alternatives */}
      {alternatives.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>💡 Greener Alternatives</Text>
          {alternatives.map((alt, i) => (
            <View key={i} style={styles.altRow}>
              <Text style={styles.altIcon}>{alt.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.altMode}>{alt.mode}</Text>
                <Text style={styles.altDuration}>{alt.durationMin} min</Text>
              </View>
              <Text style={[styles.altCo2, { color: i === 0 ? '#34D399' : '#888' }]}>{formatEmissions(alt.co2Kg)}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  content: { padding: 20, paddingBottom: 40 },
  header: { marginBottom: 20 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#111' },
  headerSub: { fontSize: 13, color: '#888', marginTop: 4 },

  card: {
    backgroundColor: '#fff', borderRadius: 24, padding: 20, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 10, elevation: 3,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#333', marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 8 },

  input: {
    backgroundColor: '#F5F7FA', borderRadius: 14, padding: 14,
    fontSize: 15, color: '#111', borderWidth: 1, borderColor: '#E5E7EB',
  },
  suggestionBox: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden', marginTop: 4 },
  suggestionItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F5' },
  suggestionText: { fontSize: 14, color: '#333' },

  pickerButton: {
    backgroundColor: '#F5F7FA', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#E5E7EB',
  },
  pickerButtonText: { fontSize: 15, color: '#111' },

  modesRow: { flexDirection: 'row', gap: 8 },
  modeChip: {
    flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 14,
    backgroundColor: '#F5F7FA', borderWidth: 1, borderColor: '#E5E7EB',
  },
  modeChipActive: { backgroundColor: '#ECFDF5', borderColor: '#34D399' },
  modeIcon: { fontSize: 20, marginBottom: 4 },
  modeLabel: { fontSize: 11, color: '#888', fontWeight: '600' },
  modeLabelActive: { color: '#059669' },

  calcButton: {
    marginTop: 20, backgroundColor: '#111', borderRadius: 16,
    paddingVertical: 16, alignItems: 'center',
  },
  calcButtonDisabled: { opacity: 0.4 },
  calcButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  summaryCell: {
    flex: 1, minWidth: '40%', backgroundColor: '#F5F7FA', borderRadius: 14,
    padding: 14, alignItems: 'center',
  },
  summaryCellVal: { fontSize: 18, fontWeight: '800', color: '#111' },
  summaryCellLbl: { fontSize: 11, color: '#888', marginTop: 2 },

  co2Bar: { marginTop: 4 },
  co2Label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 8 },
  co2Track: { height: 10, backgroundColor: '#F0F0F5', borderRadius: 99, overflow: 'hidden', marginBottom: 6 },
  co2Fill: { height: '100%', borderRadius: 99 },
  co2Value: { fontSize: 13, color: '#555', textAlign: 'right' },

  altRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F5',
  },
  altIcon: { fontSize: 24, marginRight: 12 },
  altMode: { fontSize: 15, fontWeight: '600', color: '#222' },
  altDuration: { fontSize: 12, color: '#888', marginTop: 2 },
  altCo2: { fontSize: 15, fontWeight: '700' },
});
