"""Setup Assistant test: python3 tests/setup_test.py  (file:// is fine)"""
import os, sys
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
fails = []
def check(n, ok):
    print(("PASS " if ok else "FAIL ") + n); (not ok) and fails.append(n)
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 1280, "height": 900}); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto("file://" + ROOT + "/index.html"); pg.wait_for_timeout(4800)
    D = "__duo.D"; ev = lambda j: pg.evaluate(j)
    check("setup shows on first boot", ev("document.getElementById('device').dataset.setup") == "true")
    check("status bar says No SIM before cellular", "No SIM" in pg.inner_text("#uiR .sb"))
    box = pg.locator("#uiR .setup .sstep.hello").bounding_box(); x = box["x"] + box["width"] / 2; y = box["y"] + box["height"] / 2
    pg.mouse.move(x, y); pg.mouse.down(); pg.mouse.move(x, y - 50, steps=4); pg.mouse.move(x, y - 180, steps=4); pg.mouse.up(); pg.wait_for_timeout(700)
    check("swipe up starts setup", ev(D + ".store.get('setup.step')") == 1)
    pg.click("#uiR .setup .srow:has-text('Deutsch')"); pg.wait_for_timeout(300)
    check("language switches UI to German", "Sprache" in pg.inner_text("#uiR .setup h2"))
    for _ in range(2): pg.click("#uiR .setup .sbtn"); pg.wait_for_timeout(450)
    pg.click("#uiR .setup .sbtn"); pg.wait_for_timeout(2900)
    check("cellular connects (5G)", ev(D + ".net.get().cell.gen") == "5G" and ev(D + ".net.get().cell.on"))
    check("status bar shows 5G", "5G" in pg.inner_text("#uiR .sb"))
    pg.click("#uiR .setup .sbtn:not(.hide)"); pg.wait_for_timeout(500)
    pg.click("#uiR .setup .srow:has-text('Duo-Home')"); pg.fill("#uiR .setup input[type=password]", "short"); pg.keyboard.press("Enter"); pg.wait_for_timeout(200)
    check("short Wi-Fi password rejected", not ev(D + ".net.get().wifi.on"))
    pg.fill("#uiR .setup input[type=password]", "longenough1"); pg.keyboard.press("Enter"); pg.wait_for_timeout(2000)
    check("Wi-Fi joins", ev(D + ".net.get().wifi.ssid") == "Duo-Home")
    check("status bar shows Wi-Fi icon", pg.locator("#uiR .sb .wifi svg").count() == 1)
    for _ in range(2): pg.click("#uiR .setup .sfoot .sbtn"); pg.wait_for_timeout(450)
    pg.fill("#uiR .setup input[type=email]", "luis@example.com"); pg.fill("#uiR .setup input[type=password]", "x"); pg.keyboard.press("Enter"); pg.wait_for_timeout(1800)
    check("Banana ID saved, no password stored", ev(D + ".store.get('bid').email") == "luis@example.com" and "password" not in str(ev(D + ".store.snapshot()")).lower().replace("passw", ""))
    for _ in range(3): pg.click("#uiR .setup .sfoot .sbtn"); pg.wait_for_timeout(450)
    check("setup finishes", ev(D + ".setup.done()") is True and ev("document.getElementById('device').dataset.setup") == "false")
    check("still locked afterwards", ev(D + ".lock.get()") is True)
    pg.reload(); pg.wait_for_timeout(4800)
    check("setup does not return after reload", ev("document.getElementById('device').dataset.setup") == "false")
    check("5G + Wi-Fi persist", "5G" in pg.inner_text("#uiR .sb") and pg.locator("#uiR .sb .wifi svg").count() == 1)
    print("errors:", errs or "none"); b.close()
sys.exit(1 if fails or errs else 0)
