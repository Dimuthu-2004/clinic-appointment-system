# API Endpoint Table

Base URL: `https://just-rebirth-production-52bb.up.railway.app/api`

| Module | Method | Endpoint | Description | Access |
| --- | --- | --- | --- | --- |
| Health | GET | `/health` | API health check | Public |
| Auth | POST | `/auth/register/patient` | Register a patient account | Public |
| Auth | POST | `/auth/register/doctor` | Register a doctor account | Public |
| Auth | POST | `/auth/register/staff` | Register a staff account | Public |
| Auth | POST | `/auth/login` | Log in and receive JWT token | Public |
| Auth | POST | `/auth/forgot-password` | Send 6-digit password reset code by email | Public |
| Auth | POST | `/auth/reset-password` | Reset password using email and reset code | Public |
| Auth | GET | `/auth/me` | Get current profile | Authenticated |
| Auth | PATCH | `/auth/me` | Update current profile | Authenticated |
| Users | GET | `/users` | List users with filtering | Authenticated |
| Users | POST | `/users` | Create a user account | Admin |
| Users | GET | `/users/:id` | View one user | Admin |
| Users | PUT | `/users/:id` | Update one user | Admin |
| Users | DELETE | `/users/:id` | Delete one user | Admin |
| Appointments | GET | `/appointments/doctor-directory` | List doctor directory for booking UI | Public |
| Appointments | GET | `/appointments/availability-question` | Answer natural availability query | Public |
| Appointments | GET | `/appointments/available-doctors` | Search available doctors | Public |
| Appointments | GET | `/appointments/booking-preview` | Preview booking information | Public |
| Appointments | GET | `/appointments` | List appointments | Authenticated |
| Appointments | POST | `/appointments` | Create an appointment | Authenticated |
| Appointments | GET | `/appointments/:id` | Get appointment details | Authenticated |
| Appointments | PUT | `/appointments/:id` | Update or reschedule appointment | Authenticated |
| Appointments | DELETE | `/appointments/:id` | Cancel/delete appointment | Authenticated |
| Billing | GET | `/billings` | List billing records | Authenticated |
| Billing | POST | `/billings` | Create billing record | Finance Manager |
| Billing | GET | `/billings/:id` | Get billing record | Authenticated |
| Billing | PUT | `/billings/:id` | Update billing record | Finance Manager |
| Billing | DELETE | `/billings/:id` | Delete billing record | Finance Manager |
| Billing | GET | `/billings/:id/invoice.pdf` | Download invoice PDF | Authenticated |
| Payments | POST | `/payments/paypal/billings/:id/order` | Create PayPal checkout order | Authenticated Patient |
| Payments | GET | `/payments/paypal/return` | PayPal return callback and capture | Public callback |
| Payments | GET | `/payments/paypal/cancel` | PayPal cancel callback | Public callback |
| Medical Records | GET | `/medical-records/doctor/patients` | List doctor patient directory | Authenticated |
| Medical Records | GET | `/medical-records/:patientId/history` | Get patient history for doctor | Authenticated |
| Medical Records | GET | `/medical-records` | List medical records | Authenticated |
| Medical Records | POST | `/medical-records` | Create medical record | Authenticated Doctor |
| Medical Records | GET | `/medical-records/:id` | Get medical record | Authenticated |
| Medical Records | PUT | `/medical-records/:id` | Update medical record | Authenticated Doctor |
| Medical Records | DELETE | `/medical-records/:id` | Delete medical record | Authenticated Doctor/Admin |
| Medical Records | PATCH | `/medical-records/:id/archive` | Archive medical record | Authenticated Doctor |
| Medical Records | POST | `/medical-records/:id/attachments` | Upload record attachments | Authenticated Doctor |
| Medical Records | DELETE | `/medical-records/:id/attachments/:attachmentId` | Delete attachment | Authenticated Doctor |
| Prescriptions | GET | `/prescriptions` | List prescriptions | Authenticated |
| Prescriptions | POST | `/prescriptions` | Create prescription | Authenticated Doctor |
| Prescriptions | GET | `/prescriptions/:id` | Get prescription details | Authenticated |
| Prescriptions | PUT | `/prescriptions/:id` | Update prescription | Authenticated Doctor |
| Prescriptions | DELETE | `/prescriptions/:id` | Delete prescription | Authenticated Doctor/Admin |
| Prescriptions | GET | `/prescriptions/:id/availability` | Check medicine availability for a prescription | Authenticated |
| Alerts | POST | `/alerts/preview-targets` | Preview targeted patients for an alert | Authenticated Staff/Admin |
| Alerts | GET | `/alerts` | List alerts | Authenticated |
| Alerts | POST | `/alerts` | Create awareness alert | Authenticated Staff/Admin |
| Alerts | GET | `/alerts/:id` | Get alert details | Authenticated |
| Alerts | PUT | `/alerts/:id` | Update alert | Authenticated Staff/Admin |
| Alerts | DELETE | `/alerts/:id` | Delete alert | Authenticated Staff/Admin |
| Reviews | GET | `/reviews/public` | View public doctor/patient reviews | Public |
| Reviews | GET | `/reviews` | List reviews | Authenticated |
| Reviews | POST | `/reviews` | Create review | Authenticated Patient |
| Reviews | GET | `/reviews/:id` | Get review details | Authenticated |
| Reviews | PUT | `/reviews/:id` | Update review or admin reply | Authenticated |
| Reviews | DELETE | `/reviews/:id` | Delete review | Authenticated |
| Drugs | GET | `/drugs` | List drugs | Authenticated |
| Drugs | POST | `/drugs` | Create drug item | Pharmacist/Admin |
| Drugs | GET | `/drugs/:id` | Get drug details | Authenticated |
| Drugs | PUT | `/drugs/:id` | Update drug item | Pharmacist/Admin |
| Drugs | DELETE | `/drugs/:id` | Delete drug item | Pharmacist/Admin |
| Drugs | POST | `/drugs/:id/image` | Upload drug image | Pharmacist/Admin |
| Doctor Availability | GET | `/doctor-availability/options` | Get date/session options for availability planning | Doctor/Patient/Admin |
| Doctor Availability | GET | `/doctor-availability` | List doctor availability entries | Doctor/Admin |
| Doctor Availability | POST | `/doctor-availability` | Save doctor availability | Doctor/Admin |
| Notifications | GET | `/notifications` | List notifications | Authenticated |
| Notifications | GET | `/notifications/unread-count` | Get unread notification count | Authenticated |
| Notifications | PATCH | `/notifications/read-all` | Mark all notifications as read | Authenticated |
| Notifications | PATCH | `/notifications/:id/read` | Mark one notification as read | Authenticated |
| Notifications | POST | `/notifications/push-token` | Register device push token | Authenticated |
| Notifications | DELETE | `/notifications/push-token` | Unregister device push token | Authenticated |
| App Settings | GET | `/app-settings/clinic-config` | Get clinic schedule and appointment fee config | Public |
| App Settings | PUT | `/app-settings/clinic-config` | Update clinic schedule | Authenticated Admin |
| App Settings | PUT | `/app-settings/appointment-fee` | Update appointment fee | Authenticated Admin |
