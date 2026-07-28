"""
雪徑 SnowTrail — 每週報價頁面變動監控

做法：抓每間學校的公開報價頁面文字內容，跟上次抓到的雜湊值（hash）比對。
只要頁面文字內容跟上次不一樣，就代表「這頁可能改了」，寄信通知，
由人工判斷實際漲跌後，手動更新 compare-data.js（不做自動數字擷取，
因為 8 間學校版面都不同，自動擷取數字維護成本太高，詳見討論）。

執行方式：由 GitHub Actions 每週自動跑一次（見 .github/workflows/weekly-price-check.yml）。
狀態記錄：scraper/state.json（每次跑完會被 Actions 自動 commit 回 repo）。
"""

import hashlib
import json
import os
import re
import smtplib
import sys
from datetime import datetime, timezone
from email.mime.text import MIMEText
from pathlib import Path

import requests
from bs4 import BeautifulSoup

STATE_FILE = Path(__file__).parent / "state.json"

# SnowPlus 官網報價是 PDF 圖層文字，抓不到有意義的文字內容，故不列入監控（人工比對）
SCHOOLS = [
    {"key": "chase4snow", "name": "Chase4Snow 追雪", "url": "https://chaseforsnow.com/lessons-niseko-en/"},
    {"key": "snowman", "name": "Snowman 雪人", "url": "https://snowman-club.com/pricing/"},
    {"key": "snowandflow", "name": "SnowAndFlow 雪浪", "url": "https://www.snowandflow.com/lesson-en"},
    {"key": "pinnacle", "name": "Pinnacle", "url": "https://pinnacle-snow.com/private-ski-snowboard-lessons/"},
    {"key": "fuyu", "name": "Fuyu", "url": "https://www.fuyuski.co/en/courses"},
    {"key": "baddies", "name": "Baddies", "url": "https://www.thebaddiesxx.com/lesson-price"},
    {"key": "gosnow", "name": "GoSnow(Hirafu)", "url": "https://www.gosnowniseko.com/lessons/private-lessons"},
    {"key": "niss", "name": "Niss(Hanazono)", "url": "https://hanazononiseko.com/en/winter/ski-school/private"},
]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; SnowTrailPriceMonitor/1.0; "
    "+https://github.com/frank12w/niseko-price-compare)"
}


def fetch_text(url: str) -> str:
    """抓頁面，去掉 script/style/nav/footer 等雜訊，只留可見文字，並正規化空白。"""
    resp = requests.get(url, headers=HEADERS, timeout=20)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")
    for tag in soup(["script", "style", "noscript", "header", "footer", "nav"]):
        tag.decompose()
    text = soup.get_text(separator=" ")
    return re.sub(r"\s+", " ", text).strip()


def hash_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def load_state() -> dict:
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    return {}


def save_state(state: dict) -> None:
    STATE_FILE.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")


def send_email(changed: list, errors: list) -> None:
    smtp_server = os.environ["SMTP_SERVER"]
    smtp_port = int(os.environ.get("SMTP_PORT") or "587")
    smtp_username = os.environ["SMTP_USERNAME"]
    smtp_password = os.environ["SMTP_PASSWORD"]
    email_to = os.environ.get("EMAIL_TO", smtp_username)

    lines = ["以下學校的報價頁面內容有變動，請人工確認實際價格後更新比價網站：", ""]
    for item in changed:
        lines.append(f"- {item['name']}：{item['url']}")

    if errors:
        lines.append("")
        lines.append("以下學校這次抓取失敗（網站可能改版、暫時無法連線，或封鎖了爬蟲），建議自行檢查：")
        for item in errors:
            lines.append(f"- {item['name']}：{item['url']}（錯誤：{item['error']}）")

    body = "\n".join(lines)
    msg = MIMEText(body, "plain", "utf-8")
    msg["Subject"] = f"[雪徑 SnowTrail] 本週有 {len(changed)} 間學校報價頁面變動"
    msg["From"] = smtp_username
    msg["To"] = email_to

    with smtplib.SMTP(smtp_server, smtp_port) as server:
        server.starttls()
        server.login(smtp_username, smtp_password)
        server.sendmail(smtp_username, [email_to], msg.as_string())


def main() -> int:
    state = load_state()
    changed = []
    errors = []

    for school in SCHOOLS:
        key, name, url = school["key"], school["name"], school["url"]
        now_iso = datetime.now(timezone.utc).isoformat()

        try:
            new_hash = hash_text(fetch_text(url))
        except Exception as e:  # 單一學校失敗不能讓整個任務中斷
            print(f"[錯誤] {name} 抓取失敗：{e}")
            errors.append({"name": name, "url": url, "error": str(e)})
            continue

        prev = state.get(key)
        if prev is None:
            state[key] = {"url": url, "hash": new_hash, "last_checked_at": now_iso, "last_changed_at": None}
            print(f"[初次記錄] {name}（尚無比對基準，本次不寄信）")
        elif prev["hash"] != new_hash:
            state[key] = {"url": url, "hash": new_hash, "last_checked_at": now_iso, "last_changed_at": now_iso}
            changed.append({"name": name, "url": url})
            print(f"[偵測到變動] {name}")
        else:
            prev["last_checked_at"] = now_iso
            print(f"[無變動] {name}")

    save_state(state)

    if changed or errors:
        try:
            send_email(changed, errors)
            print("已寄出通知信")
        except Exception as e:
            print(f"[警告] 寄信失敗：{e}", file=sys.stderr)
            return 1
    else:
        print("本次無任何變動，不寄信")

    return 0


if __name__ == "__main__":
    sys.exit(main())
