import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';

/**
 * ResponsiveContainer provides a centered, max-width bounded layout for Desktop Web
 * while retaining 100% full-bleed native layout on iOS and Android.
 *
 * @param {React.ReactNode} children - Inner child components
 * @param {number} maxWidth - Maximum width constraint on Web (defaults to 1200)
 * @param {object} style - Styles applied to outer wrapper
 * @param {object} contentStyle - Styles applied to the inner bounded container
 */
export default function ResponsiveContainer({
  children,
  maxWidth = 1200,
  style,
  contentStyle,
}) {
  if (Platform.OS !== 'web') {
    return <View style={[styles.mobileWrapper, style]}>{children}</View>;
  }

  return (
    <View style={[styles.webOuter, style]}>
      <View style={[styles.webInner, { maxWidth }, contentStyle]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mobileWrapper: {
    flex: 1,
    width: '100%',
  },
  webOuter: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    backgroundColor: 'inherit',
  },
  webInner: {
    width: '100%',
    flex: 1,
  },
});
