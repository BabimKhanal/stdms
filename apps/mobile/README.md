# Nucleus Education Mobile

Expo/React Native mobile client for the Nucleus Education Platform.

## Local development

Set `EXPO_PUBLIC_API_URL` in `.env` to an API URL reachable from the device. For a physical phone, use the computer's LAN IP during local development. For a released build, use the deployed HTTPS API URL.

```sh
npm install
npm start
```

Run a native development build with `npm run android`, or use the web target with `npm run web`.

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
