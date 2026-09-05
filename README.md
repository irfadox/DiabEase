![DiabEase banner](/assets/banner.png)

# DiabEase

DiabEase is a mobile app designed to help people with diabetes and their doctors track health metrics, manage treatment, and stay connected. Patients can log blood sugar levels and meals in a personal diary, set medication reminders, chat directly with their assigned doctor, and send SOS alerts in urgent situations. Doctors can view their patients and communicate with them directly. The app supports both patients and doctors through role-based access.

## How It Works

### What each screen does

- **AuthScreen.js**: Users create an account or sign in. Accounts are role-based (patient or doctor). Profile data (name, phone, affiliation, description) is stored in Supabase.
- **DiaryScreen.js**: Patients log blood sugar values and meal notes. Entries are classified as low / normal / high based on user-defined limits. A warning banner appears for out-of-range values. Patients can share a report of recent logs with their assigned doctor via the chat system.
- **RemindersScreen.js**: Users create one-time or repeating reminders (medications, glucose checks, etc.). Repeating reminders fire on selected weekdays. Local notifications are scheduled with Expo Notifications.
- **ChatScreen.js**: Real-time messaging between a patient and their assigned doctor. Patients can select a doctor, send reports, place phone calls, or trigger an SOS message. Doctors see their patients and open chats.
- **PatientListScreen.js**: Doctor-only view of assigned patients with quick access to their profiles and chats.
- **SettingsScreen.js**: Adjust target blood-sugar range, font size, and interface language (Russian, English, Kyrgyz).
- **AboutProjectScreen.js**: App description and overview of each section.

### Feedback & safety categories

- **Low / Normal / High**: Automatic status based on the user's configured min/max limits.
- **Warnings**: Banner alerts when the latest reading falls outside the target range.
- **SOS**: Special high-priority chat message for emergencies.

## Tech Stack

- **React Native** + **Expo** (SDK 51)
- **React Navigation** (bottom tabs + native stack)
- **Supabase** (PostgreSQL + Auth) for backend, profiles, logs, reminders, and messages
- **Expo Notifications** for local reminders
- **AsyncStorage** for Supabase session persistence and local preferences
- **Lucide React Native** for icons
- **Multi-language support** (Russian, English, Kyrgyz) with a React Native adaptation of [react-language-switcher](https://github.com/aidartheklutz/react-language-switcher)

## Database Schema (Supabase)

- **profiles** – users (patients & doctors), role, phone, assigned_doctor_id, affiliation, description
- **logs** – sugar readings + notes + status + timestamp
- **reminders** – title, time, type, completed flag. `type` stores JSON metadata: `{ mode: 'once'|'weekly', days: number[] }` (JS weekday: 0 is Sunday)
- **messages** – chat messages with is_sos and is_system flags

Run setup_database.sql in the Supabase SQL editor to create tables, the new-user trigger, and required columns.

## Getting Started

1. Clone the repository:

   ```
   git clone https://github.com/irfadox/DeabEase.git
   cd DeabEase
   ```

2. Install dependencies:

   ```
   npm install
   ```

3. Configure environment variables in .env:

   ```
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   ```

4. Start the development server:
   ```
   npx expo start
   ```

## Building an APK

Use Expo Application Services (EAS):

```
npm install -g eas-cli
eas login
eas build:configure
eas build --platform android --profile preview
```

Make sure eas.json contains a profile with "buildType": "apk".

## Disclaimer

DiabEase is a lifestyle and monitoring tool. It does **not** provide medical advice, diagnosis, or treatment. Always consult a licensed healthcare professional before making changes to your diabetes management plan.
