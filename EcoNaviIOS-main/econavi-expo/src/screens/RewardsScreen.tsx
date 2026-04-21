import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Animated, Easing
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../services/SupabaseClient';

interface RewardsScreenProps {
  visible?: boolean;
}

const MONTHLY_BUDGET_KG = 100;

interface Badge {
  id: string;
  name: string;
  icon: string;
  description: string;
  threshold: number;
}

const BADGES: Badge[] = [
  { id: 'seedling', name: 'Seedling 🌱', icon: '🌱', description: 'First eco-trip logged!', threshold: 0.1 },
  { id: 'leaf', name: 'Green Leaf 🍃', icon: '🍃', description: 'Saved 5 kg CO₂ this month', threshold: 5 },
  { id: 'tree', name: 'Tree Hugger 🌳', icon: '🌳', description: 'Saved 20 kg CO₂ this month', threshold: 20 },
  { id: 'warrior', name: 'Eco Warrior ⚡', icon: '⚡', description: 'Saved 50 kg CO₂ this month', threshold: 50 },
  { id: 'pioneer', name: 'Zero-Emission Pioneer 🚀', icon: '🚀', description: 'Stayed under budget all month!', threshold: 100 },
];

export const RewardsScreen: React.FC<RewardsScreenProps> = () => {
  const [totalEmittedKg, setTotalEmittedKg] = useState(0);
  const [tripCount, setTripCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const ringAnim = useRef(new Animated.Value(0)).current;

  const remainingKg = Math.max(0, MONTHLY_BUDGET_KG - totalEmittedKg);
  const progress = Math.min(remainingKg / MONTHLY_BUDGET_KG, 1);
  const savedKg = totalEmittedKg; // simplified: what they emitted vs if they drove
  const overBudget = totalEmittedKg > MONTHLY_BUDGET_KG;

  const earnedBadges = BADGES.filter(b => savedKg >= b.threshold);

  useEffect(() => {
    fetchMonthlyStats();
  }, []);

  useEffect(() => {
    Animated.timing(ringAnim, {
      toValue: progress,
      duration: 1200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const fetchMonthlyStats = async () => {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }

      const { data } = await supabase
        .from('trip_emissions')
        .select('carbon_emission')
        .eq('user_id', session.user.id)
        .gte('created_at', startOfMonth);

      if (data) {
        const total = data.reduce((sum, t) => sum + t.carbon_emission, 0);
        setTotalEmittedKg(total);
        setTripCount(data.length);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const ringColor = overBudget ? '#FF3B30' : '#34D399';
  const monthName = new Date().toLocaleString('default', { month: 'long' });

  // Circumference for SVG-style ring via border trick
  const SIZE = 200;
  const circumference = Math.PI * SIZE;

  const strokeDashoffset = ringAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🏆 Eco Rewards</Text>
        <Text style={styles.headerSub}>{monthName} · Resets on the 1st</Text>
      </View>

      {/* Budget Ring Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Monthly Carbon Budget</Text>
        <View style={styles.ringWrapper}>
          {/* Outer gray track */}
          <View style={[styles.ringTrack, { borderColor: '#E5E7EB' }]} />
          {/* Animated ring — simulated with animated border */}
          <Animated.View
            style={[
              styles.ringProgress,
              {
                borderColor: ringColor,
                transform: [
                  {
                    rotate: ringAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['-180deg', '0deg'],
                    }),
                  },
                ],
              },
            ]}
          />
          {/* Center text */}
          <View style={styles.ringCenter}>
            <Text style={[styles.ringValue, { color: overBudget ? '#FF3B30' : '#111' }]}>
              {remainingKg.toFixed(0)} kg
            </Text>
            <Text style={styles.ringLabel}>remaining</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statPill}>
            <Text style={styles.statVal}>{totalEmittedKg.toFixed(1)} kg</Text>
            <Text style={styles.statLbl}>Emitted</Text>
          </View>
          <View style={styles.statPill}>
            <Text style={styles.statVal}>{MONTHLY_BUDGET_KG} kg</Text>
            <Text style={styles.statLbl}>Budget</Text>
          </View>
          <View style={styles.statPill}>
            <Text style={styles.statVal}>{tripCount}</Text>
            <Text style={styles.statLbl}>Trips</Text>
          </View>
        </View>

        {overBudget && (
          <View style={styles.warningBanner}>
            <Text style={styles.warningText}>⚠️ You've exceeded your monthly carbon budget by {(totalEmittedKg - MONTHLY_BUDGET_KG).toFixed(1)} kg</Text>
          </View>
        )}
      </View>

      {/* Badges */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Your Badges</Text>
        {BADGES.map(badge => {
          const earned = savedKg >= badge.threshold;
          return (
            <View key={badge.id} style={[styles.badgeRow, !earned && styles.badgeLocked]}>
              <Text style={styles.badgeIcon}>{badge.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.badgeName, !earned && { color: '#AAA' }]}>{badge.name}</Text>
                <Text style={styles.badgeDesc}>{badge.description}</Text>
              </View>
              {earned && <Text style={styles.badgeCheck}>✓</Text>}
            </View>
          );
        })}
      </View>

      {/* Tip */}
      <View style={[styles.card, styles.tipCard]}>
        <Text style={styles.tipText}>💡 Tip: Choose Walk or Bike mode for short trips to earn badges faster!</Text>
      </View>
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

  ringWrapper: { alignItems: 'center', justifyContent: 'center', height: 220, marginBottom: 20 },
  ringTrack: {
    position: 'absolute', width: 180, height: 180, borderRadius: 90,
    borderWidth: 16, borderColor: '#E5E7EB',
  },
  ringProgress: {
    position: 'absolute', width: 180, height: 180, borderRadius: 90,
    borderWidth: 16, borderColor: '#34D399',
    borderBottomColor: 'transparent', borderLeftColor: 'transparent',
  },
  ringCenter: { alignItems: 'center' },
  ringValue: { fontSize: 32, fontWeight: '800' },
  ringLabel: { fontSize: 13, color: '#888', marginTop: 2 },

  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  statPill: { alignItems: 'center', backgroundColor: '#F5F7FA', borderRadius: 16, paddingVertical: 12, paddingHorizontal: 16 },
  statVal: { fontSize: 18, fontWeight: '700', color: '#111' },
  statLbl: { fontSize: 11, color: '#888', marginTop: 2 },

  warningBanner: { marginTop: 16, backgroundColor: '#FFF1F0', borderRadius: 12, padding: 12, borderLeftWidth: 3, borderLeftColor: '#FF3B30' },
  warningText: { color: '#FF3B30', fontSize: 13, fontWeight: '600' },

  badgeRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F5' },
  badgeLocked: { opacity: 0.4 },
  badgeIcon: { fontSize: 28, marginRight: 14 },
  badgeName: { fontSize: 15, fontWeight: '700', color: '#222' },
  badgeDesc: { fontSize: 12, color: '#888', marginTop: 2 },
  badgeCheck: { fontSize: 18, color: '#34D399', fontWeight: 'bold' },

  tipCard: { backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#D1FAE5' },
  tipText: { fontSize: 14, color: '#065F46', lineHeight: 20 },
});
