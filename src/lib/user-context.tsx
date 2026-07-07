import { Session, User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabase";

type Profile = {
  id: string;
  full_name?: string;
  avatar_url?: string;
  bio?: string;
  interests?: string[];
  latitude?: number;
  longitude?: number;
};

type UserContextValue = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const UserContext = createContext<UserContextValue | undefined>(undefined);

async function fetchProfile(userId: string, email?: string | null, metadataFullName?: string | null): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, bio, interests, latitude, longitude")
    .eq("id", userId)
    .single();

  if (!error && data) {
    return data as Profile;
  }

  const fallback: Profile = {
    id: userId,
    full_name: metadataFullName || (email ? email.split("@")[0] : "Usuario"),
    avatar_url: `https://api.dicebear.com/6.x/initials/svg?seed=${encodeURIComponent(
      email ?? "user"
    )}`,
    bio: "Este usuario aún no tiene biografía.",
    interests: ["Lectura", "Tecnología", "Café"],
  };

  // No existía la fila en la BD (p. ej. primer login tras confirmar cuenta): la creamos de verdad.
  const { error: upsertError } = await supabase.from("profiles").upsert({
    id: fallback.id,
    full_name: fallback.full_name,
    avatar_url: fallback.avatar_url,
    bio: fallback.bio,
    interests: fallback.interests,
  });

  if (upsertError) {
    console.warn("[profiles.upsert fallback] ", upsertError.message);
  }

  return fallback;
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      const { data } = await supabase.auth.getSession();
      if (!mounted) {
        return;
      }
      setSession(data.session);
      setUser(data.session?.user ?? null);

      if (data.session?.user) {
        const profileData = await fetchProfile(
          data.session.user.id,
          data.session.user.email,
          data.session.user.user_metadata?.full_name
        );
        if (mounted) {
          setProfile(profileData);
        }
      } else {
        setProfile(null);
      }

      setLoading(false);
    }

    loadSession();

    const { data } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          const profileData = await fetchProfile(
            newSession.user.id,
            newSession.user.email,
            newSession.user.user_metadata?.full_name
          );
          setProfile(profileData);
        } else {
          setProfile(null);
        }
      }
    );

    return () => {
      mounted = false;
      (data as any)?.subscription?.unsubscribe?.();
    };
  }, []);

  async function refreshProfile() {
    if (!user) {
      return;
    }

    const profileData = await fetchProfile(user.id, user.email);
    setProfile(profileData);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  }

  return (
    <UserContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within UserProvider");
  }
  return context;
}
