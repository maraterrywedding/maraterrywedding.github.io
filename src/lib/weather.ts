/**
 * Weather for the venue, via Open-Meteo — free, no API key, CORS-enabled.
 *
 * Two things are shown, because they answer two different questions:
 *
 *  1. Current conditions and the next few days. Always available, genuinely
 *     live, and useful to anyone visiting in the days around a trip.
 *  2. What early June is typically like in Grohnde. The wedding is far beyond
 *     any forecast horizon, so this is the only honest way to help someone
 *     decide what to pack. It comes from thirty years of local records,
 *     fetched once at build time and committed, so it also works offline.
 *
 * Everything here is pure. The fetching lives in the island; this module builds
 * URLs, maps codes and parses responses, so all of it is testable.
 */

/** Open-Meteo publishes 16 days of forecast; treat 15 as the safe edge. */
export const FORECAST_HORIZON_DAYS = 15;

export type WeatherMode = 'climate' | 'forecast';

/**
 * Nine buckets, collapsed from the WMO code list. More granularity than this
 * would need more translated labels than it would earn — "light drizzle" and
 * "moderate drizzle" mean the same thing to someone choosing a jacket.
 */
export type Condition =
  | 'clear'
  | 'partlyCloudy'
  | 'overcast'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'showers'
  | 'snow'
  | 'thunderstorm';

export interface DailyForecast {
  /** `YYYY-MM-DD` in the venue's timezone. */
  date: string;
  condition: Condition;
  high: number;
  low: number;
  /** Percentage, 0–100. Null when the API omits it. */
  rainChance: number | null;
}

export interface CurrentWeather {
  temperature: number;
  condition: Condition;
}

export interface ForecastResult {
  current: CurrentWeather | null;
  daily: DailyForecast[];
}

/** WMO weather interpretation codes → our nine buckets. */
export function wmoToCondition(code: number): Condition {
  if (code === 0) return 'clear';
  if (code === 1 || code === 2) return 'partlyCloudy';
  if (code === 3) return 'overcast';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 57) return 'drizzle';
  if (code >= 61 && code <= 67) return 'rain';
  if (code >= 71 && code <= 77) return 'snow';
  if (code >= 80 && code <= 82) return 'showers';
  if (code === 85 || code === 86) return 'snow';
  if (code >= 95 && code <= 99) return 'thunderstorm';
  // Unknown codes fall back to the most forgiving label rather than blanking
  // the card — an unexpected code must never break the widget.
  return 'partlyCloudy';
}

/** Whole days from `now` to the event, in the venue's timezone. */
export function daysUntil(now: Date | number | string, event: Date | number | string): number {
  const ms = new Date(event).getTime() - new Date(now).getTime();
  return Math.floor(ms / 86_400_000);
}

/**
 * Whether a real forecast for the wedding day exists yet.
 *
 * Note this is about the *wedding-day* card only. The current-conditions strip
 * is always shown, whatever this returns.
 */
export function pickWeatherMode(
  now: Date | number | string,
  event: Date | number | string,
): WeatherMode {
  const days = daysUntil(now, event);
  if (days < 0) return 'climate';
  return days <= FORECAST_HORIZON_DAYS ? 'forecast' : 'climate';
}

export interface Coordinates {
  lat: number;
  lon: number;
  timeZone: string;
}

export function forecastUrl({ lat, lon, timeZone }: Coordinates, days = 7): string {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: 'temperature_2m,weather_code',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    timezone: timeZone,
    forecast_days: String(days),
  });
  return `https://api.open-meteo.com/v1/forecast?${params}`;
}

/** Shape of the slice of the Open-Meteo response we rely on. */
interface RawForecast {
  current?: { temperature_2m?: number; weather_code?: number };
  daily?: {
    time?: string[];
    weather_code?: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_probability_max?: (number | null)[];
  };
}

/**
 * Parse a forecast response defensively. A missing field yields fewer days
 * rather than a thrown error, because the fallback for a broken forecast is the
 * climate panel, never an error box in front of a guest.
 */
export function parseForecast(raw: unknown): ForecastResult {
  const data = (raw ?? {}) as RawForecast;

  const current =
    typeof data.current?.temperature_2m === 'number' && typeof data.current?.weather_code === 'number'
      ? {
          temperature: Math.round(data.current.temperature_2m),
          condition: wmoToCondition(data.current.weather_code),
        }
      : null;

  const times = data.daily?.time ?? [];
  const codes = data.daily?.weather_code ?? [];
  const highs = data.daily?.temperature_2m_max ?? [];
  const lows = data.daily?.temperature_2m_min ?? [];
  const rain = data.daily?.precipitation_probability_max ?? [];

  const daily: DailyForecast[] = [];
  for (let i = 0; i < times.length; i += 1) {
    const high = highs[i];
    const low = lows[i];
    const code = codes[i];
    if (typeof high !== 'number' || typeof low !== 'number' || typeof code !== 'number') continue;
    daily.push({
      date: times[i]!,
      condition: wmoToCondition(code),
      high: Math.round(high),
      low: Math.round(low),
      rainChance: typeof rain[i] === 'number' ? rain[i]! : null,
    });
  }

  return { current, daily };
}

/** Pull the wedding day out of a forecast, if it reaches that far. */
export function findDay(daily: DailyForecast[], isoDate: string): DailyForecast | null {
  return daily.find((d) => d.date === isoDate) ?? null;
}

export interface ClimateNormals {
  avgHigh: number;
  avgLow: number;
  warmHigh: number;
  coolHigh: number;
  precipDayPercent: number;
  sampleYears: number;
  sampleDays: number;
  windowLabel: string;
  generatedAt: string;
}
