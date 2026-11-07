import { Platform } from 'react-native';

/**
 * Creates cross-platform shadow styles.
 * On React Native for Web, returns CSS `boxShadow` to prevent deprecation warnings.
 * On iOS/Android, returns standard shadowOffset, shadowOpacity, shadowRadius, and elevation.
 *
 * @param {number} x - Horizontal offset (px)
 * @param {number} y - Vertical offset (px)
 * @param {number} blur - Blur radius (px)
 * @param {string} color - Shadow color (hex or rgba)
 * @param {number} opacity - Shadow opacity for iOS (0 to 1)
 * @param {number} elevation - Elevation for Android
 * @returns {object} Platform-specific shadow style
 */
export const createShadow = (
  x = 0,
  y = 2,
  blur = 6,
  color = 'rgba(0, 0, 0, 0.12)',
  opacity = 0.15,
  elevation = 3
) => {
  if (Platform.OS === 'web') {
    return {
      boxShadow: `${x}px ${y}px ${blur}px ${color}`,
    };
  }

  return {
    shadowColor: color.startsWith('rgba') ? '#000' : color,
    shadowOffset: { width: x, height: y },
    shadowOpacity: opacity,
    shadowRadius: blur,
    elevation,
  };
};

/**
 * Normalizes timestamp / created_at across database records.
 * Returns a valid ISO string or milliseconds timestamp.
 */
export const getRecordTimestamp = (record) => {
  if (!record) return null;
  return record.created_at || record.timestamp || null;
};
