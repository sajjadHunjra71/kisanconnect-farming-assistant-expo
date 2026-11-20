# Testing Phase 2: farms, crops, activity log, offline sync

Simple steps. Do them in order. Each step says **what to do** and **what should happen**.
If something different happens, note the step number and what you saw.

**You need:** the Supabase project from Phase 1 (with `.env` keys filled), a Mac with Xcode Simulator, and Expo Go.

---

## Step 0: Set up the database (one time)

1. Open your Supabase project → **SQL Editor** → **New query**.
2. Open `supabase/migrations/20261121000000_farms_crops_activities.sql` from the project, copy everything, paste it in the editor and press **Run**.
   - **Should happen:** "Success. No rows returned". In **Table Editor** you now see three new tables: `farms`, `crops` and `activities`.
3. (Optional, recommended) New query → paste all of `supabase/tests/rls_farms.sql` → **Run**.
   - **Should happen:** it finishes with no error. If the editor shows messages, they are all `NOTICE: PASS: …` lines (14 of them). Nothing is saved: the test undoes itself at the end, so `farms`, `crops` and `activities` are still empty and there are no test users in Authentication.
   - **If it fails:** you see an error starting with `FAIL:`. Copy that line and send it.

---

## Step 1: Start the app

1. In the project folder run `npx expo start`, then press `i` to open the iOS Simulator with Expo Go.
2. Sign in with a test account (for example `farmer01@mailinator.com`). If it's a new account, open the confirmation email on mailinator.com first.
   - **Should happen:** you reach Home. If this account never set up a farm, you go to farm setup first (see step 2).

## Step 2: First farm (onboarding)

1. If you see farm setup: type a farm name, an area (e.g. `12`) and pick a unit, a district, a crop and "sown about a month ago". Press **Finish**.
   - **Should happen:** Home opens and shows that crop with its stage (e.g. "Wheat · Tillering"). Farm tab shows the farm.
2. Try **Finish** with the area empty.
   - **Should happen:** a red message under the area: "Enter an area greater than 0." Nothing is saved.

## Step 3: Add a farm with GPS

1. Simulator menu: **Features → Location → Custom Location…** → Latitude `31.5497`, Longitude `74.3436` (Lahore) → OK.
2. Farm tab → **Add farm** → name "Lahore farm", area `16`, unit **Kanal** → press **Use my location** → allow location.
   - **Should happen:** a row shows **Lahore** with "From your location".
3. Press **Save farm**.
   - **Should happen:** you're back on the Farm tab. Chips at the top now show both farms. The "Lahore farm" card shows District Lahore and Area "16 kanal".
4. Close the app and open it again.
   - **Should happen:** the farm you last picked is still selected.

## Step 4: Add a farm by picking a district

1. **Add farm** → name "Village farm", area `5`, unit Acre → **Pick district** → type `multan` in search → tap **Multan** → pick a soil type → **Save farm**.
   - **Should happen:** the farm card shows District Multan, Area "5 acre" and the soil you picked.
2. (Optional) Turn location permission off (Simulator: Settings app → Privacy → Location → Expo Go → Never), then press **Use my location** on a farm.
   - **Should happen:** the message "Location permission is off. Pick your district instead." appears and the district list opens.

## Step 5: Add crops (one planned for the future)

1. Pick "Village farm" → **Add crop** → Cotton → variety **FH-142** → sowing date 40 days ago → area `3` acre → **Save crop**.
   - **Should happen:** the crop detail opens. The timeline highlights the current stage and says "Next stage in N days".
2. Go back → **Add crop** → Rice → variety **Other** → type "My rice" → sowing date **10 days from today** → **Save crop**.
   - **Should happen:** on the Farm tab the rice card says "Planned, sowing in 10 days".
3. **Add crop** → Maize → area `4` acre.
   - **Should happen:** a yellow warning says the active crops add up to 7 acres, more than the farm's 5 acres. You can still save.

## Step 6: Log activities (incl. harvest)

1. Open the cotton crop → **Log activity** → Irrigation, today → **Save**.
2. **Log activity** → Spray, product "Imidacloprid", quantity `1` litre, cost `2500` → **Save**.
3. Farm tab → **Log activity** → Fertilizer, crop **Whole farm**, quantity `2` bag, product "Urea", cost `9000` → **Save**.
   - **Should happen:** the "This season" card on the Farm tab shows cotton with "Last irrigation: Today" and "Sprays: 1", and a total cost of Rs 11,500 (more if other crops have costs).
4. Try to pick a date after today in the date picker.
   - **Should happen:** future dates can't be picked.
5. Open the cotton crop → **Log activity** → Harvest → **Save** → answer **Yes, mark harvested**.
   - **Should happen:** cotton leaves the active crops and appears under **Past crops** (press Show) with "Harvested · today's date". The harvest is in its activity list.

## Step 7: Home screen

1. Go to Home.
   - **Should happen:** the crop cards show the selected farm's active crops (up to 3), not the sample crop. The new **Log** tile in quick actions opens "Log activity".

## Step 8: Edit and delete

1. Farm tab → **Activity log** → filter by type **Spray** → tap the spray → change cost to `3000` → **Save**.
   - **Should happen:** the list and the "This season" total update straight away.
2. Open an activity → **Delete activity** → confirm.
   - **Should happen:** it disappears from the list.
3. Open a crop → pencil icon → change the variety → **Save crop**. Then **Delete crop** → confirm.
   - **Should happen:** the crop and its activity are gone.
4. Edit "Village farm" (pencil on the farm card) → **Delete farm**.
   - **Should happen:** you're asked "Delete this farm?" and told its crops and activity log will also be removed. After confirming, the farm is gone.

## Step 9: Offline, then online

1. Turn your **Mac's Wi-Fi off** (the simulator uses the Mac's internet; the Expo dev server keeps working).
   - **Should happen:** on the Farm tab, next to the title, the status shows "Offline · saved on phone".
2. Add a crop and log an activity while offline.
   - **Should happen:** everything saves and shows normally. Settings → Sync says "2 changes waiting to upload" (or similar).
3. Turn Wi-Fi back on. Wait a few seconds (or pull down on the Farm tab).
   - **Should happen:** the status goes "Syncing…" then "Synced". Settings → Sync says "Everything is uploaded".
4. In Supabase → **Table Editor** → `farms`, `crops`, `activities`.
   - **Should happen:** you see your rows. Deleted ones have a date in `deleted_at` (they're kept on the server as deleted, not removed). `version` goes up each time a row was changed.

## Step 10: Sign-out warning with unsent changes

1. Turn Wi-Fi off again. Log one more activity.
2. Settings → **Sign out**.
   - **Should happen:** a message "1 change not uploaded yet" with **Sync now**, **Sign out anyway** and **Cancel**.
3. Press **Cancel**. Turn Wi-Fi on, wait for "Synced", then **Sign out** again.
   - **Should happen:** now only the normal "Sign out?" question appears. After signing out and back in, all your farms and crops come back from the server.

## Step 11: Export my data

1. Settings → **Export my data**.
   - **Should happen:** the share sheet opens with a file like `kisanconnect-export-2026-11-20.json`. Save it to Files (or AirDrop to your Mac) and open it: it has `exportedAt`, `profile`, `farms`, `crops` and `activities`, and only rows that weren't deleted.

## Step 12: Two devices (if possible)

1. Open a second simulator (Xcode → Open Developer Tool → Simulator → File → Open Simulator → another iPhone). In the Expo terminal press `shift + i` and pick it.
2. Sign in with the **same account** on both.
   - **Should happen:** both show the same farms after a sync (pull down on the Farm tab).
3. **Conflict test:** turn Wi-Fi off. On phone A rename a farm to "A name". Turn Wi-Fi on, and right away on phone B rename the same farm to "B name" and pull to refresh on B first, then on A.
   - **Should happen:** whichever change reached the server first wins on both phones. The phone that lost shows the server's name and a small tag "Updated from another device" on the farm card.
4. **Delete wins:** on phone B delete a crop. On phone A (offline) edit that same crop, then go online and pull to refresh.
   - **Should happen:** the crop disappears on phone A too; the delete is not undone.

## Step 13: Delete account (last, optional)

1. Settings → **Delete account** → confirm.
   - **Should happen:** you're back on Welcome. In Supabase the user and all their farms/crops/activities are gone. Signing in on this phone with a new account shows no old farms (the old local data file was deleted).

---

**Demo mode check (optional):** remove the Supabase keys from `.env` and restart. The app should open without login and show the sample farm with a "Sample data" badge. Changes there are not saved after restart.
