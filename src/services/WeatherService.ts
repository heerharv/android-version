// WeatherService.ts — Smart weather integration for eco-routing suggestions

export interface WeatherData {
  temp: number;
  condition: 'sunny' | 'rainy' | 'cloudy' | 'hot';
  description: string;
}

export class WeatherService {
  private static instance: WeatherService;
  private apiKey: string | null = null; // To be provided by user later

  private constructor() {}

  public static getInstance(): WeatherService {
    if (!WeatherService.instance) {
      WeatherService.instance = new WeatherService();
    }
    return WeatherService.instance;
  }

  public async getCurrentWeather(lat: number, lon: number): Promise<WeatherData> {
    // If we had a key: 
    // const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${this.apiKey}&units=metric`);
    // const data = await res.json();
    
    // MOCK LOGIC for premium demo
    const hour = new Date().getHours();
    const isHot = hour > 11 && hour < 16;
    
    return new Promise((resolve) => {
      setTimeout(() => {
        if (isHot) {
          resolve({ temp: 32, condition: 'hot', description: 'Very Hot' });
        } else {
          // Randomly simulate clouds or sun
          const rand = Math.random();
          if (rand > 0.8) resolve({ temp: 24, condition: 'rainy', description: 'Light Rain' });
          else if (rand > 0.4) resolve({ temp: 27, condition: 'sunny', description: 'Clear Skies' });
          else resolve({ temp: 25, condition: 'cloudy', description: 'Cloudy' });
        }
      }, 500);
    });
  }

  public getRecommendation(weather: WeatherData): { mode: string; reason: string } {
    if (weather.condition === 'rainy') {
      return { mode: 'car', reason: 'It might rain—Car or Bus is recommended for comfort.' };
    }
    if (weather.condition === 'hot') {
      return { mode: 'transit', reason: 'High heat today—AC transport is recommended.' };
    }
    return { mode: 'walk', reason: 'Great weather! Perfect for a Walk or Bike ride to save CO₂.' };
  }
}

export const weatherService = WeatherService.getInstance();
