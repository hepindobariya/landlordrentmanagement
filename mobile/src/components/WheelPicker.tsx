import React, { useEffect, useRef } from "react"
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native"
import { Platform, ScrollView, StyleSheet, Text, Vibration, View } from "react-native"
import { colors, font, radius } from "../theme"

// Tick feedback as each item snaps past the center. We use React Native's
// built-in Vibration (a core API, always available) instead of a native module
// like expo-haptics so this component can never fail to resolve at bundle time
// or crash on start. Android gets a short 8ms "tick"; iOS is skipped because a
// single Vibration call there is a full, heavy buzz that feels wrong on a wheel.
function tick() {
  if (Platform.OS === "android") {
    try {
      Vibration.vibrate(8)
    } catch (e) {
      // ignore — feedback is best-effort only
    }
  }
}

const ITEM_HEIGHT = 44
const VISIBLE = 5 // odd number so one row sits in the center
const PAD = ITEM_HEIGHT * ((VISIBLE - 1) / 2)

// A single infinite-feeling snapping column, styled like an iOS picker wheel.
export function WheelPicker({
  items,
  selectedIndex,
  onChange,
}: {
  items: string[]
  selectedIndex: number
  onChange: (index: number) => void
}) {
  const ref = useRef<ScrollView>(null)
  const lastTick = useRef<number>(selectedIndex)

  // Re-snap when the selected index changes from outside (e.g. day count
  // shrinks when the month changes).
  useEffect(() => {
    lastTick.current = selectedIndex
    const id = setTimeout(() => {
      ref.current?.scrollTo({ y: selectedIndex * ITEM_HEIGHT, animated: false })
    }, 0)
    return () => clearTimeout(id)
  }, [selectedIndex])

  function clamp(i: number): number {
    if (i < 0) return 0
    if (i > items.length - 1) return items.length - 1
    return i
  }

  function handleScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const y = e.nativeEvent.contentOffset.y
    const idx = clamp(Math.round(y / ITEM_HEIGHT))
    if (idx !== lastTick.current) {
      lastTick.current = idx
      tick()
    }
  }

  function handleEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const y = e.nativeEvent.contentOffset.y
    const idx = clamp(Math.round(y / ITEM_HEIGHT))
    onChange(idx)
    ref.current?.scrollTo({ y: idx * ITEM_HEIGHT, animated: true })
  }

  return (
    <View style={styles.wrap}>
      <View pointerEvents="none" style={styles.highlight} />
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        scrollEventThrottle={16}
        onScroll={handleScroll}
        onMomentumScrollEnd={handleEnd}
        contentContainerStyle={styles.contentPad}
      >
        {items.map((label, i) => {
          const active = i === selectedIndex
          return (
            <View key={`${label}-${i}`} style={styles.item}>
              <Text
                style={[styles.itemText, active ? styles.itemTextActive : null]}
                numberOfLines={1}
              >
                {label}
              </Text>
            </View>
          )
        })}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    height: ITEM_HEIGHT * VISIBLE,
    overflow: "hidden",
  },
  contentPad: { paddingVertical: PAD },
  item: { height: ITEM_HEIGHT, alignItems: "center", justifyContent: "center" },
  itemText: { fontSize: font.h3, color: colors.subtle, fontWeight: "600" },
  itemTextActive: { color: colors.text, fontWeight: "800" },
  highlight: {
    position: "absolute",
    left: 4,
    right: 4,
    top: PAD,
    height: ITEM_HEIGHT,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryTint,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.primaryTintStrong,
  },
})
