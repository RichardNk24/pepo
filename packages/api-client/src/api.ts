import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || "").replace(
  /\/$/,
  "",
);
export const LIVE = Boolean(API_URL);
let accessToken = "";
let sessionKey = "pepo-rider-session";
export function configureClient(role: "passenger" | "driver") {
  sessionKey = `pepo-${role === "driver" ? "driver" : "rider"}-session`;
}
export const getToken = () => accessToken;
export async function loadToken() {
  accessToken =
    (Platform.OS === "web"
      ? await AsyncStorage.getItem(sessionKey)
      : await SecureStore.getItemAsync(sessionKey)) || "";
  return accessToken;
}
export async function saveToken(token: string) {
  accessToken = token;
  if (Platform.OS === "web") {
    if (token) await AsyncStorage.setItem(sessionKey, token);
    else await AsyncStorage.removeItem(sessionKey);
  } else {
    if (token) await SecureStore.setItemAsync(sessionKey, token);
    else await SecureStore.deleteItemAsync(sessionKey);
  }
}
export class RequestError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown; form?: FormData } = {},
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 16000);
  try {
    const response = await fetch(`${API_URL}/api${path}`, {
      method: options.method || "GET",
      signal: controller.signal,
      headers: {
        ...(options.form ? {} : { "Content-Type": "application/json" }),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body:
        options.form ||
        (options.body ? JSON.stringify(options.body) : undefined),
    });
    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new RequestError(
        "Le serveur a renvoyé une réponse invalide.",
        response.status,
      );
    }
    if (!response.ok)
      throw new RequestError(
        data.error || "La demande a échoué. Réessayez.",
        response.status,
      );
    return data as T;
  } catch (e) {
    if (e instanceof RequestError) throw e;
    throw new RequestError(
      "Impossible de joindre Pepo. Vérifiez votre connexion et réessayez.",
      0,
    );
  } finally {
    clearTimeout(timer);
  }
}
