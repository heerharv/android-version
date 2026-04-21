import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { HomeScreen } from './src/screens/HomeScreen';
import { signInAutomatically } from './src/services/SupabaseClient';

export default function App() {
  useEffect(() => {
    signInAutomatically();
  }, []);

  return (
    <PaperProvider>
      <View style={styles.container}>
        <HomeScreen />
        <StatusBar style="dark" />
      </View>
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});
