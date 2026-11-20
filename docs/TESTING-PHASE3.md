# Testing Phase 3: weather and push alerts

Simple steps. Do them in order. Each step says **what to do** and **what should happen**.
If something different happens, note the step number and what you saw.

**Before this:** Phase 2 steps 0–5 done (you have a farm with a location and at least one crop that is growing, not planned).

---

## Step 0: Set up the server (one time)

1. Supabase → **SQL Editor** → run `supabase/migrations/20261122000000_weather_cache.sql`, then `supabase/migrations/20261123000000_push_alerts.sql`.
   - **Should happen:** "Success. No rows returned" both times. Table Editor shows `weather_cache`, `push_tokens` and `alerts_sent`.
2. In the project folder on the Mac (Terminal):
   ```
   npx supabase login
   npx supabase link --project-ref <your project ref>
   npx supabase functions deploy weather-proxy
   npx supabase functions deploy weather-alerts --no-verify-jwt
   npx supabase secrets set CRON_SECRET=<make up a long random password>
   ```
   - **Should happen:** each deploy ends with "Deployed Functions". Supabase → **Edge Functions** lists `weather-proxy` and `weather-alerts`.
3. Open `supabase/setup/schedule_weather_alerts.sql`, replace `<PROJECT_REF>` and `<CRON_SECRET>` (same password as above), paste it in the SQL Editor and **Run**.
   - **Should happen:** it returns a job id number. (Integrations → Cron shows `weather-alerts-every-3h`.)

## Step 1: Weather tab with a real forecast

1. `npx expo start` → `i` → sign in → pick a farm that has a location.
2. Open the **Weather** tab.
   - **Should happen:** no "Sample data" badge. The title shows your farm's district. The big card shows the temperature now, the day slider shows today's hours, and the 7-day list starts with "Today". Numbers look like the real weather (compare with your phone's weather app; small differences are normal).
3. Supabase → Table Editor → `weather_cache`.
   - **Should happen:** one row, `cell` like `31.5_74.3`, `fetched_at` = just now.
4. Pull down on the Weather tab to refresh.
   - **Should happen:** it refreshes. `weather_cache.fetched_at` does **not** change if it's been less than an hour (the cached copy is used).

## Step 2: Advice cards

1. On the Weather tab, scroll to **Farm advice**.
   - **Should happen:** a spray card ("Good to spray today 08:00–19:00" or "No good spray window…" with a reason), and for each growing crop an irrigation card ("next irrigation in about N days", "Irrigate … tomorrow" or "Skip irrigation…").
2. Log an irrigation for a crop today (Farm → crop → Log activity → Irrigation), then come back to Weather.
   - **Should happen:** that crop's irrigation card now says next irrigation in several days.
3. Home tab.
   - **Should happen:** the weather card shows the same temperature as the Weather tab with "Updated N min ago · Open-Meteo", and the top 2 advice cards appear under "Advice for today".

## Step 3: Offline

1. Turn the Mac's Wi-Fi off. Close and reopen the app (or pull to refresh on Weather).
   - **Should happen:** the forecast still shows, with an "Offline · showing the last saved forecast" badge. The Home weather card says "Offline · …".
2. Turn Wi-Fi back on and pull to refresh.
   - **Should happen:** the badge goes away.

## Step 4: Farm without a location

1. Add a farm and save it **without** picking GPS or a district. Select it.
   - **Should happen:** the Weather tab says "Add your farm's location to see its weather" with a **Set farm location** button that opens the farm edit screen.

## Step 5: Demo mode (optional)

1. Remove the Supabase keys from `.env`, restart.
   - **Should happen:** Weather and Home show a sample forecast with the "Sample data" badge (foggy mornings, rain tomorrow evening).

---

## Push alerts (needs a real iPhone or Android phone)

Push alerts can't be received in the iOS Simulator, and on Android they need a development build (Expo Go on Android no longer supports push). The easiest test is **Expo Go on a real iPhone**.

## Step 6: Allow alerts on the phone

1. One time: in the project folder run `npx eas-cli init` and follow the prompts (free Expo account). It adds `extra.eas.projectId` to `app.json`.
2. Open the app on the phone with Expo Go (scan the QR from `npx expo start`), sign in.
   - **Should happen:** the phone asks to allow notifications. Tap **Allow**.
3. Supabase → Table Editor → `push_tokens`.
   - **Should happen:** one row with a token like `ExponentPushToken[…]` and your user id.
4. Settings → turn **Weather alerts** off.
   - **Should happen:** the row disappears from `push_tokens`. Turn it back on → the row comes back.

## Step 7: Force an alert and run the job by hand

Real alerts only come when the weather is extreme, so we make the cached forecast show frost.

1. Make sure the selected farm has a **growing** crop and the Weather tab was opened in the last 3 hours (so `weather_cache` has a fresh row).
2. SQL Editor → run:
   ```sql
   update public.weather_cache
   set forecast = jsonb_set(forecast, '{daily,minC}',
         (select jsonb_agg(0) from jsonb_array_elements(forecast->'daily'->'minC'))),
       fetched_at = now();
   ```
3. Terminal (use your project ref and CRON_SECRET):
   ```
   curl -X POST https://<PROJECT_REF>.supabase.co/functions/v1/weather-alerts -H "x-cron-secret: <CRON_SECRET>"
   ```
   - **Should happen:** it prints something like `{"farms":1,"cells":1,"failedCells":0,"sent":1,"removedTokens":0}` and the phone shows a notification "<farm name>: Frost risk: down to 0°C".
4. Tap the notification.
   - **Should happen:** the app opens on the Weather tab.
5. Run the same `curl` again.
   - **Should happen:** `"sent":0`, with no second notification. The same alert is never sent twice; `alerts_sent` has the rows.
6. Without the secret: `curl -X POST https://<PROJECT_REF>.supabase.co/functions/v1/weather-alerts`
   - **Should happen:** `{"error":"unauthorized"}`.
7. Clean up: SQL Editor → `delete from public.weather_cache;` (it refills next time the Weather tab opens).

## Step 8: Sign out stops alerts

1. Settings → Sign out.
   - **Should happen:** the phone's row is gone from `push_tokens`.
2. Sign in with a different account on the same phone.
   - **Should happen:** the token row now belongs to the new user id (the old account will not get alerts on this phone).

## Step 9: Automatic runs (next day)

1. Leave everything as is for a day.
   - **Should happen:** Integrations → Cron → `weather-alerts-every-3h` shows runs every 3 hours with status "succeeded". You only get notifications when the forecast really has heat, frost, heavy rain, strong wind or disease weather for your crops.
