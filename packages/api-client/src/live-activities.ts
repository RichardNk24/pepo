import { api } from "./api";

export type LiveActivityTokenInput = {
  activityId: string;
  pushToken: string;
  language: "fr" | "en" | "sw" | "ln";
};

export const registerLiveActivityToken = (tripId: string, input: LiveActivityTokenInput) =>
  api<void>(`/trips/${encodeURIComponent(tripId)}/live-activity-token`, {
    method: "PUT",
    body: input,
  });

export const removeLiveActivityToken = (tripId: string, activityId: string) =>
  api<void>(
    `/trips/${encodeURIComponent(tripId)}/live-activity-token/${encodeURIComponent(activityId)}`,
    { method: "DELETE" },
  );
