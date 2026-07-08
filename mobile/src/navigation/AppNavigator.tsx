import { NavigationContainer } from "@react-navigation/native"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import React from "react"
import { StyleSheet, Text, TouchableOpacity } from "react-native"
import { supabase } from "../lib/supabase"
import PropertiesScreen from "../screens/PropertiesScreen"
import PropertyDetailScreen from "../screens/PropertyDetailScreen"
import PropertyFormScreen from "../screens/PropertyFormScreen"
import UnitFormScreen from "../screens/UnitFormScreen"
import { colors } from "../theme"

// Route names + the params each screen expects.
export type RootStackParamList = {
  Properties: undefined
  PropertyDetail: { propertyId: string }
  PropertyForm: { propertyId?: string } // no id = create, id present = edit
  UnitForm: { propertyId: string; unitId?: string } // no unitId = create
}

const Stack = createNativeStackNavigator<RootStackParamList>()

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.card },
          headerTitleStyle: { color: colors.text },
          headerTintColor: colors.primary,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen
          name="Properties"
          component={PropertiesScreen}
          options={({ navigation }) => ({
            title: "Properties",
            headerLeft: () => (
              <TouchableOpacity onPress={() => supabase.auth.signOut()}>
                <Text style={styles.logoutText}>Log Out</Text>
              </TouchableOpacity>
            ),
            headerRight: () => (
              <TouchableOpacity
                onPress={() => navigation.navigate("PropertyForm", {})}
              >
                <Text style={styles.addText}>＋</Text>
              </TouchableOpacity>
            ),
          })}
        />
        <Stack.Screen
          name="PropertyDetail"
          component={PropertyDetailScreen}
          options={{ title: "Property" }}
        />
        <Stack.Screen
          name="PropertyForm"
          component={PropertyFormScreen}
          options={{ title: "Property" }}
        />
        <Stack.Screen
          name="UnitForm"
          component={UnitFormScreen}
          options={{ title: "Unit" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  )
}

const styles = StyleSheet.create({
  logoutText: { color: colors.danger, fontWeight: "600", fontSize: 15 },
  addText: { color: colors.primary, fontWeight: "700", fontSize: 26 },
})
