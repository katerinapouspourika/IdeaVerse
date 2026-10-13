/**
 * Old spellings of IANA time zones that some browsers still list, mapped to their current names, such as `Europe/Kiev`
 * to `Europe/Kyiv`. Zones that are links only because two places share a clock, such as `Europe/Vatican`, stay as they are.
 */
const renamed: Record<string, string> = {
  'Africa/Asmera': 'Africa/Asmara',
  'America/Buenos_Aires': 'America/Argentina/Buenos_Aires',
  'America/Catamarca': 'America/Argentina/Catamarca',
  'America/Coral_Harbour': 'America/Atikokan',
  'America/Cordoba': 'America/Argentina/Cordoba',
  'America/Godthab': 'America/Nuuk',
  'America/Indianapolis': 'America/Indiana/Indianapolis',
  'America/Jujuy': 'America/Argentina/Jujuy',
  'America/Louisville': 'America/Kentucky/Louisville',
  'America/Mendoza': 'America/Argentina/Mendoza',
  'Asia/Calcutta': 'Asia/Kolkata',
  'Asia/Katmandu': 'Asia/Kathmandu',
  'Asia/Rangoon': 'Asia/Yangon',
  'Asia/Saigon': 'Asia/Ho_Chi_Minh',
  'Atlantic/Faeroe': 'Atlantic/Faroe',
  'Europe/Kiev': 'Europe/Kyiv',
  'Pacific/Enderbury': 'Pacific/Kanton',
  'Pacific/Ponape': 'Pacific/Pohnpei',
  'Pacific/Truk': 'Pacific/Chuuk',
};

/** The current name of a time zone, for one the browser may still spell the old way. */
export function currentZoneName(zone: string): string {
  return renamed[zone] ?? zone;
}

/** A time zone to choose from: its IANA id, which is what gets saved, and a label with its UTC offset right now. */
export interface TimeZoneOption {
  id: string;
  label: string;
  /** Minutes ahead of UTC right now, for sorting. */
  offset: number;
}

/** The zone's offset from UTC at a moment, in minutes, read from the browser's `longOffset` name such as `GMT+05:30`. */
function offsetMinutes(zone: string, now: Date): number {
  try {
    const name =
      new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' }).formatToParts(now).find((p) => p.type === 'timeZoneName')
        ?.value ?? '';
    const match = /([+-])(\d{2}):?(\d{2})?/.exec(name);
    if (!match) {
      return 0;
    }
    const minutes = Number(match[2]) * 60 + Number(match[3] ?? 0);
    return match[1] === '-' ? -minutes : minutes;
  } catch {
    return 0;
  }
}

/** Formats an offset in minutes as `UTC+05:30`. */
function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? '-' : '+';
  const whole = Math.abs(minutes);
  return `UTC${sign}${String(Math.floor(whole / 60)).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`;
}

/** A readable name for a zone: its city, then the most specific region, such as "Buenos Aires (Argentina)". */
export function placeName(zone: string): string {
  const parts = currentZoneName(zone).split('/').map((part) => part.replaceAll('_', ' '));
  const city = parts.at(-1) ?? zone;
  const region = parts.at(-2);
  return region ? `${city} (${region})` : city;
}

/** Builds the option for one zone at a moment. */
export function timeZoneOption(zone: string, now: Date = new Date()): TimeZoneOption {
  const offset = offsetMinutes(zone, now);
  return { id: zone, label: `(${formatOffset(offset)}) ${placeName(zone)}`, offset };
}

/**
 * Every time zone the browser knows, plus UTC, under their current names and sorted by UTC offset and then name. Each zone in
 * `keep`, such as the saved one, is offered under its own id even when it is an old spelling, in place of its current name,
 * so it stays selected without being listed twice.
 */
export function timeZoneOptions(keep: string[], now: Date = new Date()): TimeZoneOption[] {
  const known = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
  const byName = new Map<string, string>();
  for (const zone of ['UTC', ...known]) {
    byName.set(currentZoneName(zone), currentZoneName(zone));
  }
  for (const zone of keep) {
    byName.set(currentZoneName(zone), zone);
  }
  return [...byName.values()]
    .map((zone) => timeZoneOption(zone, now))
    .sort((a, b) => a.offset - b.offset || a.label.localeCompare(b.label));
}

/** Simplifies text for matching a search: lower case, with underscores and slashes as spaces. */
function searchable(text: string): string {
  return text.toLowerCase().replaceAll(/[_/]/g, ' ');
}

/**
 * Whether an option matches a search on its label or IANA id; every word must match. Every label starts with its offset
 * from UTC, so "UTC" or "GMT" alone matches only the UTC zone itself; before an offset, as in "utc+05:30", it is ignored.
 */
export function matchesZone(option: TimeZoneOption, search: string): boolean {
  const haystack = `${searchable(option.label.replace('(UTC', '('))} ${searchable(option.id)}`;
  return searchable(search)
    .replaceAll(/\b(?:utc|gmt)(?=[+-])/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => (word === 'gmt' ? 'utc' : word))
    .every((word) => haystack.includes(word));
}
