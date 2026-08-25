import { StyleSheet, Text, View } from 'react-native';
import { radius, type } from '../theme';

/**
 * Initials on a colour derived from the name, so each person is visually
 * distinct and the list can be scanned by shape rather than read line by line.
 *
 * The hue is a hash of the name: stable across sessions and devices without
 * storing anything, and it means two different people rarely collide.
 */
function hueFor(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) % 360;
  }
  return hash;
}

function initialsFor(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

type Props = {
  name: string;
  size?: number;
};

export default function Avatar({ name, size = 44 }: Props) {
  const hue = hueFor(name);
  // Fixed saturation and lightness keep every avatar in the same warm family,
  // so the list doesn't turn into confetti.
  const background = `hsl(${hue}, 62%, 92%)`;
  const foreground = `hsl(${hue}, 52%, 34%)`;

  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: radius.pill, backgroundColor: background },
      ]}
    >
      <Text style={[styles.initials, { color: foreground, fontSize: size * 0.36 }]}>
        {initialsFor(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontWeight: type.heading.fontWeight,
    letterSpacing: 0.3,
  },
});
