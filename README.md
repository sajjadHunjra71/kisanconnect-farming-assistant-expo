# KisanConnect

Smart farming assistant for farmers in Punjab, Pakistan. Built with Expo (React Native) and TypeScript.

> Status: **UI phase.** All screens are built and use clearly labelled sample data. Backend (Supabase), sign-in and AI arrive in the next phases. See [`docs/MASTER_PLAN.md`](docs/MASTER_PLAN.md).

![KisanConnect screens: welcome, home, scan, Urdu home, dark mode](docs/screenshots/preview.png)

## Features (planned, UI ready)
- **Today**: weather for your farm, crop stage, tasks and advice.
- **Weather intelligence**: hourly + 7-day forecast, spray window, irrigation advice (FAO-56), alerts.
- **Leaf scan**: on-device disease model with a cloud second opinion. Always "possible", never "confirmed".
- **Ask AI**: chat with text or voice that knows your crop, stage and weather.
- **Mandi rates** with a visible rate date, **expert questions**, **farm management**.
- **English + Urdu**, switch with one tap in Settings (RTL supported). Light, dark and auto themes.

## Tech stack
Expo SDK 58 · React Native 0.88 · TypeScript (strict) · Expo Router · Zustand · i18next · Reanimated · react-native-svg.
Planned: Supabase (Auth, Postgres, Storage, Edge Functions), Open-Meteo, on-device TFLite + Gemini (free tier).

## Run
```bash
npm install
cp .env.example .env      # add Supabase URL + anon key; without them the app runs in demo mode
npx expo start            # open in Expo Go (iOS simulator: press i)
npm run typecheck
```
Google sign-in uses Supabase's browser flow (`expo-web-browser`), so login works in Expo Go with no native build. Backend setup (SQL, providers, Edge Function) is in [`supabase/README.md`](supabase/README.md). Native builds for later phases (camera, voice) will use EAS cloud builds.

## Roadmap
| Phase | Scope | Status |
|---|---|---|
| 0 | Foundation, design system, full UI | ✅ Done |
| 1 | Auth (Google + email via Supabase), profile | ✅ Code done, needs Supabase keys |
| 2 | Farm & crop management, offline sync | Planned |
| 3 | Weather intelligence + push alerts | Planned |
| 4 | Crop disease detection (on-device + AI second opinion) | Planned |
| 5 | AI assistant + voice | Planned |
| 6 | Irrigation & reminders | Planned |
| 7 | Mandi prices | Planned |
| 8 | Expert connection | Planned |
| 9 | Hardening & release | Planned |

## Project structure
```
src/
  app/                 Routes only (Expo Router)
    (onboarding)/      welcome, language, farm-setup
    (auth)/            sign-in, sign-up, forgot-password, check-email
    auth/              callback, reset (deep-link targets for email links + Google)
    (tabs)/            index (Home), weather, scan, assistant, farm
    scan/result, mandi, expert/, settings
  components/
    ui/                Reusable primitives (Text, Button, Card, Chip, TextField, ...)
    layout/            TabBar
  features/<feature>/components   Feature-specific components
  theme/               Palette, spacing/radius tokens, typography, ThemeProvider
  i18n/                i18next setup, languages, locales/en.json + ur.json
  hooks/               useDirection (RTL), useLocalized
  store/               Zustand settings store (persisted)
  config/env.ts        Public env (EXPO_PUBLIC_*) only
  mocks/               Sample data for UI work (to be replaced)
  types/               Domain types
```

## Design system
- **Palette "field almanac"**: paper cream `#F6F2E9`, forest green `#1F5C3F`, wheat gold `#D9A13B`, terracotta `#B5532E` for risk, sky `#2F6F9F` for weather. Full dark palette included.
- **Type**: Fraunces (display), Plus Jakarta Sans (UI), Noto Nastaliq Urdu (Urdu, with taller line height).
- 48 dp minimum touch targets, high contrast, icons with every label, read-aloud planned on every answer.

## Adding a language
1. Add it to `src/i18n/languages.ts` (code, native name, `ltr`/`rtl`).
2. Add `src/i18n/locales/<code>.json` with the same keys as `en.json`.
3. Add the language to data `Localized` fields where needed.

## Secrets
Only `EXPO_PUBLIC_*` values go in `.env` (they are bundled into the app). Server secrets such as the Gemini API key and Supabase service-role key live only in Supabase Edge Function secrets. `.env` is git-ignored.

## License
MIT © 2026 Sajjad Khalid
