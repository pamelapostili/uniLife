import { Stack } from "expo-router";
import { UserProvider } from "../lib/user-context";

export default function RootLayout() {
  return (
    <UserProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </UserProvider>
  );
}