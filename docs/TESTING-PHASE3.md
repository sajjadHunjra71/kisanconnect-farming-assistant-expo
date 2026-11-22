# Testing Phase 3: weather, alerts and notifications

Simple steps. Do them in order. Each step says **what to do** and **what should happen**.
If something different happens, note the step number and what you saw.

**Before this:** Phase 2 is set up and tested (`docs/TESTING-PHASE2.md`), and you have a farm with a location and at least one crop that is growing (not planned).

---

## Step 0: Set up the server (one time)

1. Supabase → **SQL Editor** → run `supabase/migrations/20261122000000_weather_cache.sql`, then `supabase/migrations/20261123000000_push_alerts.sql`.
   - **Should happen:** "Success. No rows returned" both times. Table Editor shows `weather_cache`, `rate_limits`, `push_tokens`, `alerts`, `push_tickets` and `job_state`. The `profiles` table has a new `notification_prefs` column.
2. (Optional, recommended) New query → paste all of `supabase/tests/rls_weather.sql` → **Run**.
   - **Should happen:** no error (if messages show, they are 14 `PASS` lines). It ends with `rollback`, so nothing is kept.
3. In the project folder on the Mac (Terminal). No Docker needed:
   ```
   npx supabase login
   npx supabase link --project-ref <your project ref>
   npx supabase functions deploy delete-account --use-api
   npx supabase functions deploy weather-proxy --use-api
   npx supabase functions deploy weather-alerts --use-api
   ```
   - **Should happen:** each deploy ends with "Deployed Functions". Supabase → **Edge Functions** lists all three.
4. Open `supabase/setup/schedule_weather_alerts.sql`, replace `<PROJECT_REF>` (2 places), paste it in the SQL Editor and **Run**.
   - **Should happen:** it returns job ids. **Integrations → Cron** shows `weather-alerts-every-3h` and `weather-purge-daily`. **Integrations → Vault** has a secret named `weather_alerts_cron_secret`. You never need to copy the secret anywhere.

## Step 1: Weather tab with a real forecast

1. `npx expo start` → `i` → sign in → pick a farm that has a location.
2. Open the **Weather** tab.
   - **Should happen:** no "Sample data" badge. The title shows your farm's district. The day slider shows today's hours. Under "7-day forecast" the first row is "Today", and below it is a second list called **"Outlook (less certain)"** for days 8–14. At the bottom it says **"Weather data by Open-Meteo.com (CC BY 4.0)"**.
3. Supabase → Table Editor → `weather_cache`.
   - **Should happen:** one row, `cache_key` like `31.5_74.3:open-meteo:v3`, `fetched_at` = just now. Nothing in the row shows your farm's exact location (only the rounded cell).
4. Pull down to refresh.
   - **Should happen:** `fetched_at` does **not** change within 15 minutes (the cached copy is used). After 15 minutes, opening the Weather tab again (or bringing the app back to the front) gets a newer forecast.
5. Look at **Next 24 hours** under the day slider.
   - **Should happen:** 24 hourly temperatures from now, continuing past midnight into tomorrow.

## Step 2: Spray strip and advice

1. Look at the **Spray window** card.
   - **Should happen:** up to 12 daylight hours (between 05 and 19). Colours: green = good, yellow = care, red = avoid.
2. Scroll to **Farm advice**.
   - **Should happen:** a spray card ("Good to spray today 08:00–12:00" or "No good spray window…" with a reason).
3. Irrigation card for a crop that is **more than 20 days old with no irrigation logged**.
   - **Should happen:** "Log the last irrigation of …" with a **Log irrigation** button. No made-up number.
4. Tap **Log irrigation**, save an irrigation for a few days ago, then come back.
   - **Should happen:** the card now says "next irrigation in about N days", "Irrigate … tomorrow" or "Skip irrigation… (rain expected)".
5. If you have a rice crop:
   - **Should happen:** "Rice: keep standing water" instead of a day count.
6. Tap **How is this worked out?**
   - **Should happen:** a short explanation of the spray and irrigation rules opens.
7. Home tab.
   - **Should happen:** the weather card shows the same temperature with "Updated N min ago · Open-Meteo" and the top 2 advice cards.

## Step 3: Offline and old forecast

1. Turn the Mac's Wi-Fi off. Pull to refresh on Weather.
   - **Should happen:** the forecast still shows with an "Offline · showing the last saved forecast" badge.
2. Turn Wi-Fi back on and pull to refresh.
   - **Should happen:** the badge goes away.
3. (Optional) To see the "old forecast" state: with Wi-Fi off, set the Simulator's date forward by 2 days (Mac System Settings → Date & Time), reopen the app.
   - **Should happen:** "Old forecast…" warning and **no advice cards** (they need a fresh forecast). Set the date back afterwards.

## Step 4: Farm without a location

1. Add a farm without GPS or a district and select it.
   - **Should happen:** the Weather tab says "Add your farm's location to see its weather" with a **Set farm location** button.

## Step 5: Notification permission after the first farm

1. Sign in with a **new** account (no farms yet). In farm setup, fill in the farm and press **Finish** (or Farm tab → Add farm → Save).
   - **Should happen:** right after saving, a message explains weather alerts ("Get weather alerts?") with **Not now** / **Allow**. Tap **Allow** → the system asks for notification permission → allow it.
2. Add a second farm.
   - **Should happen:** no question this time.

## Step 6: Alert settings

1. Settings → **Alert types**.
   - **Should happen:** switches for Heatwave, Crop heat stress, Frost, Heavy rain, Strong wind, Fog, Disease weather (all on), and **Quiet hours** From 22:00 Until 06:00.
2. Turn **Fog** off and pick quiet hours From 21:00.
   - **Should happen:** it saves without an error. Supabase → `profiles` → your row → `notification_prefs` shows `"fog": false` and `"start": "21:00"`. Turn Fog back on.

## Step 7: Make an alert and run the job (works in the Simulator)

Real alerts only come with extreme weather, so we make the cached forecast show frost. Frost alerts are only for **sugarcane, maize, or wheat at heading**, so make sure the selected farm has one of those growing (e.g. a maize crop sown 30 days ago).

1. Open the Weather tab for that farm (so `weather_cache` has a fresh row).
2. SQL Editor → run (sets every day's minimum temperature to −1 °C in the cached forecasts):
   ```sql
   update public.weather_cache
   set forecast = jsonb_set(forecast, '{daily,minC}',
         (select jsonb_agg(-1) from jsonb_array_elements(forecast->'daily'->'minC'))),
       fetched_at = now();
   ```
3. Run the job once by hand (SQL Editor; replace `<PROJECT_REF>`):
   ```sql
   select net.http_post(
     url := 'https://<PROJECT_REF>.supabase.co/functions/v1/weather-alerts',
     headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',
       (select decrypted_secret from vault.decrypted_secrets where name = 'weather_alerts_cron_secret')),
     body := '{}'::jsonb);
   ```
   - **Should happen:** it returns a request id. After a few seconds, `select status_code, content from net._http_response order by created desc limit 1;` shows `200` and something like `{"farms":1,...,"alertsCreated":1,...}`. Table `alerts` has a row "Frost risk for Maize: down to -1°C".
4. In the app (Simulator), pull down on the Farm tab (or bring the app back to the front).
   - **Should happen:**
     - A **local notification** "Frost risk for Maize…" appears (Simulator: swipe down from the top to see it if the app is open). If it's inside your quiet hours, it comes on the first sync after they end.
     - On Home, the **bell** shows a red **1**.
5. Tap the bell.
   - **Should happen:** the **Weather alerts** inbox lists the frost alert with an unread dot. Tap it → the dot goes away and the bell count drops. Supabase → `alerts.read_at` is filled after the next sync.
6. Run the SQL from step 3 again.
   - **Should happen:** `"alertsCreated":0`. The same alert is never created or sent twice.
7. Wrong secret check (Terminal):
   ```
   curl -X POST https://<PROJECT_REF>.supabase.co/functions/v1/weather-alerts -H "x-cron-secret: wrong"
   ```
   - **Should happen:** `{"error":"unauthorized"}`.
8. Clean up: SQL Editor → `delete from public.weather_cache;` (it refills next time the Weather tab opens).

## Step 8: Offline "mark read"

1. Make another alert (step 7 with a different value, e.g. `jsonb_agg(-2)`, after `delete from public.alerts;`).
2. Turn Wi-Fi off, open the inbox and tap the alert.
   - **Should happen:** it shows as read straight away.
3. Wi-Fi on, pull to refresh on the Farm tab.
   - **Should happen:** Supabase `alerts.read_at` is now filled.

## Step 9: Push notifications (needs a real phone)

Push doesn't work in the iOS Simulator, and Expo Go on Android no longer supports it. Use **Expo Go on a real iPhone**.

1. One time: `npx eas-cli init` in the project folder (free Expo account). It adds `extra.eas.projectId` to `app.json`.
2. Open the app on the iPhone (scan the QR from `npx expo start`), sign in, allow notifications (step 5).
   - **Should happen:** Supabase → `push_tokens` has a row `ExponentPushToken[…]` with your user id.
3. Repeat step 7 (after `delete from public.alerts;`).
   - **Should happen:** a push "<farm name>: Frost risk for …" arrives on the phone, and `alerts.pushed_at` and `push_ticket_id` are filled. Tapping it opens the Weather tab. There is no second, local notification for the same alert.
4. Settings → turn **Weather alerts** (under Notifications) off.
   - **Should happen:** the `push_tokens` row is deleted. Turn it back on and the row comes back.
5. Sign out.
   - **Should happen:** the token row is deleted, and the phone's saved forecasts are cleared.

## Step 10: Automatic runs (next day)

1. Leave it for a day.
   - **Should happen:**
     - **Integrations → Cron** shows `weather-alerts-every-3h` running every 3 hours with "succeeded", and `weather-purge-daily` once a day.
     - You only get alerts when the forecast really has heat, frost (for the right crops), heavy rain, strong wind, fog or disease weather.
     - Alerts that come in quiet hours are pushed after they end.

## Step 11: Demo mode (optional)

1. Remove the Supabase keys from `.env` and restart.
   - **Should happen:** Weather and Home show a sample forecast with the "Sample data" badge. The bell shows **1** and the inbox has two sample alerts (one unread).
