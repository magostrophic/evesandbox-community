# Eve Sandbox Community: setup guide

The Community lives at **community.evesandbox.com**. It is a separate website from evesandbox.com, with its own folder, its own Cloudflare project, its own database and its own picture storage.

| Part | What is used |
|---|---|
| Sign in | **Email and password** (with a confirmation email and "Forgot password?") or "Continue with Google", both through **Firebase Authentication** (free Spark plan, no card needed) |
| Text (posts, replies, votes, reports, usernames, bios, links) | **Cloudflare D1** database |
| Pictures (on posts only, 5 MB each, up to 4 per post) and profile pictures (3 MB max) | **Cloudflare R2** bucket |
| Profiles | A page for every member at `community.evesandbox.com/id/username` |
| Website and server code | One **Cloudflare Worker**, deployed from GitHub like your main site |

Replies are text only. Every member has a public profile with a picture, a bio, links (Instagram, Discord, X, YouTube, a website) and tabs for Posts, Replies and Liked posts. People can delete their own posts and replies. When a post is deleted, its replies, votes and pictures are deleted with it.

You do five things: make a free Firebase project for the sign-in, create the D1 database and the R2 bucket, put the files on GitHub, create the Cloudflare project, and add one secret. Allow about 45 minutes.

---

## What is in this folder

| Path | What it is |
|---|---|
| `public/` | The website itself (page, style, fonts). Visitors get this. For the most reliable logo, also put your `evesandbox.png` (the same file the main site uses) in this folder. The page uses it first and falls back to the main site's copy. |
| `worker/index.js` | The server code: sign-in check, posts, replies, votes, pictures, profiles. |
| `schema.sql` | The database tables. You paste it into D1 once (step 3). |
| `migration-profiles.sql` | Only for a database you created **before** profiles existed (see step 3). |
| `wrangler.jsonc` | **The only file you edit.** Project name, your three Firebase values, your D1 ID, the R2 bucket, the address. |
| `source/` | The readable page code. You never need it to deploy. |

---

## 1. Make the Firebase project for sign-in (free, no card)

Firebase is Google's own sign-in service. Here it does one job only: it keeps the sign-in details (the password, stored scrambled by Firebase, never readable by anyone, including you), sends the confirmation and reset emails, shows the "Continue with Google" window, and proves who the person is. The Community server never sees a password. Everything else (posts, pictures, profiles) stays in your Cloudflare D1 and R2. You do **not** turn on Firestore, Storage, Hosting or anything else in Firebase.

**It costs nothing.** Stay on the free **Spark** plan and never add a billing account. Email and Google sign-in have no per-login charge on Spark. If Firebase or Google ever offers to "Upgrade" (for example to *Identity Platform*), ignore it. You do not need it.

1. Go to **console.firebase.google.com** and sign in with the Google account that should own this.
2. Click **Create a project** (or **Add project**). Name it `eve-sandbox-community`. When it asks about Google Analytics, turn it **off**. Click **Create project**, then **Continue**.
3. In the left menu open **Build**, then **Authentication**, then click **Get started**.
4. Open the **Sign-in method** tab, choose **Google**, and switch **Enable** on.
   - **Public-facing name for project:** `Eve Sandbox` (this is the name people see on the Google window).
   - **Support email for project:** choose your email. Click **Save**.
   - Then click **Add new provider** again, choose **Email/Password**, switch the first switch (**Enable**) on and leave **Email link (passwordless sign-in)** **off**. Click **Save**.
5. Open **Authentication**, then **Settings**, then **Authorized domains**, then **Add domain**, and type `community.evesandbox.com`. (`localhost` and the `firebaseapp.com` address are already there. Leave them.)
6. Click the **gear** next to *Project Overview*, then **Project settings**, then the **General** tab. Scroll to **Your apps** and click the web icon `</>`. Nickname: `community`. Leave *Firebase Hosting* unticked. Click **Register app**.
7. Firebase shows a block starting with `const firebaseConfig = {`. Copy **three** values from it: `apiKey`, `projectId` and `appId`. (You do not need the others.)
8. Open `wrangler.jsonc` in a text editor and paste them between the quotes of `FIREBASE_API_KEY`, `FIREBASE_PROJECT_ID` and `FIREBASE_APP_ID`.

### 1.9 Email and password: the few extra settings

Email sign-in needs no new files and no extra values. Check these once:

1. **Authentication, Sign-in method:** both **Google** and **Email/Password** show *Enabled*. If Email/Password is off, the page says "Email sign-in is not switched on yet".
2. **Authentication, Settings, User actions:** keep **Email enumeration protection** switched **on** (the default for new projects). It stops strangers from finding out which emails have accounts. Leave **Create (sign-up)** and **Delete** allowed.
3. **Authentication, Templates:** the **Email address verification** and **Password reset** emails are what people receive.
   - **Sender:** you already verified `community.evesandbox.com` as the sender domain, so they come from your own address (for example `noreply@community.evesandbox.com`). If you see **Verified**, nothing more to do.
   - **Subject:** this one is editable on the free plan. Use the lines in `firebase-email-templates/subjects.txt`.
   - **Message:** it may be locked on the free plan. That is fine, the built-in message works. The same goes for the **Action URL** (the address the link goes through): **leave it as it is.** The link opens a small Firebase page that says "Your email has been verified", and its **Continue** button returns the person to community.evesandbox.com.
4. **Spam folder:** the first emails from a new sender sometimes land in spam. The page tells people to check it. The SPF and DKIM records you added are what keep this rare.

**How it works, in short:**

| Step | What happens |
|---|---|
| Create account | The person types an email and a password (8 to 128 characters). Firebase stores the password scrambled and emails a confirmation link. The person is **not** signed in yet. |
| Confirm | They open the link. Firebase marks the email as verified. |
| Sign in | The browser asks Firebase to check the password and gets a signed token. The Community server checks the token with Firebase's public keys and, **only if the email is verified**, starts its own session. Everything else (name, username, bio, posts, pictures, votes) is stored in D1 and R2 as before. |
| Forgot password | Firebase emails a reset link. The page always answers the same way, whether or not the address has an account. |
| Same email, two ways | An email that signs in with Google and with a password is **one** member (matched by the verified email). |

## Settings (Account, Display, Security, Privacy)

Signed-in members open **Settings** from the menu under their picture (below *My profile*). It lives at `community.evesandbox.com/#/settings`; nothing to configure.

| Section | What it does |
|---|---|
| Account | Shows the email, name, username and how the member signs in, and links to *Edit profile*. **Delete account** always removes the account, profile, profile picture, votes and the reports the member filed. The member chooses with three tick-boxes whether to also delete **all their posts** (which also removes the pictures and everyone's replies under those posts), **only the pictures on their posts**, and **all their replies**. Anything left unticked stays and is shown as **Deleted User** (no name, no profile link, no way back to the person). The member must type `DELETE` and confirm again (their password, or the Google window), then the page also removes the sign-in account in Firebase. Posts of other people keep working: their reply counts and scores are corrected. A member whose account was restricted by a moderator cannot delete it, so a restriction cannot be escaped. |
| Display | Theme (same as the device, light or dark) and text size. Saved in that browser only (also works when signed out). |
| Security | Email-and-password members can **change their password** (they type the current one first). Google members are pointed to their Google account, which owns the password. |
| Privacy | Switch to show or hide the posts the member liked on their profile (off by default). |

If deleting the sign-in account in Firebase ever fails, the member's Community data is still gone; the Firebase user can be removed by hand under Authentication, Users.

**Why the password is not stored in D1:** a Cloudflare Worker on the free plan may use only 10 milliseconds of processor time per request, and properly scrambling a password takes far longer. A home-made version would either fail or use a weak method. Firebase does this safely and for free. If you would still rather keep passwords in your own D1, tell me. It needs the paid Workers plan and I would recommend against it.

These three values are **not secrets**. Every visitor's browser needs them, and the server checks every sign-in itself, so nobody can pretend to be someone else with them. Never paste a *service account*, *private key* or *Web API secret* anywhere.

*Already set the Community up with the earlier Google Client ID version?* Do the steps above, put the three values in `wrangler.jsonc` (the old `GOOGLE_CLIENT_ID` line is gone), and upload the new folder. People who signed in before keep their account, because it is matched by their verified email.

## 2. (Check) Your Cloudflare account

Your domain evesandbox.com must already be on this Cloudflare account (it is). You already use R2 for Text and File Sharing, so R2 is already turned on.

## 3. Create the D1 database

1. Cloudflare dashboard, then **Storage & databases**, then **D1 SQL database**, then **Create database**.
2. Name: `evesandbox-community`. Pick a location near your visitors (or leave automatic). Click **Create**.
3. On the database's page copy the **Database ID** (a long code with dashes). Paste it between the quotes of `database_id` in `wrangler.jsonc`.
4. Open the **Console** tab of the database. Open `schema.sql` from this folder, copy **all** of it, paste it in the console and press **Execute**. It should say the queries ran. (It is safe to run twice.)
5. **Only if you already set the Community up before profiles existed:** your tables already exist, so `schema.sql` will not add the new columns. In the same Console paste and run `migration-profiles.sql` **once** (running it twice gives a harmless "duplicate column" error). If you are setting up for the first time, skip this.

## 4. Create the R2 bucket for pictures

1. Dashboard, then **R2 object storage**, then **Create bucket**.
2. Name it exactly `evesandbox-community-images`. Leave everything else as it is.
3. **Keep it private.** Do not turn on "Public access" or an `r2.dev` address. The Community serves pictures itself, so the bucket stays closed to the outside.

## 5. Put the Community on GitHub

1. On github.com create a **new repository** named `evesandbox-community`. A **private** one is fine.
2. Upload the **contents** of this folder: `public`, `worker`, `source`, `schema.sql`, `migration-profiles.sql`, `wrangler.jsonc`, `COMMUNITY-SETUP.md`, `README.md`. Use **Add file**, then **Upload files**, then **Commit changes**. Check that your edited `wrangler.jsonc` (with the three Firebase values and the database ID) is the one uploaded, and that the `worker` folder arrived with `index.js` inside.

## 6. Create the Cloudflare project

1. Dashboard, then **Workers & Pages**, then **Create application**, then choose to import from **GitHub** and pick `evesandbox-community`.
2. The project (Worker) name must be exactly **`evesandbox-community`**. It must match `name` in `wrangler.jsonc`, or the build fails.
3. Leave the build command empty and the deploy command as the default (`npx wrangler deploy`). Click **Save and Deploy**.
4. `wrangler.jsonc` also connects the database, the picture bucket and the address `community.evesandbox.com`. Cloudflare creates the DNS entry itself.
   - If it complains the address is already in use, open **DNS** for evesandbox.com, delete any existing `community` record, and redeploy.
   - If it complains it cannot find the D1 database or the bucket, the ID or the bucket name in `wrangler.jsonc` is wrong. Fix it on GitHub and the project redeploys.

## 7. Add the secret

The server signs people in with a secret key that only you know.

1. Open the project `evesandbox-community`, then **Settings**, then **Variables and Secrets**, then **Add**.
2. **Type:** `Secret`. **Variable name:** `SESSION_SECRET`.
3. **Value:** a long random text of **at least 32 characters** (40 or more is better). A password manager's "generate password" button with 48 characters works. Do not reuse a password. Nobody, including you, ever needs to type it again.
4. Click **Deploy** (or **Save**). Keep a copy in your password manager. If you ever change it, everyone is signed out once.

Never put this secret in GitHub or in a message to anyone.

## 8. Try it

1. Open **https://community.evesandbox.com**. You should see the Community page. If it says "not open yet", the three `FIREBASE_` values in `wrangler.jsonc` are empty.
2. Click **Sign in**. Try **Create account** with an email and password, open the confirmation email, then sign in. (Later you can also try **Continue with Google** and **Forgot password?**.) Then choose a **display name** (2 to 30 letters) and a **username** (3 to 20 letters, numbers or underscores). The username becomes your profile address.
3. **Start a post**, add a title, some text and a picture, press **Post**. Every post gets an 8-letter ID (for example `#k3f9x2ab`) and its own link.
4. Reply, vote with the arrows, press **Share** (the link it copies shows a preview card in chat apps), try **Report** and **Delete**.
5. Open the post link in a private window. It works without signing in. Voting, posting and replying ask for a sign-in.
6. Click your picture (top right), then **My profile**. Your address is `https://community.evesandbox.com/id/yourusername`. Press **Edit profile** to add a picture (3 MB at most), a bio (300 characters), your Instagram and Discord (and X, YouTube, GitHub or a website if you like), and to choose whether other people may see the posts you liked.
7. Open your profile link in a private window. It shows your picture, bio, links and the **Posts** and **Replies** tabs. **Liked posts** shows to others only if you switched that on (it is private by default).

## 9. Make yourself the moderator

Moderators can delete any post or reply. Only you can add one, because it is done in the database.

1. Sign in on the Community once.
2. D1, your database, **Console**, run (with your own Gmail address):
   ```sql
   UPDATE users SET is_admin = 1 WHERE email = 'you@gmail.com';
   ```
3. Reload the Community. Delete buttons now appear on everybody's posts, and your account menu shows **Admin**.

**Reading reports:**
```sql
SELECT r.created, r.post_id, r.reply_id, r.reason, u.email AS reporter FROM reports r JOIN users u ON u.id = r.reporter_id ORDER BY r.created DESC LIMIT 50;
```
Open `https://community.evesandbox.com/p/<post_id>` to see the post, and delete it with the Delete button.

**Cleaning up a profile** (a rude bio, a bad link or picture): run
```sql
UPDATE users SET bio = '', links = '{}', avatar = 0 WHERE username = 'theirusername';
```
That hides the picture at once. To also remove the file, open R2, then your bucket, then **Objects**, and delete the object named `a/<their user id>` (find the id with `SELECT id FROM users WHERE username = 'theirusername';`).

**Changing someone's username** (for example an impersonation): `UPDATE users SET username = 'newname' WHERE username = 'oldname';` (3 to 20 lowercase letters, numbers or underscores, not already taken).

**Blocking someone** (they can still read, but can not post, reply or vote):
```sql
UPDATE users SET banned = 1 WHERE email = 'person@example.com';
```
Undo it with `banned = 0`.

**Removing a person's account and data** (if they ask through your Contact page): first open and delete their posts with the Delete button (that also removes the pictures), then run:
```sql
DELETE FROM replies WHERE author_id = (SELECT id FROM users WHERE email = 'person@example.com');
DELETE FROM votes WHERE user_id = (SELECT id FROM users WHERE email = 'person@example.com');
DELETE FROM reports WHERE reporter_id = (SELECT id FROM users WHERE email = 'person@example.com');
DELETE FROM users WHERE email = 'person@example.com';
```
If they had a profile picture, also delete the object `a/<their user id>` in R2 (get the id with `SELECT id FROM users WHERE email = 'person@example.com';` **before** you run the lines above).
Then run `UPDATE posts SET reply_count = (SELECT COUNT(*) FROM replies WHERE post_id = posts.id), score = (SELECT COALESCE(SUM(value),0) FROM votes WHERE post_id = posts.id);` so the counters stay right.

## 10. Update the main site

1. Unzip `Site-update.zip` (26 changed files; it never contains `assets/config.js`).
2. In your main site's GitHub repo, **delete the `grab` folder** (open each file in it and use the bin icon).
3. Upload the unzipped files with their folders (**Add file**, then **Upload files**) and commit.
4. What changes on evesandbox.com: Grab Box is gone, a **Community** link is in every footer, and the Terms of Service and Privacy pages now cover the Community, including pictures and profiles (and say that liked posts are private unless the member shares them).

---

## The rules built in

- Pictures: **JPEG, PNG, WebP or GIF only**, **5 MB at most each**, **up to 4 per post**, on **posts only**. The server checks the file's real contents, not just its name, so a renamed file or an SVG is refused.
- Replies: text only, up to 2,000 characters. Posts: title up to 120, text up to 5,000.
- Profiles: username 3 to 20 lowercase letters, numbers or underscores, unique, and it can be changed once every 30 days (so old links do not break all the time); names like `admin`, `moderator` or `eve` are reserved. Profile picture: JPEG, PNG or WebP, **3 MB at most** (the page crops it square and shrinks it before upload; one picture per person, a new one replaces the old). Bio: up to 300 characters. Links: Instagram, Discord (a username or a discord.gg invite), X, YouTube, GitHub and a website. Only the pieces of a link are saved and the address is built by the site, so nobody can hide a different address behind "Instagram". Your email is never shown on a profile.
- **Liked posts** are private by default. Only the person themselves sees them until they turn on "Show the posts I liked on my profile". Other tabs (Posts, Replies) are public.
- Posts and profile pages can appear in search results (they carry a title, description, preview picture and structured data). Pictures themselves are not listed by image search.
- JPEG photos are redrawn in the visitor's browser before upload, which removes hidden details like where a photo was taken. Other formats are stored as they are.
- Limits per account (the server enforces them): one post every 30 seconds, one reply every 10 seconds, 15 posts and 30 MB of pictures per day, 200 replies per day.
- A signed-in person can only delete their own posts and replies. Scores and reply counts are recalculated from the votes and replies, so nobody can fake them.
- Signing in is checked by the server against Firebase's public keys (only Google accounts and email accounts with a **confirmed** email are accepted), and the session is a signed, HttpOnly cookie. Firebase keeps nothing in the browser afterwards.

## What it costs and how far it goes

On Cloudflare's free plans (limits as I know them; check Cloudflare's pricing pages for current numbers): D1 gives about 5 million row reads and 100,000 row writes per day and 5 GB of data; R2 gives 10 GB of pictures and 1 million writes and 10 million reads per month; the Worker gives 100,000 requests per day (the website's own files do not count, only the sign-in, post, vote and picture requests). A full post of 4 pictures can be up to 20 MB, so 10 GB holds roughly 500 such posts, and many more typical ones. If you pass a limit the Community stops working until the allowance resets (or you upgrade); it does not charge a plan you never bought. You can see usage on the D1, R2 and Worker pages in the dashboard.

## If something goes wrong

| What you see | What to do |
|---|---|
| Pasting a post link in a chat app shows no card (no title or picture) | 1) Open `https://community.evesandbox.com/robots.txt`. It must show only `Disallow: /api/`. If it also lists `/p/` or `/img/`, the old file is still on GitHub: upload `public/robots.txt` again (chat apps such as Slack, X and Facebook obey that file). 2) Open `https://community.evesandbox.com/api/ping?post=<post id>`. Under `preview` it shows the title, text and picture that chat apps will read, whether the picture is stored, its size in KB and its type (it should say `image/...`; WhatsApp may skip pictures over about 300 KB). If `link previews` in the same answer is not `ok`, send me the answer. 3) In Chrome open `view-source:https://community.evesandbox.com/p/<post id>` and press Ctrl+F for `og:title`; the post's title must be in it. 4) Chat apps remember the first answer for a link, so test with a **new post**, or add `?v=2` to the end of the link. Facebook and Instagram can be refreshed at developers.facebook.com/tools/debug. 5) If a Cloudflare setting such as **Bot Fight Mode** or **Block AI bots** is on for the domain, switch it off while testing. |
| You want to check the whole setup at once | Open `https://community.evesandbox.com/api/ping`. It shows `"ok":true` and a `build` code when everything is in place (if you get an error page instead, the newest files are not deployed yet). Otherwise it names what is `missing` or has a `problem` (the secret, the Firebase values, a database table, the picture storage, the page files). It shows no passwords or keys. |
| "The community is not open yet" | The three `FIREBASE_` values in `wrangler.jsonc` are empty. Fill them in on GitHub; it redeploys. |
| "Something went wrong. Please try again." on a post or profile page | The page shows only a friendly message (no technical line). If it was "A security check is needed", the request was stopped by a Cloudflare security check in front of the site, not by the Community. It happens when a challenge or bot rule covers `community.evesandbox.com` and its pass expires after a while. In the Cloudflare dashboard open evesandbox.com, then Security, then Events, find the blocked `/api/...` request and look at which rule or service it names. Then either exclude `community.evesandbox.com` (or at least `/api/*` and `/img/*`) from that rule, or raise the challenge pass time under Security, Settings. The page reloads itself once to pass the check and asks again by itself up to 3 times before showing the message. To see exactly what failed, open the browser console (F12, Console): the details (code, HTTP status, address) are written there, and with a `ref` you can search for it in Cloudflare, Workers & Pages, evesandbox-community, **Logs**. |
| "The community is still being set up" when signing in or posting | The server cannot find `SESSION_SECRET`. In Cloudflare open **Workers & Pages**, the **evesandbox-community** project, **Settings**, **Variables and Secrets**. There must be a row named exactly `SESSION_SECRET` (capital letters, no spaces) with the type **Secret** (not *Text*, because a Text variable is wiped at the next GitHub deploy) and a value of **32 or more** characters with no spaces. Add or fix it, press **Deploy**, wait a minute, hard-refresh and try again. |
| The Google window does not open | The browser blocked the pop-up. Allow pop-ups for community.evesandbox.com and press the button again. If nothing changes, delete the `Content-Security-Policy` line from `public/_headers` on GitHub and tell me. |
| "This address is not allowed for sign-in yet" | Add `community.evesandbox.com` under Authentication, then Settings, then Authorized domains (step 1.5). |
| "Sign-in could not be checked" | One of the three Firebase values in `wrangler.jsonc` is wrong (most often `FIREBASE_PROJECT_ID`; it must be the project's ID, not its display name), or your computer's clock is wrong. |
| "Email sign-in is not switched on yet" | Step 1.4: add **Email/Password** under Authentication, Sign-in method, and switch it on. |
| "Please confirm your email first" | The person has not opened the confirmation link. Use **Send the verification email again**, and check the spam folder. |
| "Wrong email or password" | Typo, or the account was made with Google only (use **Continue with Google**, or **Forgot password?** to add a password). |
| The confirmation email never arrives | Check the spam folder, then Authentication, Templates, that the sender shows **Verified**. Firebase also limits how many it sends per hour; wait and retry. |
| "Too many tries" | Firebase paused that device for a few minutes. Wait and try again. |
| Google says the sign-in is disabled | Step 1.4: Google must be switched **Enable** in Authentication, Sign-in method. |
| Build fails in Cloudflare | The project name must be exactly `evesandbox-community`; `wrangler.jsonc` must be in the repo's top folder; the D1 ID and bucket name must exist. |
| Posts fail with a server error | D1 tables missing: run `schema.sql` again in the D1 Console (step 3.4). |
| Pictures do not show | The R2 bucket must be named `evesandbox-community-images`, exactly as in `wrangler.jsonc`. |
| The address will not attach | Delete an old `community` DNS record in Cloudflare and redeploy. |

## Honest limits

- **Tested here:** the whole Community running on Cloudflare's own local test engine (the same server runtime, a local D1 database and a local R2 bucket), with a stand-in for Firebase that signs sign-in tokens in Firebase's format. 232 checks on the server (forged and expired tokens, wrong project, unconfirmed emails, other sign-in kinds refused, cheating attempts, the 5 MB and 3 MB limits to the byte, fake and SVG pictures, deleting a post removes its replies, votes and pictures, usernames, links, private liked posts, profile pages) 103 checks in a real browser (sign-in, posting with pictures, voting, replies, sharing, admin delete, profile pages and editing, phone layout), and 51 more checks of the email sign-in (create account, confirmation notice, resend, wrong password, offline, forgot password, same email by Google and by password, phone and dark layout, with the page security rules switched on). Also checked in a real browser: the empty profile tabs (31), the footer, menu and security-check message (14), the vote and live-update behaviour (15), the picture viewer (30), preview cards for posts and profiles, including an `index.html` written differently and a database that fails for a moment (33 + 18), and a session that comes back by itself after a failed answer (10), and Settings with account deletion, password change, themes and the fixed header (82).
- **Not tested here:** the real Firebase sign-in window, Google screens and the real confirmation and reset emails (my workspace cannot reach Firebase or send email), the real D1 and R2 services, and the actual Cloudflare deployment. I could not reach them from my workspace. Your first sign-in and first post are the real test. If something fails, send me the exact message.
- **Moderation is manual:** nobody reviews posts or pictures before they appear, and pictures are not scanned. You are responsible for what is posted, so read the reports and use delete and ban.
- **Spam:** every account needs a confirmed email and the limits above apply per account, but one person can make several email addresses.
- **Search engines:** posts (`/p/...`) and profile pages (`/id/...`) carry their own title, description, canonical address, preview tags and structured data, and are open to indexing. Pictures carry `noindex, noimageindex`, so image search does not list them. `robots.txt` blocks only `/api/` and points to the sitemap at `https://community.evesandbox.com/p/sitemap.xml` (the newest 1000 posts). In Google Search Console add `community.evesandbox.com` (the same domain verification covers it) and submit that sitemap address under Sitemaps. Google decides when and whether to list a page, which can take days or weeks. Pages that do not exist, and posts that were deleted, answer 404 and `noindex`.
- **Profile pictures are not scanned** and are cropped automatically (no manual crop screen). Animated GIFs are not accepted as profile pictures.
