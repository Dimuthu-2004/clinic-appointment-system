# Problem Statement

## Project Title
Smart Clinic Appointment and Patient Management System

## Background
Many small and medium-sized clinics still depend on manual appointment books, phone calls, paper medical records, and disconnected payment handling. This causes long waiting times, poor record tracking, billing confusion, and difficulty in communication between patients, doctors, finance staff, and pharmacists.

## Problem
The clinic needs a single digital platform that can:

- allow patients to register and book appointments without visiting the clinic first
- help doctors manage schedules, appointments, prescriptions, and patient records
- support finance staff in tracking billing and payment completion
- support pharmacists in managing drugs and checking prescription availability
- improve communication through notifications, reviews, and awareness alerts
- provide secure role-based access to sensitive healthcare information

The current manual or partially digital process leads to duplicate work, missing records, delayed payments, and limited visibility for both staff and patients.

## Proposed Solution
The proposed solution is a full-stack Smart Clinic system with a mobile frontend and a REST API backend. The solution includes:

- patient, doctor, staff, and admin authentication
- appointment booking with doctor availability and token handling
- billing with clinic-counter and PayPal payment support
- medical record management with vitals and file attachments
- prescription management and medicine availability support
- drug inventory management
- patient awareness alerts and notifications
- patient review and feedback handling
- hosted backend deployment for real-device access during demonstration

## Objectives

- digitize the complete clinic appointment lifecycle
- reduce waiting time and manual data duplication
- centralize patient, appointment, billing, and prescription data
- improve communication between patients and clinic staff
- support a scalable and role-based architecture suitable for future enhancement

## Scope

### In Scope

- mobile access for patients and clinic users
- REST API backend for all core business modules
- MongoDB-based persistent data storage
- role-based authorization
- email-based password reset
- PayPal integration for remote payment flows

### Out of Scope

- inpatient hospital management
- insurance claim processing
- laboratory system integration
- advanced analytics dashboards beyond the implemented operational reporting

## Expected Outcome
The final system provides a practical clinic management platform where patients can book appointments, staff can manage operations, and doctors can maintain treatment history in a more efficient, secure, and organized way than a manual process.
