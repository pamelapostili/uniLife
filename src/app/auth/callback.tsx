import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { supabase } from "../../lib/supabase";

/**
 * Pantalla puente para el login social en web: Supabase regresa aquí tras el
 * OAuth. Puede venir como "?code=..." (flujo PKCE, el que usa esta versión
 * de supabase-js por defecto) o como "#access_token=..." (flujo implícito).
 * Lo procesamos manualmente antes de que expo-router limpie la URL, ya que
 * su enrutado en web borra el hash/query antes de que el cliente de
 * Supabase alcance a detectarlo por sí solo.
 */
export default function AuthCallback() {
  const router = useRouter();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const ranRef = useRef(false);

  useEffect(() => {
    // React StrictMode ejecuta los efectos dos veces en desarrollo; el código
    // de OAuth es de un solo uso, así que una segunda ejecución lo rompería.
    if (ranRef.current) return;
    ranRef.current = true;

    (async () => {
      try {
        const search = typeof window !== "undefined" ? window.location.search : "";
        const hash = typeof window !== "undefined" ? window.location.hash : "";
        const searchParams = new URLSearchParams(search);
        const hashParams = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);

        const errorDescription = searchParams.get("error_description") ?? hashParams.get("error_description");
        if (errorDescription) {
          throw new Error(errorDescription);
        }

        const code = searchParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else {
          const access_token = hashParams.get("access_token");
          const refresh_token = hashParams.get("refresh_token");
          if (access_token && refresh_token) {
            const { error } = await supabase.auth.setSession({ access_token, refresh_token });
            if (error) throw error;
          } else {
            throw new Error("No se recibió información de sesión en la respuesta.");
          }
        }

        router.replace("/");
      } catch (err: any) {
        setErrorMsg(err?.message ?? "No se pudo completar el inicio de sesión.");
      }
    })();
  }, []);

  return (
    <View style={styles.container}>
      {errorMsg ? (
        <>
          <Text style={styles.errorText}>{errorMsg}</Text>
          <TouchableOpacity style={styles.button} onPress={() => router.replace("/login")}>
            <Text style={styles.buttonText}>Volver a iniciar sesión</Text>
          </TouchableOpacity>
        </>
      ) : (
        <ActivityIndicator size="large" color="#324F40" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F4F5F0",
    padding: 24,
  },
  errorText: {
    marginBottom: 16,
    color: "#b91c1c",
    textAlign: "center",
  },
  button: {
    backgroundColor: "#324F40",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
  },
});
