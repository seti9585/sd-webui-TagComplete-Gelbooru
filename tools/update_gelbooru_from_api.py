#!/usr/bin/env python3
"""Refresh the Gelbooru autocomplete dictionary using Gelbooru's own API."""

import argparse
import csv
import datetime as dt
import html
import json
import os
import sqlite3
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TARGET = ROOT / "tags" / "gelbooru.csv"
STATE = ROOT / "tools" / ".gelbooru_update.sqlite3"
STAMP = ROOT / "tags" / "gelbooru_update.json"
API = "https://gelbooru.com/index.php"
INITIAL_DATE = dt.date(2026, 6, 11)


def request_page(after_id, user_id, api_key, delay):
    params = {"page": "dapi", "s": "tag", "q": "index", "json": "1",
              "limit": "100", "after_id": str(after_id)}
    if user_id and api_key:
        params.update(user_id=user_id, api_key=api_key)
    url = API + "?" + urllib.parse.urlencode(params)
    for attempt in range(6):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": "TAC-Gelbooru-Update/1.0"})
            with urllib.request.urlopen(request, timeout=45) as response:
                value = json.load(response)
            if isinstance(value, dict):
                value = value.get("tag", value.get("tags"))
            if isinstance(value, dict):
                value = [value]
            if not isinstance(value, list):
                raise ValueError("Unexpected API response structure")
            time.sleep(delay)
            return value
        except (urllib.error.URLError, TimeoutError, ValueError, OSError) as exc:
            if attempt == 5:
                raise RuntimeError("API request failed after retries") from exc
            wait = min(90, max(delay, 2) * (2 ** attempt))
            print(f"Request failed; retry in {wait:.0f}s: {type(exc).__name__}", file=sys.stderr)
            time.sleep(wait)


def normalize(entry):
    if not isinstance(entry, dict):
        raise ValueError("Tag entry is not an object")
    tag_id = int(entry["id"])
    name = html.unescape(str(entry["name"]))
    category = int(entry.get("type", entry.get("category", 0)))
    count = int(entry.get("count", entry.get("post_count", 0)))
    if tag_id < 1 or category < 0 or count < 0 or not name or "\n" in name or "\r" in name:
        raise ValueError("Invalid tag entry")
    return tag_id, name, category, count


def main():
    parser = argparse.ArgumentParser(description="Update Gelbooru tags from the official API")
    parser.add_argument("--days", type=int, default=90, help="Refresh interval (default: 90)")
    parser.add_argument("--min-count", type=int, default=20, help="Minimum post count")
    parser.add_argument("--delay", type=float, default=0.5, help="Seconds between requests")
    parser.add_argument("--force", action="store_true", help="Refresh even if the dictionary is recent")
    parser.add_argument("--status", action="store_true", help="Only report age; do not contact Gelbooru")
    args = parser.parse_args()
    if args.days < 0 or args.min_count < 0 or args.delay < 0.2:
        parser.error("days and min-count must be nonnegative; delay must be >= 0.2")
    today = dt.datetime.now(dt.timezone.utc).date()
    try:
        stamp = json.loads(STAMP.read_text(encoding="utf-8"))
        last = dt.date.fromisoformat(stamp["completed_utc"])
    except (OSError, ValueError, KeyError, TypeError):
        last = INITIAL_DATE
    age = (today - last).days
    print(f"Gelbooru dictionary: {age} days old; interval: {args.days} days")
    if args.status or (age < args.days and not args.force and not STATE.exists()):
        return 0
    user_id = os.environ.get("GELBOORU_USER_ID", "")
    api_key = os.environ.get("GELBOORU_API_KEY", "")
    if bool(user_id) != bool(api_key):
        parser.error("Set both GELBOORU_USER_ID and GELBOORU_API_KEY, or neither")
    STATE.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(STATE)
    try:
        connection.execute("CREATE TABLE IF NOT EXISTS tags (id INTEGER PRIMARY KEY, name TEXT NOT NULL, category INTEGER NOT NULL, count INTEGER NOT NULL)")
        connection.execute("CREATE TABLE IF NOT EXISTS progress (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
        previous = connection.execute("SELECT value FROM progress WHERE key='after_id'").fetchone()
        cursor = int(previous[0]) if previous else 0
        while True:
            page = request_page(cursor, user_id, api_key, args.delay)
            if not page:
                break
            rows = [normalize(item) for item in page]
            next_id = max(row[0] for row in rows)
            if next_id <= cursor:
                raise ValueError("API pagination did not advance; existing dictionary preserved")
            with connection:
                connection.executemany("INSERT OR REPLACE INTO tags VALUES (?, ?, ?, ?)", rows)
                connection.execute("INSERT OR REPLACE INTO progress VALUES ('after_id', ?)", (str(next_id),))
            cursor = next_id
            if cursor % 10000 < 100:
                print(f"Fetched through tag ID {cursor}", flush=True)
        total = connection.execute("SELECT COUNT(*) FROM tags").fetchone()[0]
        if total < 100000:
            raise ValueError(f"Only {total} tags fetched; existing dictionary preserved")
        output = TARGET.with_suffix(".csv.pending")
        with output.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.writer(handle, lineterminator="\n")
            for name, category, count in connection.execute(
                "SELECT name, category, count FROM tags WHERE count >= ? AND category != 6 ORDER BY count DESC, name",
                (args.min_count,),
            ):
                writer.writerow((name, category, count, ""))
        if output.stat().st_size < 1000000:
            raise ValueError("Result is too small; existing dictionary preserved")
        output.replace(TARGET)
        STAMP.write_text(json.dumps({"completed_utc": today.isoformat(), "source": API,
                                    "total_fetched": total, "minimum_count": args.min_count}, indent=2) + "\n", encoding="utf-8")
        print(f"Updated {TARGET} from Gelbooru API ({total} source tags). Reload WebUI to use it.")
    except (OSError, ValueError, RuntimeError, sqlite3.Error) as exc:
        print(f"Update paused: {exc}. Run the same command to resume; the previous dictionary remains available.", file=sys.stderr)
        return 1
    finally:
        connection.close()
    try:
        STATE.unlink()
    except OSError:
        pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
