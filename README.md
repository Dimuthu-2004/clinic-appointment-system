# Clinic Appointment System

Full-stack university assignment project with:

- `mobile/` for the Expo-managed React Native app
- `backend/` for the Node.js + Express.js REST API
- MongoDB-ready backend models and relationships
- JWT authentication, password hashing, protected routes, role-aware access, validation, centralized errors, and file upload support
- Patient, doctor, finance manager, pharmacist, and admin-ready role structure

## Tech Stack

- Frontend: Expo React Native, React Navigation, Axios
- Backend: Node.js, Express.js, Mongoose
- Database: MongoDB / MongoDB Atlas
- Auth: JWT + bcryptjs
- Uploads: Multer

## Folder Structure

```text
clinic-appointment-system/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── utils/
│   │   ├── validations/
│   │   ├── app.js
│   │   └── server.js
│   ├── uploads/
│   ├── .env.example
│   └── package.json
├── mobile/
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   ├── context/
│   │   ├── hooks/
│   │   ├── navigation/
│   │   ├── screens/
│   │   ├── theme/
│   │   └── utils/
│   ├── .env.example
│   ├── App.js
│   ├── app.json
│   └── package.json
└── README.md
```

## Implemented Modules

- Authentication
  - Patient registration
  - Doctor registration
  - Staff registration
  - Login
  - Google login foundation for patient sign-in
  - JWT token auth
  - Password hashing
  - Protected routes
  - Profile fetch/update
- Appointment Management
  - Create
  - View list/detail
  - Update / reschedule
  - Delete
- Billing Management
  - Create
  - View list/detail
  - Update
  - Delete
- Drug Inventory Management
  - Create
  - View list/detail
  - Update
  - Delete
- Medical Record Management
  - Create
  - View list/detail
  - Update
  - Archive
  - Delete
  - File attachment upload/delete
- Prescription Management
  - Create
  - View list/detail
  - Update
  - Delete
- Patient Awareness Alerts
  - Create
  - View list/detail
  - Update
  - Delete
- Review and Feedback
  - Create
  - View list/detail
  - Update
  - Delete

## Backend Setup

1. Open a terminal in `clinic-appointment-system/backend`
2. Copy `.env.example` to `.env`
3. Update the environment variables
4. Start MongoDB locally or use MongoDB Atlas
5. Run:

```bash
npm install
npm run dev
```

### Backend Environment Example

```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://127.0.0.1:27017/clinic_appointment_system
JWT_SECRET=replace_with_a_secure_secret
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:8081,http://localhost:19006
```

### Backend Base URL

```text
http://localhost:5000/api
```

### Sample API Endpoints

#### Auth

- `POST /api/auth/register/patient`
- `POST /api/auth/register/doctor`
- `POST /api/auth/register/staff`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `PATCH /api/auth/me`

#### Users

- `GET /api/users?role=doctor`
- `GET /api/users?role=patient`

#### Appointments

- `GET /api/appointments`
- `POST /api/appointments`
- `GET /api/appointments/:id`
- `PUT /api/appointments/:id`
- `DELETE /api/appointments/:id`

#### Billings

- `GET /api/billings`
- `POST /api/billings`
- `GET /api/billings/:id`
- `PUT /api/billings/:id`
- `DELETE /api/billings/:id`

#### Medical Records

- `GET /api/medical-records`
- `POST /api/medical-records`
- `GET /api/medical-records/:id`
- `PUT /api/medical-records/:id`
- `PATCH /api/medical-records/:id/archive`
- `POST /api/medical-records/:id/attachments`
- `DELETE /api/medical-records/:id/attachments/:attachmentId`
- `DELETE /api/medical-records/:id`

#### Prescriptions

- `GET /api/prescriptions`
- `POST /api/prescriptions`
- `GET /api/prescriptions/:id`
- `PUT /api/prescriptions/:id`
- `DELETE /api/prescriptions/:id`

#### Alerts

- `GET /api/alerts`
- `POST /api/alerts`
- `GET /api/alerts/:id`
- `PUT /api/alerts/:id`
- `DELETE /api/alerts/:id`

#### Reviews

- `GET /api/reviews`
- `POST /api/reviews`
- `GET /api/reviews/:id`
- `PUT /api/reviews/:id`
- `DELETE /api/reviews/:id`

#### Drugs

- `GET /api/drugs`
- `POST /api/drugs`
- `GET /api/drugs/:id`
- `PUT /api/drugs/:id`
- `DELETE /api/drugs/:id`

### Example Request Body

```json
{
  "doctor": "6611c0f26fc14554112ab001",
  "appointmentDate": "2026-04-15T09:30:00.000Z",
  "reason": "Routine follow-up",
  "patientNotes": "Need blood pressure review"
}
```

## Mobile Setup

1. Open a second terminal in `clinic-appointment-system/mobile`
2. Copy `.env.example` to `.env`
3. Set `EXPO_PUBLIC_API_URL`
4. Run:

```bash
npm install
npx expo start
```

### Mobile Environment Example

```env
EXPO_PUBLIC_API_URL=http://localhost:5000/api
```

### Important Expo Go Note

If you use Expo Go on a physical phone, `localhost` will not point to your computer. Use one of these instead:

- your computer LAN IP, for example `http://192.168.1.20:5000/api`
- a deployed backend URL later, for example Render or Railway

## How To Use

1. Start the backend first
2. Start the Expo app
3. Scan the QR code using Expo Go
4. Register a patient account and a doctor account
5. Login and test each module using the real API flow

## Deployment Preparation Already Included

- Environment-based API URL on mobile
- Environment-based backend secrets
- Google auth env placeholders on backend and mobile
- MongoDB Atlas-ready connection string pattern
- Render/Railway-friendly Node start script
- Hosted upload support structure
- No dependency on the existing parent project

## Still Needed Before Final Deployment

- Create production `.env` values
- Use a hosted MongoDB Atlas database
- Set CORS `CLIENT_URL` to production frontend/backend origins
- Configure persistent file storage for uploads in production
- Deploy backend to Render or Railway
- Replace local Expo API URL with deployed backend URL
- Add your real Google OAuth client IDs
- Optionally add logging, rate limiting, and automated tests

## Admin Account

No default admin user is auto-created on first run.

An admin seed command is included now:

```bash
cd backend
npm run seed:admin
```

Before running it, set these in `backend/.env`:

- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `ADMIN_FIRST_NAME`
- `ADMIN_LAST_NAME`
- `ADMIN_PHONE`

Admin-only backend user CRUD routes are also available under `/api/users`.

## Viva-Friendly Notes

- The backend uses clear `models`, `controllers`, `routes`, `middleware`, and `validations`
- The mobile app uses functional components, hooks, context, reusable inputs, and stack/tab navigation
- Business flows are API-driven rather than hardcoded mock data
- Role-based behavior changes what patients and doctors can create, edit, or view
