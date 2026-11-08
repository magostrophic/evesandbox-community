# Eve Sandbox Community: setup guide

The Community lives at **community.evesandbox.com**. It is a separate website from evesandbox.com, with its own folder, its own Cloudflare project, its own database and its own picture storage.

| Part | What is used |
|---|---|
| Sign in | "Continue with Google" through **Firebase Authentication** (free Spark plan, no card needed) |
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
| `public/` | The website itself (page, style, fonts). Visitors get this. |
| `worker/index.js` | The server code: sign-in check, posts, replies, votes, pictures, profiles. |
| `schema.sql` | The database tables. You paste it into D1 once (step 3). |
| `migration-profiles.sql` | Only for a database you created **before** profiles existed (see step 3). |
| `wrangler.jsonc` | **The only file you edit.** Project name, your three Firebase values, your D1 ID, the R2 bucket, the address. |
| `source/` | The readable page code. You never need it to deploy. |

---

## 1. Make the Firebase project for sign-in (free, no card)

Firebase is Google's own sign-in service. Here it does one job only: it shows the "Continue with Google" window and proves who the person is. Everything else (posts, pictures, profiles) stays in your Cloudflare D1 and R2. You do **not** turn on Firestore, Storage, Hosting or anything else in Firebase.

**It costs nothing.** Stay on the free **Spark** plan and never add a billing account. Sign-in with Google has no per-login charge on Spark. If Firebase or Google ever offers to "Upgrade" (for example to *Identity Platform*), ignore it. You do not need it.

1. Go to **console.firebase.google.com** and sign in with the Google account that should own this.
2. Click **Create a project** (or **Add project**). Name it `eve-sandbox-community`. When it asks about Google Analytics, turn it **off**. Click **Create project**, then **Continue**.
3. In the left menu open **Build**, then **Authentication**, then click **Get started**.
4. Open the **Sign-in method** tab, choose **Google**, and switch **Enable** on.
   - **Public-facing name for project:** `Eve Sandbox` (this is the name people see on the Google window).
   - **Support email for project:** choose your email. Click **Save**.
5. Open **Authentication**, then **Settings**, then **Authorized domains**, then **Add domain**, and type `community.evesandbox.com`. (`localhost` and the `firebaseapp.com` address are already there. Leave them.)
6. Click the **gear** next to *Project Overview*, then **Project settings**, then the **General** tab. Scroll to **Your apps** and click the web icon `</>`. Nickname: `community`. Leave *Firebase Hosting* unticked. Click **Register app**.
7. Firebase shows a block starting with `const firebaseConfig = {`. Copy **three** values from it: `apiKey`, `projectId` and `appId`. (You do not need the others.)
8. Open `wrangler.jsonc` in a text editor and paste them between the quotes of `FIREBASE_API_KEY`, `FIREBASE_PROJECT_ID` and `FIREBASE_APP_ID`.

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
2. Click **Sign in**, press **Continue with Google**, choose your account, then choose a **display name** (2 to 30 letters) and a **username** (3 to 20 letters, numbers or underscores). The username becomes your profile address.
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
- Profile pages ask search engines not to list them.
- JPEG photos are redrawn in the visitor's browser before upload, which removes hidden details like where a photo was taken. Other formats are stored as they are.
- Limits per account (the server enforces them): one post every 30 seconds, one reply every 10 seconds, 15 posts and 30 MB of pictures per day, 200 replies per day.
- A signed-in person can only delete their own posts and replies. Scores and reply counts are recalculated from the votes and replies, so nobody can fake them.
- Signing in is checked by the server against Firebase's public keys (only Google accounts with a verified email are accepted), and the session is a signed, HttpOnly cookie. Firebase keeps nothing in the browser afterwards.

## What it costs and how far it goes

On Cloudflare's free plans (limits as I know them; check Cloudflare's pricing pages for current numbers): D1 gives about 5 million row reads and 100,000 row writes per day and 5 GB of data; R2 gives 10 GB of pictures and 1 million writes and 10 million reads per month; the Worker gives 100,000 requests per day (the website's own files do not count, only the sign-in, post, vote and picture requests). A full post of 4 pictures can be up to 20 MB, so 10 GB holds roughly 500 such posts, and many more typical ones. If you pass a limit the Community stops working until the allowance resets (or you upgrade); it does not charge a plan you never bought. You can see usage on the D1, R2 and Worker pages in the dashboard.

## If something goes wrong

| What you see | What to do |
|---|---|
| "The community is not open yet" | The three `FIREBASE_` values in `wrangler.jsonc` are empty. Fill them in on GitHub; it redeploys. |
| "still being set up" when signing in or posting | The `SESSION_SECRET` secret is missing or shorter than 32 characters (step 7). |
| The Google window does not open | The browser blocked the pop-up. Allow pop-ups for community.evesandbox.com and press the button again. If nothing changes, delete the `Content-Security-Policy` line from `public/_headers` on GitHub and tell me. |
| "This address is not allowed for sign-in yet" | Add `community.evesandbox.com` under Authentication, then Settings, then Authorized domains (step 1.5). |
| "Sign-in could not be checked" | One of the three Firebase values in `wrangler.jsonc` is wrong (most often `FIREBASE_PROJECT_ID`; it must be the project's ID, not its display name), or your computer's clock is wrong. |
| Google says the sign-in is disabled | Step 1.4: Google must be switched **Enable** in Authentication, Sign-in method. |
| Build fails in Cloudflare | The project name must be exactly `evesandbox-community`; `wrangler.jsonc` must be in the repo's top folder; the D1 ID and bucket name must exist. |
| Posts fail with a server error | D1 tables missing: run `schema.sql` again in the D1 Console (step 3.4). |
| Pictures do not show | The R2 bucket must be named `evesandbox-community-images`, exactly as in `wrangler.jsonc`. |
| The address will not attach | Delete an old `community` DNS record in Cloudflare and redeploy. |

## Honest limits

- **Tested here:** the whole Community running on Cloudflare's own local test engine (the same server runtime, a local D1 database and a local R2 bucket), with a stand-in for Firebase that signs sign-in tokens in Firebase's format. 206 checks on the server (forged and expired tokens, wrong Client ID, cheating attempts, the 5 MB and 3 MB limits to the byte, fake and SVG pictures, deleting a post removes its replies, votes and pictures, usernames, links, private liked posts, profile pages) and 103 checks in a real browser (sign-in, posting with pictures, voting, replies, sharing, admin delete, profile pages and editing, phone layout).
- **Not tested here:** the real Firebase sign-in window and Google screens (my workspace cannot reach Firebase), the real D1 and R2 services, and the actual Cloudflare deployment. I could not reach them from my workspace. Your first sign-in and first post are the real test. If something fails, send me the exact message.
- **Moderation is manual:** nobody reviews posts or pictures before they appear, and pictures are not scanned. You are responsible for what is posted, so read the reports and use delete and ban.
- **Spam:** only Google accounts can post and the limits above apply per account, but one person can make several Google accounts.
- **Search engines:** share links (`/p/...`) and profile pages (`/id/...`) tell search engines not to list them; the Community itself is a single page and is not indexed post by post.
- **Profile pictures are not scanned** and are cropped automatically (no manual crop screen). Animated GIFs are not accepted as profile pictures.
