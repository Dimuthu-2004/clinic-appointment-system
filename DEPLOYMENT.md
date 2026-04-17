# Smart Clinic Deployment Guide

This setup is intended for the final viva requirement: no localhost API in the demo.

## Recommended Demo Setup

- Backend API: Render web service
- Database: MongoDB Atlas
- Mobile app: Expo EAS internal Android APK build or production build

The mobile app must use:

```text
EXPO_PUBLIC_API_URL=https://your-smart-clinic-api.onrender.com/api
```

Do not use `http://localhost:5000/api` or a LAN IP for the final demo.

## 1. Deploy The Backend On Render

1. Push this repository to GitHub.
2. In Render, create a new Blueprint from the repository.
3. Render will read `render.yaml` from the project root.
4. During Blueprint creation, enter these secret values when prompted:
   - `MONGO_URI`: MongoDB Atlas connection string
   - `SERVER_PUBLIC_URL`: deployed Render URL, for example `https://smart-clinic-api.onrender.com`
   - `ADMIN_PASSWORD`: secure admin password for the deployed system
   - `PAYPAL_CLIENT_ID`: PayPal sandbox or live client ID
   - `PAYPAL_CLIENT_SECRET`: PayPal sandbox or live client secret
5. After deploy, open:

```text
https://your-smart-clinic-api.onrender.com/api/health
```

Expected response:

```json
{
  "success": true,
  "message": "Clinic Appointment System API is running"
}
```

## 2. Configure MongoDB Atlas

Use a hosted Atlas cluster and set the Render `MONGO_URI` environment variable to the Atlas URI.

For a viva/demo setup, make sure Atlas Network Access allows Render to connect. The easiest demo option is allowing access from anywhere, but for a real production app you should restrict this more carefully.

## 3. Configure PayPal

Set these backend environment variables in Render:

```text
PAYPAL_MODE=sandbox
PAYPAL_SETTLEMENT_CURRENCY=USD
PAYPAL_LKR_PER_USD=300
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
SERVER_PUBLIC_URL=https://your-smart-clinic-api.onrender.com
```

PayPal redirect URLs are generated from `SERVER_PUBLIC_URL`, so this must be the deployed API URL, not localhost.

## 4. Build The Mobile App With The Hosted API

Inside `mobile`, configure the EAS environment variable:

```powershell
eas env:create --name EXPO_PUBLIC_API_URL --value https://your-smart-clinic-api.onrender.com/api --environment preview --visibility plaintext
eas env:create --name EXPO_PUBLIC_API_URL --value https://your-smart-clinic-api.onrender.com/api --environment production --visibility plaintext
```

For a quick Android viva build:

```powershell
cd mobile
eas build --platform android --profile preview
```

The `preview` profile produces an internal APK, which is usually the simplest option for a live demo on an Android phone.

## 5. Final Demo Checklist

- API health URL works from a browser using the deployed URL.
- MongoDB Atlas shows new app data after registering or booking.
- Mobile app API URL is the deployed HTTPS URL.
- Patient registration/login works on the phone without the local backend running.
- Appointment booking creates a billing record.
- Doctor can start an appointment only after the payment is marked paid.
- PayPal return URL uses the hosted backend, not localhost.

## Notes

- Render free services can sleep after inactivity, so open the health URL before the viva to wake the API.
- Uploaded files are stored in the backend `uploads` folder. On many hosted platforms, local filesystem storage is not ideal long term. For a production version, use cloud storage such as S3 or Cloudinary for drug photos and attachments.
