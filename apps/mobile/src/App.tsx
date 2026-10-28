import { Assets as NavigationAssets } from '@react-navigation/elements';
import { DarkTheme, DefaultTheme } from '@react-navigation/native';
import { Asset } from 'expo-asset';
import { createURL } from 'expo-linking';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ActivityIndicator, useColorScheme, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Navigation } from './navigation';
import { AuthProvider, useAuth } from './auth';
import { Login } from './screens/Login';

Asset.loadAsync([
  ...NavigationAssets,
  require('./assets/newspaper.png'),
  require('./assets/bell.png'),
]);

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

const linking = {
  enabled: 'auto' as const,
  prefixes: [createURL('/')],
};

export function App() {
  return <SafeAreaProvider><AuthProvider><AuthenticatedApp /></AuthProvider></SafeAreaProvider>;
}

function AuthenticatedApp() {
  const colorScheme = useColorScheme();
  const { user, loading } = useAuth();

  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => undefined);
  }, []);

  if (loading) return <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center' }}><ActivityIndicator color="#2563eb" size="large" /></View>;
  if (!user) return <Login />;

  const theme = colorScheme === 'dark' ? DarkTheme : DefaultTheme;

  return (
    <Navigation
      theme={theme}
      linking={linking}
      onReady={() => {
        void SplashScreen.hideAsync().catch(() => undefined);
      }}
    />
  );
}
