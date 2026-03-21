import "dotenv/config";
import express from "express";
import axios from "axios";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.OPENWEATHER_API_KEY;

if (!API_KEY) {
  console.log("API_KEY is missing from env");
  process.exit(1);
}

//middleware
app.use(cors());
app.use(express.json());

//main endpoint: GET /api/weather?city=...
app.get("/api/weather", async (req, res) => {
  try {
    const city = req.query.city;
    if (!city) {
      return res.status(400).json({ error: "city parameter is required" });
    }

    console.log(`fetching weather for: ${city}`);

    // Step 1: City → lat/lon (Geocoding API)
    const geoUrl = `http://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=1&appid=${API_KEY}`;
    const geoRes = await axios.get(geoUrl);

    if (!geoRes.data || geoRes.data.length === 0) {
      return res.status(404).json({ error: `City "${city}" not found` });
    }

    const { lat, lon, name, country } = geoRes.data[0];

    // Step 2: Weather data (Current + 7-day forecast)
    const weatherUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`;
    const weatherRes = await axios.get(weatherUrl);

    const list = weatherRes.data.list;
    const current = list[0]; // First item = current weather

    // Build 7-day forecast (group by date)
    const dailyForecast = {};
    list.forEach((item) => {
      const date = item.dt_txt.split(" ")[0]; // YYYY-MM-DD
      if (!dailyForecast[date]) {
        dailyForecast[date] = {
          min: item.main.temp_min,
          max: item.main.temp_max,
          description: item.weather[0].description,
        };
      } else {
        dailyForecast[date].min = Math.min(
          dailyForecast[date].min,
          item.main.temp_min,
        );
        dailyForecast[date].max = Math.max(
          dailyForecast[date].max,
          item.main.temp_max,
        );
      }
    });

    // Clean response for dashboard
    res.json({
      location: `${name}, ${country}`,
      current: {
        temperature: Math.round(current.main.temp),
        humidity: current.main.humidity,
        windSpeed: current.wind.speed,
        description: current.weather[0].description,
        icon: current.weather[0].icon,
        feelsLike: Math.round(current.main.feels_like),
      },
      forecast: Object.entries(dailyForecast)
        .slice(0, 7) // Next 7 days
        .map(([date, data]) => ({
          date,
          min: Math.round(data.min),
          max: Math.round(data.max),
          description: data.description,
        })),
    });
  } catch (error) {
    console.error("Weather API error: ", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to fetch weather data" });
  }
});

//Health chech
app.get("/", (req, res) => {
  res.json({
    message: "Weather Dashboard API is running!",
    endpoints: "/api/weather?city=Abu Dhabi",
  });
});

app.listen(PORT, () => {
  console.log(`Weather API running on http://localhost:${PORT}`);
  console.log(`Test: http://localhost:${PORT}/api/weather?city=Abu Dhabi`);
});
