import type {
EarningsSummary,
NewTrip,
Point,
Profile,
Trip,
} from "@pepo/types/model";
import { api } from "./api";
export const getMe = () => api<Profile>("/me");
export const getTrips = () => api<Trip[]>("/trips");
export const createTrip = (input: NewTrip) =>
  api<Trip>("/trips", { method: "POST", body: input });
export const cancelTrip = (id: string) =>
  api<Trip>(`/trips/${encodeURIComponent(id)}/status`, {
    method: "POST",
    body: { status: "cancelled" },
  });
export const acceptTrip = (id: string, offerId: string) =>
  api<Trip>(`/trips/${encodeURIComponent(id)}/accept`, {
    method: "POST",
    body: { offerId },
  });
export const getDriverRequests = () => api<Trip[]>("/requests");
export const updateDriverLocation = (id: string, point: Point) =>
  api<{ ok: true }>(`/trips/${encodeURIComponent(id)}/location`, {
    method: "POST",
    body: point,
  });
export const getDriverEarnings = () =>
  api<EarningsSummary>("/earnings/summary");
