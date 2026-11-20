"""Quick visual harness: python3 tests/shot.py <out.png> [angle] [wait_s] [js-to-run]"""
import sys, json
from playwright.sync_api import sync_playwright
out = sys.argv[1]; ang = float(sys.argv[2]) if len(sys.argv) > 2 else 0
wait = float(sys.argv[3]) if len(sys.argv) > 3 else 4.2
js = sys.argv[4] if len(sys.argv) > 4 else ""
errs = []
with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"])
    pg = b.new_page(viewport={"width": 1280, "height": 900}, device_scale_factor=1)
    pg.on("pageerror", lambda e: errs.append("PAGEERROR " + str(e)))
    pg.on("console", lambda m: errs.append(m.type + ": " + m.text) if m.type in ("error", "warning") else None)
    pg.goto("file:///home/claude/iphone-dou-ios27/index.html")
    pg.wait_for_timeout(int(wait * 1000))
    if js: pg.evaluate(js); pg.wait_for_timeout(1200)
    if ang: pg.evaluate(f"window.__duo.setAngle({ang})"); pg.wait_for_timeout(500)
    pg.screenshot(path=out)
    b.close()
print(json.dumps(errs, indent=1))
