import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { distanceKm, formatDistance } from "../lib/geo";
import { supabase } from "../lib/supabase";
import { useUser } from "../lib/user-context";

type NearbyUser = {
  id: string;
  name: string;
  avatarUrl: string;
  coordinate: { latitude: number; longitude: number };
  online: boolean;
};

function avatarFor(name: string | null | undefined, url: string | null | undefined, seed: string) {
  return url || `https://api.dicebear.com/6.x/initials/svg?seed=${encodeURIComponent(name ?? seed)}`;
}

function isRecentlyActive(updatedAt: string | null | undefined) {
  if (!updatedAt) return false;
  return Date.now() - new Date(updatedAt).getTime() < 3 * 60 * 1000;
}

export default function CercanosScreen() {
  const { user, profile, loading: authLoading } = useUser();
  const router = useRouter();
  const [location, setLocation] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [users, setUsers] = useState<NearbyUser[]>([]);
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
  const mapRef = useRef<any>(null);
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (Platform.OS !== "web") {
      const maps = require("react-native-maps");
      setMapView(() => maps.default);
      setMarker(() => maps.Marker);
    }
  }, []);

  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 1500,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      })
    );
    anim.start();
    return () => anim.stop();
  }, [pulseAnim]);

  async function loadNearby() {
    if (!user) return;

    // Solo se muestran usuarios con los que ya hay una solicitud de mensaje aceptada ("amigos").
    const { data: accepted, error: acceptedError } = await supabase
      .from("message_requests")
      .select("sender_id, receiver_id")
      .eq("status", "accepted")
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);

    if (acceptedError) {
      console.warn("[message_requests.select amigos] ", acceptedError.message);
      setFetchingUsers(false);
      return;
    }

    const friendIds = (accepted ?? []).map((r: any) => (r.sender_id === user.id ? r.receiver_id : r.sender_id));

    if (friendIds.length === 0) {
      setUsers([]);
      setFetchingUsers(false);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, latitude, longitude, avatar_url, updated_at")
      .in("id", friendIds)
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .limit(30);

    if (!error && data) {
      setUsers(
        data.map((item: any) => ({
          id: item.id,
          name: item.full_name ?? "Usuario",
          avatarUrl: avatarFor(item.full_name, item.avatar_url, item.id),
          coordinate: { latitude: item.latitude, longitude: item.longitude },
          online: isRecentlyActive(item.updated_at),
        }))
      );
    }
    setFetchingUsers(false);
  }

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
      return;
    }

    if (user) {
      loadNearby();
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
          saveMyLocation(loc.coords.latitude, loc.coords.longitude);
        }
      );
    })();

    return () => {
      if (locationSubscription?.remove) {
        locationSubscription.remove();
      }
    };
  }, [user]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (user) loadNearby();
    }, 5000);

    return () => clearInterval(interval);
  }, [user]);

  function goToRegion(latitude: number, longitude: number) {
    const target = { latitude, longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 };
    setRegion(target);
    mapRef.current?.animateToRegion?.(target, 600);
  }

  function centerOnMe() {
    if (!location) return;
    goToRegion(location.latitude, location.longitude);
  }

  const nearbySorted = [...users]
    .map((u) => ({
      ...u,
      distanceKm: location ? distanceKm(location, u.coordinate) : null,
    }))
    .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));

  const myAvatarUrl = avatarFor(profile?.full_name, profile?.avatar_url, user?.id ?? "yo");

  const pulseScale = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 2] });
  const pulseOpacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] });

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.title}>Personas cerca de ti</Text>
        <TouchableOpacity style={styles.button} onPress={centerOnMe}>
          <Ionicons name="locate" size={16} color="#fff" />
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
            Mapa web para visualizar usuarios cercanos. Usa la lista de abajo para ver a cada persona.
          </Text>
          <iframe
            title="Mapa de usuarios cercanos"
            style={styles.webMap}
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${region.longitude - 0.03}%2C${region.latitude - 0.02}%2C${region.longitude + 0.03}%2C${region.latitude + 0.02}&layer=mapnik&marker=${region.latitude}%2C${region.longitude}`}
          />
        </View>
      ) : MapView && Marker ? (
        <MapView ref={mapRef} style={styles.map} provider={MapView.PROVIDER_GOOGLE} initialRegion={region}>
          {location && (
            <Marker coordinate={location} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges>
              <View style={styles.myMarkerWrap}>
                <Animated.View
                  style={[
                    styles.pulse,
                    { transform: [{ scale: pulseScale }], opacity: pulseOpacity },
                  ]}
                />
                <View style={styles.myMarkerRing}>
                  <Image source={{ uri: myAvatarUrl }} style={styles.myMarkerAvatar} />
                </View>
              </View>
            </Marker>
          )}

          {nearbySorted.map((u) => (
            <Marker
              key={u.id}
              coordinate={u.coordinate}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
              onPress={() => router.push(`/usuario/${u.id}`)}
            >
              <View style={styles.markerRing}>
                <Image source={{ uri: u.avatarUrl }} style={styles.markerAvatar} />
                {u.online && <View style={styles.onlineDot} />}
              </View>
            </Marker>
          ))}
        </MapView>
      ) : (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6f7e49" />
          <Text style={styles.loadingText}>Preparando el mapa...</Text>
        </View>
      )}

      <View style={styles.carousel}>
        {nearbySorted.length === 0 ? (
          <Text style={styles.carouselEmpty}>
            Solo ves en el mapa a las personas con las que ya tienes un chat aceptado. Busca gente en "Nuevo chat" y
            envía una solicitud para empezar.
          </Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carouselContent}>
            {nearbySorted.map((u) => (
              <TouchableOpacity
                key={u.id}
                style={styles.card}
                activeOpacity={0.85}
                onPress={() => goToRegion(u.coordinate.latitude, u.coordinate.longitude)}
              >
                <View style={styles.cardAvatarWrap}>
                  <Image source={{ uri: u.avatarUrl }} style={styles.cardAvatar} />
                  {u.online && <View style={styles.cardOnlineDot} />}
                </View>
                <Text style={styles.cardName} numberOfLines={1}>
                  {u.name}
                </Text>
                <Text style={styles.cardDistance}>
                  {u.distanceKm != null ? formatDistance(u.distanceKm) : "—"}
                </Text>
                <TouchableOpacity style={styles.cardButton} onPress={() => router.push(`/usuario/${u.id}`)}>
                  <Text style={styles.cardButtonText}>Ver perfil</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
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
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#6f7e49",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    marginLeft: 6,
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
  myMarkerWrap: {
    width: 60,
    height: 60,
    justifyContent: "center",
    alignItems: "center",
  },
  pulse: {
    position: "absolute",
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#3b82f6",
  },
  myMarkerRing: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#fff",
    borderWidth: 3,
    borderColor: "#3b82f6",
    justifyContent: "center",
    alignItems: "center",
  },
  myMarkerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  markerRing: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#6f7e49",
    justifyContent: "center",
    alignItems: "center",
  },
  markerAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  onlineDot: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#22c55e",
    borderWidth: 2,
    borderColor: "#fff",
  },
  carousel: {
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingVertical: 12,
  },
  carouselEmpty: {
    textAlign: "center",
    color: "#94a3b8",
    paddingHorizontal: 16,
  },
  carouselContent: {
    paddingHorizontal: 12,
  },
  card: {
    width: 130,
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    padding: 12,
    marginHorizontal: 6,
    alignItems: "center",
  },
  cardAvatarWrap: {
    position: "relative",
    marginBottom: 8,
  },
  cardAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  cardOnlineDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#22c55e",
    borderWidth: 2,
    borderColor: "#f8fafc",
  },
  cardName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
  },
  cardDistance: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
    marginBottom: 8,
  },
  cardButton: {
    backgroundColor: "#6f7e49",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  cardButtonText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
});
