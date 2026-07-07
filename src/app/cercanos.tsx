import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../lib/supabase";
import { useUser } from "../lib/user-context";

const initialUsers = [
  {
    id: "1",
    name: "Carlos",
    description: "Estudia Ingeniería",
    coordinate: { latitude: -12.0464, longitude: -77.0428 },
    color: "#3b82f6",
  },
  {
    id: "2",
    name: "Ana",
    description: "Busca grupo de estudio",
    coordinate: { latitude: -12.0421, longitude: -77.0310 },
    color: "#10b981",
  },
  {
    id: "3",
    name: "Luis",
    description: "Entrena todos los días",
    coordinate: { latitude: -12.0506, longitude: -77.0432 },
    color: "#f97316",
  },
];

export default function CercanosScreen() {
  const { user, loading: authLoading } = useUser();
  const router = useRouter();
  const [location, setLocation] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [users, setUsers] = useState(initialUsers);
  const [region, setRegion] = useState({
    latitude: -12.0464,
    longitude: -77.0428,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });
  const [loading, setLoading] = useState(true);
  const [MapView, setMapView] = useState<any>(null);
  const [Marker, setMarker] = useState<any>(null);
  const [fetchingUsers, setFetchingUsers] = useState(true);
  const [watcher, setWatcher] = useState<any>(null);

  useEffect(() => {
    if (Platform.OS !== "web") {
      const maps = require("react-native-maps");
      setMapView(() => maps.default);
      setMarker(() => maps.Marker);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
      return;
    }

    if (user) {
      (async () => {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, full_name, latitude, longitude, avatar_url")
          .neq("id", user.id)
          .not("latitude", "is", null)
          .not("longitude", "is", null)
          .limit(20);

        if (!error && data?.length) {
          setUsers(
            data.map((item: any) => ({
              id: item.id,
              name: item.full_name ?? "Usuario",
              description: "Conectado cerca de ti",
              coordinate: { latitude: item.latitude, longitude: item.longitude },
              color: "#3b82f6",
            }))
          );
        }

        setFetchingUsers(false);
      })();
    } else if (!authLoading) {
      setFetchingUsers(false);
    }
  }, [authLoading, user]);
  // Guarda la ubicación del usuario logueado en su fila de "profiles" para que
  // otros usuarios puedan verlo como "cercano" de verdad (antes nunca se sincronizaba).
  async function saveMyLocation(latitude: number, longitude: number) {
    if (!user) return;
    const { error } = await supabase
      .from("profiles")
      .update({ latitude, longitude, updated_at: new Date().toISOString() })
      .eq("id", user.id);

    if (error) {
      console.warn("[profiles.update location] ", error.message);
    }
  }

  useEffect(() => {
    let locationSubscription: any;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setErrorMsg("Permiso de ubicación denegado. Activa el GPS para ver el mapa.");
        setLoading(false);
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = currentLocation.coords;

      setLocation(currentLocation.coords);
      setRegion((current) => ({
        ...current,
        latitude,
        longitude,
      }));
      setLoading(false);
      saveMyLocation(latitude, longitude);

      locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 10,
          timeInterval: 5000,
        },
        (loc) => {
          setLocation(loc.coords);
          setRegion((current) => ({
            ...current,
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          }));
          saveMyLocation(loc.coords.latitude, loc.coords.longitude);
        }
      );
      setWatcher(locationSubscription);
    })();

    return () => {
      if (locationSubscription?.remove) {
        locationSubscription.remove();
      }
    };
  }, [user]);

  useEffect(() => {
    const interval = setInterval(async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, latitude, longitude, avatar_url")
        .neq("id", user.id)
        .not("latitude", "is", null)
        .not("longitude", "is", null)
        .limit(20);

      if (!error && data?.length) {
        setUsers(
          data.map((item: any) => ({
            id: item.id,
            name: item.full_name ?? "Usuario",
            description: "Conectado cerca de ti",
            coordinate: { latitude: item.latitude, longitude: item.longitude },
            color: "#3b82f6",
          }))
        );
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [user]);

  function centerOnMe() {
    if (!location) return;
    setRegion((current) => ({
      ...current,
      latitude: location.latitude,
      longitude: location.longitude,
    }));
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.title}>Personas cerca de ti</Text>
        <TouchableOpacity style={styles.button} onPress={centerOnMe}>
          <Text style={styles.buttonText}>Mi ubicación</Text>
        </TouchableOpacity>
      </View>

      {loading || fetchingUsers ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6f7e49" />
          <Text style={styles.loadingText}>Cargando ubicación...</Text>
        </View>
      ) : errorMsg ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      ) : Platform.OS === "web" ? (
        <View style={styles.webMapContainer}>
          <Text style={styles.webMapInfo}>
            Mapa web para visualizar usuarios cercanos.
          </Text>
          <iframe
            title="Mapa de usuarios cercanos"
            style={styles.webMap}
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${region.longitude - 0.03}%2C${region.latitude - 0.02}%2C${region.longitude + 0.03}%2C${region.latitude + 0.02}&layer=mapnik`}
          />
        </View>
      ) : MapView && Marker ? (
        <MapView
          style={styles.map}
          provider={MapView.PROVIDER_GOOGLE}
          region={region}
          showsUserLocation
          showsMyLocationButton={false}
        >
          {users.map((user) => (
            <Marker
              key={user.id}
              coordinate={user.coordinate}
              title={user.name}
              description={user.description}
              pinColor={user.color}
            />
          ))}
        </MapView>
      ) : (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6f7e49" />
          <Text style={styles.loadingText}>Preparando el mapa...</Text>
        </View>
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Actualización en tiempo real: los puntos se mueven cada 5 segundos.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f7f8fa",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    flex: 1,
  },
  button: {
    backgroundColor: "#6f7e49",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    color: "#64748b",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 30,
  },
  errorText: {
    color: "#ef4444",
    textAlign: "center",
  },
  webMapContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  webMapInfo: {
    marginBottom: 10,
    color: "#475569",
  },
  webMap: {
    width: "100%",
    height: "100%",
    borderWidth: 0,
    borderRadius: 16,
    overflow: "hidden",
  },
  footer: {
    padding: 12,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  footerText: {
    color: "#475569",
    textAlign: "center",
  },
});
