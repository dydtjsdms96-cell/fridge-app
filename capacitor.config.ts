import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.dydtjsdms96.fridgeapp",
  appName: "프레시포켓",
  webDir: "www",
  server: {
    url: "https://fridge-app-aolm.vercel.app",
    cleartext: false,
    androidScheme: "https",
    allowNavigation: [
      "fridge-app-aolm.vercel.app",
      "*.vercel.app",
      "*.supabase.co",
    ],
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#2E5B4C",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#2E5B4C",
      overlaysWebView: false,
    },
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#2E5B4C",
  },
};

export default config;
