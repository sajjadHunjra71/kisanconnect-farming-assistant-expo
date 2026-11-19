import DateTimePicker, { DateTimePickerAndroid, type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, View } from 'react-native';

import { Card, ListRow, Text, TextField } from '@/components/ui';
import { isLocalDate, parseLocalDate, toLocalDate } from '@/engine';
import { useSettingsStore } from '@/store/settings-store';
import { useTheme } from '@/theme';

import { formatDate } from '../format';

type Props = {
  label: string;
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  error?: string;
};

const clamp = (v: string, min?: string, max?: string) => (min && v < min ? min : max && v > max ? max : v);

/** Local calendar date picker: dialog on Android, inline calendar on iOS, text field on web. */
export function DateField({ label, value, onChange, min, max, error }: Props) {
  const { spacing } = useTheme();
  const language = useSettingsStore((s) => s.language);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(value);

  if (Platform.OS === 'web') {
    return (
      <TextField
        label={label}
        value={text}
        placeholder="YYYY-MM-DD"
        onChangeText={(v) => {
          setText(v);
          if (isLocalDate(v)) onChange(clamp(v, min, max));
        }}
        error={error}
      />
    );
  }

  const handle = (e: DateTimePickerEvent, d?: Date) => {
    if (Platform.OS === 'android') setOpen(false);
    if (e.type === 'set' && d) onChange(clamp(toLocalDate(d), min, max));
  };

  const press = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: parseLocalDate(value),
        mode: 'date',
        minimumDate: min ? parseLocalDate(min) : undefined,
        maximumDate: max ? parseLocalDate(max) : undefined,
        onChange: handle,
      });
    } else setOpen((o) => !o);
  };

  return (
    <View style={{ gap: spacing.xs }}>
      <Card style={{ paddingVertical: spacing.xs }}>
        <ListRow icon="calendar-outline" iconTone="primarySoft" title={formatDate(value, language)} subtitle={label} onPress={press} chevron={false} />
        {open && Platform.OS === 'ios' ? (
          <DateTimePicker
            value={parseLocalDate(value)}
            mode="date"
            display="inline"
            minimumDate={min ? parseLocalDate(min) : undefined}
            maximumDate={max ? parseLocalDate(max) : undefined}
            onChange={handle}
          />
        ) : null}
      </Card>
      {error ? (
        <Text variant="caption" color="danger">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
