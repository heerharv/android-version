import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { locationManager } from '../services/LocationManager';

interface SafetyScreenProps {
  onClose: () => void;
}

export const SafetyScreen: React.FC<SafetyScreenProps> = ({ onClose }) => {
  const [pulseAnim] = useState(new Animated.Value(1));
  const [address, setAddress] = useState('Fetching location...');

  useEffect(() => {
    // Basic pulse animation for SOS button
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    // Fake coordinate resolution for demo
    const loc = locationManager.getLocation();
    if (loc) {
      setAddress(`Lat: ${loc.latitude.toFixed(4)}, Lon: ${loc.longitude.toFixed(4)}`);
    } else {
      setAddress('Ready to Broadcast');
    }
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Emergency SOS</Text>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeText}>Close</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <Animated.View style={[styles.pulseCircle, { transform: [{ scale: pulseAnim }] }]} />
        <TouchableOpacity style={styles.sosButton} activeOpacity={0.8} onPress={() => alert('SOS Broadcasted!')}>
          <Text style={styles.sosText}>SOS</Text>
        </TouchableOpacity>

        <Text style={styles.warningText}>Press to trigger emergency protocol</Text>

        <View style={styles.locationCard}>
          <Text style={styles.locationTitle}>Your Current Location</Text>
          <Text style={styles.locationAddress}>{address}</Text>
        </View>

        <View style={styles.contactsCard}>
          <Text style={styles.contactsTitle}>Emergency Contacts (Notified)</Text>
          <Text style={styles.contactItem}>• Mom (555-0192)</Text>
          <Text style={styles.contactItem}>• Local Authorities</Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1C1C1E' },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, alignItems: 'center' },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  closeButton: { padding: 8 },
  closeText: { fontSize: 16, color: '#0A84FF', fontWeight: 'bold' },
  content: { padding: 20, alignItems: 'center', flex: 1, justifyContent: 'center' },

  pulseCircle: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255, 59, 48, 0.3)', top: '15%' },
  sosButton: {
    width: 150, height: 150, borderRadius: 75, backgroundColor: '#FF3B30',
    justifyContent: 'center', alignItems: 'center', marginBottom: 24,
    shadowColor: '#FF3B30', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 20, elevation: 10
  },
  sosText: { fontSize: 40, fontWeight: '900', color: '#fff' },
  warningText: { fontSize: 16, color: '#aaa', marginBottom: 60 },

  locationCard: { width: '100%', backgroundColor: '#2C2C2E', padding: 20, borderRadius: 16, marginBottom: 16 },
  locationTitle: { color: '#8E8E93', fontSize: 14, marginBottom: 8 },
  locationAddress: { color: '#fff', fontSize: 16, fontWeight: '500' },

  contactsCard: { width: '100%', backgroundColor: '#2C2C2E', padding: 20, borderRadius: 16 },
  contactsTitle: { color: '#8E8E93', fontSize: 14, marginBottom: 12 },
  contactItem: { color: '#fff', fontSize: 16, marginBottom: 6 }
});
