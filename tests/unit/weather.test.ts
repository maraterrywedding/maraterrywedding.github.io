import { describe, expect, it } from 'vitest';
import climate from '@/data/climate-june.json';
import {
  FORECAST_HORIZON_DAYS,
  daysUntil,
  findDay,
  forecastUrl,
  parseForecast,
  pickWeatherMode,
  wmoToCondition,
} from '@/lib/weather';

const CEREMONY = '2027-06-11T11:00:00+02:00';
const COORDS = { lat: 52.028, lon: 9.415, timeZone: 'Europe/Berlin' };

describe('wmoToCondition', () => {
  it.each([
    [0, 'clear'],
    [1, 'partlyCloudy'],
    [2, 'partlyCloudy'],
    [3, 'overcast'],
    [45, 'fog'],
    [48, 'fog'],
    [51, 'drizzle'],
    [57, 'drizzle'],
    [61, 'rain'],
    [65, 'rain'],
    [67, 'rain'],
    [71, 'snow'],
    [77, 'snow'],
    [80, 'showers'],
    [82, 'showers'],
    [85, 'snow'],
    [95, 'thunderstorm'],
    [99, 'thunderstorm'],
  ])('maps WMO %i to %s', (code, expected) => {
    expect(wmoToCondition(code)).toBe(expected);
  });

  it('degrades gracefully on an unknown code rather than breaking the card', () => {
    expect(wmoToCondition(999)).toBe('partlyCloudy');
    expect(wmoToCondition(-1)).toBe('partlyCloudy');
  });
});

describe('pickWeatherMode', () => {
  it('uses climate normals while the wedding is far away', () => {
    expect(pickWeatherMode('2026-08-14T12:00:00+02:00', CEREMONY)).toBe('climate');
  });

  it('switches to a real forecast at the horizon, and not before', () => {
    // Exactly 15 whole days out — inside Open-Meteo's window.
    expect(pickWeatherMode('2027-05-27T11:00:00+02:00', CEREMONY)).toBe('forecast');
    // 16 whole days out — outside it.
    expect(pickWeatherMode('2027-05-26T11:00:00+02:00', CEREMONY)).toBe('climate');
  });

  it('is on the forecast side on the day itself', () => {
    expect(pickWeatherMode('2027-06-11T08:00:00+02:00', CEREMONY)).toBe('forecast');
  });

  it('falls back to climate once the wedding has passed', () => {
    expect(pickWeatherMode('2027-06-12T08:00:00+02:00', CEREMONY)).toBe('climate');
  });

  it('has a horizon inside what the API actually publishes', () => {
    // Open-Meteo serves 16 days; going right to the edge risks an empty card.
    expect(FORECAST_HORIZON_DAYS).toBeLessThan(16);
  });
});

describe('daysUntil', () => {
  it('counts whole days only', () => {
    expect(daysUntil('2027-06-10T11:00:00+02:00', CEREMONY)).toBe(1);
    expect(daysUntil('2027-06-10T23:00:00+02:00', CEREMONY)).toBe(0);
  });

  it('goes negative after the event', () => {
    expect(daysUntil('2027-06-13T11:00:00+02:00', CEREMONY)).toBe(-2);
  });
});

describe('forecastUrl', () => {
  it('requests the fields the widget renders, and nothing more', () => {
    const url = new URL(forecastUrl(COORDS));
    expect(url.origin + url.pathname).toBe('https://api.open-meteo.com/v1/forecast');
    expect(url.searchParams.get('latitude')).toBe('52.028');
    expect(url.searchParams.get('longitude')).toBe('9.415');
    expect(url.searchParams.get('timezone')).toBe('Europe/Berlin');
    expect(url.searchParams.get('forecast_days')).toBe('7');
    expect(url.searchParams.get('current')).toContain('temperature_2m');
    expect(url.searchParams.get('daily')).toContain('precipitation_probability_max');
  });

  it('needs no API key — that is why this provider was chosen', () => {
    const url = forecastUrl(COORDS);
    expect(url).not.toMatch(/key|token|appid/i);
  });
});

describe('parseForecast', () => {
  const raw = {
    current: { temperature_2m: 19.4, weather_code: 3 },
    daily: {
      time: ['2027-06-10', '2027-06-11', '2027-06-12'],
      weather_code: [0, 61, 95],
      temperature_2m_max: [22.6, 19.1, 24.9],
      temperature_2m_min: [11.2, 10.8, 13.4],
      precipitation_probability_max: [5, 70, null],
    },
  };

  it('rounds temperatures and maps conditions', () => {
    const result = parseForecast(raw);
    expect(result.current).toEqual({ temperature: 19, condition: 'overcast' });
    expect(result.daily).toHaveLength(3);
    expect(result.daily[1]).toEqual({
      date: '2027-06-11',
      condition: 'rain',
      high: 19,
      low: 11,
      rainChance: 70,
    });
  });

  it('keeps a day whose rain probability is missing', () => {
    expect(parseForecast(raw).daily[2]!.rainChance).toBeNull();
  });

  it('returns an empty result rather than throwing on junk', () => {
    for (const junk of [null, undefined, {}, { daily: {} }, { daily: { time: ['x'] } }, 42, 'no']) {
      const result = parseForecast(junk);
      expect(result.daily).toEqual([]);
      expect(result.current).toBeNull();
    }
  });

  it('drops a day with incomplete numbers instead of rendering NaN', () => {
    const result = parseForecast({
      daily: {
        time: ['2027-06-10', '2027-06-11'],
        weather_code: [0, 1],
        temperature_2m_max: [22, null],
        temperature_2m_min: [11, 9],
        precipitation_probability_max: [0, 0],
      },
    });
    expect(result.daily).toHaveLength(1);
    expect(result.daily[0]!.date).toBe('2027-06-10');
  });

  it('survives a missing `current` block', () => {
    expect(parseForecast({ daily: raw.daily }).current).toBeNull();
    expect(parseForecast({ daily: raw.daily }).daily).toHaveLength(3);
  });
});

describe('committed June climate normals', () => {
  // This file is generated once, online, by scripts/fetch-climate.mjs and then
  // committed. These checks are the only thing standing between a bad fetch and
  // the site telling guests to pack for the wrong weather.

  it('rests on a real sample, not a handful of days', () => {
    expect(climate.sampleYears).toBeGreaterThanOrEqual(25);
    expect(climate.sampleDays).toBeGreaterThanOrEqual(300);
  });

  it('describes a plausible northern German June', () => {
    expect(climate.avgHigh).toBeGreaterThan(15);
    expect(climate.avgHigh).toBeLessThan(30);
    expect(climate.avgLow).toBeGreaterThan(5);
    expect(climate.avgLow).toBeLessThan(18);
  });

  it('keeps the overnight low below the daytime high', () => {
    expect(climate.avgLow).toBeLessThan(climate.avgHigh);
  });

  it('brackets the average with its cool and warm ends', () => {
    expect(climate.coolHigh).toBeLessThan(climate.avgHigh);
    expect(climate.warmHigh).toBeGreaterThan(climate.avgHigh);
  });

  it('reports rainfall as a usable percentage', () => {
    expect(climate.precipDayPercent).toBeGreaterThan(0);
    expect(climate.precipDayPercent).toBeLessThan(100);
    expect(Number.isInteger(climate.precipDayPercent)).toBe(true);
  });
});

describe('findDay', () => {
  const daily = parseForecast({
    daily: {
      time: ['2027-06-10', '2027-06-11'],
      weather_code: [0, 61],
      temperature_2m_max: [22, 19],
      temperature_2m_min: [11, 10],
      precipitation_probability_max: [5, 70],
    },
  }).daily;

  it('finds the wedding day when the forecast reaches it', () => {
    expect(findDay(daily, '2027-06-11')?.condition).toBe('rain');
  });

  it('returns null when it does not', () => {
    expect(findDay(daily, '2027-06-20')).toBeNull();
    expect(findDay([], '2027-06-11')).toBeNull();
  });
});
