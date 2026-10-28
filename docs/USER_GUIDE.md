# Career Page Job Alerts: setup guide

Get a **Telegram message within an hour** of a new job appearing on your favourite companies' career pages, often before it reaches LinkedIn or Naukri.

- ✅ Free
- ✅ Nothing to install
- ✅ Keeps working when your computer is off
- ⏱️ About **10 minutes** to set up

You need a **Google account** (Gmail) and the **Telegram** app on your phone.

---

## Step 1: Make your own copy of the sheet

1. Open the **Make a copy** link you were given.
2. Click the blue **Make a copy** button.
3. Your own copy opens. Wait about 10 seconds until a menu called **Job Alerts** appears at the top, next to *Help*.

> Can't see the **Job Alerts** menu? Reload the page (Cmd+R on Mac, Ctrl+R on Windows) and wait 10 seconds.

---

## Step 2: Create your Telegram bot (2 minutes)

The bot is your private "alert sender". Only you will receive its messages.

1. Open **Telegram** and search for **@BotFather** (it has a blue tick ✔️). Tap it, then tap **Start**.
2. Send this message: `/newbot`
3. BotFather asks for a **name**. Type anything, e.g. `My Job Alerts`
4. It asks for a **username**. It must end in `bot`, e.g. `priya_jobalerts_bot`. If it's taken, try another.
5. BotFather replies with a **token**, a long code like
   `7123456789:AAH4k3...Xyz`
   **Copy it** (tap and hold on the token → Copy).
6. In the same message, tap the link to **your new bot** (`t.me/priya_jobalerts_bot`) and press **START**.

> 🔒 The token is like a password for your bot. Don't share it or post screenshots of it.

---

## Step 3: Connect the bot to your sheet

1. In your sheet, open the **Settings** tab (tabs are at the bottom of the screen).
2. Paste the token into the yellow cell next to **Telegram bot token**.
3. Click the menu **Job Alerts → 1. Find my Telegram chat ID**.
4. **The first time only**, Google asks for permission:
   - Click **Continue** and choose your Google account.
   - You'll see **"Google hasn't verified this app"**. That's normal for a personal sheet. Click **Advanced** (bottom left), then **Go to Career Page Job Alerts (unsafe)**.
   - Click **Allow**.
5. Click **Job Alerts → 1. Find my Telegram chat ID** again. It fills in your chat ID for you ✅.

> It says "No message found yet"? Open your bot in Telegram, press **START** or send it `hi`, then try again.

---

## Step 4: Tell it what you're looking for

Still on the **Settings** tab, fill in the yellow cells:

| Setting | What to type | Example |
|---|---|---|
| **Roles you want** | Job titles you want, separated by commas | `Product Manager, Product Owner, Business Analyst` |
| **Skip titles containing** | Words that mean "not for me" | `intern, sales, engineer` |
| **Locations** | Cities or "Remote", separated by commas. Leave empty for anywhere | `Bengaluru, Bangalore, Hyderabad, Remote` |
| **Check every (minutes)** | `60` is right for the 250 starter companies. Use `30` for faster alerts if you keep fewer than 150 | `60` |
| **Also match job descriptions** | `Yes` also alerts when your role appears in the description, not just the title | `Yes` |

💡 Add spelling variants too, e.g. both `Bengaluru` and `Bangalore`.

---

## Step 5: Add your favourite companies

1. Open the **Companies** tab. It comes with **250 companies** already filled in, mostly Global Capability Centres (GCCs) hiring in India.
2. **Delete the rows you don't care about** and **add your own** companies, one per row in column A. Use the name as it appears on the company's careers page, e.g. `Atlassian`, `Datadog`.
3. **Workday companies (optional):** many big companies use Workday. To check:
   - Open the company's careers website and click any job.
   - If the web address contains **myworkdayjobs.com**, copy it up to the first word after `.com/`. For example:
     `https://astrazeneca.wd3.myworkdayjobs.com/Careers`
   - Paste it into **column B** on that company's row.
4. Leave columns C to E empty. They fill in automatically.

---

## Step 6: Test, then start

1. Click **Job Alerts → 2. Send a test message**. You should get *"✅ Job Alerts is connected"* on Telegram.
2. Click **Job Alerts → 3. Start alerts**.

**That's it! 🎉** You can close the sheet and your computer. Alerts arrive on Telegram.

---

## What to expect

- **The first day is quiet.** The first check of each company records the jobs *already* posted, so you aren't flooded with old ones. After that, you're alerted only about **new** jobs.
- **Each alert looks like this:**

  > 🆕 2 new jobs
  >
  > • Senior Product Manager — Atlassian (Bengaluru, India)
  > https://…

- **The Companies tab** shows what's happening:

  | Status | Meaning |
  |---|---|
  | ✅ Greenhouse / Lever / Ashby / Workday | Being watched |
  | ⏳ Checking soon | Will be looked up in a coming run (about 40 companies per run, so all 250 are checked within the first day) |
  | ❌ Not found | Its careers site isn't supported. Add its Workday link in column B, or remove it |
  | ⚠️ Workday link not working | Check the link in column B |

- **The Alerts tab** keeps a list of every job you were sent.
- **Settings → Last run** shows when it last checked, how many new jobs it found, and any problem.

---

## Everyday use

| I want to… | Do this |
|---|---|
| Add or remove a company | Edit the **Companies** tab. Changes are picked up on the next check |
| Change roles or locations | Edit the **Settings** tab |
| Check right now | **Job Alerts → Check now** |
| Pause alerts | **Job Alerts → Stop alerts** (start again with **3. Start alerts**) |

---

## Problems?

| Problem | Fix |
|---|---|
| No **Job Alerts** menu | Reload the page and wait 10 seconds |
| "Telegram did not accept the bot token" | Copy the token again from @BotFather, with no extra spaces |
| Test says **"chat not found"** | Open your bot in Telegram, press **START**, then run **1. Find my Telegram chat ID** again |
| Test says **"Unauthorized"** | The token is wrong. Copy it again from @BotFather |
| No alerts after a day | Look at **Settings → Last run**. Are your companies ✅ on the Companies tab? Are your **Roles** and **Locations** too narrow? |
| Lots of ❌ Not found | Normal for companies using SuccessFactors, Taleo, iCIMS or their own site. Add Workday links where possible, and follow the rest on LinkedIn |
| "Service invoked too many times" in the Log tab | You're watching a lot of companies. Keep **Check every** at `60` and remove companies you don't need |

---

## Privacy

- Everything stays in **your** Google account and **your** Telegram. The person who shared the sheet can't see your copy, your settings or your alerts.
- The sheet only reads public job listings and sends messages to your bot.
- To remove everything: **Job Alerts → Stop alerts**, then delete your copy of the sheet.
