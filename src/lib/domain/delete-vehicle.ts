import { deleteVehicle } from "@/lib/models/vehicle";
import { listTrips } from "@/lib/models/trip";
import { deleteTripCascade } from "@/lib/domain/delete-trip";

// Removes a Vehicle and every Trip (and each Trip's derived data) that
// belongs to it. Returns false when the vehicle didn't exist, in which
// case nothing else is touched.
export async function deleteVehicleCascade(vehicleId: string): Promise<boolean> {
  const trips = await listTrips(vehicleId);
  await Promise.all(trips.map((trip) => deleteTripCascade(trip.id)));
  return deleteVehicle(vehicleId);
}
