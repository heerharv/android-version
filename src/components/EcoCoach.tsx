import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { supabase } from '../services/SupabaseClient';

interface CoachAdvice {
  text: string;
  type: 'success' | 'info' | 'action';
}

export const EcoCoach: React.FC = () => {
  const [advice, setAdvice] = useState<CoachAdvice>({
    text: "Analyzing your travel patterns...",
    type: 'info'
  });
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    generateAdvice();
  }, []);

  const generateAdvice = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setAdvice({ text: "Sign in to get personalized eco-tips!", type: 'info' });
        return;
      }

      const { data } = await supabase
        .from('trip_emissions')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!data || data.length === 0) {
        setAdvice({ text: "Welcome! Record your first trip to get smart eco-tips.", type: 'info' });
      } else {
        const carTrips = data.filter(t => t.transport_mode === 'car').length;
        const totalSaved = data.reduce((acc, t) => acc + (t.transport_mode !== 'car' ? t.carbon_emission : 0), 0);

        if (carTrips > 3) {
          setAdvice({ 
            text: "You've taken several car trips lately. Switching your next short commute to Bike would save ~1.2kg of CO₂!", 
            type: 'action' 
          });
        } else if (totalSaved > 10) {
          setAdvice({ 
            text: `Incredible! You've saved ${totalSaved.toFixed(1)}kg of CO₂ this week. You're a top 10% Eco-Warrior!`, 
            type: 'success' 
          });
        } else {
          setAdvice({ 
            text: "Biking for trips under 3km is the fastest way to earn your next badge.", 
            type: 'info' 
          });
        }
      }
    } catch (e) {
      setAdvice({ text: "Tip: Sustainable travel keeps the planet green! 🌱", type: 'info' });
    }

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  };

  const getTheme = () => {
    switch (advice.type) {
      case 'success': return { background: '#ECFDF5', text: '#059669', dot: '#34D399' };
      case 'action': return { background: '#FFF7ED', text: '#C2410C', dot: '#F97316' };
      default: return { background: '#F0F9FF', text: '#0369A1', dot: '#0EA5E9' };
    }
  };

  const theme = getTheme();

  return (
    <Animated.View style={[styles.container, { backgroundColor: theme.background, opacity: fadeAnim }]}>
      <View style={[styles.dot, { backgroundColor: theme.dot }]} />
      <View style={styles.textWrapper}>
        <Text style={styles.label}>AI ECO-COACH</Text>
        <Text style={[styles.text, { color: theme.text }]}>{advice.text}</Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 14,
  },
  textWrapper: {
    flex: 1,
  },
  label: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
    color: 'rgba(0,0,0,0.3)',
    marginBottom: 4,
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
});
