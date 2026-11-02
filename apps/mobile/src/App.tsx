import { Assets as NavigationAssets } from '@react-navigation/elements';
import { DarkTheme, DefaultTheme } from '@react-navigation/native';
import { Asset } from 'expo-asset';
import { createURL } from 'expo-linking';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ActivityIndicator, Platform, useColorScheme, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Navigation } from './navigation';
import { AuthProvider, useAuth } from './auth';
import { Login } from './screens/Login';
import { ForcedPasswordChange } from './screens/ForcedPasswordChange';
import { useNetwork } from './hooks/useNetwork';
import { OfflineBanner } from './components/OfflineBanner';

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
  const { online } = useNetwork();

  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => undefined);
  }, []);

  if (loading) return <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center' }}><ActivityIndicator color="#2563eb" size="large" /></View>;
  if (!user) return <Login />;
  if (user.mustChangePassword) return <ForcedPasswordChange />;

  const theme = colorScheme === 'dark' ? DarkTheme : DefaultTheme;

  return (
    <>
      {!online && Platform.OS !== 'web' && <OfflineBanner online={false} onRetry={() => undefined} />}
      <Navigation
        theme={theme}
        linking={linking}
        onReady={() => {
          void SplashScreen.hideAsync().catch(() => undefined);
        }}
      />
    </>
  );
}
