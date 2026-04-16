# Seven Mynd — A2 + A3 + B1 Delivery

This zip contains every modified and new file for batches A2 (responsive layout
audit), A3 (loading / empty / error states), and B1 (real Picovoice wake word).

Total: **22 files** — 4 new, 18 modified, 1 DB migration.

## How to upload to GitHub (no Terminal needed)

You are going to drag these files into GitHub's web interface, and each folder
inside this zip mirrors exactly where the file lives in your repo.

### Step 1 — Open your repo on github.com

1. Go to `github.com/<your-username>/mind-weave-ledger`.
2. Click the **`develop`** branch selector (top-left of the file list).
   **Important:** the charter says all work goes on `develop`, never `main`.
3. If `develop` does not exist yet, click the branch selector, type `develop`,
   and press Enter — GitHub will create it from `main`.

### Step 2 — Upload files

GitHub's web uploader handles folders via drag-and-drop. The cleanest workflow:

1. **Extract the zip** on your Mac by double-clicking it. You'll get a folder
   called `seven-mynd-batches-1-to-5`.
2. Inside that folder you'll see exactly this structure:

   ```
   index.html
   src/
     App.tsx
     index.css
     components/
       BottomNav.tsx
       ChatInput.tsx
       PageError.tsx
       PageSkeletons.tsx
       TopNav.tsx
       TypewriterBubble.tsx
       WakeWordNavigator.tsx
     contexts/
       AlwaysListeningContext.tsx
     pages/
       Digest.tsx
       Home.tsx
       Library.tsx
       Memory.tsx
       Profile.tsx
       Reviews.tsx
       Settings.tsx
       Trace.tsx
       Vault.tsx
     services/
       wake-word/
         PorcupineWakeWordService.ts
   supabase/
     migrations/
       20260416000000_always_listening_pref.sql
   ```

3. On GitHub, make sure you're on the `develop` branch. Click **Add file →
   Upload files**.
4. Open Finder to the extracted `seven-mynd-batches-1-to-5` folder. Select the
   `index.html` file AND the `src` folder AND the `supabase` folder (hold ⌘ to
   multi-select). Drag them all onto the GitHub upload area.
5. GitHub will preserve the folder structure. You'll see each file listed in
   its correct path (e.g. `src/components/BottomNav.tsx`).
6. In the **commit message** field at the bottom, paste:

   ```
   A2 + A3 + B1: responsive audit, page states, Picovoice wake word
   ```

7. Leave **"Commit directly to the `develop` branch"** selected.
8. Click the green **Commit changes** button.

### Step 3 — Install the two new npm packages

Picovoice's Porcupine SDK is not yet in your `package.json`. You need to add
two packages. Use Lovable's built-in dependency manager, or ask your dev
helper to run this in Terminal:

```
pnpm add @picovoice/porcupine-web@^3.0.5 @picovoice/web-voice-processor@^4.0.10
```

If Lovable handles dependencies for you automatically, you can instead open
`package.json` in GitHub's web editor, and inside the `"dependencies"` block
add these two lines (alphabetically sorted near `@radix-ui`):

```json
    "@picovoice/porcupine-web": "^3.0.5",
    "@picovoice/web-voice-processor": "^4.0.10",
```

Commit that change to `develop` as well. Lovable / Vercel will run
`pnpm install` automatically on the next deploy.

### Step 4 — Run the database migration

The migration file at `supabase/migrations/20260416000000_always_listening_pref.sql`
adds one new column (`always_listening_enabled`) to the `user_preferences`
table. You must run it in Supabase BEFORE the new `Settings.tsx` code
deploys, otherwise the Always Listening toggle won't persist.

1. Go to your Supabase dashboard → **SQL Editor**.
2. Click **New query**.
3. Open the file `supabase/migrations/20260416000000_always_listening_pref.sql`
   from the extracted zip folder (any text editor — TextEdit is fine). Copy
   its entire contents.
4. Paste into the Supabase SQL Editor.
5. Click **Run** (bottom-right).
6. You should see a green success message. The migration is idempotent — it's
   safe to run multiple times.

### Step 5 — Verify on Vercel preview

1. Wait ~60 seconds after committing. Vercel auto-deploys the `develop`
   branch to a preview URL.
2. Go to your Vercel dashboard → pick the Seven Mynd project → find the latest
   deployment for `develop` → click **Visit**.
3. Walk through this quick checklist:
   - [ ] Sign in. Home page loads.
   - [ ] Bottom nav is exactly 56px tall, tabs feel tappable (min 44×44).
   - [ ] Reviews page shows skeletons on first load, then content or the
         updated empty-state text.
   - [ ] Vault page skeletons → content or empty state.
   - [ ] Library, Trace, Digest, Memory pages all load with skeletons.
   - [ ] Settings → Live & Voice → "Always Listening" toggle exists (no
         "coming soon" text on the Wake Word row either).
   - [ ] Toggle Always Listening ON. Your browser should prompt for mic
         access. Grant it. Toggle description should change to
         `Active — wake word: "Hey Seven"`.
   - [ ] Say "Hey Seven". You should be redirected to the Live page.
   - [ ] If you denied the mic, an error banner appears below the toggle
         explaining what happened.

### Step 6 — Promote to production

Once the checklist above is green on the `develop` preview:

1. On GitHub, click **Pull requests → New pull request**.
2. Base: `main`. Compare: `develop`.
3. Title: `A2 + A3 + B1: responsive audit, page states, Picovoice wake word`.
4. Click **Create pull request**, then **Merge pull request**, then
   **Confirm merge**.
5. Vercel auto-deploys `main` to production (`sevenmynd.com`).

## What changed vs. the previous codebase

### 4 new files
- `src/components/PageError.tsx`
- `src/components/PageSkeletons.tsx`
- `src/components/WakeWordNavigator.tsx`
- `src/services/wake-word/PorcupineWakeWordService.ts`

### 18 modified files
- `index.html` — viewport meta (user-scalable=no, maximum-scale=1)
- `src/index.css` — `overflow-x: hidden` on html and body
- `src/App.tsx` — wires `<WakeWordNavigator />` inside the provider tree
- `src/components/BottomNav.tsx` — h-14 (56px), 44×44 touch targets, aria
- `src/components/TopNav.tsx` — 44×44 touch targets, aria
- `src/components/ChatInput.tsx` — 44×44 buttons, `max-w-[780px]`, aria
- `src/components/TypewriterBubble.tsx` — responsive widths
  (85%/75%/65%)
- `src/contexts/AlwaysListeningContext.tsx` — real Porcupine service, lazy
  import, pause on Live, error exposure, detection timestamp
- `src/pages/Home.tsx` — safe-area padding, `max-w-[780px]`, responsive user
  bubbles, 44px suggestion chips, larger scroll-to-bottom button
- `src/pages/Reviews.tsx` — skeleton, error, new empty state, flex-wrap +
  44px outcome buttons
- `src/pages/Vault.tsx` — skeleton, error, new empty state, 44px filter
  chips + edit/delete buttons, `max-w-[780px]`
- `src/pages/Library.tsx` — skeleton, error, new empty state with
  [New Section] button, `max-w-[780px]`
- `src/pages/Trace.tsx` — skeleton, error, safe-area, `max-w-[780px]`
- `src/pages/Digest.tsx` — skeleton, error, new empty state,
  `max-w-[780px]`
- `src/pages/Memory.tsx` — skeleton, error, new empty state,
  `max-w-[780px]`
- `src/pages/Profile.tsx` — safe-area, `max-w-[780px]`, aria
- `src/pages/Settings.tsx` — real Always Listening toggle, error banner,
  fallback notice, persistence to `user_preferences`

### 1 database migration
- `supabase/migrations/20260416000000_always_listening_pref.sql` — adds
  `always_listening_enabled` column to `user_preferences`.

## Notes for the engineering chat or Lovable

- The Porcupine SDK is loaded via `import("@picovoice/porcupine-web")` inside
  the context's lifecycle effect. The ~3.5MB WASM bundle lands in a separate
  chunk — the main bundle stays under budget (Architecture §19.6).
- The microphone is never requested on page load. Only when the user
  explicitly toggles Always Listening ON in Settings.
- If the custom `Hey-Seven_en_wasm_v4_0_0.ppn` file fails to load (network
  error, wrong filename, etc.), the service falls back to the built-in
  "Computer" keyword automatically. Settings surfaces this with a "Running
  with built-in 'Computer'…" notice so you know.
- Wake word detection automatically pauses when Live voice mode is active
  (to avoid fighting over the microphone) and resumes when Live ends.
- All touch targets are minimum 44×44 — iOS HIG and Material Design both
  specify this as the minimum tap target size.
