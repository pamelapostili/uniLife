import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import { supabase } from "./supabase";

WebBrowser.maybeCompleteAuthSession();

export type OAuthProvider = "google" | "apple";

/**
 * Inicia sesión con un proveedor externo (Google, Apple, ...) vía Supabase OAuth.
 * En web, Supabase redirige la pestaña directamente (el cliente detecta la sesión al volver).
 * En nativo, abre un navegador in-app y captura el token del deep link de regreso.
 */
export async function signInWithProvider(provider: OAuthProvider) {
  if (Platform.OS === "web") {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined,
      },
    });
    if (error) throw error;
    return null;
  }

  const redirectTo = Linking.createURL("auth/callback");

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error || !data?.url) {
    throw error ?? new Error("No se pudo iniciar el flujo de autenticación.");
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  if (result.type !== "success" || !result.url) {
    if (result.type === "cancel" || result.type === "dismiss") {
      return null;
    }
    throw new Error(`No se pudo completar el inicio de sesión (${result.type}).`);
  }

  // El proveedor puede regresar con "?code=..." (flujo PKCE, el que usa
  // supabase-js por defecto) o con "#access_token=..." (flujo implícito).
  const [beforeHash, hashPart] = result.url.split("#");
  const queryPart = beforeHash.split("?")[1] ?? "";
  const searchParams = new URLSearchParams(queryPart);
  const hashParams = new URLSearchParams(hashPart ?? "");

  const errorDescription = searchParams.get("error_description") ?? hashParams.get("error_description");
  if (errorDescription) {
    throw new Error(errorDescription);
  }

  const code = searchParams.get("code");
  if (code) {
    const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(code);
    if (sessionError) throw sessionError;
    return sessionData;
  }

  const access_token = hashParams.get("access_token");
  const refresh_token = hashParams.get("refresh_token");

  if (!access_token || !refresh_token) {
    throw new Error("No se recibió la sesión del proveedor.");
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
    access_token,
    refresh_token,
  });

  if (sessionError) throw sessionError;

  return sessionData;
}
