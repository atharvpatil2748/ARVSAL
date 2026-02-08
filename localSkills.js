const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

/* ========== WEATHER ========== */

async function geocodeCity(city) {
  const url =
    `https://geocoding-api.open-meteo.com/v1/search` +
    `?name=${encodeURIComponent(city)}` +
    `&count=1&language=en&format=json`;

  const res = await fetch(url);
  const data = await res.json();

  if (!data?.results?.length) return null;

  const place = data.results[0];
  return {
    lat: place.latitude,
    lon: place.longitude,
    name: place.name,
    country: place.country
  };
}

async function getWeather(city = "kanpur") {
  const location = await geocodeCity(city);

  if (!location) {
    return `I couldn't find weather data for "${city}".`;
  }

  const { lat, lon, name, country } = location;

  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lon}` +
    `&current_weather=true`;

  const res = await fetch(url);
  const data = await res.json();

  if (!data?.current_weather) {
    return "Weather data is currently unavailable.";
  }

  const { temperature, windspeed } = data.current_weather;

  return `The current temperature in ${name}, ${country} is ${temperature}°C with wind speed ${windspeed} km/h.`;
}

/* ========== NEWS ========== */
async function getNews() {
  const apiKey = process.env.GNEWS_API_KEY;

  if (!apiKey) return "News service is not configured.";

  const url = `https://gnews.io/api/v4/top-headlines?country=in&lang=en&max=5&apikey=${apiKey}`;
  const res = await fetch(url);
  const data = await res.json();

  if (!data.articles?.length) return "No news available right now.";

  return data.articles
    .slice(0, 3)
    .map((a, i) => `${i + 1}. ${a.title}`)
    .join("\n");
}

module.exports = {
  getWeather,
  getNews
};