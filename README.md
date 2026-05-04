# Clinic Appointment System

Smart Clinic is a full-stack university project for managing clinic appointments, patient records, billing, prescriptions, alerts, reviews, and drug inventory.

## Repository Structure

- `backend/` - Node.js, Express.js, and MongoDB REST API
- `mobile/` - Expo React Native mobile application

## Core Modules

- Authentication and profile management
- Appointment booking and scheduling
- Billing and payment handling
- Medical records and patient history
- Digital prescriptions
- Drug inventory management
- Patient awareness alerts
- Reviews and feedback
- Notifications and doctor availability

## Tech Stack

- Frontend: Expo React Native
- Backend: Node.js and Express.js
- Database: MongoDB
- Authentication: JWT

## Deployment

- Backend URL: `https://just-rebirth-production-52bb.up.railway.app`

## Google Sign-In Setup

- Mobile env files: add `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, and `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` in `mobile/.env` or `mobile/.env.production`.
- Backend env files and Railway variables: add `GOOGLE_ANDROID_CLIENT_ID`, `GOOGLE_IOS_CLIENT_ID`, and `GOOGLE_WEB_CLIENT_ID` with the same client IDs used by the app.
- For Android, create the OAuth client in Google Cloud for package `com.it24103228.clinicappointmentsystemmobile` and use your app signing SHA fingerprints there.
- Google login now creates a patient account automatically the first time a verified Google user signs in. The patient can fill in phone, address, and the rest of the profile later.

## Push Notification Notes

- The app asks for notification permission only on a physical device running a development build or APK.
- Expo Go will still show saved notification records inside the app, but it will not register an Expo push token for real system notifications in this project.
- Real push notifications also require the logged-in user to allow notifications on the device and the backend to be reachable when a notification is created.

## Pre-APK Checks

Run these before generating the final APK:

```powershell
cd backend
npm install
npm run dev
```

```powershell
cd mobile
npm install
npx expo run:android
```

If you want a preview Android build after the checks pass:

```powershell
cd mobile
npx eas-cli@latest build --platform android --profile preview --non-interactive
```
