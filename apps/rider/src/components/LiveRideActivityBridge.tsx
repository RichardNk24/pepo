import { LIVE } from "@pepo/api-client/api";
import { registerLiveActivityToken, removeLiveActivityToken } from "@pepo/api-client/live-activities";
import type { Language, Trip } from "@pepo/types/model";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import type { PepoRideActivityProps } from "../widgets/PepoRideActivity";
import { useApp } from "@pepo/session/AppProvider";

const STORED_TRIP = "pepo-live-activity-trip";
const STORED_ACTIVITY = "pepo-live-activity-id";

function presentation(trip: Trip, language: Language): PepoRideActivityProps {
  const status: Record<Language, Record<string, [string, string]>> = {
    fr: { searching: ["Recherche d’un conducteur", "Recherche…"], accepted: ["Votre conducteur arrive", "En route"], arrived: ["Votre conducteur est là", "Arrivé"], in_progress: ["Course en cours", "En course"], completed: ["Vous êtes arrivé", "Terminé"], cancelled: ["Course annulée", "Annulée"] },
    en: { searching: ["Finding a driver", "Finding…"], accepted: ["Your driver is on the way", "On the way"], arrived: ["Your driver is here", "Arrived"], in_progress: ["Ride in progress", "On trip"], completed: ["You have arrived", "Done"], cancelled: ["Ride cancelled", "Cancelled"] },
    sw: { searching: ["Tunatafuta dereva", "Tunatafuta…"], accepted: ["Dereva wako anakuja", "Anakuja"], arrived: ["Dereva wako amefika", "Amefika"], in_progress: ["Safari inaendelea", "Safarini"], completed: ["Umefika", "Imekamilika"], cancelled: ["Safari imeghairiwa", "Imeghairiwa"] },
    ln: { searching: ["Tokómi koluka motambwisi", "Boluki…"], accepted: ["Motambwisi azali koya", "Azali koya"], arrived: ["Motambwisi akómi", "Akómi"], in_progress: ["Mobembo ezali kokende", "Na mobembo"], completed: ["Okómi", "Esili"], cancelled: ["Mobembo elongolami", "Elongolami"] },
  };
  const vehicles: Record<Language, Record<string, string>> = {
    fr: { moto: "Moto", motoSend: "Moto colis", taxi: "Taxi", suv: "SUV", minibus: "Minibus", tricycle: "Tricycle", truck: "Camion", pickupTruck: "Pick-up" },
    en: { moto: "Motorbike", motoSend: "Moto delivery", taxi: "Taxi", suv: "SUV", minibus: "Minibus", tricycle: "Tricycle", truck: "Truck", pickupTruck: "Pickup" },
    sw: { moto: "Pikipiki", motoSend: "Pikipiki ya mizigo", taxi: "Teksi", suv: "SUV", minibus: "Basi dogo", tricycle: "Bajaji", truck: "Lori", pickupTruck: "Pickup" },
    ln: { moto: "Moto", motoSend: "Moto ya biloko", taxi: "Taxi", suv: "SUV", minibus: "Minibus", tricycle: "Tricycle", truck: "Kamio", pickupTruck: "Pick-up" },
  };
  const labels = status[language][trip.status] || status[language].searching;
  return {
    statusLabel: labels[0],
    compactLabel: labels[1],
    vehicleLabel: vehicles[language][trip.vehicle] || vehicles[language].taxi,
    openLabel: ({
      fr: "Touchez pour ouvrir Pepo",
      en: "Tap to open Pepo",
      sw: "Gusa ili ufungue Pepo",
      ln: "Finá mpo na kofungola Pepo",
    } as Record<Language, string>)[language],
  };
}

async function publishToken(trip: Trip, activityId: string, pushToken: string, language: Language) {
  try {
    await registerLiveActivityToken(trip.id, { activityId, pushToken, language });
  } catch {
    // ActivityKit still updates locally; APNs registration can retry on the next token event.
  }
}

export function LiveRideActivityBridge() {
  const app = useApp();
  const subscription = useRef<{ remove: () => void } | null>(null);
  const generation = useRef(0);
  const activeTrip = app.activeTrip;
  const tripId = activeTrip?.id;
  const status = activeTrip?.status;
  const vehicle = activeTrip?.vehicle;
  const language = app.settings.language;
  const tripStatusSnapshot = app.trips.map((trip) => `${trip.id}:${trip.status}`).join("|");
  const expoGo = Constants.executionEnvironment === "storeClient" || Constants.appOwnership === "expo";
  const eligible = Platform.OS === "ios" && !expoGo && LIVE && !app.demo && app.profile?.role === "passenger";

  useEffect(() => {
    const currentGeneration = ++generation.current;
    if (!eligible || !app.ready) return;
    let disposed = false;
    const run = async () => {
      const [storedTripId, storedActivityId] = await Promise.all([
        AsyncStorage.getItem(STORED_TRIP),
        AsyncStorage.getItem(STORED_ACTIVITY),
      ]);
      if (disposed || currentGeneration !== generation.current) return;
      const { default: PepoRideActivity } = await import("../widgets/PepoRideActivity");
      const { after } = await import("expo-widgets");
      const instances = PepoRideActivity.getInstances();
      const storedTrip = storedTripId ? app.trips.find((trip) => trip.id === storedTripId) : undefined;

      if (!activeTrip) {
        if (storedTrip && (storedTrip.status === "completed" || storedTrip.status === "cancelled")) {
          const existing = instances.find((item) => item.getId() === storedActivityId) || instances[0];
          if (existing) await existing.end(
            storedTrip.status === "completed" ? after(new Date(Date.now() + 15 * 60 * 1000)) : "immediate",
            presentation(storedTrip, language),
          );
          subscription.current?.remove();
          subscription.current = null;
          if (storedTripId && storedActivityId)
            await removeLiveActivityToken(storedTripId, storedActivityId).catch(() => {});
          await AsyncStorage.multiRemove([STORED_TRIP, STORED_ACTIVITY]);
        }
        return;
      }
      const props = presentation(activeTrip, language);
      let instance = storedTripId === activeTrip.id
        ? instances.find((item) => item.getId() === storedActivityId)
        : undefined;
      if (!instance) {
        for (const old of instances) await old.end("immediate").catch(() => {});
        instance = PepoRideActivity.start(props, `pepo://ride?id=${encodeURIComponent(activeTrip.id)}`);
        const activityId = instance.getId();
        await AsyncStorage.multiSet([[STORED_TRIP, activeTrip.id], [STORED_ACTIVITY, activityId]]);
        subscription.current?.remove();
        subscription.current = instance.addPushTokenListener((event) => {
          void publishToken(activeTrip, activityId, event.pushToken, language);
        });
        const token = await instance.getPushToken();
        if (token) await publishToken(activeTrip, activityId, token, language);
      } else {
        await instance.update(props, new Date(Date.now() + 10 * 60 * 1000));
        subscription.current?.remove();
        subscription.current = instance.addPushTokenListener((event) => {
          void publishToken(activeTrip, instance!.getId(), event.pushToken, language);
        });
        const token = await instance.getPushToken();
        if (token) await publishToken(activeTrip, instance.getId(), token, language);
      }
    };
    void run().catch(() => {});
    return () => { disposed = true; };
  }, [eligible, app.ready, tripId, status, vehicle, language, tripStatusSnapshot]);

  useEffect(() => () => subscription.current?.remove(), []);
  return null;
}
