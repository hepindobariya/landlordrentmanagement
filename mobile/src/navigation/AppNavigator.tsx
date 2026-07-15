import { Feather } from "@expo/vector-icons"
import {
  createBottomTabNavigator,
  type BottomTabBarProps,
} from "@react-navigation/bottom-tabs"
import { NavigationContainer } from "@react-navigation/native"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import React, { useState } from "react"
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import ExpenseFormScreen from "../screens/ExpenseFormScreen"
import ExpensesScreen from "../screens/ExpensesScreen"
import HomeScreen from "../screens/HomeScreen"
import LeaseDetailScreen from "../screens/LeaseDetailScreen"
import LeaseFormScreen from "../screens/LeaseFormScreen"
import LeasesScreen from "../screens/LeasesScreen"
import LegalLibraryScreen from "../screens/LegalLibraryScreen"
import MaintenanceFormScreen from "../screens/MaintenanceFormScreen"
import MaintenanceScreen from "../screens/MaintenanceScreen"
import PropertiesScreen from "../screens/PropertiesScreen"
import PropertyDetailScreen from "../screens/PropertyDetailScreen"
import PropertyFormScreen from "../screens/PropertyFormScreen"
import RentCalendarScreen from "../screens/RentCalendarScreen"
import RentCollectScreen from "../screens/RentCollectScreen"
import TenantFormScreen from "../screens/TenantFormScreen"
import TenantsScreen from "../screens/TenantsScreen"
import UnitFormScreen from "../screens/UnitFormScreen"
import NotificationsScreen from "../screens/NotificationsScreen"
import PaymentHistoryScreen from "../screens/PaymentHistoryScreen"
import TenantDetailScreen from "../screens/TenantDetailScreen"
import { colors, font, radius, shadow, spacing } from "../theme"

// Route names + the params each screen expects.
export type RootStackParamList = {
  Main: undefined
  Home: undefined
  Properties: undefined
  PropertyDetail: { propertyId: string }
  PropertyForm: { propertyId?: string }
  UnitForm: { propertyId: string; unitId?: string }
  Tenants: undefined
  TenantForm: { tenantId?: string }
  Leases: undefined
  LeaseDetail: { leaseId: string }
  LeaseForm: { leaseId?: string }
  RentCollect: { chargeId: string; leaseId: string }
  RentCalendar: undefined
  LegalLibrary: undefined
  Maintenance: undefined
  MaintenanceForm: { ticketId?: string }
  Expenses: undefined
  ExpenseForm: { expenseId?: string }
  Notifications: undefined
  PaymentHistory: { leaseId: string; chargeId?: string }
  TenantDetail: { tenantId: string }
}

const Tab = createBottomTabNavigator()
const Stack = createNativeStackNavigator<RootStackParamList>()

const TAB_ICONS: Record<string, any> = {
  Home: "grid",
  Properties: "home",
  Leases: "file-text",
  Maintenance: "tool",
}

// Quick-add sheet items (center + button).
const ADD_ITEMS: Array<{
  screen: keyof RootStackParamList
  label: string
  icon: any
  bg: string
  fg: string
}> = [
  { screen: "PropertyForm", label: "New property", icon: "home", bg: colors.primaryTint, fg: colors.primary },
  { screen: "TenantForm", label: "New tenant", icon: "user", bg: colors.infoBg, fg: colors.info },
  { screen: "LeaseForm", label: "New lease", icon: "file-text", bg: colors.warnBg, fg: colors.warn },
  { screen: "MaintenanceForm", label: "New ticket", icon: "tool", bg: colors.dangerBg, fg: colors.danger },
  { screen: "ExpenseForm", label: "New expense", icon: "credit-card", bg: colors.successBg, fg: colors.success },
]

function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets()
  const [menuOpen, setMenuOpen] = useState(false)

  const go = (screen: keyof RootStackParamList) => {
    setMenuOpen(false)
    ;(navigation as any).navigate(screen, {})
  }

  const renderTab = (routeKey: string, routeName: string, index: number) => {
    const focused = state.index === index
    const onPress = () => {
      const event = navigation.emit({
        type: "tabPress",
        target: routeKey,
        canPreventDefault: true,
      })
      if (!focused && !event.defaultPrevented) {
        ;(navigation as any).navigate(routeName)
      }
    }
    const labelStyle = [styles.tabLabel, focused ? styles.tabLabelActive : null]
    return (
      <TouchableOpacity
        key={routeKey}
        style={styles.tabItem}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <Feather
          name={TAB_ICONS[routeName]}
          size={22}
          color={focused ? colors.primary : colors.subtle}
        />
        <Text style={labelStyle}>{routeName}</Text>
      </TouchableOpacity>
    )
  }

  const left = state.routes.slice(0, 2)
  const right = state.routes.slice(2)
  const bottomPad = insets.bottom > 0 ? insets.bottom : spacing.sm

  return (
    <View style={[styles.tabBarWrap, { paddingBottom: bottomPad }]}>
      <View style={styles.tabBar}>
        {left.map((r, i) => renderTab(r.key, r.name, i))}
        <View style={styles.fabSlot} />
        {right.map((r, i) => renderTab(r.key, r.name, i + 2))}
      </View>

      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.9}
        onPress={() => setMenuOpen(true)}
      >
        <Feather name="plus" size={28} color={colors.white} />
      </TouchableOpacity>

      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setMenuOpen(false)}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Add new</Text>
            {ADD_ITEMS.map((item) => {
              const iconStyle = [styles.sheetIcon, { backgroundColor: item.bg }]
              return (
                <TouchableOpacity
                  key={item.screen}
                  style={styles.sheetRow}
                  activeOpacity={0.8}
                  onPress={() => go(item.screen)}
                >
                  <View style={iconStyle}>
                    <Feather name={item.icon} size={20} color={item.fg} />
                  </View>
                  <Text style={styles.sheetRowText}>{item.label}</Text>
                  <Feather name="chevron-right" size={20} color={colors.subtle} />
                </TouchableOpacity>
              )
            })}
          </View>
        </Pressable>
      </Modal>
    </View>
  )
}

const tabScreenOptions = {
  headerStyle: { backgroundColor: colors.background },
  headerTitleStyle: { color: colors.text, fontWeight: "800" as const, fontSize: font.h3 },
  headerShadowVisible: false,
  headerTintColor: colors.primary,
  sceneStyle: { backgroundColor: colors.background },
}

function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={tabScreenOptions}
    >
      <Tab.Screen name="Home" component={HomeScreen as any} />
      <Tab.Screen name="Properties" component={PropertiesScreen as any} />
      <Tab.Screen name="Leases" component={LeasesScreen as any} />
      <Tab.Screen name="Maintenance" component={MaintenanceScreen as any} />
    </Tab.Navigator>
  )
}

const stackScreenOptions = {
  headerStyle: { backgroundColor: colors.background },
  headerTitleStyle: { color: colors.text, fontWeight: "800" as const, fontSize: font.h3 },
  headerShadowVisible: false,
  headerTintColor: colors.primary,
  contentStyle: { backgroundColor: colors.background },
}

const hideHeader = { headerShown: false }
const rentCalendarOptions = { title: "Rent calendar" }
const legalLibraryOptions = { title: "Legal & compliance" }
const expensesOptions = { title: "Expenses" }

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={stackScreenOptions}>
        <Stack.Screen name="Main" component={MainTabs} options={hideHeader} />
        <Stack.Screen name="Tenants" component={TenantsScreen} />
        <Stack.Screen name="PropertyDetail" component={PropertyDetailScreen} />
        <Stack.Screen name="PropertyForm" component={PropertyFormScreen} />
        <Stack.Screen name="UnitForm" component={UnitFormScreen} />
        <Stack.Screen name="TenantForm" component={TenantFormScreen} />
        <Stack.Screen name="LeaseDetail" component={LeaseDetailScreen} />
        <Stack.Screen name="LeaseForm" component={LeaseFormScreen} />
        <Stack.Screen name="RentCollect" component={RentCollectScreen} />
        <Stack.Screen
          name="RentCalendar"
          component={RentCalendarScreen}
          options={rentCalendarOptions}
        />
        <Stack.Screen
          name="LegalLibrary"
          component={LegalLibraryScreen}
          options={legalLibraryOptions}
        />
        <Stack.Screen name="MaintenanceForm" component={MaintenanceFormScreen} />
        <Stack.Screen
          name="Expenses"
          component={ExpensesScreen}
          options={expensesOptions}
        />
        <Stack.Screen name="ExpenseForm" component={ExpenseFormScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: "Alerts & Telegram" }} />
        <Stack.Screen name="PaymentHistory" component={PaymentHistoryScreen} options={{ title: "Payment History" }} />
        <Stack.Screen name="TenantDetail" component={TenantDetailScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  )
}

const styles = StyleSheet.create({
  tabBarWrap: {
    backgroundColor: "transparent",
    paddingHorizontal: spacing.md,
    paddingTop: 28,
  },
  tabBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    height: 64,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.floating,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    height: "100%",
  },
  fabSlot: { width: 68 },
  tabLabel: { fontSize: font.tiny, color: colors.subtle, fontWeight: "600" },
  tabLabelActive: { color: colors.primary },
  fab: {
    position: "absolute",
    top: 0,
    alignSelf: "center",
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 5,
    borderColor: colors.background,
    ...shadow.floating,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(11,27,43,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  sheetTitle: {
    fontSize: font.h3,
    fontWeight: "800",
    color: colors.text,
    marginBottom: spacing.sm,
  },
  sheetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  sheetIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetRowText: {
    flex: 1,
    fontSize: font.body,
    fontWeight: "600",
    color: colors.text,
  },
})
