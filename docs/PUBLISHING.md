# Publishing the template (for the maintainer)

Users get Career Page Job Alerts by copying one master Google Sheet. Copying a sheet also copies its script, so users never see code.

## 1. Create the master template (once, about 5 minutes)

1. Open **sheets.new**. Name the file **Career Page Job Alerts**.
2. Click **Extensions → Apps Script**.
3. Top left, click **Untitled project** and rename it **Career Page Job Alerts**. Users see this name on Google's permission screen.
4. Delete the sample code in `Code.gs`, paste the whole of [`Code.gs`](../Code.gs) from this repo, and click **Save** 💾.
5. Close the Apps Script tab and **reload** the sheet. Within about 10 seconds the **Start here, Settings, Companies, Alerts, Log** tabs appear, plus the **Job Alerts** menu.
   - If they don't, open Apps Script again, choose **buildTemplate** in the function dropdown, click **Run** and allow access.
6. **Keep the master clean.** Don't enter a bot token and don't click *Start alerts* in it.

## 2. Share it

1. Click **Share → General access → Anyone with the link → Viewer → Done**.
2. Copy the sheet's link and replace everything from `/edit` onwards with `/copy`:
   `https://docs.google.com/spreadsheets/d/<SHEET_ID>/copy`
3. Put that link in the README (replace `TEMPLATE_COPY_LINK`) and wherever you share it.

Opening a `/copy` link shows a **Make a copy** button. The copy lands in the user's own Drive.

## 3. Test it like a new user

Open the `/copy` link (ideally from a second Google account) and follow [USER_GUIDE.md](USER_GUIDE.md). Check that:

- [ ] **1. Find my Telegram chat ID** fills in the chat ID
- [ ] **2. Send a test message** arrives on Telegram
- [ ] **3. Start alerts** runs, and the Companies tab shows ✅ / ❌ statuses
- [ ] **Settings → Last run** updates every 30 minutes

## 4. Release an update

1. Edit `Code.gs` and run `node test/test.js`.
2. Paste the new `Code.gs` into the master template's Apps Script and save. New copies get it automatically.
3. Existing users can upgrade by pasting the new `Code.gs` into **their** copy (Extensions → Apps Script → select all → paste → Save). Their settings, companies and alerts are kept.
