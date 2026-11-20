/**
 * Notification preferences (profiles.notification_prefs) and quiet hours. Pure, shared
 * with the weather-alerts Edge Function.
 */
export const ALERT_PREF_KINDS = ['heatwave', 'heat-stress', 'frost', 'heavy-rain', 'strong-wind', 'fog', 'disease'] as const;
export type AlertPrefKind = (typeof ALERT_PREF_KINDS)[number];

export type NotificationPrefs = {
  kinds: Record<AlertPrefKind, boolean>;
  quiet_hours: { start: string; end: string }; // local 'HH:MM'
};

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  kinds: { heatwave: true, 'heat-stress': true, frost: true, 'heavy-rain': true, 'strong-wind': true, fog: true, disease: true },
  quiet_hours: { start: '22:00', end: '06:00' },
};

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Fill gaps / drop junk so the rest of the code can trust the shape. */
export function normalizePrefs(raw: unknown): NotificationPrefs {
  const r = (raw ?? {}) as { kinds?: Record<string, unknown>; quiet_hours?: { start?: unknown; end?: unknown } };
  const kinds = { ...DEFAULT_NOTIFICATION_PREFS.kinds };
  for (const k of ALERT_PREF_KINDS) if (typeof r.kinds?.[k] === 'boolean') kinds[k] = r.kinds[k] as boolean;
  const start = typeof r.quiet_hours?.start === 'string' && HHMM.test(r.quiet_hours.start) ? r.quiet_hours.start : DEFAULT_NOTIFICATION_PREFS.quiet_hours.start;
  const end = typeof r.quiet_hours?.end === 'string' && HHMM.test(r.quiet_hours.end) ? r.quiet_hours.end : DEFAULT_NOTIFICATION_PREFS.quiet_hours.end;
  return { kinds, quiet_hours: { start, end } };
}

/** Is local time 'HH:MM' inside the quiet hours? Handles overnight ranges (22:00–06:00). */
export function inQuietHours(localHHMM: string, quiet: { start: string; end: string }): boolean {
  if (quiet.start === quiet.end) return false;
  return quiet.start < quiet.end ? localHHMM >= quiet.start && localHHMM < quiet.end : localHHMM >= quiet.start || localHHMM < quiet.end;
}

/** Preference bucket for an alert kind (all disease rules share one switch). */
export function prefKindFor(kind: string): AlertPrefKind {
  return (ALERT_PREF_KINDS as readonly string[]).includes(kind) ? (kind as AlertPrefKind) : 'disease';
}

/** Should this alert be pushed now? */
export function shouldNotify(kind: string, prefs: NotificationPrefs, localHHMM: string): 'send' | 'hold' | 'off' {
  if (!prefs.kinds[prefKindFor(kind)]) return 'off';
  return inQuietHours(localHHMM, prefs.quiet_hours) ? 'hold' : 'send';
}
