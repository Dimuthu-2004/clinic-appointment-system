# Smart Clinic Deployment Guide

This setup is intended for the final viva requirement: no localhost API in the demo.

## Recommended Demo Setup

- Backend API: Railway service from `backend/`
- Database: MongoDB Atlas
- Mobile app: Expo EAS internal Android APK build or production build

The mobile app must use:

```text
EXPO_PUBLIC_API_URL=https://your-smart-clinic-api.up.railway.app/api
```

Do not use `http://localhost:5000/api` or a LAN IP for the final demo build.

## 1. Deploy The Backend On Railway

1. Push this repository to GitHub.
2. In Railway, create a new project from the repository.
3. Earlier, we deployed only the backend service. The intended setup is still `backend` as the Railway root directory.
4. The repository root now also includes a Railway entrypoint, so if you forget to set the root directory Railway can still boot the backend API from the project root.
5. Use either of these Railway setups:
   - Preferred: set the Railway root directory to `backend`
   - Fallback: leave the Railway root directory as the repository root and Railway will start the backend through the root `package.json`
6. Add these Railway environment variables before the first deploy:
   - `NODE_ENV=production`
   - `MONGO_URI`: MongoDB Atlas connection string
   - `JWT_SECRET`: long random secret
   - `JWT_EXPIRES_IN=7d`
   - `PASSWORD_RESET_CODE_EXPIRES_MINUTES=15`
   - `CLIENT_URL=*`
   - `SERVER_PUBLIC_URL=https://your-smart-clinic-api.up.railway.app`
   - `ADMIN_EMAIL=admin@clinic.com`
   - `ADMIN_PASSWORD`: secure admin password
   - `ADMIN_FIRST_NAME=System`
   - `ADMIN_LAST_NAME=Admin`
   - `ADMIN_PHONE=0710000000`
   - `APPOINTMENT_FEE_AMOUNT=2500`
   - `APPOINTMENT_FEE_CURRENCY=LKR`
   - `PAYMENT_DUE_WINDOW_MINUTES=30`
   - `PAYPAL_MODE=sandbox`
   - `PAYPAL_SETTLEMENT_CURRENCY=USD`
   - `PAYPAL_LKR_PER_USD=300`
   - `PAYPAL_CLIENT_ID=...`
   - `PAYPAL_CLIENT_SECRET=...`
   - `SMTP_HOST=smtp.gmail.com`
   - `SMTP_PORT=587`
   - `SMTP_SECURE=false`
   - `SMTP_USER=...`
   - `SMTP_PASS=...`
   - `EMAIL_FROM_NAME=Smart Clinic`
   - `EMAIL_FROM_ADDRESS=...`

> Note: Railway automatically provides `PORT` for the deployed service. Do not manually define `PORT` in Railway environment variables unless you know the platform expects a fixed port.

7. After Railway finishes deploying, open:

```text
https://your-smart-clinic-api.up.railway.app/api/health
```

Expected response:

```json
{
  "success": true,
  "message": "Clinic Appointment System API is running"
}
```

## 2. Configure MongoDB Atlas

Use a hosted Atlas cluster and set the Railway `MONGO_URI` environment variable to the Atlas URI.

For a viva/demo setup, make sure Atlas Network Access allows Railway to connect. The simplest demo option is allowing access from anywhere, but for a real production app you should restrict this more carefully.

## 3. Configure PayPal

Set these backend environment variables in Railway:

```text
PAYPAL_MODE=sandbox
PAYPAL_SETTLEMENT_CURRENCY=USD
PAYPAL_LKR_PER_USD=300
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
SERVER_PUBLIC_URL=https://your-smart-clinic-api.up.railway.app
```

PayPal redirect URLs are generated from `SERVER_PUBLIC_URL`, so this must be the deployed Railway URL, not localhost.

## 4. Build The Mobile App With The Hosted API

Inside `mobile`, configure the EAS environment variable:

```powershell
eas env:create --name EXPO_PUBLIC_API_URL --value https://your-smart-clinic-api.up.railway.app/api --environment preview --visibility plaintext
eas env:create --name EXPO_PUBLIC_API_URL --value https://your-smart-clinic-api.up.railway.app/api --environment production --visibility plaintext
```

Do not set `EXPO_PUBLIC_API_FALLBACK_URL` to localhost for preview or production. The app now stays on the explicit hosted API when one is configured, which avoids accidental switching back to local URLs.

For a quick Android viva build:

```powershell
cd mobile
eas build --platform android --profile preview
```

The `preview` profile produces an internal APK, which is usually the simplest option for a live demo on an Android phone.

## 5. Final Demo Checklist

- Railway health URL works from a browser using the deployed HTTPS URL.
- MongoDB Atlas shows new app data after registering or booking.
- Mobile `EXPO_PUBLIC_API_URL` points to the Railway `/api` URL.
- Patient registration/login works on the phone without the local backend running.
- Appointment booking creates a billing record.
- Doctor can start an appointment only after the payment is marked paid.
- PayPal return URL uses the Railway backend, not localhost.

## Notes

- If you change the Railway public domain, update both `SERVER_PUBLIC_URL` and `EXPO_PUBLIC_API_URL` before rebuilding the mobile app.
- If Railway shows `502 Application failed to respond`, first confirm the deploy is using either the `backend` root directory or the repository root with the new root-level `railway.json` and `package.json`.
- Uploaded files are stored in the backend `uploads` folder. On many hosted platforms, local filesystem storage is not ideal long term. For a production version, use cloud storage such as S3 or Cloudinary for drug photos and attachments.
