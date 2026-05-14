import React from 'react';
import { ScrollView, TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

interface Chip {
  key: string;
  label: string;
  color?: string;
}

interface FilterChipsProps {
  chips: Chip[];
  active: string;
  onSelect: (key: string) => void;
}

export function FilterChips({ chips, active, onSelect }: FilterChipsProps) {
  const colors = useColors();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.scroll}
    >
      {chips.map(chip => {
        const isActive = chip.key === active;
        const accent = chip.color || colors.primary;
        return (
          <TouchableOpacity
            key={chip.key}
            style={[
              styles.chip,
              {
                backgroundColor: isActive ? accent : colors.muted,
                borderColor: isActive ? accent : colors.border,
              }
            ]}
            onPress={() => onSelect(chip.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.label, { color: isActive ? '#fff' : colors.mutedForeground }]}>
              {chip.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0, marginBottom: 8, maxHeight: 44 },
  row: { alignItems: 'center', paddingHorizontal: 16, gap: 8, paddingVertical: 4 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1,
  },
  label: { fontSize: 13, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
});
