import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { HeaderButton, Text } from "@react-navigation/elements";
import { createStaticNavigation } from "@react-navigation/native";
import {
  createNativeStackNavigator,
  createNativeStackScreen,
} from "@react-navigation/native-stack";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Home } from "./screens/Home";
import { NotFound } from "./screens/NotFound";
import { Profile } from "./screens/Profile";
import { Settings } from "./screens/Settings";
import { Attendance, Fees, Learning, Results, Timetable } from "./screens/Modules";
import { Leave } from "./screens/Leave";
import { More } from "./screens/More";
import { Updates } from "./screens/Updates";
import { Documents } from "./screens/Documents";
import { useAuth } from "../auth";

// ── Shared palette (matches all screens) ─────────────────────────────────
const palette = {
  primary: "#7c3aed",
  primarySoft: "#f5f3ff",
  bg: "#f8fafc",
  ink: "#1e1b4b",
  inkSoft: "#334155",
  muted: "#64748b",
  border: "#ddd6fe",
};

// ── Tab options factory ──────────────────────────────────────────────────
const TAB_BAR_HEIGHT = 68;

const tabOptions = (
  title: string,
  icon: keyof typeof MaterialCommunityIcons.glyphMap,
  iconFocused: keyof typeof MaterialCommunityIcons.glyphMap,
  bottomInset = 0,
) => ({
  title,
  tabBarLabel: title,
  tabBarIcon: ({
    color,
    focused,
    size,
  }: {
    color: string;
    focused: boolean;
    size: number;
  }) => (
    <MaterialCommunityIcons
      name={focused ? iconFocused : icon}
      color={color}
      size={focused ? size + 1 : size}
    />
  ),
  tabBarActiveTintColor: palette.primary,
  tabBarInactiveTintColor: "#475569",
  tabBarItemStyle: { paddingTop: 4, paddingBottom: 2 },
  tabBarLabelStyle: {
    fontSize: 11,
    fontWeight: "700" as const,
    marginTop: 2,
  },
  tabBarStyle: {
    backgroundColor: "rgba(255,255,255,0.98)",
    borderColor: "#ddd6fe",
    borderRadius: 24,
    borderTopWidth: 0,
    elevation: 5,
    height: TAB_BAR_HEIGHT + bottomInset,
    marginHorizontal: 14,
    paddingBottom: bottomInset + 6,
    paddingTop: 6,
    position: "relative" as const,
    shadowColor: palette.primary,
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { height: 4, width: 0 },
  },
  tabBarActiveBackgroundColor: "transparent",
  tabBarIconStyle: { marginBottom: -1 },
});

const Tab = createBottomTabNavigator();

/** Only show tabs the signed-in role can actually use. */
function HomeTabs() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const can = (...required: string[]) =>
    Boolean(
      user?.isPlatformAdmin ||
        required.some((permission) =>
          user?.permissions?.includes(permission),
        ),
    );

  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen
        name="Home"
        component={Home}
        options={tabOptions("Home", "view-dashboard-outline", "view-dashboard", insets.bottom)}
      />
      {can("homework.view") ? (
        <Tab.Screen
          name="Learning"
          component={Learning}
          options={tabOptions("Learning", "book-open-outline", "book-open-page-variant", insets.bottom)}
        />
      ) : null}
      {can("attendance.view") ? (
        <Tab.Screen
          name="Attendance"
          component={Attendance}
          options={tabOptions("Attendance", "calendar-check-outline", "calendar-check", insets.bottom)}
        />
      ) : null}
      {can("timetable.view") ? (
        <Tab.Screen
          name="Timetable"
          component={Timetable}
          options={tabOptions("Timetable", "calendar-clock-outline", "calendar-clock", insets.bottom)}
        />
      ) : null}
      {can("result.view", "exam.view") ? (
        <Tab.Screen
          name="Results"
          component={Results}
          options={tabOptions("Results", "chart-box-outline", "chart-box", insets.bottom)}
        />
      ) : null}
      <Tab.Screen
        name="More"
        component={More}
        options={tabOptions("More", "dots-horizontal-circle-outline", "dots-horizontal-circle", insets.bottom)}
      />
    </Tab.Navigator>
  );
}

// ── Stack ────────────────────────────────────────────────────────────────
const RootStack = createNativeStackNavigator({
  screenOptions: {
    // Consistent header styling across all stack screens
    headerStyle: { backgroundColor: palette.bg },
    headerTintColor: palette.primary,
    headerTitleStyle: {
      color: palette.ink,
      fontWeight: "800",
      fontSize: 17,
    },
    headerShadowVisible: false,
    contentStyle: { backgroundColor: palette.bg },
    headerBackButtonDisplayMode: "minimal", // just the chevron on iOS
  },
  screens: {
    HomeTabs: createNativeStackScreen({
      screen: HomeTabs,
      options: {
        title: "Home",
        headerShown: false,
      },
    }),
    Profile: createNativeStackScreen({
      screen: Profile,
      options: { title: "Profile", headerBackTitle: "Back" },
      linking: {
        path: ":user(@[a-zA-Z0-9-_]+)",
        parse: {
          user: (value) => value.replace(/^@/, ""),
        },
        stringify: {
          user: (value) => `@${value}`,
        },
      },
    }),
    Documents: createNativeStackScreen({
      screen: Documents,
      options: { title: "My documents", headerBackTitle: "Back" },
    }),
    Updates: createNativeStackScreen({
      screen: Updates,
      options: { title: "Updates", headerBackTitle: "Back" },
    }),
    Fees: createNativeStackScreen({
      screen: Fees,
      options: { title: "Fees", headerBackTitle: "Back" },
    }),
    Timetable: createNativeStackScreen({
      screen: Timetable,
      options: { title: "Timetable", headerBackTitle: "Back" },
    }),
    Leave: createNativeStackScreen({
      screen: Leave,
      options: { title: "Leave requests", headerBackTitle: "Back" },
    }),
    Settings: createNativeStackScreen({
      screen: Settings,
      options: ({ navigation }) => ({
        title: "Settings",
        presentation: "modal",
        headerRight: () => (
          <HeaderButton onPress={navigation.goBack}>
            <Text style={{ color: palette.primary, fontWeight: "700" }}>
              Done
            </Text>
          </HeaderButton>
        ),
      }),
    }),
    NotFound: createNativeStackScreen({
      screen: NotFound,
      options: {
        title: "404",
      },
      linking: {
        path: "*",
      },
    }),
  },
});

export const Navigation = createStaticNavigation(RootStack);

type RootStackType = typeof RootStack;

declare module "@react-navigation/native" {
  interface RootNavigator extends RootStackType {}
}
