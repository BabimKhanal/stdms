# Nucleus Education Mobile

Expo/React Native mobile client for the Nucleus Education Platform.

## Local development

Set `EXPO_PUBLIC_API_URL` in `.env` to an API URL reachable from the device. For a physical phone, use the computer's LAN IP during local development. For a released build, use the deployed HTTPS API URL.

```sh
npm install
npm start
```

Run a native development build with `npm run android`, or use the web target with `npm run web`.

To build the debug APK directly with Gradle and install it on a connected Android device:

```sh
npm run android:build:install
```

This runs `assembleDebug` and then `adb install -r`. Enable USB debugging and verify the device with `adb devices` first.

## Android APK

The `preview` EAS profile produces an installable Android APK. Run these commands from this directory:

```sh
bunx eas-cli login
bunx eas-cli build:configure
$env:EXPO_PUBLIC_API_URL = "https://api.example.com/api/v1"
bunx eas-cli build --platform android --profile preview
```

The build URL printed by EAS can be opened on an Android device to install the APK. EAS will handle Android signing credentials when prompted.

For Google Play, use the production profile, which produces an Android App Bundle by default:

```sh
bunx eas-cli build --platform android --profile production
```

`EXPO_PUBLIC_API_URL` is embedded at build time. Do not use `localhost` in a device or store build unless the API is running on that same device.

## Push notifications

Users opt in under **Settings → Notifications**. The app registers the Expo push token to the signed-in account, syncs it on later launches, and revokes it on sign-out. Tapping a push opens the Updates inbox. Existing in-app updates continue to work if push delivery is disabled or unavailable.

Remote push requires an iOS or Android development/production build and a physical device; Android remote push is not available in Expo Go. Configure Android FCM v1 and iOS APNs credentials for the EAS project, then build and install a new native binary after changing `app.json`:

```sh
bunx eas-cli build --profile development --platform android
bunx eas-cli build --profile development --platform ios
```

For delivery, configure `PUSH_PROVIDER=expo` on the API. `EXPO_ACCESS_TOKEN` is optional but recommended for authenticated Expo Push Service requests. Keep EAS/APNs/FCM credentials in their respective provider secret stores; do not commit them. Test first with Expo's notification tool on a development build.
