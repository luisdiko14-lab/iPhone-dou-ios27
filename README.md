# iPhone Duo · DuoOS 27

A foldable "iPhone Duo" with a Liquid-Glass-style OS, built in plain HTML/CSS/JS plus an optional Python backend.

**Run it**

```bash
python3 server.py            # http://localhost:8027  (Python stdlib only)
```
…or just open `index.html` / host it on GitHub Pages. The OS works without the server; the server adds real file storage, cross-device state sync and a shared chat room.

## What's in it
- **Fold / unfold, no crease.** While open there is a single live display (the right half overscans over the hinge), so there is no seam. Folding runs a damped-spring hinge in CSS 3D (`F` key, button or slider).
- **Cover display works too.** Folded, the outer 376×836 screen is a second fully live screen with its own home pager, lock screen and apps.
- **Boot animation + lock screen** (`P` power key / button; restart & power off in Settings).
- **Six original wallpapers** (Aurora, Solstice, Lagoon, Orchid, Ember, Graphite) in an iOS-27 / Liquid Glass style. They are original artwork, not Apple's files. Glass tint, blur, brightness, accent, film grain in Settings.
- **Settings:** wallpaper, display & glass, fold physics presets, sounds/volume, device name, 24-hour, °C/°F, storage, server status, restart/power off, About.

## 20 working apps
Messages (local assistant bot + shared Room) · Browser · Camera · Music (live WebAudio generator + import your own audio) · Settings · Clock (world, alarms, stopwatch, timer) · Calendar · Weather · Notes · Reminders (with notifications) · Calculator (scientific) · Photos · Maps · Files (on-device + Python server storage) · Contacts (vCard import/export) · Voice Memos · Converter (incl. live currency) · Freeform (drawing) · Terminal (sandboxed shell over the file system) · 2048.

## Python backend (`server.py`)
`/api/ping`, `/api/state`, `/api/files|file|mkdir` (sandboxed to `./storage`), `/api/sysinfo`, `/api/messages`.
Binds to 127.0.0.1, checks Host/Origin, serves only `index.html`, `css/`, `js/`, `assets/`, caps body sizes and never executes anything.

## Tests
`python3 tests/smoke.py [screenshots_dir]` (needs Playwright) boots the OS, opens all 20 apps on both displays, and checks calculator, reminders, assistant, terminal, server file/chat APIs, 2048, notes, camera and voice memo (fake devices), music, settings, fold/unfold and power.

## Honest notes
- Weather, Maps, Browser and live currency need internet; they were not verified against live services in the build sandbox. Some sites refuse to load inside the Browser app's frame.
- Camera/microphone need https or localhost.
- Not affiliated with Apple.
