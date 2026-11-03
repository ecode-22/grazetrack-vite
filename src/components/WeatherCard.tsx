import { useEffect, useState } from 'react';
import type { FarmProfile } from '@/lib/types';

type WeatherLocation = NonNullable<FarmProfile['location']>;

interface WeatherData {
  current: {
    temperature_2m: number;
    is_day: number;
    weather_code: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
  };
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    wind_speed_10m_max: number[];
    wind_direction_10m_dominant: number[];
  };
}

function weatherDescription(code: number) {
  if (code === 0) return 'Clear sky';
  if (code === 1) return 'Mainly clear';
  if (code === 2) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if (code === 45 || code === 48) return 'Fog';
  if (code >= 51 && code <= 57) return 'Drizzle';
  if (code >= 61 && code <= 67) return 'Rain';
  if (code >= 71 && code <= 77) return 'Snow';
  if (code >= 80 && code <= 82) return 'Rain showers';
  if (code === 85 || code === 86) return 'Snow showers';
  if (code >= 95) return 'Thunderstorms';
  return 'Changeable';
}

function weatherSymbol(code: number, isDay = true) {
  if (code === 0) return isDay ? '☀' : '☾';
  if (code <= 2) return isDay ? '⛅' : '☁';
  if (code === 3 || code === 45 || code === 48) return '☁';
  if (code >= 71 && code <= 77 || code === 85 || code === 86) return '❄';
  if (code >= 95) return 'ϟ';
  if (code >= 51) return '☂';
  return '☁';
}

function windDirection(degrees: number) {
  return ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'][Math.round(degrees / 22.5) % 16];
}

function formatDay(date: string) {
  return new Intl.DateTimeFormat(undefined, { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
}

export default function WeatherCard({ location, onSaveFarmLocation }: {
  location: WeatherLocation | null;
  onSaveFarmLocation: (location: WeatherLocation) => void;
}) {
  const [data, setData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [editingLocation, setEditingLocation] = useState(!location);
  const [latitude, setLatitude] = useState(location ? String(location.latitude) : '');
  const [longitude, setLongitude] = useState(location ? String(location.longitude) : '');
  const [locationError, setLocationError] = useState('');
  const locationLatitude = location?.latitude;
  const locationLongitude = location?.longitude;

  useEffect(() => {
    if (locationLatitude === undefined || locationLongitude === undefined) return;

    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 10000);
    const params = new URLSearchParams({
      latitude: String(locationLatitude),
      longitude: String(locationLongitude),
      current: 'temperature_2m,is_day,weather_code,wind_speed_10m,wind_direction_10m',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,wind_direction_10m_dominant',
      timezone: 'auto',
      forecast_days: '4',
    });

    setLoading(true);
    setError('');
    fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Weather service is unavailable.');
        return response.json() as Promise<WeatherData>;
      })
      .then((weather) => setData(weather))
      .catch((cause: unknown) => {
        if (cause instanceof Error && cause.name === 'AbortError' && !timedOut) return;
        setError(timedOut ? 'The forecast request timed out. Check your connection and try again.' : 'Could not load the farm forecast. Check your connection and try again.');
      })
      .finally(() => {
        clearTimeout(timeout);
        setLoading(false);
      });

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [locationLatitude, locationLongitude, refreshKey]);

  function saveLocation() {
    setLocationError('');
    const lat = Number(latitude);
    const lon = Number(longitude);
    if (!latitude.trim() || !longitude.trim() || !Number.isFinite(lat) || lat < -90 || lat > 90) {
      setLocationError('Enter a latitude between -90 and 90.');
      return;
    }
    if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
      setLocationError('Enter a longitude between -180 and 180.');
      return;
    }
    onSaveFarmLocation({ latitude: lat, longitude: lon, accuracyM: 0, capturedAt: new Date().toISOString() });
    setEditingLocation(false);
  }

  return (
    <section className="card weather-card" aria-label="Local weather forecast">
      <div className="weather-heading">
        <div>
          <div className="card-title">Farm weather</div>
          <div className="weather-location">{location ? `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}` : 'Farm coordinates not set'}</div>
        </div>
        <div className="weather-heading-actions">
        {location && !editingLocation && (
          <button type="button" className="weather-refresh" onClick={() => setRefreshKey((key) => key + 1)} disabled={loading} aria-label="Refresh weather" title="Refresh weather">
            ↻
          </button>
        )}
        {location && !editingLocation && <button type="button" className="weather-location-edit" onClick={() => {
          setLatitude(String(location.latitude));
          setLongitude(String(location.longitude));
          setEditingLocation(true);
        }}>Edit farm location</button>}
        </div>
      </div>

      {editingLocation || !location ? (
        <form className="weather-location-form" onSubmit={(event) => { event.preventDefault(); saveLocation(); }}>
          <p>Weather is based on your farm coordinates, not this device’s location.</p>
          <label>Latitude<input type="number" min="-90" max="90" step="any" value={latitude} onChange={(event) => setLatitude(event.target.value)} placeholder="e.g. -33.92" /></label>
          <label>Longitude<input type="number" min="-180" max="180" step="any" value={longitude} onChange={(event) => setLongitude(event.target.value)} placeholder="e.g. 18.42" /></label>
          {locationError && <p className="weather-location-error" role="alert">{locationError}</p>}
          <div><button className="weather-retry" type="submit">Save farm location</button>{location && <button className="weather-cancel-edit" type="button" onClick={() => setEditingLocation(false)}>Cancel</button>}</div>
        </form>
      ) : error ? (
        <div className="weather-error" role="alert">
          <strong>Forecast unavailable</strong>
          <span>{error}</span>
          <button type="button" className="weather-retry" onClick={() => setRefreshKey((key) => key + 1)}>Try again</button>
        </div>
      ) : loading && !data ? (
        <p className="weather-loading" role="status">Loading local forecast…</p>
      ) : location && data ? (
        <>
          <div className="weather-current">
            <span className="weather-current-symbol" aria-hidden="true">{weatherSymbol(data.current.weather_code, data.current.is_day === 1)}</span>
            <div className="weather-current-main">
              <strong>{Math.round(data.current.temperature_2m)}°</strong>
              <span>{weatherDescription(data.current.weather_code)}</span>
            </div>
            <div className="weather-current-wind">
              <span>Wind</span>
              <strong>{Math.round(data.current.wind_speed_10m)} km/h {windDirection(data.current.wind_direction_10m)}</strong>
            </div>
          </div>
          <div className="weather-forecast" aria-label="Three-day forecast">
            {data.daily.time.slice(1, 4).map((date, index) => {
              const dayIndex = index + 1;
              return (
                <div className="weather-day" key={date}>
                  <span className="weather-day-name">{formatDay(date)}</span>
                  <span className="weather-day-symbol" aria-hidden="true">{weatherSymbol(data.daily.weather_code[dayIndex])}</span>
                  <span className="weather-day-condition">{weatherDescription(data.daily.weather_code[dayIndex])}</span>
                  <strong className="weather-day-temp">{Math.round(data.daily.temperature_2m_max[dayIndex])}° <span>{Math.round(data.daily.temperature_2m_min[dayIndex])}°</span></strong>
                  <span className="weather-day-wind">{Math.round(data.daily.wind_speed_10m_max[dayIndex])} km/h {windDirection(data.daily.wind_direction_10m_dominant[dayIndex])}</span>
                </div>
              );
            })}
          </div>
        </>
      ) : null}
      {loading && data && <span className="weather-updating" role="status">Updating…</span>}
    </section>
  );
}