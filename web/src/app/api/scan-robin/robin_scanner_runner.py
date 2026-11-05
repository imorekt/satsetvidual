#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Backend RobinScan Harvester Runner (Memory-Only, No target.txt writes)
Mirrors D:\\SEMUABOT\\NEWBOT\\deploy\\robin\\scanner.py
"""

import os
import sys
import json
import time
import re
from pathlib import Path
from typing import List, Tuple, Optional
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from bs4 import BeautifulSoup

BURN_ADDRESS = "0x0000000000000000000000000000000000000000"
SESSION_CACHE_FILE = Path(__file__).resolve().parent / ".robinscan_session.json"

DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://robin.etherscan.io/"
}


def is_valid_evm_address(addr: str) -> bool:
    if not isinstance(addr, str):
        return False
    clean = addr.strip().lower()
    if not (clean.startswith("0x") and len(clean) == 42):
        return False
    if clean == BURN_ADDRESS:
        return False
    try:
        int(clean, 16)
        return True
    except ValueError:
        return False


class RobinSessionManager:
    """Mengelola sesi requests dengan caching cookie lokal & auto-init seperti scanner.py."""
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update(DEFAULT_HEADERS)
        self.user_agent = DEFAULT_HEADERS["User-Agent"]
        self._setup_adapter()
        self._load_cached_session()

    def _setup_adapter(self):
        adapter = HTTPAdapter(
            pool_connections=35,
            pool_maxsize=35,
            max_retries=Retry(total=2, backoff_factor=0.3, status_forcelist=[500, 502, 503, 504])
        )
        self.session.mount("https://", adapter)
        self.session.mount("http://", adapter)

    def _load_cached_session(self):
        if SESSION_CACHE_FILE.exists():
            try:
                data = json.loads(SESSION_CACHE_FILE.read_text(encoding="utf-8"))
                ua = data.get("user_agent")
                cookies = data.get("cookies", {})
                if ua:
                    self.user_agent = ua
                    self.session.headers["User-Agent"] = ua
                for k, v in cookies.items():
                    self.session.cookies.set(k, v)
            except Exception:
                pass

    def _save_cached_session(self):
        try:
            cookies_dict = {c.name: c.value for c in self.session.cookies}
            SESSION_CACHE_FILE.write_text(
                json.dumps({"user_agent": self.user_agent, "cookies": cookies_dict, "ts": time.time()}),
                encoding="utf-8"
            )
        except Exception:
            pass

    def init_session(self, test_addr: str = "0x3d90f66B534Dd8482b181e24655A9e8265316BE9", endpoint_path: str = "txs") -> bool:
        test_url = f"https://robin.etherscan.io/{endpoint_path}?a={test_addr}&p=1"
        try:
            r = self.session.get(test_url, timeout=5)
            if r.status_code == 200 and "Just a moment..." not in r.text and "<table" in r.text:
                return True
        except Exception:
            pass
        return False


def extract_address_from_td(td, exclude_addr: str = "") -> Optional[str]:
    if not td:
        return None
    exclude_lower = exclude_addr.lower() if exclude_addr else ""

    a_tag = td.find("a")
    if a_tag:
        for attr in ("data-clipboard-text", "data-address", "data-highlight-target"):
            val = a_tag.get(attr)
            if val and is_valid_evm_address(val) and val.lower() != exclude_lower:
                return val.lower()

        href = a_tag.get("href")
        if href:
            m = re.search(r"/address/(0x[a-fA-F0-9]{40})", href)
            if m:
                cand = m.group(1).lower()
                if is_valid_evm_address(cand) and cand != exclude_lower:
                    return cand

    for attr in ("data-clipboard-text", "data-address", "data-highlight-target"):
        val = td.get(attr)
        if val and is_valid_evm_address(val) and val.lower() != exclude_lower:
            return val.lower()

    for elem in td.find_all(True):
        for attr in ("data-clipboard-text", "data-address", "data-highlight-target"):
            val = elem.get(attr)
            if val and is_valid_evm_address(val) and val.lower() != exclude_lower:
                return val.lower()

    text = td.get_text()
    for cand in re.findall(r"0x[a-fA-F0-9]{40}", text):
        cand_lower = cand.lower()
        if is_valid_evm_address(cand_lower) and cand_lower != exclude_lower:
            return cand_lower

    return None


def extract_row_from_and_to(tr, exclude_ca: str = "") -> Tuple[Optional[str], Optional[str]]:
    tds = tr.find_all("td")
    if not tds or len(tds) < 5:
        return None, None

    in_out_idx = None
    for i, td in enumerate(tds):
        badge = td.find("span", class_=lambda c: c and "badge" in c)
        if badge and badge.get_text(strip=True) in ("IN", "OUT"):
            in_out_idx = i
            break

    from_addr = None
    to_addr = None

    if in_out_idx is not None:
        if in_out_idx > 0:
            from_addr = extract_address_from_td(tds[in_out_idx - 1], exclude_ca)
        if in_out_idx + 1 < len(tds):
            to_addr = extract_address_from_td(tds[in_out_idx + 1], exclude_ca)
        return from_addr, to_addr

    for td in tds:
        if td.find("i", id=lambda x: x and x.startswith("linkIcon_f")):
            from_addr = extract_address_from_td(td, exclude_ca)
        elif td.find("i", id=lambda x: x and x.startswith("linkIcon_t")):
            to_addr = extract_address_from_td(td, exclude_ca)

    if from_addr or to_addr:
        return from_addr, to_addr

    if len(tds) > 8:
        from_addr = extract_address_from_td(tds[8], exclude_ca)
    if len(tds) > 10:
        to_addr = extract_address_from_td(tds[10], exclude_ca)

    return from_addr, to_addr


def extract_row_age_seconds(tr, current_time: Optional[float] = None) -> Optional[float]:
    if current_time is None:
        current_time = time.time()

    td_local = tr.find("td", class_="showLocalDate")
    if td_local:
        text = td_local.get_text(strip=True)
        if text.isdigit() and len(text) >= 9:
            tx_ts = int(text)
            return max(0.0, current_time - tx_ts)

    td_date = tr.find("td", class_="showDate")
    if td_date:
        text = td_date.get_text(strip=True)
        m = re.search(r"(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})", text)
        if m:
            try:
                dt = datetime.strptime(m.group(1), "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
                return max(0.0, current_time - dt.timestamp())
            except Exception:
                pass

    td_age = tr.find("td", class_="showAge")
    if td_age:
        text = td_age.get_text(strip=True).lower()
        m = re.search(r"(\d+)\s*(sec|min|hr|hour|day)", text)
        if m:
            val = int(m.group(1))
            unit = m.group(2)
            if unit.startswith("sec"):
                return float(val)
            elif unit.startswith("min"):
                return float(val * 60)
            elif unit.startswith("hr") or unit.startswith("hour"):
                return float(val * 3600)
            elif unit.startswith("day"):
                return float(val * 86400)

    for span in tr.find_all("span", attrs={"data-bs-title": True}):
        title = span["data-bs-title"].lower()
        m = re.search(r"(\d+)\s*(sec|min|hr|hour|day)", title)
        if m:
            val = int(m.group(1))
            unit = m.group(2)
            if unit.startswith("sec"):
                return float(val)
            elif unit.startswith("min"):
                return float(val * 60)
            elif unit.startswith("hr") or unit.startswith("hour"):
                return float(val * 3600)
            elif unit.startswith("day"):
                return float(val * 86400)

    return None


def parse_addresses_from_html(
    html_text: str,
    target_ca: str,
    mode: str,
    max_age_seconds: Optional[float] = None
) -> Tuple[List[str], int, bool, bool]:
    lower_html = html_text.lower()
    if "there are no matching entries" in lower_html or "no matching entries" in lower_html:
        return [], 0, True, False

    soup = BeautifulSoup(html_text, "html.parser")
    table = soup.find("table")
    if not table:
        return [], 0, True, False

    rows = table.find_all("tr")
    if len(rows) <= 1:
        return [], 0, True, False

    extracted_addresses = []
    valid_row_count = 0
    reached_time_limit = False
    current_time = time.time()

    for tr in rows[1:]:
        tds = tr.find_all("td")
        if not tds:
            continue

        if max_age_seconds is not None:
            age_sec = extract_row_age_seconds(tr, current_time=current_time)
            if age_sec is not None and age_sec > max_age_seconds:
                reached_time_limit = True
                break

        from_addr, to_addr = extract_row_from_and_to(tr, exclude_ca=target_ca)
        valid_row_count += 1

        selected_addr = None
        if mode in ("transaction", "token_transfer_from"):
            selected_addr = from_addr
        elif mode == "token_transfer_to":
            selected_addr = to_addr

        if selected_addr:
            extracted_addresses.append(selected_addr)

    is_last_from_pagination = False
    m_page = re.search(r"Page\s+(\d+)\s+of\s+(\d+)", html_text, re.IGNORECASE)
    if m_page:
        curr_p = int(m_page.group(1))
        total_p = int(m_page.group(2))
        if curr_p >= total_p:
            is_last_from_pagination = True

    is_last = (valid_row_count == 0) or is_last_from_pagination or reached_time_limit
    return extracted_addresses, valid_row_count, is_last, reached_time_limit


ROBIN_RPC_ENDPOINTS = [
    "https://rpc.mainnet.chain.robinhood.com",
    "https://robinhood.drpc.org"
]


def fetch_from_robin_rpc(
    target_ca: str,
    page_num: int,
    mode: str = "transaction",
    max_age_seconds: Optional[float] = None
) -> Tuple[List[str], int, bool, bool]:
    """Fallback cepat & stabil ke Robinhood EVM RPC jika Etherscan terhalang Cloudflare/403."""
    def rpc_call(method: str, params: list, timeout: int = 6):
        for url in ROBIN_RPC_ENDPOINTS:
            try:
                r = requests.post(url, json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params}, timeout=timeout)
                if r.status_code == 200:
                    data = r.json()
                    if "result" in data:
                        return data["result"]
            except Exception:
                continue
        return None

    try:
        latest_hex = rpc_call("eth_blockNumber", [], timeout=5)
        if not latest_hex:
            return [], 0, True, False
        latest_block = int(latest_hex, 16)

        chunk_span = 300000
        end_block = max(0, latest_block - (chunk_span * (page_num - 1)))
        start_block = max(0, end_block - chunk_span)
        if end_block <= 0:
            return [], 0, True, False

        sig_transfer = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
        is_token_mode = "token_transfer" in mode
        topics = [sig_transfer] if is_token_mode else []

        logs = rpc_call("eth_getLogs", [{
            "address": target_ca,
            "fromBlock": hex(start_block),
            "toBlock": hex(end_block),
            "topics": topics
        }], timeout=8)

        if not logs or not isinstance(logs, list):
            return [], 0, True, False

        if is_token_mode:
            addrs = []
            topic_idx = 2 if mode == "token_transfer_to" else 1
            for l in logs[:50]:
                top = l.get("topics", [])
                if len(top) > topic_idx:
                    raw = top[topic_idx]
                    if len(raw) >= 66:
                        cand = "0x" + raw[26:].lower()
                        if is_valid_evm_address(cand) and cand != target_ca.lower():
                            addrs.append(cand)
            return addrs, len(logs), len(logs) < 50, False
        else:
            tx_hashes = list(dict.fromkeys([l["transactionHash"] for l in logs if "transactionHash" in l]))[:50]
            if not tx_hashes:
                return [], 0, True, False

            batch_payload = [{"jsonrpc": "2.0", "id": i, "method": "eth_getTransactionByHash", "params": [h]} for i, h in enumerate(tx_hashes)]
            tx_results = None
            for url in ROBIN_RPC_ENDPOINTS:
                try:
                    r = requests.post(url, json=batch_payload, timeout=8)
                    if r.status_code == 200:
                        tx_results = r.json()
                        if isinstance(tx_results, list):
                            break
                except Exception:
                    continue

            addrs = []
            if isinstance(tx_results, list):
                for item in tx_results:
                    t = item.get("result")
                    if t and t.get("from"):
                        cand = str(t["from"]).lower()
                        if is_valid_evm_address(cand) and cand != target_ca.lower():
                            addrs.append(cand)
            return addrs, len(tx_hashes), len(tx_hashes) < 50, False
    except Exception:
        return [], 0, True, False


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Missing payload"}))
        sys.exit(1)

    payload = json.loads(sys.argv[1])
    target_address = str(payload.get("targetAddress", "")).strip().lower()
    pages_to_fetch = payload.get("pages", [1])
    mode = str(payload.get("mode", "transaction")).strip()
    max_age_seconds = payload.get("maxAgeSeconds", None)
    if max_age_seconds is not None:
        max_age_seconds = float(max_age_seconds)

    endpoint = "tokentxns" if "token_transfer" in mode else "txs"
    session_mgr = RobinSessionManager()

    results = []

    def fetch_and_parse_worker(page_num: int):
        url = f"https://robin.etherscan.io/{endpoint}?a={target_address}&p={page_num}"
        try:
            resp = session_mgr.session.get(url, timeout=5)
            if resp.status_code == 200 and "Just a moment..." not in resp.text and "<table" in resp.text:
                addrs, row_count, is_last, reached_time = parse_addresses_from_html(
                    resp.text, target_address, mode=mode, max_age_seconds=max_age_seconds
                )
                return {
                    "page": page_num,
                    "addresses": addrs,
                    "rowCount": row_count,
                    "isLastPage": is_last,
                    "reachedTimeLimit": reached_time,
                    "error": None
                }
        except Exception:
            pass

        # RPC Fallback otomatis & cepat jika web explorer terhalang Cloudflare
        addrs, row_count, is_last, reached_time = fetch_from_robin_rpc(
            target_address, page_num, mode=mode, max_age_seconds=max_age_seconds
        )
        return {
            "page": page_num,
            "addresses": addrs,
            "rowCount": row_count,
            "isLastPage": is_last,
            "reachedTimeLimit": reached_time,
            "error": None
        }

    with ThreadPoolExecutor(max_workers=min(len(pages_to_fetch), 10)) as executor:
        future_map = {executor.submit(fetch_and_parse_worker, int(p)): int(p) for p in pages_to_fetch}
        for fut in as_completed(future_map):
            results.append(fut.result())

    results.sort(key=lambda x: x["page"])
    print(json.dumps({
        "targetAddress": target_address,
        "endpoint": endpoint,
        "results": results
    }))


if __name__ == "__main__":
    main()

