import { Session } from "@supabase/supabase-js"
import { StatusBar } from "expo-status-bar"
import React, { useEffect, useState } from "react"
import { ActivityIndicator, StyleSheet, View } from "react-native"
import { supabase } from "./src/lib/supabase"
import LoginScreen from "./src/screens/LoginScreen"
import PropertiesScreen from "./src/screens/PropertiesScreen"
import { colors } from "./src/theme"

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [initializing, setInitializing] = useState(true)

  useEffect(() => {
    // Load any existing session on startup.
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setInitializing(false)
    })

    // Keep the UI in sync with login/logout events.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  if (initializing) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  return (
    <>
      <StatusBar style="dark" />
      {session ? <PropertiesScreen /> : <LoginScreen />}
    </>
  )
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
})
