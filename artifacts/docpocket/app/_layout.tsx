import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { AppLockProvider, useAppLock } from "@/contexts/AppLockContext";
import { VaultProvider } from "@/contexts/VaultContext";
import { InfoProvider } from "@/contexts/InfoContext";
import { KitsProvider } from "@/contexts/KitsContext";
import { LockScreen } from "@/components/LockScreen";

SplashScreen.preventAutoHideAsync();

function AppContent() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="file/[id]" options={{ presentation: "modal", headerShown: false }} />
      <Stack.Screen name="kit/[id]" options={{ headerShown: false }} />
    </Stack>
  );
}

function AppWithLock() {
  const { isLocked, isPinSetup, ready } = useAppLock();
  if (!ready) return null;
  return (
    <>
      <AppContent />
      {isLocked && isPinSetup && <LockScreen />}
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SettingsProvider>
            <AppLockProvider>
              <VaultProvider>
                <InfoProvider>
                  <KitsProvider>
                    <AppWithLock />
                  </KitsProvider>
                </InfoProvider>
              </VaultProvider>
            </AppLockProvider>
          </SettingsProvider>
        </GestureHandlerRootView>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
