import { NavigationContainer } from "@react-navigation/native"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import React from "react"
import HomeScreen from "../screens/HomeScreen"
import LeaseDetailScreen from "../screens/LeaseDetailScreen"
import LeaseFormScreen from "../screens/LeaseFormScreen"
import LeasesScreen from "../screens/LeasesScreen"
import MaintenanceFormScreen from "../screens/MaintenanceFormScreen"
import MaintenanceScreen from "../screens/MaintenanceScreen"
import PaymentHistoryScreen from "../screens/PaymentHistoryScreen"
import PropertiesScreen from "../screens/PropertiesScreen"
import PropertyDetailScreen from "../screens/PropertyDetailScreen"
import PropertyFormScreen from "../screens/PropertyFormScreen"
import RentCollectScreen from "../screens/RentCollectScreen"
import TenantDetailScreen from "../screens/TenantDetailScreen"
import TenantFormScreen from "../screens/TenantFormScreen"
import TenantsScreen from "../screens/TenantsScreen"
import UnitFormScreen from "../screens/UnitFormScreen"
import { colors } from "../theme"

// Route names + the params each screen expects.
export type RootStackParamList = {
  Home: undefined
  Properties: undefined
  PropertyDetail: { propertyId: string }
  PropertyForm: { propertyId?: string }
  UnitForm: { propertyId: string; unitId?: string }
  Tenants: undefined
  TenantDetail: { tenantId: string }
  TenantForm: { tenantId?: string }
  Leases: undefined
  LeaseDetail: { leaseId: string }
  LeaseForm: { leaseId?: string }
  RentCollect: { chargeId: string; leaseId: string }
  PaymentHistory: { leaseId?: string; chargeId?: string }
  Maintenance: undefined
  MaintenanceForm: { ticketId?: string }
}

const Stack = createNativeStackNavigator<RootStackParamList>()

// Each screen sets its own header title (and any header buttons) via
// navigation.setOptions in a useLayoutEffect, so no per-screen options here.
export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerStyle: { backgroundColor: colors.card },
          headerTitleStyle: { color: colors.text },
          headerTintColor: colors.primary,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Properties" component={PropertiesScreen} />
        <Stack.Screen name="PropertyDetail" component={PropertyDetailScreen} />
        <Stack.Screen name="PropertyForm" component={PropertyFormScreen} />
        <Stack.Screen name="UnitForm" component={UnitFormScreen} />
        <Stack.Screen name="Tenants" component={TenantsScreen} />
        <Stack.Screen name="TenantDetail" component={TenantDetailScreen} />
        <Stack.Screen name="TenantForm" component={TenantFormScreen} />
        <Stack.Screen name="Leases" component={LeasesScreen} />
        <Stack.Screen name="LeaseDetail" component={LeaseDetailScreen} />
        <Stack.Screen name="LeaseForm" component={LeaseFormScreen} />
        <Stack.Screen name="RentCollect" component={RentCollectScreen} />
        <Stack.Screen name="PaymentHistory" component={PaymentHistoryScreen} />
        <Stack.Screen name="Maintenance" component={MaintenanceScreen} />
        <Stack.Screen name="MaintenanceForm" component={MaintenanceFormScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  )
}