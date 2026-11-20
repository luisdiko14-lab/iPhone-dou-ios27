# iPhone Duo · DuoOS 27

A foldable "iPhone Duo" with a Liquid-Glass-style OS, built in plain HTML/CSS/JS plus an optional Python backend.

**Run it**

```bash
python3 server.py            # http://localhost:8080  (Python stdlib only)
```
…or just open `index.html` / host it on GitHub Pages. The OS works without the server; the server adds real file storage, cross-device state sync and a shared chat room.

## What's in it
- **Fold / unfold, no crease.** While open there is a single live display (the right half overscans over the hinge), so there is no seam. Folding runs a damped-spring hinge in CSS 3D (`F` key, button or slider).
- **Cover display works too.** Folded, the outer 376×836 screen is a second fully live screen with its own home pager, lock screen and apps.
- **Boot animation + lock screen** (`P` power key / button; restart & power off in Settings).
- **Six original wallpapers** (Aurora, Solstice, Lagoon, Orchid, Ember, Graphite) in an iOS-27 / Liquid Glass style. They are original artwork, not Apple's files. Glass tint, blur, brightness, accent, film grain in Settings.
- **Setup Assistant (first run):** Hello (swipe up or tap) → language (English, Deutsch, Shqip, Español, Français and more; the setup screens are translated for the first five) → region → **cellular** ("Free WiFi 5G" connecting animation) → **Wi-Fi** (pick a network, type a password) → privacy → **Banana ID** (a fictional account that lives only on the device; no password is stored) → terms → personalise → welcome. The status bar shows **5G** and a **Wi-Fi** icon once connected ("No SIM" before). Cellular, Wi-Fi, Banana ID and Language can be changed later in Settings, and Settings › General can run setup again. Cellular and Wi-Fi are simulated; online apps use your real connection. Add `?setup=skip` to the URL to skip it.
- **Settings:** wallpaper, display & glass, fold physics presets, sounds/volume, device name, 24-hour, °C/°F, storage, server status, restart/power off, About.

## 20 working apps
Messages (local assistant bot + shared Room) · Browser · Camera · Music (live WebAudio generator + import your own audio) · Settings · Clock (world, alarms, stopwatch, timer) · Calendar · Weather · Notes · Reminders (with notifications) · Calculator (scientific) · Photos · Maps · Files (on-device + Python server storage) · Contacts (vCard import/export) · Voice Memos · Converter (incl. live currency) · Freeform (drawing) · Terminal (sandboxed shell over the file system) · 2048.

## Python backend (`server.py`)
`/api/ping`, `/api/state`, `/api/files|file|mkdir` (sandboxed to `./storage`), `/api/sysinfo`, `/api/messages`.
Binds to 127.0.0.1, checks Host/Origin, serves only `index.html`, `css/`, `js/`, `assets/`, caps body sizes and never executes anything.

## Tests
`python3 tests/setup_test.py` (the first-run flow) and `python3 tests/smoke.py [screenshots_dir]` (both need Playwright) boots the OS, opens all 20 apps on both displays, and checks calculator, reminders, assistant, terminal, server file/chat APIs, 2048, notes, camera and voice memo (fake devices), music, settings, fold/unfold and power.

## Honest notes
- Weather, Maps, Browser and live currency need internet; they were not verified against live services in the build sandbox. Some sites refuse to load inside the Browser app's frame.
- Camera/microphone need https or localhost.
- Not affiliated with Apple.

## Public tunnel / GitHub Pages
The repo's workflows (`static.yml`, `cloudflare-tunnel.yml`) are kept. The tunnel runs `python server.py` on port 8080; requests coming through it get the OS only, and the file/state/chat API is disabled for them, so a public link can't read or write your storage. On GitHub Pages the OS runs fully standalone.
