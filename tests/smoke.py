"""Smoke test: starts server.py, boots the OS, opens every app on both displays,
then exercises real functionality. Run:  python3 tests/smoke.py [shots_dir]"""
import json, os, subprocess, sys, time, urllib.request
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8127
SHOTS = sys.argv[1] if len(sys.argv) > 1 else None
if SHOTS: os.makedirs(SHOTS, exist_ok=True)
for f in ('state.json',):
    try: os.remove(os.path.join(ROOT, 'data', f))
    except FileNotFoundError: pass
srv = subprocess.Popen([sys.executable, os.path.join(ROOT, "server.py"), "--port", str(PORT), "--quiet"], cwd=ROOT)
for _ in range(40):
    try: urllib.request.urlopen(f"http://127.0.0.1:{PORT}/api/ping", timeout=1); break
    except Exception: time.sleep(.15)

fails, errs = [], []
def check(name, ok, info=""):
    print(("PASS " if ok else "FAIL ") + name + (" " + str(info) if info and not ok else ""))
    if not ok: fails.append(name)

try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"])
        ctx = b.new_context(viewport={"width": 1280, "height": 900}, permissions=["camera", "microphone"])
        pg = ctx.new_page()
        pg.on("pageerror", lambda e: errs.append("PAGEERROR " + str(e)))
        pg.on("console", lambda m: errs.append(m.text) if m.type == "error" and "ERR_TUNNEL" not in m.text and "Failed to load resource" not in m.text else None)
        pg.goto(f"http://127.0.0.1:{PORT}/")
        pg.wait_for_timeout(1200)
        check("boot overlay shown", pg.evaluate("__duo.D.power.state") == "booting")
        pg.wait_for_timeout(3600)
        check("boot completes", pg.evaluate("__duo.D.power.state") == "on")
        check("starts locked", pg.evaluate("__duo.D.lock.get()") is True)
        pg.evaluate("__duo.D.lock.set(false)")
        check("backend detected", pg.evaluate("__duo.D.api.up") is True)
        apps = pg.evaluate("Object.keys(__duo.D.apps)")
        check("20 apps registered", len(apps) == 20, len(apps))

        # every app on both displays
        for si, kind in ((0, "inner"), (1, "cover")):
            for a in apps:
                pg.evaluate(f"(()=>{{const s=__duo.D.screens[{si}]; s.open('{a}')}})()")
                pg.wait_for_timeout(450)
                n = pg.evaluate(f"(()=>{{const s=__duo.D.screens[{si}]; return s.app && s.app.id==='{a}' ? s.app.body.querySelectorAll('*').length : -1}})()")
                check(f"{kind}: {a} opens", n > 8, n)
                if SHOTS and a in ("settings", "music", "weather", "terminal", "game") : pg.screenshot(path=f"{SHOTS}/{kind}-{a}.png")
                pg.evaluate(f"__duo.D.screens[{si}].close()"); pg.wait_for_timeout(250)

        S = lambda js: pg.evaluate(js)
        def open_app(a, si=0):
            S(f"__duo.D.screens[{si}].open('{a}')"); pg.wait_for_timeout(500)
        def body(si=0): return f"__duo.D.screens[{si}].app.body"

        # calculator
        open_app("calculator")
        for k in ["1", "2", "×", "3", "="]:
            pg.evaluate(f"""[...{body()}.querySelectorAll('button')].find(b=>b.textContent.trim()==='{k}').click()""")
        pg.wait_for_timeout(200)
        check("calculator 12×3=36", "36" in S(f"{body()}.textContent"))
        S("__duo.D.screens[0].close()")

        # state-level functional checks through the apps' own stores
        S("__duo.D.store.set('reminders',[{id:'r1',title:'t',due:Date.now()+1500,done:false,flag:false,ts:Date.now()}])")
        pg.wait_for_timeout(2600)
        check("reminder fires (notified)", S("__duo.D.store.get('reminders')[0].notified") is True)

        # messages bot
        open_app("messages"); pg.wait_for_timeout(300)
        pg.fill(f"input[aria-label='Message']", "/calc 6*7"); pg.press("input[aria-label='Message']", "Enter"); pg.wait_for_timeout(700)
        check("assistant computes", "42" in S("document.body.innerText") or any("42" in m["text"] for m in S("__duo.D.store.get('msg.assistant',[])")))
        pg.fill("input[aria-label='Message']", "/note buy milk"); pg.press("input[aria-label='Message']", "Enter"); pg.wait_for_timeout(700)
        check("assistant /note creates a note", any("buy milk" in n.get("text", "") for n in S("__duo.D.store.get('notes',[])")))
        S("__duo.D.screens[0].close()")

        # terminal + VFS
        open_app("terminal")
        for c in ["mkdir proj", "cd proj", "echo hello > a.txt", "cat a.txt"]:
            pg.fill("input[aria-label='Command']", c); pg.press("input[aria-label='Command']", "Enter"); pg.wait_for_timeout(120)
        check("terminal echo/cat", "hello" in S(f"{body()}.textContent"))
        check("VFS has file", S("__duo.D.fs.read('/proj/a.txt')") == "hello\n")
        pg.fill("input[aria-label='Command']", "sysinfo"); pg.press("input[aria-label='Command']", "Enter"); pg.wait_for_timeout(600)
        check("terminal sysinfo via Python", "python" in S(f"{body()}.textContent").lower())
        S("__duo.D.screens[0].close()")

        # server file API through the app code path
        r = S("""(async()=>{const D=__duo.D; await D.api.call('api/file?path=smoke/x.txt',{method:'PUT',body:'abc'}); const t=await D.api.call('api/file?path=smoke/x.txt'); await D.api.call('api/file?path=smoke',{method:'DELETE'}); return t})()""")
        check("server file roundtrip", r == "abc", r)

        # room chat via server
        r = S("""(async()=>{const D=__duo.D; await D.api.call('api/messages',{method:'POST',json:{from:'other',name:'Pal',text:'yo',cid:'z1'}}); await new Promise(r=>setTimeout(r,3300)); return D.store.get('msg.room',[]).some(m=>m.text==='yo')})()""")
        check("room receives server message", r is True)

        # 2048
        open_app("game")
        for k in ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"] * 3: pg.keyboard.press(k)
        check("2048 has tiles", S(f"{body()}.querySelectorAll('.g-tile').length") >= 2)
        S("__duo.D.screens[0].close()")

        # notes
        open_app("notes")
        pg.evaluate(f"[...{body()}.querySelectorAll('button')].find(b=>/new|compose|plus/i.test(b.getAttribute('aria-label')||''))?.click()")
        pg.wait_for_timeout(500)
        pg.keyboard.type("note from smoke test")
        pg.wait_for_timeout(500)
        check("notes saves typing", any("smoke test" in n.get("text", "") for n in S("__duo.D.store.get('notes',[])")))
        S("__duo.D.screens[0].close()")

        # camera -> photos
        open_app("camera"); pg.wait_for_timeout(1500)
        pg.click("button[aria-label='Take photo']"); pg.wait_for_timeout(1200)
        n = S("(async()=>(await __duo.D.photos.all()).length)()")
        check("camera captures to Photos (fake device)", n >= 1, n)
        S("__duo.D.screens[0].close()")

        # voice memo
        open_app("voicememos")
        pg.click("button[aria-label='Record']"); pg.wait_for_timeout(1500); pg.click("button[aria-label='Record']"); pg.wait_for_timeout(1000)
        n = S("(async()=>(await __duo.D.blobs.all('memos')).length)()")
        check("voice memo recorded", n >= 1, n)
        S("__duo.D.screens[0].close()")

        # music engine
        S("__duo.D.music.play('g1')"); pg.wait_for_timeout(1500)
        check("music plays", S("__duo.D.music.playing") is True and S("__duo.D.music.position()") > 0.5)
        S("__duo.D.music.pause()")

        # settings change applies
        S("__duo.D.settings.set({wallpaper:'ember'})")
        check("wallpaper applies", S("document.documentElement.dataset.wall") == "ember")

        # fold / unfold
        S("__duo.D.fold.set && __duo.setAngle(180)"); pg.wait_for_timeout(600)
        check("folds", S("__duo.D.fold.angle") > 170)
        open_app("calculator", 1); check("cover app works while folded", S("__duo.D.screens[1].app && __duo.D.screens[1].app.id") == "calculator")
        S("__duo.D.screens[1].close()"); S("__duo.setAngle(0)"); pg.wait_for_timeout(600)
        check("unfolds", S("__duo.D.fold.angle") < 5)

        # power
        S("__duo.D.power.off()"); check("power off", S("__duo.D.power.state") == "off")
        b.close()
finally:
    srv.terminate()

print("\nconsole/page errors:", json.dumps(errs, indent=1) if errs else "none")
print("FAILED:" if fails else "ALL PASSED", fails if fails else "")
sys.exit(1 if fails or errs else 0)
