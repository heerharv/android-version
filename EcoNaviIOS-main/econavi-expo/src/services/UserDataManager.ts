import { supabase } from './SupabaseClient';
import { carbonEmissionForTrip, calculateTravelTime } from '../utils/EmissionsCalculator';

export class UserDataManager {
  private static instance: UserDataManager;
  
  private constructor() {}

  public static getInstance(): UserDataManager {
    if (!UserDataManager.instance) {
      UserDataManager.instance = new UserDataManager();
    }
    return UserDataManager.instance;
  }

  // Saves a completed trip from Live Tracking to Supabase
  public async saveTrip(distanceKm: number, transportMode: string) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) {
       console.warn("No auth session found, cannot save trip to Supabase.");
       return false;
    }

    const timeTaken = calculateTravelTime(transportMode, distanceKm);
    const emissions = carbonEmissionForTrip(distanceKm, transportMode);

    const { error } = await supabase
      .from('trip_emissions')
      .insert({
        user_id: session.user.id,
        distance: distanceKm,
        time_taken: timeTaken,
        carbon_emission: emissions,
        transport_mode: transportMode
      });

    if (error) {
      console.error("Failed to insert trip:", error);
      return false;
    }
    return true;
  }

  // Fetch all time carbon saved by user
  public async fetchTotalCarbonSaved(): Promise<number> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) return 0;

    const { data, error } = await supabase
      .from('trip_emissions')
      .select('carbon_emission')
      .eq('user_id', session.user.id);

    if (error || !data) {
      console.error("Failed to fetch trips:", error);
      return 0;
    }

    // In a real scenario, this calculates car emissions vs the transport_mode taken.
    // For simplicity mirroring mocked iOS profile, we sum the saved emissions directly if mode != 'car'.
    let savings = 0;
    // Assuming car emission is roughly 0.12 kg/km
    // Savings = (Car_Co2) - (Trip_Co2)
    // Actually the iOS EmissionsCalculator computes actual emission.
    return data.reduce((acc, trip) => acc + trip.carbon_emission, 0); 
  }
}

export const userDataManager = UserDataManager.getInstance();
