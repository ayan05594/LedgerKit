"""Read-only deployment smoke checks for LedgerKit.

Set LEDGERKIT_URL to a deployed URL, or leave it unset for localhost:4400.
This intentionally does not create or mutate financial data.
"""

import json
import os
import urllib.error
import urllib.parse
import urllib.request


BASE = os.environ.get("LEDGERKIT_URL", "http://localhost:4400").rstrip("/")
EXPECTED_CATALOG_VERSION = "india-2026-09-09-v6"


def get_json(path: str) -> dict:
    request = urllib.request.Request(
        BASE + path,
        headers={"Accept": "application/json", "User-Agent": "LedgerKit smoke test"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def check(label: str, condition: bool) -> None:
    if not condition:
        raise AssertionError(label)
    print(f"  ok   {label}")


print(f"Checking {BASE}")
health = get_json("/api/health")
check("health endpoint reports success", health.get("ok") is True)
check("database is connected", health.get("database") == "connected")
check("reference data is ready", health.get("referenceReady") is True)
check("card catalog is ready", health.get("catalogReady") is True)
check("card selection schema is ready", health.get("cardSelectionReady") is True)
check("private manual-card schema is ready", health.get("manualCardReady") is True)
check("Slice card is restored", health.get("sliceCardReady") is True)
check("Slice reward estimate is installed", health.get("sliceRewardsReady") is True)
check("tenant ownership schema is ready", health.get("ownershipReady") is True)
check(
    "expected catalog version is deployed",
    health.get("catalogVersion") == EXPECTED_CATALOG_VERSION,
)
check(
    "catalog contains selectable cards",
    health.get("counts", {}).get("catalogCards", 0) > 0,
)

opener = urllib.request.build_opener(urllib.request.HTTPRedirectHandler())
request = urllib.request.Request(
    BASE + "/",
    headers={"User-Agent": "LedgerKit smoke test"},
)
with opener.open(request, timeout=30) as response:
    final_path = urllib.parse.urlparse(response.geturl()).path
    check("signed-out visitors are sent to login", final_path == "/login")

print("Deployment smoke checks passed")
