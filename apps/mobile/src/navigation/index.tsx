import {
  createBottomTabNavigator,
  createBottomTabScreen,
} from '@react-navigation/bottom-tabs';
import { HeaderButton, Text } from '@react-navigation/elements';
import { createStaticNavigation } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  createNativeStackScreen,
} from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Home } from './screens/Home';
import { NotFound } from './screens/NotFound';
import { Profile } from './screens/Profile';
import { Settings } from './screens/Settings';
import { Attendance, Learning, Results } from './screens/Modules';
import { More } from './screens/More';
import { Updates } from './screens/Updates';

const tabOptions = (title: string, icon: keyof typeof MaterialCommunityIcons.glyphMap) => ({ title, tabBarLabel: title, tabBarIcon: ({ color, size }: { color: string; size: number }) => <MaterialCommunityIcons name={icon} color={color} size={size} />, tabBarActiveTintColor: '#2563eb', tabBarInactiveTintColor: '#94a3b8', tabBarItemStyle: { paddingTop: 5 }, tabBarLabelStyle: { fontSize: 11, fontWeight: '700' as const }, tabBarStyle: { backgroundColor: '#ffffff', borderTopColor: '#e7edf5', height: 66, paddingBottom: 8, paddingTop: 5 } });

const HomeTabs = createBottomTabNavigator({
  screens: {
    Home: createBottomTabScreen({
      screen: Home,
      options: {
        ...tabOptions('Home', 'view-dashboard-outline'),
      },
    }),
    Learning: createBottomTabScreen({ screen: Learning, options: tabOptions('Learning', 'book-open-outline') }),
    Attendance: createBottomTabScreen({ screen: Attendance, options: tabOptions('Attendance', 'calendar-check-outline') }),
    Results: createBottomTabScreen({ screen: Results, options: tabOptions('Results', 'chart-box-outline') }),
    More: createBottomTabScreen({ screen: More, options: tabOptions('More', 'dots-horizontal-circle-outline') }),
  },
});

const RootStack = createNativeStackNavigator({
  screens: {
    HomeTabs: createNativeStackScreen({
      screen: HomeTabs,
      options: {
        title: 'Home',
        headerShown: false,
      },
    }),
    Profile: createNativeStackScreen({
      screen: Profile,
      linking: {
        path: ':user(@[a-zA-Z0-9-_]+)',
        parse: {
          user: (value) => value.replace(/^@/, ''),
        },
        stringify: {
          user: (value) => `@${value}`,
        },
      },
    }),
    Updates: createNativeStackScreen({
      screen: Updates,
      options: { title: 'Updates', headerBackTitle: 'Back' },
    }),
    Settings: createNativeStackScreen({
      screen: Settings,
      options: ({ navigation }) => ({
        presentation: 'modal',
        headerRight: () => (
          <HeaderButton onPress={navigation.goBack}>
            <Text>Close</Text>
          </HeaderButton>
        ),
      }),
    }),
    NotFound: createNativeStackScreen({
      screen: NotFound,
      options: {
        title: '404',
      },
      linking: {
        path: '*',
      },
    }),
  },
});

export const Navigation = createStaticNavigation(RootStack);

type RootStackType = typeof RootStack;

declare module '@react-navigation/native' {
  interface RootNavigator extends RootStackType {}
}
