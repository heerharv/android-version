import React, { useEffect, useState } from 'react';
import {
  View, StyleSheet, Text, TouchableOpacity, ScrollView,
  Dimensions, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LineChart, PieChart } from 'react-native-chart-kit';
import * as Haptics from 'expo-haptics';
import { userDataManager } from '../services/UserDataManager';
import { supabase } from '../services/SupabaseClient';

interface ProfileScreenProps {
  onClose: () => void;
}

const screenWidth = Dimensions.get('window').width;

const chartConfig = {
  backgroundGradientFrom: '#fff',
  backgroundGradientTo: '#fff',
  color: (opacity = 1) => `rgba(52, 211, 153, ${opacity})`, // #34D399
  labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
  strokeWidth: 2,
  barPercentage: 0.5,
  useShadowColorFromDataset: false,
};

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ onClose }) => {
  const [carbonSaved, setCarbonSaved] = useState<number>(0);
  const [tripCount, setTripCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [email, setEmail] = useState('eco.warrior@econavi.app');

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  }, []);

  const loadStats = async () => {
    const savings = await userDataManager.fetchTotalCarbonSaved();
    setCarbonSaved(savings);
    
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      setEmail(session.user.email || 'guest@econavi.app');
      const { count } = await supabase
        .from('trip_emissions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', session.user.id);
      setTripCount(count || 0);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  const weeklyData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [{
      data: [0.8, 1.2, 0.5, 2.1, 1.8, 3.2, 2.5], // Dynamic data would go here
    }],
  };

  const pieData = [
    { name: 'Walk', population: 35, color: '#34D399', legendFontColor: '#7F7F7F', legendFontSize: 12 },
    { name: 'Bike', population: 45, color: '#0EA5E9', legendFontColor: '#7F7F7F', legendFontSize: 12 },
    { name: 'Bus', population: 15, color: '#F59E0B', legendFontColor: '#7F7F7F', legendFontSize: 12 },
    { name: 'Car', population: 5, color: '#EF4444', legendFontColor: '#7F7F7F', legendFontSize: 12 },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📊 Eco Profile</Text>
        <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
          <Text style={styles.closeText}>Done</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{email[0].toUpperCase()}</Text>
            <View style={styles.verifiedBadge}><Text style={{fontSize: 8}}>✓</Text></View>
          </View>
          <Text style={styles.userName}>Eco Knight</Text>
          <Text style={styles.userEmail}>{email}</Text>
        </View>

        {/* Stats Row */}
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{carbonSaved.toFixed(1)}kg</Text>
            <Text style={styles.statLabel}>Saved Total</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{tripCount}</Text>
            <Text style={styles.statLabel}>Eco Trips</Text>
          </View>
        </View>

        {/* Weekly Trend Chart */}
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Weekly Savings Trend</Text>
          <LineChart
            data={weeklyData}
            width={screenWidth - 72}
            height={180}
            chartConfig={chartConfig}
            bezier
            style={styles.chart}
            withInnerLines={false}
            withOuterLines={false}
          />
        </View>

        {/* Mode Distribution Chart */}
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Transport Distribution</Text>
          <PieChart
            data={pieData}
            width={screenWidth - 80}
            height={160}
            chartConfig={chartConfig}
            accessor="population"
            backgroundColor="transparent"
            paddingLeft="15"
            absolute
          />
        </View>

        {/* Settings */}
        <View style={styles.actionCard}>
           <TouchableOpacity style={styles.actionRow}>
             <Text style={styles.actionLabel}>Push Notifications</Text>
             <Text style={styles.actionVal}>On</Text>
           </TouchableOpacity>
           <TouchableOpacity style={styles.actionRow}>
             <Text style={styles.actionLabel}>Privacy Settings</Text>
             <Text style={styles.actionArrow}>›</Text>
           </TouchableOpacity>
           <TouchableOpacity style={[styles.actionRow, { borderBottomWidth: 0 }]}>
             <Text style={[styles.actionLabel, { color: '#EF4444' }]}>Sign Out</Text>
           </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FB' },
  header: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24, paddingVertical: 16, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#F0F0F5'
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#111' },
  closeButton: { backgroundColor: '#F3F4F6', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
  closeText: { fontSize: 14, fontWeight: '700', color: '#111' },

  content: { padding: 20 },
  profileHeader: { alignItems: 'center', marginBottom: 24 },
  avatar: { 
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#34D399', 
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
    shadowColor: '#34D399', shadowOpacity: 0.3, shadowRadius: 10, elevation: 5
  },
  avatarText: { fontSize: 32, fontWeight: 'bold', color: '#fff' },
  verifiedBadge: { position: 'absolute', bottom: 0, right: 0, width: 20, height: 20, borderRadius: 10, backgroundColor: '#0EA5E9', borderWidth: 2, borderColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  userName: { fontSize: 20, fontWeight: '800', color: '#111' },
  userEmail: { fontSize: 13, color: '#888', marginTop: 4 },

  statsCard: { 
    flexDirection: 'row', backgroundColor: '#fff', borderRadius: 24, padding: 20,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, elevation: 3,
    marginBottom: 20
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '800', color: '#059669' },
  statLabel: { fontSize: 11, color: '#888', marginTop: 4, fontWeight: '600' },
  statDivider: { width: 1, height: '60%', backgroundColor: '#F3F4F6', alignSelf: 'center' },

  chartCard: { 
    backgroundColor: '#fff', borderRadius: 24, padding: 20, marginBottom: 20,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, elevation: 3,
  },
  chartTitle: { fontSize: 15, fontWeight: '700', color: '#333', marginBottom: 16 },
  chart: { marginRight: -20, marginTop: 10 },

  actionCard: { 
    backgroundColor: '#fff', borderRadius: 24, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, elevation: 3,
    marginBottom: 40
  },
  actionRow: { 
    flexDirection: 'row', justifyContent: 'space-between', padding: 20,
    borderBottomWidth: 1, borderBottomColor: '#F9FAFB', alignItems: 'center'
  },
  actionLabel: { fontSize: 15, fontWeight: '600', color: '#333' },
  actionVal: { fontSize: 14, color: '#888' },
  actionArrow: { color: '#D1D5DB', fontSize: 18 },
});
