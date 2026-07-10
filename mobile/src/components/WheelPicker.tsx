import React, { useEffect, useRef } from "react"
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native"
import { ScrollView, StyleSheet, Text, View } from "react-native"
import { colors, font, radius } from "../theme"

// Optional haptics: gives the "tick tick" feel as each item snaps past the
// center. Wrapped in try/require so the app still runs if the native module
// isn't installed yet (it is listed in package.json / `expo install`).
let Haptics: { selectionAsync?: () => void } | null = null
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Haptics = require("expo-haptics")
} catch (e) {
  Haptics = null
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
      Haptics?.selectionAsync?.()
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
