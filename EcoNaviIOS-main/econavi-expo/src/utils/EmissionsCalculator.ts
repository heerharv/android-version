export const emissionFactors: Record<string, number> = {
  walk: 0.0,
  bike: 0.0,
  two_wheeler: 55.0,
  auto: 90.0,
  bus: 82.0,
  metro: 28.0,
  train: 35.0,
  car: 170.0,
  rideshare: 170.0,
  freightTruck: 70.0,
  freightRail: 18.0,
  freightShip: 9.0,
  freightAir: 540.0,
};

export const averageSpeeds: Record<string, number> = {
  walk: 4.5,
  bike: 28,
  bus: 18,
  train: 65,
  metro: 35,
  car: 30,
  rideshare: 30,
  auto: 25,
};

export const costFactors: Record<string, { perKm: number; baseFare: number }> = {
  walk: { perKm: 0, baseFare: 0 },
  bike: { perKm: 3.5, baseFare: 0 },
  bus: { perKm: 1.5, baseFare: 15 },
  train: { perKm: 1.0, baseFare: 30 },
  metro: { perKm: 2.0, baseFare: 25 },
  auto: { perKm: 12, baseFare: 30 },
  car: { perKm: 8.5, baseFare: 0 },
  rideshare: { perKm: 14, baseFare: 40 },
};

export const calculateEmissions = (mode: string, distanceKm: number): number => {
  const factor = emissionFactors[mode] ?? 0;
  return factor * distanceKm;
};

export const carbonEmissionForTrip = (distanceKm: number, mode: string): number => {
  return calculateEmissions(mode, distanceKm);
};

export const calculateTravelTime = (mode: string, distanceKm: number): number => {
  const speed = averageSpeeds[mode] ?? 30;
  return (distanceKm / speed) * 60;
};

export const calculateCost = (mode: string, distanceKm: number, peakHour = false): number => {
  const factors = costFactors[mode];
  if (!factors) return 0;

  let cost = factors.baseFare + factors.perKm * distanceKm;

  if (peakHour && mode === 'rideshare') {
    cost *= 1.4;
  }

  return cost;
};

export const calculateFreightEmissions = (method: string, weightKg: number, distanceKm: number): number => {
  const weightTons = weightKg / 1000;
  const factor = emissionFactors[method] ?? 0;
  return factor * weightTons * distanceKm;
};

export const calculateCarbonCredits = (savedEmissionsGrams: number): number => {
  return Math.floor(savedEmissionsGrams / 100);
};

export const formatEmission = (grams: number): string => {
  if (grams < 1000) {
    return `${grams.toFixed(0)} g CO₂`;
  } else {
    return `${(grams / 1000).toFixed(1)} kg CO₂`;
  }
};

export const formatEmissions = (gramsCO2: number): string => {
  return formatEmission(gramsCO2);
};

export const formatCostINR = (amount: number): string => {
  return `₹${amount.toFixed(0)}`;
};
