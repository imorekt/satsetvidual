import os
import sys
import time
import json
import io
import argparse
import requests
from datetime import datetime
from web3 import Web3
from eth_account import Account

import colorama
from colorama import Fore, Back, Style
from rich.layout import Layout
from rich.live import Live
from rich.panel import Panel
from rich.table import Table
from rich.console import Console
from rich.text import Text

colorama.init(autoreset=True)

# Memperbaiki encoding stdout/stderr di Windows agar mendukung emoji dan UTF-8 (dengan auto-flush)
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace", line_buffering=True)
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace", line_buffering=True)

# Memuat dotenv dari cwd atau direktori script
def load_env_file():
    env_path = ".env"
    if not os.path.exists(env_path):
        script_dir = os.path.dirname(os.path.abspath(__file__))
        env_path = os.path.join(script_dir, ".env")
        
    if os.path.exists(env_path):
        try:
            from dotenv import load_dotenv
            load_dotenv(env_path)
        except ImportError:
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        key, val = line.split("=", 1)
                        os.environ[key.strip()] = val.strip()

load_env_file()

# ==============================================================================
#  KONSTANTA UTAMA (Jaringan Base)
# ==============================================================================
WETH_ADDRESS = Web3.to_checksum_address("0x4200000000000000000000000000000000000006")
AERODROME_FACTORY_ADDRESS = Web3.to_checksum_address("0x420DD381b31aEf6683db6B902084cB0FFECe40Da")
UNISWAP_V3_FACTORY_ADDRESS = Web3.to_checksum_address("0x33128a8fC17869897dcE68Ed026d694621f6FDfD")
UNISWAP_V2_FACTORY_ADDRESS = Web3.to_checksum_address("0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6") # Sushi Factory Base

DEX_CONFIG = {
    "aerodrome": {
        "name": "Aerodrome V2",
        "router": Web3.to_checksum_address("0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43"),
        "factory": AERODROME_FACTORY_ADDRESS
    },
    "uniswap_v3": {
        "name": "Uniswap V3",
        "router": Web3.to_checksum_address("0x2626664c2603336E57B271c5C0b26F421741e481"),
        "factory": UNISWAP_V3_FACTORY_ADDRESS
    },
    "uniswap_v2": {
        "name": "SushiSwap / Uniswap V2 Clone (Base)",
        "router": Web3.to_checksum_address("0x6BDDef4241De2659c4900f224e76a5c2f9011eFa"), # Default Sushi V2 Router di Base
        "factory": UNISWAP_V2_FACTORY_ADDRESS
    },
    "uniswap_v4": {
        "name": "Uniswap V4",
        "router": Web3.to_checksum_address("0xFdf682F51FE81Aa4898F0AE2163d8A55c127fbC7"), # Uniswap V4 Universal Router di Base
        "factory": Web3.to_checksum_address("0x498581fF718922c3f8e6A244956aF099B2652b2b") # PoolManager
    }
}

# ==============================================================================
#  ABI KONTRAK
# ==============================================================================
FACTORY_ABI = [
    {
        "inputs": [
            {"name": "tokenA", "type": "address"},
            {"name": "tokenB", "type": "address"},
            {"name": "stable", "type": "bool"}
        ],
        "name": "getPool",
        "outputs": [{"name": "pool", "type": "address"}],
        "stateMutability": "view",
        "type": "function"
    }
]

UNISWAP_V3_FACTORY_ABI = [
    {
        "inputs": [
            {"name": "tokenA", "type": "address"},
            {"name": "tokenB", "type": "address"},
            {"name": "fee", "type": "uint24"}
        ],
        "name": "getPool",
        "outputs": [{"name": "pool", "type": "address"}],
        "stateMutability": "view",
        "type": "function"
    }
]

UNISWAP_V2_FACTORY_ABI = [
    {
        "inputs": [
            {"name": "tokenA", "type": "address"},
            {"name": "tokenB", "type": "address"}
        ],
        "name": "getPair",
        "outputs": [{"name": "pair", "type": "address"}],
        "stateMutability": "view",
        "type": "function"
    }
]

UNISWAP_V3_POOL_ABI = [
    {
        "inputs": [],
        "name": "slot0",
        "outputs": [
            {"name": "sqrtPriceX96", "type": "uint160"},
            {"name": "tick", "type": "int24"},
            {"name": "observationIndex", "type": "uint16"},
            {"name": "observationCardinality", "type": "uint16"},
            {"name": "observationCardinalityNext", "type": "uint16"},
            {"name": "feeProtocol", "type": "uint8"},
            {"name": "unlocked", "type": "bool"}
        ],
        "stateMutability": "view",
        "type": "function"
    }
]

ERC20_ABI = [
    {"constant": True, "inputs": [{"name": "_owner", "type": "address"}], "name": "balanceOf", "outputs": [{"name": "balance", "type": "uint256"}], "type": "function"},
    {"constant": False, "inputs": [{"name": "_spender", "type": "address"}, {"name": "_value", "type": "uint256"}], "name": "approve", "outputs": [{"name": "success", "type": "bool"}], "type": "function"},
    {"constant": True, "inputs": [{"name": "_owner", "type": "address"}, {"name": "_spender", "type": "address"}], "name": "allowance", "outputs": [{"name": "remaining", "type": "uint256"}], "type": "function"},
    {"constant": True, "inputs": [], "name": "decimals", "outputs": [{"name": "", "type": "uint8"}], "type": "function"},
    {"constant": True, "inputs": [], "name": "symbol", "outputs": [{"name": "", "type": "string"}], "type": "function"},
    {"constant": True, "inputs": [], "name": "name", "outputs": [{"name": "", "type": "string"}], "type": "function"}
]

AERODROME_ROUTER_ABI = [
    {
        "inputs": [
            {"name": "amountIn", "type": "uint256"},
            {"name": "amountOutMin", "type": "uint256"},
            {
                "components": [
                    {"name": "from", "type": "address"},
                    {"name": "to", "type": "address"},
                    {"name": "stable", "type": "bool"},
                    {"name": "factory", "type": "address"}
                ],
                "name": "routes",
                "type": "tuple[]"
            },
            {"name": "to", "type": "address"},
            {"name": "deadline", "type": "uint256"}
        ],
        "name": "swapExactTokensForETHSupportingFeeOnTransferTokens",
        "outputs": [{"name": "amounts", "type": "uint256[]"}],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {"name": "amountIn", "type": "uint256"},
            {
                "components": [
                    {"name": "from", "type": "address"},
                    {"name": "to", "type": "address"},
                    {"name": "stable", "type": "bool"},
                    {"name": "factory", "type": "address"}
                ],
                "name": "routes",
                "type": "tuple[]"
            }
        ],
        "name": "getAmountsOut",
        "outputs": [{"name": "amounts", "type": "uint256[]"}],
        "stateMutability": "view",
        "type": "function"
    }
]

UNISWAP_V3_ROUTER_ABI = [
    {
        "inputs": [
            {
                "components": [
                    {"name": "tokenIn", "type": "address"},
                    {"name": "tokenOut", "type": "address"},
                    {"name": "fee", "type": "uint24"},
                    {"name": "recipient", "type": "address"},
                    {"name": "amountIn", "type": "uint256"},
                    {"name": "amountOutMinimum", "type": "uint256"},
                    {"name": "sqrtPriceLimitX96", "type": "uint160"}
                ],
                "name": "params",
                "type": "tuple"
            }
        ],
        "name": "exactInputSingle",
        "outputs": [{"name": "amountOut", "type": "uint256"}],
        "stateMutability": "payable",
        "type": "function"
    }
]

UNISWAP_V2_ROUTER_ABI = [
    {
        "inputs": [
            {"name": "amountIn", "type": "uint256"},
            {"name": "amountOutMin", "type": "uint256"},
            {"name": "path", "type": "address[]"},
            {"name": "to", "type": "address"},
            {"name": "deadline", "type": "uint256"}
        ],
        "name": "swapExactTokensForETHSupportingFeeOnTransferTokens",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {"name": "amountIn", "type": "uint256"},
            {"name": "path", "type": "address[]"}
        ],
        "name": "getAmountsOut",
        "outputs": [{"name": "amounts", "type": "uint256[]"}],
        "stateMutability": "view",
        "type": "function"
    }
]

# ==============================================================================
#  FUNGSI BANTU / HELPERS
# ==============================================================================
global_dashboard = None

class RichDashboard:
    def __init__(self, bot, token_symbol, token_name, decimals, target_pool_id, mode, sell_ratio):
        self.bot = bot
        self.token_symbol = token_symbol
        self.token_name = token_name
        self.decimals = decimals
        self.target_pool_id = target_pool_id
        self.mode = mode
        self.sell_ratio = sell_ratio
        
        self.console = Console()
        self.logs_list = []
        
        self.layout = Layout()
        self.layout.split_row(
            Layout(name="left", ratio=3),
            Layout(name="right", ratio=5)
        )
        
        self.live = Live(self.layout, console=self.console, refresh_per_second=4, auto_refresh=True)

    def add_log(self, msg, symbol="ℹ️"):
        ts = datetime.now().strftime("%H:%M:%S")
        color = "white"
        if symbol == "🔎":
            color = "cyan"
        elif symbol in ["🔥", "✅", "🎉"]:
            color = "bold green"
        elif symbol in ["🚀", "⚡", "💸"]:
            color = "bold yellow"
        elif symbol in ["❌", "🛑", "⚠️"]:
            color = "bold red"
        elif symbol in ["💵", "💰", "📊"]:
            color = "green"
        elif symbol == "📍":
            color = "bold cyan"
            
        clean_msg = f"[{ts}] {symbol} [{color}]{msg}[/{color}]"
        self.logs_list.append(clean_msg)
        if len(self.logs_list) > 20:
            self.logs_list.pop(0)
        self.update()

    def update(self):
        wallet = self.bot.wallet_address
        try:
            eth_bal = self.bot.w3.from_wei(self.bot.w3.eth.get_balance(wallet), 'ether')
        except Exception:
            eth_bal = 0.0
            
        try:
            token_bal = self.bot.w3.eth.contract(
                address=Web3.to_checksum_address(self.bot.token_ca),
                abi=ERC20_ABI
            ).functions.balanceOf(wallet).call() / (10**self.decimals)
        except Exception:
            token_bal = 0.0
            
        table = Table(show_header=False, box=None)
        table.add_column("Key", style="bold cyan")
        table.add_column("Value", style="white")
        
        table.add_row("Wallet", f"{wallet[:6]}...{wallet[-4:]}")
        table.add_row("ETH Balance", f"{eth_bal:.6f} ETH")
        table.add_row("Token", f"{self.token_symbol} ({self.token_name})")
        table.add_row("Token Balance", f"{token_bal:,.2f} {self.token_symbol}")
        
        dex_name = self.bot.detected_dex.upper() if hasattr(self.bot, 'detected_dex') else "UNKNOWN"
        table.add_row("DEX Mode", f"{dex_name}")
        
        p_id = self.target_pool_id
        if len(p_id) > 16:
            p_id_show = f"{p_id[:8]}...{p_id[-6:]}"
        else:
            p_id_show = p_id
        table.add_row("Pool / PoolId", f"{p_id_show}")
        table.add_row("Sell Ratio", f"{self.sell_ratio}%")
        
        last_block = getattr(self.bot, 'last_scanned_block', 0)
        table.add_row("Last Scanned", f"{last_block:,}" if last_block else "Waiting...")
        
        left_panel = Panel(table, title="[bold green]📊 DASHBOARD (COLORAMA & RICH)[/bold green]", border_style="green")
        self.layout["left"].update(left_panel)
        
        logs_markup = "\n".join(self.logs_list)
        right_panel = Panel(Text.from_markup(logs_markup), title="[bold yellow]🔎 LIVE SCANS & TRADES[/bold yellow]", border_style="yellow")
        self.layout["right"].update(right_panel)

    def start(self):
        self.live.start()

    def stop(self):
        self.live.stop()

telegram_log_callback = None
telegram_status_callback = None

def log(msg, symbol="ℹ️"):
    global global_dashboard
    global telegram_log_callback
    
    if telegram_log_callback:
        try:
            telegram_log_callback(msg, symbol)
        except Exception:
            pass

    if global_dashboard is not None:
        global_dashboard.add_log(msg, symbol)
    else:
        ts = datetime.now().strftime("%H:%M:%S")
        color_prefix = ""
        if symbol == "🔎":
            color_prefix = Fore.CYAN
        elif symbol == "🔥":
            color_prefix = Fore.GREEN + Style.BRIGHT
        elif symbol == "🚀":
            color_prefix = Fore.YELLOW + Style.BRIGHT
        elif symbol in ["❌", "🛑", "⚠️"]:
            color_prefix = Fore.RED + Style.BRIGHT
        elif symbol == "✅":
            color_prefix = Fore.GREEN
            
        print(f"[{ts}] {symbol} {color_prefix}{msg}{Style.RESET_ALL}")

def check_gas_price(w3):
    """Mengambil harga gas saat ini di Base"""
    try:
        return w3.eth.gas_price
    except Exception as e:
        log(f"Gagal mengambil gas price, menggunakan default: {e}", "⚠️")
        return w3.to_wei(0.1, "gwei") # Base biasanya sangat murah

# ==============================================================================
#  LOGIKA BLOCKCHAIN UTAMA
# ==============================================================================
class FailoverHTTPProvider(Web3.HTTPProvider):
    def __init__(self, endpoint_uris, *args, **kwargs):
        self.endpoint_uris = endpoint_uris
        self.current_index = 0
        super().__init__(self.endpoint_uris[0], *args, **kwargs)
        
    def make_request(self, method, params):
        for attempt in range(len(self.endpoint_uris)):
            try:
                self.endpoint_uri = self.endpoint_uris[self.current_index]
                return super().make_request(method, params)
            except Exception as e:
                next_index = (self.current_index + 1) % len(self.endpoint_uris)
                log(f"RPC bermasalah ({self.endpoint_uri}). Beralih ke RPC cadangan: {self.endpoint_uris[next_index]}.", "⚠️")
                self.current_index = next_index
        raise ConnectionError("Semua RPC Node yang terdaftar gagal dihubungi.")

class BaseAutoSellBot:
    def __init__(self, rpc_url, private_key, slippage, gas_multiplier):
        if "," in rpc_url:
            rpc_urls = [url.strip() for url in rpc_url.split(",") if url.strip()]
        else:
            rpc_urls = [rpc_url.strip()]
            
        self.w3 = Web3(FailoverHTTPProvider(rpc_urls))
        if not self.w3.is_connected():
            raise ConnectionError("Gagal terhubung ke semua RPC Node Base yang terdaftar.")

        self.account = Account.from_key(private_key)
        self.wallet_address = self.account.address
        self.slippage = float(slippage)
        self.sell_ratio = 98.0  # Default, can be updated
        self.gas_multiplier = float(gas_multiplier)
        self._nonce = None

    def get_next_nonce(self):
        """Mendapatkan nonce berikutnya dengan pelacakan lokal untuk kecepatan maksimal"""
        if self._nonce is None:
            self._nonce = self.w3.eth.get_transaction_count(self.wallet_address)
        nonce = self._nonce
        self._nonce += 1
        return nonce

    def reset_nonce(self):
        """Mereset pelacakan nonce lokal jika terjadi kesalahan transaksi"""
        self._nonce = None

    def get_token_info(self, token_ca):
        """Mendapatkan simbol, nama, desimal, dan saldo token"""
        token_ca = Web3.to_checksum_address(token_ca)
        contract = self.w3.eth.contract(address=token_ca, abi=ERC20_ABI)
        
        try:
            symbol = contract.functions.symbol().call()
            name = contract.functions.name().call()
            decimals = contract.functions.decimals().call()
            balance = contract.functions.balanceOf(self.wallet_address).call()
            return contract, symbol, name, decimals, balance
        except Exception as e:
            raise ValueError(f"Gagal memuat info token dari CA {token_ca}. Pastikan CA benar! Detail: {e}")

    def check_and_approve(self, token_contract, router_address, amount_in, symbol):
        """Memeriksa allowance dan menyetujui spender (router) jika perlu"""
        allowance = token_contract.functions.allowance(self.wallet_address, router_address).call()
        if allowance >= amount_in:
            log(f"Token {symbol} sudah memiliki izin (Allowance) yang cukup untuk Router.", "✅")
            return True
        
        log(f"Mengirim transaksi persetujuan (Approve) untuk token {symbol}...", "🔄")
        
        gas_price = int(check_gas_price(self.w3) * self.gas_multiplier)
        
        # Menggunakan nilai persetujuan maksimal untuk menghemat gas di masa depan
        max_approve_val = 2**256 - 1
        
        try:
            tx = token_contract.functions.approve(router_address, max_approve_val).build_transaction({
                "from": self.wallet_address,
                "nonce": self.get_next_nonce(),
                "gasPrice": gas_price,
                "chainId": 8453 # Base Mainnet
            })
        except Exception as e:
            self.reset_nonce()
            log(f"Gagal membangun transaksi Approve: {e}", "❌")
            return False
        
        # Estimasi Gas Limit
        try:
            tx["gas"] = int(self.w3.eth.estimate_gas(tx) * 1.1)
        except Exception:
            tx["gas"] = 80000  # Default untuk ERC20 Approve
            
        try:
            signed_tx = self.w3.eth.account.sign_transaction(tx, private_key=self.account.key)
            raw_tx = getattr(signed_tx, "raw_transaction", getattr(signed_tx, "rawTransaction", None))
            tx_hash = self.w3.eth.send_raw_transaction(raw_tx)
            log(f"Transaksi Approve dikirim! Hash: {tx_hash.hex()}", "💸")
            
            log("Menunggu konfirmasi transaksi Approve...", "⏳")
            receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
            
            if receipt.status == 1:
                log(f"Berhasil menyetujui Router untuk menggunakan token {symbol}.", "✅")
                return True
            else:
                log(f"Transaksi Approve gagal dikonfirmasi (reverted).", "❌")
                return False
        except Exception as e:
            self.reset_nonce()
            log(f"Terjadi kesalahan saat memproses Approve: {e}", "❌")
            return False

    def check_and_approve_v4(self, token_contract, token_ca, router_address, amount_in, symbol):
        """Memeriksa allowance untuk Permit2 dan menyetujui Universal Router di Permit2 jika perlu (Khusus V4)"""
        PERMIT2_ADDRESS = Web3.to_checksum_address("0x000000000022D473030F116dDEE9F6B43aC78BA3")
        
        # 1. Cek allowance Permit2 di Token ERC20
        allowance_erc20 = token_contract.functions.allowance(self.wallet_address, PERMIT2_ADDRESS).call()
        if allowance_erc20 < amount_in:
            log(f"Mengirim transaksi persetujuan (Approve) ERC20 untuk Permit2...", "🔄")
            max_approve_val = 2**256 - 1
            gas_price = int(check_gas_price(self.w3) * self.gas_multiplier)
            try:
                tx = token_contract.functions.approve(PERMIT2_ADDRESS, max_approve_val).build_transaction({
                    "from": self.wallet_address,
                    "nonce": self.get_next_nonce(),
                    "gasPrice": gas_price,
                    "chainId": 8453
                })
                tx["gas"] = 80000
                signed_tx = self.w3.eth.account.sign_transaction(tx, private_key=self.account.key)
                raw_tx = getattr(signed_tx, "raw_transaction", getattr(signed_tx, "rawTransaction", None))
                tx_hash = self.w3.eth.send_raw_transaction(raw_tx)
                log(f"Approve Permit2 dikirim! Hash: {tx_hash.hex()}", "💸")
                self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
            except Exception as e:
                self.reset_nonce()
                log(f"Gagal Approve Permit2: {e}", "❌")
                return False
                
        # 2. Cek allowance Universal Router di Permit2
        permit2_abi = [
            {"inputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"address","name":"","type":"address"},{"internalType":"address","name":"","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint160","name":"amount","type":"uint160"},{"internalType":"uint48","name":"expiration","type":"uint48"},{"internalType":"uint48","name":"nonce","type":"uint48"}],"stateMutability":"view","type":"function"},
            {"inputs":[{"internalType":"address","name":"token","type":"address"},{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint160","name":"amount","type":"uint160"},{"internalType":"uint48","name":"expiration","type":"uint48"}],"name":"approve","outputs":[],"stateMutability":"nonpayable","type":"function"}
        ]
        permit2_contract = self.w3.eth.contract(address=PERMIT2_ADDRESS, abi=permit2_abi)
        
        allowance_data = permit2_contract.functions.allowance(self.wallet_address, token_ca, router_address).call()
        permit2_amount = allowance_data[0]
        permit2_expiration = allowance_data[1]
        
        current_time = int(time.time())
        if permit2_amount < amount_in or permit2_expiration < current_time + 600:
            log(f"Mengirim transaksi persetujuan (Approve) Permit2 untuk Universal Router...", "🔄")
            max_amount = 2**160 - 1
            max_expiration = 281474976710655 # type(uint48).max
            gas_price = int(check_gas_price(self.w3) * self.gas_multiplier)
            try:
                tx = permit2_contract.functions.approve(token_ca, router_address, max_amount, max_expiration).build_transaction({
                    "from": self.wallet_address,
                    "nonce": self.get_next_nonce(),
                    "gasPrice": gas_price,
                    "chainId": 8453
                })
                tx["gas"] = 100000
                signed_tx = self.w3.eth.account.sign_transaction(tx, private_key=self.account.key)
                raw_tx = getattr(signed_tx, "raw_transaction", getattr(signed_tx, "rawTransaction", None))
                tx_hash = self.w3.eth.send_raw_transaction(raw_tx)
                log(f"Approve Permit2 ke UR dikirim! Hash: {tx_hash.hex()}", "💸")
                self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
            except Exception as e:
                self.reset_nonce()
                log(f"Gagal Approve Permit2 ke UR: {e}", "❌")
                return False
                
        log(f"Token {symbol} sudah memiliki izin Permit2 (Universal Router).", "✅")
        return True

    def execute_swap_aerodrome(self, token_ca, amount_in, decimals, symbol):
        """Eksekusi swap menggunakan Aerodrome V2 Router"""
        config = DEX_CONFIG["aerodrome"]
        router_contract = self.w3.eth.contract(address=config["router"], abi=AERODROME_ROUTER_ABI)
        
        # Struktur Rute Aerodrome V2: (address from, address to, bool stable, address factory)
        # Kami menggunakan Pool Factory volatile default karena memecoin biasanya volatile
        routes = [(token_ca, WETH_ADDRESS, False, config["factory"])]
        
        log(f"Mendapatkan estimasi harga keluaran dari Aerodrome...", "🔍")
        amount_out_min = 0
        try:
            amounts_out = router_contract.functions.getAmountsOut(amount_in, routes).call()
            expected_out = amounts_out[-1]
            amount_out_min = int(expected_out * (100.0 - self.slippage) / 100.0)
            log(f"Estimasi hasil: {self.w3.from_wei(expected_out, 'ether'):.6f} ETH", "📈")
            log(f"Hasil minimal setelah Slippage ({self.slippage}%): {self.w3.from_wei(amount_out_min, 'ether'):.6f} ETH", "📉")
        except Exception as e:
            log(f"Gagal getAmountsOut (mungkin tidak ada likuiditas langsung di pool Aerodrome): {e}", "⚠️")
            log("Melanjutkan swap dengan amountOutMin = 0 (Risiko frontrun tinggi jika likuiditas tipis)", "⚠️")
            
        deadline = int(time.time()) + 600 # 10 menit
        
        gas_price = int(check_gas_price(self.w3) * self.gas_multiplier)
        
        try:
            tx = router_contract.functions.swapExactTokensForETHSupportingFeeOnTransferTokens(
                amount_in,
                amount_out_min,
                routes,
                self.wallet_address,
                deadline
            ).build_transaction({
                "from": self.wallet_address,
                "nonce": self.get_next_nonce(),
                "gasPrice": gas_price,
                "chainId": 8453
            })
        except Exception as e:
            self.reset_nonce()
            raise e
        
        try:
            tx["gas"] = int(self.w3.eth.estimate_gas(tx) * 1.2)
        except Exception as e:
            log(f"Estimasi gas gagal: {e}. Menggunakan default gas limit.", "⚠️")
            tx["gas"] = 350000  # Default untuk Swap
            
        try:
            signed_tx = self.w3.eth.account.sign_transaction(tx, private_key=self.account.key)
            raw_tx = getattr(signed_tx, "raw_transaction", getattr(signed_tx, "rawTransaction", None))
            tx_hash = self.w3.eth.send_raw_transaction(raw_tx)
            return tx_hash
        except Exception as e:
            self.reset_nonce()
            raise e

    def execute_swap_uniswap_v3(self, token_ca, amount_in, decimals, symbol, fee_tier):
        """Eksekusi swap menggunakan Uniswap V3 SwapRouter02"""
        config = DEX_CONFIG["uniswap_v3"]
        router_contract = self.w3.eth.contract(address=config["router"], abi=UNISWAP_V3_ROUTER_ABI)
        
        # Di Uniswap V3, estimasi output tanpa Quoter sangat sulit dilakukan secara on-chain langsung.
        # Kita set amountOutMinimum = 0 secara default atau menggunakan estimasi dari pool jika memungkinkan.
        # Untuk kesederhanaan dan kecepatan eksekusi memecoin, kita set minimal output = 0.
        amount_out_min = 0
        
        # Parameter untuk exactInputSingle
        params = (
            token_ca,
            WETH_ADDRESS,
            int(fee_tier),
            self.wallet_address,
            amount_in,
            amount_out_min,
            0 # sqrtPriceLimitX96 (0 = dinonaktifkan)
        )
        
        gas_price = int(check_gas_price(self.w3) * self.gas_multiplier)
        
        try:
            tx = router_contract.functions.exactInputSingle(params).build_transaction({
                "from": self.wallet_address,
                "nonce": self.get_next_nonce(),
                "gasPrice": gas_price,
                "chainId": 8453
            })
        except Exception as e:
            self.reset_nonce()
            raise e
        
        try:
            tx["gas"] = int(self.w3.eth.estimate_gas(tx) * 1.2)
        except Exception as e:
            log(f"Estimasi gas gagal: {e}. Menggunakan default gas limit.", "⚠️")
            tx["gas"] = 300000
            
        try:
            signed_tx = self.w3.eth.account.sign_transaction(tx, private_key=self.account.key)
            raw_tx = getattr(signed_tx, "raw_transaction", getattr(signed_tx, "rawTransaction", None))
            tx_hash = self.w3.eth.send_raw_transaction(raw_tx)
            return tx_hash
        except Exception as e:
            self.reset_nonce()
            raise e

    def execute_swap_uniswap_v2(self, token_ca, amount_in, decimals, symbol, router_address):
        """Eksekusi swap menggunakan Uniswap V2 style Router (SushiSwap, BaseSwap, dsb)"""
        router_contract = self.w3.eth.contract(address=router_address, abi=UNISWAP_V2_ROUTER_ABI)
        path = [token_ca, WETH_ADDRESS]
        
        log(f"Mendapatkan estimasi harga keluaran dari V2 Router...", "🔍")
        amount_out_min = 0
        try:
            amounts_out = router_contract.functions.getAmountsOut(amount_in, path).call()
            expected_out = amounts_out[-1]
            amount_out_min = int(expected_out * (100.0 - self.slippage) / 100.0)
            log(f"Estimasi hasil: {self.w3.from_wei(expected_out, 'ether'):.6f} ETH", "📈")
            log(f"Hasil minimal setelah Slippage ({self.slippage}%): {self.w3.from_wei(amount_out_min, 'ether'):.6f} ETH", "📉")
        except Exception as e:
            log(f"Gagal getAmountsOut di V2: {e}", "⚠️")
            log("Melanjutkan swap dengan amountOutMin = 0 (Risiko frontrun tinggi)", "⚠️")
            
        deadline = int(time.time()) + 600
        gas_price = int(check_gas_price(self.w3) * self.gas_multiplier)
        
        try:
            tx = router_contract.functions.swapExactTokensForETHSupportingFeeOnTransferTokens(
                amount_in,
                amount_out_min,
                path,
                self.wallet_address,
                deadline
            ).build_transaction({
                "from": self.wallet_address,
                "nonce": self.get_next_nonce(),
                "gasPrice": gas_price,
                "chainId": 8453
            })
        except Exception as e:
            self.reset_nonce()
            raise e
        
        try:
            tx["gas"] = int(self.w3.eth.estimate_gas(tx) * 1.2)
        except Exception as e:
            log(f"Estimasi gas gagal: {e}. Menggunakan default gas limit.", "⚠️")
            tx["gas"] = 250000
            
        try:
            signed_tx = self.w3.eth.account.sign_transaction(tx, private_key=self.account.key)
            raw_tx = getattr(signed_tx, "raw_transaction", getattr(signed_tx, "rawTransaction", None))
            tx_hash = self.w3.eth.send_raw_transaction(raw_tx)
            return tx_hash
        except Exception as e:
            self.reset_nonce()
            raise e

    def execute_swap_uniswap_v4(self, token_ca, amount_in, decimals, symbol, fee_tier):
        """Eksekusi swap menggunakan Uniswap V4 Universal Router (0xFdf682F51FE81Aa4898F0AE2163d8A55c127fbC7)"""
        from eth_abi import abi
        
        router_address = Web3.to_checksum_address("0xFdf682F51FE81Aa4898F0AE2163d8A55c127fbC7")
        
        ETH_ADDRESS = "0x0000000000000000000000000000000000000000"
        hooks = "0x0000000000000000000000000000000000000000"
        fee = int(fee_tier)
        
        if fee == 100:
            tick_spacing = 1
        elif fee == 500:
            tick_spacing = 10
        elif fee == 3000:
            tick_spacing = 60
        elif fee == 10000:
            tick_spacing = 200
        else:
            tick_spacing = 60

        # Dalam Uniswap V4, pool utama untuk token biasa dipasangkan langsung dengan Native ETH (address 0).
        # Karena 0x0 selalu lebih kecil dari token_ca, maka ETH selalu menjadi currency0.
        is_token0_eth = True
        
        pool_key = (
            ETH_ADDRESS,
            token_ca,
            fee,
            tick_spacing,
            hooks
        )
            
        # 1. SWAP_EXACT_IN_SINGLE (0x06)
        zero_for_one = not is_token0_eth
        p0 = abi.encode(
            ["((address,address,uint24,int24,address),bool,uint128,uint128,bytes)"],
            [(pool_key, zero_for_one, amount_in, 0, b"")]
        )
        
        # 2. SETTLE_ALL (0x0c)
        p1 = abi.encode(
            ["address", "uint256"],
            [token_ca, 2**256 - 1]
        )
        
        # 3. TAKE_ALL (0x0f)
        p2 = abi.encode(
            ["address", "uint256"],
            [ETH_ADDRESS, 0]
        )
        
        actions = bytes.fromhex("060c0f")
        params = [p0, p1, p2]
        
        v4_input = abi.encode(["bytes", "bytes[]"], [actions, params])
        
        # PERMIT2_TRANSFER_FROM = 0x02, V4_SWAP = 0x10, SWEEP = 0x04
        # Karena V4 mengembalikan Native ETH, kita tidak perlu UNWRAP_WETH.
        
        # Parameter PERMIT2_TRANSFER_FROM: (address token, address recipient, uint160 amount)
        p_permit = abi.encode(["address", "address", "uint160"], [token_ca, router_address, amount_in])
        
        # Parameter SWEEP: (address token, address recipient, uint256 amountMin)
        # Kita sweep Native ETH (address 0) ke wallet
        p_sweep = abi.encode(["address", "address", "uint256"], [ETH_ADDRESS, self.wallet_address, 0])
        
        commands = bytes.fromhex("021004")
        inputs = [p_permit, v4_input, p_sweep]
        
        deadline = int(time.time()) + 600
        
        payload = abi.encode(["bytes", "bytes[]", "uint256"], [commands, inputs, deadline])
        
        gas_price = int(check_gas_price(self.w3) * self.gas_multiplier)
        data = "0x3593564c" + payload.hex()
        
        tx = {
            "from": self.wallet_address,
            "to": router_address,
            "data": data,
            "nonce": self.get_next_nonce(),
            "gasPrice": gas_price,
            "chainId": 8453
        }
        
        try:
            tx["gas"] = int(self.w3.eth.estimate_gas(tx) * 1.2)
        except Exception as e:
            log(f"Estimasi gas V4 gagal: {e}. Menggunakan default gas limit.", "⚠️")
            tx["gas"] = 350000
            
        try:
            signed_tx = self.w3.eth.account.sign_transaction(tx, private_key=self.account.key)
            raw_tx = getattr(signed_tx, "raw_transaction", getattr(signed_tx, "rawTransaction", None))
            tx_hash = self.w3.eth.send_raw_transaction(raw_tx)
            return tx_hash
        except Exception as e:
            self.reset_nonce()
            raise e

    def sell_token(self, token_ca, sell_percentage=100, dex_choice="aerodrome", fee_tier=3000, pool_override=None, bypass_approve=False):
        """Fungsi utama untuk melakukan penjualan token"""
        token_ca = Web3.to_checksum_address(token_ca)
        
        # 1. Dapatkan informasi token
        contract, symbol, name, decimals, balance = self.get_token_info(token_ca)
        
        if balance == 0:
            log(f"Saldo token {symbol} Anda saat ini adalah 0.", "❌")
            return False
            
        # Panggil get_or_predict_lp_pool untuk mendeteksi DEX & fee tier yang valid secara dinamis
        lp_pool = self.get_or_predict_lp_pool(token_ca, dex_choice, fee_tier, pool_override)
        if not lp_pool:
            log("Gagal mendeteksi LP Pool. Penjualan dibatalkan.", "❌")
            return False
            
        # Update DEX dan fee tier berdasarkan hasil auto-detect
        dex_choice = self.detected_dex
        fee_tier = self.detected_fee_tier
            
        amount_to_sell = int(balance * (sell_percentage / 100.0))
        if amount_to_sell == 0:
            log(f"Jumlah token yang akan dijual setelah perhitungan persentase ({sell_percentage}%) adalah 0.", "❌")
            return False
            
        readable_amount = amount_to_sell / (10 ** decimals)
        log(f"Mempersiapkan penjualan {readable_amount:.6f} {symbol} ({sell_percentage}% dari total saldo)...", "🛒")
        
        # Tentukan alamat router berdasarkan pilihan DEX
        if dex_choice == "aerodrome":
            router_address = DEX_CONFIG["aerodrome"]["router"]
        elif dex_choice == "uniswap_v3":
            router_address = DEX_CONFIG["uniswap_v3"]["router"]
        elif dex_choice == "uniswap_v2":
            router_address = Web3.to_checksum_address(custom_router) if custom_router else DEX_CONFIG["uniswap_v2"]["router"]
        elif dex_choice == "uniswap_v4":
            router_address = DEX_CONFIG["uniswap_v4"]["router"]
        else:
            raise ValueError(f"DEX '{dex_choice}' tidak dikenal!")
            
        # 2. Lakukan Approve jika diperlukan
        if not bypass_approve:
            if dex_choice == "uniswap_v4":
                approved = self.check_and_approve_v4(contract, token_ca, router_address, amount_to_sell, symbol)
            else:
                approved = self.check_and_approve(contract, router_address, amount_to_sell, symbol)
            if not approved:
                log("Proses penjualan dibatalkan karena persetujuan (Approve) gagal.", "❌")
                return False
            
        # 3. Eksekusi swap
        log(f"Mengirim transaksi swap ke {DEX_CONFIG[dex_choice]['name']}...", "🚀")
        try:
            if dex_choice == "aerodrome":
                tx_hash = self.execute_swap_aerodrome(token_ca, amount_to_sell, decimals, symbol)
            elif dex_choice == "uniswap_v3":
                tx_hash = self.execute_swap_uniswap_v3(token_ca, amount_to_sell, decimals, symbol, fee_tier)
            elif dex_choice == "uniswap_v2":
                tx_hash = self.execute_swap_uniswap_v2(token_ca, amount_to_sell, decimals, symbol, router_address)
            elif dex_choice == "uniswap_v4":
                tx_hash = self.execute_swap_uniswap_v4(token_ca, amount_to_sell, decimals, symbol, fee_tier)
                
            log(f"Transaksi swap dikirim! Hash: {tx_hash.hex()}", "💸")
            log("Menunggu konfirmasi transaksi swap...", "⏳")
            
            receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=180)
            if receipt.status == 1:
                log(f"🎉 SUKSES! Berhasil menjual {readable_amount:.6f} {symbol} di {DEX_CONFIG[dex_choice]['name']}.", "🚀")
                # Tampilkan sisa saldo ETH terbaru
                eth_bal = self.w3.eth.get_balance(self.wallet_address)
                log(f"Saldo ETH terbaru: {self.w3.from_wei(eth_bal, 'ether'):.6f} ETH", "💰")
                return True
            else:
                log("Transaksi swap GAGAL dikonfirmasi (reverted).", "❌")
                return False
        except Exception as e:
            log(f"Terjadi kesalahan saat memproses swap: {e}", "❌")
            return False

    def monitor_and_sell(self, token_ca, sell_percentage=100, dex_choice="aerodrome", fee_tier=3000, custom_router=None, poll_interval=2, stop_event=None):
        """Memantau saldo token dan otomatis menjual begitu saldo > 0"""
        token_ca = Web3.to_checksum_address(token_ca)
        
        # Dapatkan LP Pool dan deteksi DEX / fee tier secara otomatis
        lp_pool = self.get_or_predict_lp_pool(token_ca, dex_choice, fee_tier, custom_router if dex_choice == "uniswap_v2" else None)
        if not lp_pool:
            log("Tidak dapat mendeteksi pool dan tidak ada pool manual.", "❌")
            return
            
        dex_choice = self.detected_dex
        fee_tier = self.detected_fee_tier
        
        contract, symbol, name, decimals, initial_balance = self.get_token_info(token_ca)
        
        # Tentukan alamat router untuk pre-approve
        if dex_choice == "aerodrome":
            router_address = DEX_CONFIG["aerodrome"]["router"]
        elif dex_choice == "uniswap_v3":
            router_address = DEX_CONFIG["uniswap_v3"]["router"]
        elif dex_choice == "uniswap_v2":
            router_address = Web3.to_checksum_address(custom_router) if custom_router else DEX_CONFIG["uniswap_v2"]["router"]
        elif dex_choice == "uniswap_v4":
            router_address = DEX_CONFIG["uniswap_v4"]["router"]
            
        log(f"Memulai Pemantau Saldo untuk token {symbol} ({name})", "🔍")
        log(f"DEX Pilihan: {DEX_CONFIG[dex_choice]['name']}", "⚙️")
        log(f"Saldo awal saat ini: {initial_balance / (10 ** decimals):.6f} {symbol}", "📊")
        
        # Opsi Pre-Approve untuk mempercepat transaksi di masa depan
        allowance = contract.functions.allowance(self.wallet_address, router_address).call()
        if allowance == 0:
            pilihan = input(f"❓ Token {symbol} belum di-Approve. Apakah Anda ingin melakukan Pre-Approve sekarang agar penjualan nanti instan? (y/n): ").strip().lower()
            if pilihan == 'y':
                self.check_and_approve(contract, router_address, 2**256 - 1, symbol)
        
        log(f"Menunggu saldo {symbol} bertambah > 0... Tekan Ctrl+C untuk membatalkan.", "⏳")
        
        cycle = 0
        try:
            while True:
                if stop_event and stop_event.is_set():
                    log("Pemantauan dihentikan melalui Telegram.", "🛑")
                    break
                
                cycle += 1
                try:
                    balance = contract.functions.balanceOf(self.wallet_address).call()
                    if balance > 0:
                        log(f"Saldo terdeteksi! Jumlah: {balance / (10 ** decimals):.6f} {symbol}", "🔥")
                        log("Memicu eksekusi auto-sell...", "⚡")
                        success = self.sell_token(token_ca, sell_percentage, dex_choice, fee_tier, custom_router)
                        if success:
                            log("Proses auto-sell selesai dengan sukses. Keluar...", "🎉")
                            break
                        else:
                            log("Auto-sell gagal. Mencoba lagi dalam 3 detik...", "⚠️")
                            time.sleep(3)
                    
                    if cycle % 15 == 0:
                        log(f"Sedang memantau... (Saldo saat ini: {balance / (10 ** decimals):.6f} {symbol})", "👀")
                except Exception as e:
                    log(f"Error saat membaca blockchain: {e}", "⚠️")
                
                time.sleep(poll_interval)
        except KeyboardInterrupt:
            log("Pemantauan dibatalkan oleh pengguna.", "🛑")

    def get_eth_price(self, fallback_price=3500.0):
        """Mendapatkan harga ETH terkini dari CoinGecko dengan fallback"""
        try:
            r = requests.get("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd", timeout=5)
            if r.status_code == 200:
                price = float(r.json()["ethereum"]["usd"])
                log(f"Harga ETH Terkini (CoinGecko API): ${price:,.2f}", "📊")
                return price
        except Exception:
            pass
        log(f"Gagal mengambil harga real-time, menggunakan harga fallback: ${fallback_price:,.2f}", "⚠️")
        return fallback_price

    def get_or_predict_lp_pool(self, token_ca, dex_choice, fee_tier=3000, pool_override=None):
        """Mendapatkan LP Pool token dengan WETH secara otomatis lintas DEX dan Fee Tier"""
        if pool_override:
            if len(pool_override) == 66:
                log(f"Pool V4 PoolId: {pool_override[:10]}...{pool_override[-6:]}", "📍")
                self.detected_dex = "uniswap_v4"
                self.detected_fee_tier = fee_tier
                return pool_override
            else:
                addr = Web3.to_checksum_address(pool_override)
                log(f"Pool manual: {addr}", "📍")
                self.detected_dex = dex_choice
                self.detected_fee_tier = fee_tier
                return addr

        token_ca = Web3.to_checksum_address(token_ca)
        self.detected_dex = dex_choice
        self.detected_fee_tier = fee_tier

        # Fungsi pembantu untuk mencari pool di Aerodrome
        def find_aerodrome():
            try:
                factory = self.w3.eth.contract(address=AERODROME_FACTORY_ADDRESS, abi=FACTORY_ABI)
                p = factory.functions.getPool(token_ca, WETH_ADDRESS, False).call()
                if p and p != "0x0000000000000000000000000000000000000000":
                    return p
            except Exception:
                pass
            return None

        # Fungsi pembantu untuk mencari pool di Uniswap V3
        def find_uniswap_v3(target_fee=None):
            try:
                factory = self.w3.eth.contract(address=UNISWAP_V3_FACTORY_ADDRESS, abi=UNISWAP_V3_FACTORY_ABI)
                if target_fee:
                    p = factory.functions.getPool(token_ca, WETH_ADDRESS, target_fee).call()
                    if p and p != "0x0000000000000000000000000000000000000000":
                        return p, target_fee
                else:
                    for fee in [3000, 500, 10000, 100]:
                        p = factory.functions.getPool(token_ca, WETH_ADDRESS, fee).call()
                        if p and p != "0x0000000000000000000000000000000000000000":
                            return p, fee
            except Exception:
                pass
            return None, None

        # Fungsi pembantu untuk mencari pool di Uniswap V2
        def find_uniswap_v2():
            try:
                factory = self.w3.eth.contract(address=UNISWAP_V2_FACTORY_ADDRESS, abi=UNISWAP_V2_FACTORY_ABI)
                p = factory.functions.getPair(token_ca, WETH_ADDRESS).call()
                if p and p != "0x0000000000000000000000000000000000000000":
                    return p
            except Exception:
                pass
            return None

        # Jalankan pencarian berdasarkan prioritas DEX pilihan
        pool = None
        if dex_choice == "aerodrome":
            pool = find_aerodrome()
            if pool:
                self.detected_dex = "aerodrome"
            else:
                # Fallback: Cari di Uniswap V3
                p, f = find_uniswap_v3()
                if p:
                    pool = p
                    self.detected_dex = "uniswap_v3"
                    self.detected_fee_tier = f
                    log(f"Auto-scan: Beralih ke Uniswap V3 (Fee {f})", "📍")
                else:
                    # Fallback: Cari di Uniswap V2
                    p = find_uniswap_v2()
                    if p:
                        pool = p
                        self.detected_dex = "uniswap_v2"
                        log("Auto-scan: Beralih ke Uniswap V2", "📍")
                        
        elif dex_choice == "uniswap_v3":
            # Cari di V3 dengan fee tier pilihan
            p, f = find_uniswap_v3(fee_tier)
            if p:
                pool = p
                self.detected_dex = "uniswap_v3"
                self.detected_fee_tier = f
            else:
                # Cari di V3 dengan fee tier lainnya
                p, f = find_uniswap_v3()
                if p:
                    pool = p
                    self.detected_dex = "uniswap_v3"
                    self.detected_fee_tier = f
                    log(f"Auto-scan: Beralih ke Uniswap V3 Fee Tier {f}", "📍")
                else:
                    # Fallback: Cari di Uniswap V2
                    p = find_uniswap_v2()
                    if p:
                        pool = p
                        self.detected_dex = "uniswap_v2"
                        log("Auto-scan: Beralih ke Uniswap V2", "📍")
                    else:
                        # Fallback: Cari di Aerodrome
                        p = find_aerodrome()
                        if p:
                            pool = p
                            self.detected_dex = "aerodrome"
                            log("Auto-scan: Beralih ke Aerodrome V2", "📍")
                            
        elif dex_choice == "uniswap_v2":
            pool = find_uniswap_v2()
            if pool:
                self.detected_dex = "uniswap_v2"
            else:
                # Fallback: Cari di Uniswap V3
                p, f = find_uniswap_v3()
                if p:
                    pool = p
                    self.detected_dex = "uniswap_v3"
                    self.detected_fee_tier = f
                    log(f"Auto-scan: Beralih ke Uniswap V3 (Fee {f})", "📍")
                else:
                    # Fallback: Cari di Aerodrome
                    p = find_aerodrome()
                    if p:
                        pool = p
                        self.detected_dex = "aerodrome"
                        log("Auto-scan: Beralih ke Aerodrome V2", "📍")

        if pool and pool != "0x0000000000000000000000000000000000000000":
            return Web3.to_checksum_address(pool)
        else:
            log("LP Pool tidak ditemukan di DEX mana pun. Silakan cek CA Token atau masukkan pool secara manual.", "⚠️")
            return None

    def get_token_price_in_eth(self, token_ca, decimals, lp_pool, dex_choice):
        """Menghitung harga 1 token dalam ETH dari LP Pool secara on-chain"""
        try:
            if dex_choice in ["aerodrome", "uniswap_v2"]:
                weth_contract = self.w3.eth.contract(address=WETH_ADDRESS, abi=ERC20_ABI)
                token_contract = self.w3.eth.contract(address=token_ca, abi=ERC20_ABI)
                
                weth_bal = weth_contract.functions.balanceOf(lp_pool).call()
                token_bal = token_contract.functions.balanceOf(lp_pool).call()
                
                if token_bal > 0:
                    price_eth = (weth_bal / 10**18) / (token_bal / 10**decimals)
                    return price_eth
            elif dex_choice == "uniswap_v3":
                pool_contract = self.w3.eth.contract(address=lp_pool, abi=UNISWAP_V3_POOL_ABI)
                slot0 = pool_contract.functions.slot0().call()
                sqrtPriceX96 = slot0[0]
                
                is_token0 = int(token_ca, 16) < int(WETH_ADDRESS, 16)
                price = (sqrtPriceX96 / (2**96)) ** 2
                if is_token0:
                    price_eth = price * (10**decimals / 10**18)
                else:
                    price_eth = (1 / price) * (10**decimals / 10**18)
                return price_eth
        except Exception as e:
            log(f"Gagal mendapatkan harga token dari LP Pool: {e}", "⚠️")
        return None

    def monitor_counter_sell(self, token_ca, dex_choice, fee_tier=3000, pool_override=None, poll_interval=2, sell_ratio=98.0, stop_event=None):
        """Memantau LP Pool dan otomatis menjual sell_ratio% dari setiap pembelian orang lain"""
        token_ca = Web3.to_checksum_address(token_ca)

        # 1. Deteksi LP Pool
        lp_pool = self.get_or_predict_lp_pool(token_ca, dex_choice, fee_tier, pool_override)
        if not lp_pool:
            print(f"{Fore.RED}[❌] Tidak dapat mendeteksi pool. Masukkan pool manual dengan --pool.{Style.RESET_ALL}")
            return

        dex_choice  = self.detected_dex
        fee_tier    = self.detected_fee_tier
        dex_name    = DEX_CONFIG.get(dex_choice, {}).get("name", dex_choice.upper())

        contract, symbol, name, decimals, initial_balance = self.get_token_info(token_ca)

        eth_bal = self.w3.from_wei(self.w3.eth.get_balance(self.wallet_address), 'ether')
        
        # ── Header startup ──────────────────────────────────────────────────────
        print()
        print(f"{Fore.CYAN}{'═'*60}{Style.RESET_ALL}")
        print(f"{Fore.CYAN}  🤖  BASE AUTO-SELL TOKEN BOT{Style.RESET_ALL}")
        print(f"{Fore.CYAN}{'═'*60}{Style.RESET_ALL}")
        print(f"  Token   : {Fore.YELLOW}{symbol} ({name}){Style.RESET_ALL}")
        print(f"  Wallet  : {Fore.WHITE}{self.wallet_address[:8]}...{self.wallet_address[-6:]}{Style.RESET_ALL}")
        print(f"  ETH Bal : {Fore.GREEN}{eth_bal:.6f} ETH{Style.RESET_ALL}")
        print(f"  Saldo   : {Fore.GREEN}{initial_balance / (10**decimals):,.2f} {symbol}{Style.RESET_ALL}")
        print(f"  DEX     : {Fore.GREEN}{dex_name}{Style.RESET_ALL}")
        pool_disp = f"{lp_pool[:12]}...{lp_pool[-8:]}" if len(lp_pool) > 24 else lp_pool
        print(f"  Pool    : {Fore.WHITE}{pool_disp}{Style.RESET_ALL}")
        print(f"  Jual    : {Fore.YELLOW}{self.sell_ratio}%{Style.RESET_ALL} dari pembelian")
        print(f"  Slippage: {self.slippage}%  |  Poll: {poll_interval}s")
        print(f"{Fore.CYAN}{'─'*60}{Style.RESET_ALL}")

        # 2. Pre-approve
        if dex_choice == "aerodrome":
            router_address = DEX_CONFIG["aerodrome"]["router"]
        elif dex_choice == "uniswap_v3":
            router_address = DEX_CONFIG["uniswap_v3"]["router"]
        elif dex_choice == "uniswap_v2":
            router_address = DEX_CONFIG["uniswap_v2"]["router"]
        elif dex_choice == "uniswap_v4":
            router_address = DEX_CONFIG["uniswap_v4"]["router"]
        else:
            router_address = DEX_CONFIG.get(dex_choice, {}).get("router", "")

        if dex_choice == "uniswap_v4":
            self.check_and_approve_v4(contract, token_ca, router_address, 2**256 - 1, symbol)
        else:
            self.check_and_approve(contract, router_address, 2**256 - 1, symbol)

        # 3. Signature Swap event
        SIG_V3   = "0xc42079f94a6350d7e6230537752229158a419725d8434caefa575191e70c2d45"
        SIG_V2   = "0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130140159d82c"
        SIG_AERO = "0xb3e2773606ab6c0e55790051613b32f1d2850a1b8d5a1085002df3570690029b"
        SIG_V4   = "0x40e9cecb9f5f1f1c5b9c97dec2917b7ee92e57ba5563708daca94dd84ad7112f"

        swap_sig_set  = {SIG_V3[2:].lower(), SIG_V2[2:].lower(), SIG_AERO[2:].lower(), SIG_V4[2:].lower()}
        swap_sig_list = [SIG_V3, SIG_V2, SIG_AERO, SIG_V4]

        UNISWAP_V4_POOL_MANAGER = Web3.to_checksum_address("0x498581fF718922c3f8e6A244956aF099B2652b2b")

        is_token0_weth = int(WETH_ADDRESS, 16) < int(token_ca, 16)

        last_block = self.w3.eth.block_number
        last_status_block = last_block
        total_sells = 0

        def cprint(msg, color=Fore.WHITE):
            ts = datetime.now().strftime("%H:%M:%S")
            print(f"{Fore.DARKGRAY if hasattr(Fore, 'DARKGRAY') else Fore.WHITE}[{ts}]{Style.RESET_ALL} {color}{msg}{Style.RESET_ALL}")
            if telegram_log_callback:
                telegram_log_callback(msg, "")

        cprint(f"Memantau dari blok {last_block:,}... (Ctrl+C untuk berhenti)", Fore.CYAN)
        print()

        try:
            while True:
                if stop_event and stop_event.is_set():
                    log("Pemantauan dihentikan melalui Telegram.", "🛑")
                    break
                try:
                    current_block = self.w3.eth.block_number
                    if current_block <= last_block:
                        time.sleep(poll_interval)
                        continue

                    start_block = last_block + 1
                    end_block   = current_block

                    # Update blok secara real-time di 1 baris yang sama (menimpa baris sebelumnya)
                    ts = datetime.now().strftime("%H:%M:%S")
                    status_msg = f"[{ts}] 📡 Memantau Blok: {end_block:,} | Total sell: {total_sells}x "
                    print(f"\r{Fore.CYAN}{status_msg:<60}{Style.RESET_ALL}", end="", flush=True)
                    if telegram_status_callback and end_block % 3 == 0:
                        telegram_status_callback(end_block, total_sells)

                    # Tentukan target
                    is_v4 = len(lp_pool) == 66 or lp_pool.lower().startswith("0x1ab15fdc")
                    target_addresses = [UNISWAP_V4_POOL_MANAGER] if is_v4 else [lp_pool]

                    # Ambil log swap
                    logs = []
                    try:
                        logs = self.w3.eth.get_logs({
                            "fromBlock": start_block,
                            "toBlock":   end_block,
                            "address":   target_addresses,
                            "topics":    [swap_sig_list]
                        })
                    except Exception:
                        try:
                            logs = self.w3.eth.get_logs({
                                "fromBlock": start_block,
                                "toBlock":   end_block,
                                "address":   target_addresses
                            })
                        except Exception as e2:
                            cprint(f"⚠️  Gagal ambil logs: {e2}", Fore.YELLOW)

                    # Proses setiap swap event
                    for log_entry in logs:
                        entry_topics = log_entry["topics"]
                        if not entry_topics:
                            continue

                        raw_sig = entry_topics[0].hex().lower()
                        if raw_sig not in swap_sig_set:
                            continue
                        sig = "0x" + raw_sig

                        tx_hash_hex = log_entry["transactionHash"].hex()
                        data_bytes  = bytes(log_entry["data"])

                        is_buy     = False
                        weth_amount  = 0
                        token_amount = 0

                        try:
                            if sig == SIG_V4:
                                if len(entry_topics) < 2 or len(data_bytes) < 64:
                                    continue
                                p_id = "0x" + entry_topics[1].hex().lower()
                                t_id = lp_pool.lower()
                                if not t_id.startswith("0x"):
                                    t_id = "0x" + t_id
                                if p_id != t_id:
                                    continue
                                a0 = int.from_bytes(data_bytes[0:32],  byteorder="big", signed=True)
                                a1 = int.from_bytes(data_bytes[32:64], byteorder="big", signed=True)
                                
                                # ── PERUBAHAN TANDA UNISWAP V4 ──
                                # Di V4, event Swap menggunakan tipe BalanceDelta. 
                                # Positif (+) = User Menerima dari Pool
                                # Negatif (-) = User Membayar ke Pool
                                if is_token0_weth:
                                    # WETH (token0) dibayar (a0 < 0), Token (token1) diterima (a1 > 0) -> INI ADALAH BUY
                                    if a0 < 0 and a1 > 0:
                                        is_buy, weth_amount, token_amount = True, abs(a0), a1
                                else:
                                    # WETH (token1) dibayar (a1 < 0), Token (token0) diterima (a0 > 0) -> INI ADALAH BUY
                                    if a1 < 0 and a0 > 0:
                                        is_buy, weth_amount, token_amount = True, abs(a1), a0

                            elif sig == SIG_V3:
                                if len(data_bytes) < 64:
                                    continue
                                a0 = int.from_bytes(data_bytes[0:32],  byteorder="big", signed=True)
                                a1 = int.from_bytes(data_bytes[32:64], byteorder="big", signed=True)
                                if is_token0_weth:
                                    if a0 > 0 and a1 < 0:
                                        is_buy, weth_amount, token_amount = True, a0, abs(a1)
                                else:
                                    if a1 > 0 and a0 < 0:
                                        is_buy, weth_amount, token_amount = True, a1, abs(a0)

                            elif sig in (SIG_V2, SIG_AERO):
                                if len(data_bytes) < 128:
                                    continue
                                a0in  = int.from_bytes(data_bytes[0:32],   byteorder="big", signed=False)
                                a1in  = int.from_bytes(data_bytes[32:64],  byteorder="big", signed=False)
                                a0out = int.from_bytes(data_bytes[64:96],  byteorder="big", signed=False)
                                a1out = int.from_bytes(data_bytes[96:128], byteorder="big", signed=False)
                                if is_token0_weth:
                                    if a0in > 0 and a1out > 0:
                                        is_buy, weth_amount, token_amount = True, a0in, a1out
                                else:
                                    if a1in > 0 and a0out > 0:
                                        is_buy, weth_amount, token_amount = True, a1in, a0out

                        except Exception as e_parse:
                            cprint(f"⚠️  Parse error: {e_parse}", Fore.YELLOW)
                            continue

                        # ── Eksekusi sell jika ada buy ───────────────────────────────
                        if is_buy and token_amount > 0:
                            weth_r = weth_amount / 10**18
                            tok_r  = token_amount / 10**decimals

                            # Estimasi USD
                            try:
                                eth_usd  = self.get_eth_price()
                                buy_usd  = weth_r * eth_usd
                                usd_info = f"≈${buy_usd:.4f} USD"
                            except Exception:
                                buy_usd  = 0.0
                                usd_info = ""

                            print()
                            cprint(f"🔥 BUY TERDETEKSI  tx: 0x{tx_hash_hex[:8]}...{tx_hash_hex[-6:]}", Fore.GREEN + Style.BRIGHT)
                            cprint(f"   Dibeli  : {tok_r:,.6f} {symbol}  ({weth_r:.8f} ETH {usd_info})", Fore.GREEN)

                            tokens_to_sell = int(token_amount * (self.sell_ratio / 100.0))
                            sell_usd = buy_usd * (self.sell_ratio / 100.0) if buy_usd > 0 else 0.0

                            our_balance = contract.functions.balanceOf(self.wallet_address).call()
                            cprint(f"   Saldo   : {our_balance/(10**decimals):,.6f} {symbol}", Fore.WHITE)

                            if our_balance == 0:
                                cprint("   ❌ Saldo kita 0, skip.", Fore.RED)
                                print()
                                continue

                            if tokens_to_sell == 0:
                                cprint("   ⚠️  Pembelian terlalu kecil, skip.", Fore.YELLOW)
                                print()
                                continue

                            if tokens_to_sell > our_balance:
                                tokens_to_sell = our_balance
                                cprint("   ⚠️  Saldo kurang, jual semua saldo.", Fore.YELLOW)

                            sell_pct = (tokens_to_sell / our_balance) * 100.0
                            sell_r   = tokens_to_sell / 10**decimals
                            cprint(f"   Jual    : {sell_r:,.6f} {symbol} ({self.sell_ratio}% dari buy{'  ≈$'+f'{sell_usd:.4f} USD' if sell_usd else ''})", Fore.YELLOW + Style.BRIGHT)
                            cprint(f"   Kirim transaksi...", Fore.CYAN)

                            success = self.sell_token(
                                token_ca=token_ca,
                                sell_percentage=sell_pct,
                                dex_choice=dex_choice,
                                fee_tier=fee_tier,
                                pool_override=pool_override,
                                bypass_approve=False
                            )

                            if success:
                                total_sells += 1
                                cprint(f"   ✅ SUKSES sell #{total_sells}  ≈${sell_usd:.4f} dari buy ≈${buy_usd:.4f}", Fore.GREEN + Style.BRIGHT)
                            else:
                                cprint("   ❌ Penjualan GAGAL.", Fore.RED)
                            print()

                    last_block = end_block

                except Exception as e:
                    cprint(f"⚠️  Error: {e}", Fore.YELLOW)

                time.sleep(poll_interval)

        except KeyboardInterrupt:
            print()
            cprint("🛑 Bot dihentikan. Sampai jumpa!", Fore.CYAN)
            print(f"{Fore.CYAN}{'═'*60}{Style.RESET_ALL}")





# ==============================================================================
#  ENTRY POINT (CLI)
# ==============================================================================
def main():
    p = argparse.ArgumentParser(description="Bot Auto-Sell Token Jaringan Base")
    p.add_argument("--token", "-t", help="Contract Address (CA) token yang ingin dijual")
    p.add_argument("--dex", "-d", choices=["aerodrome", "uniswap_v3", "uniswap_v2"], default="uniswap_v3", help="DEX tempat menjual token")
    p.add_argument("--mode", "-m", choices=["instant", "monitor", "counter"], default="counter", help="Mode eksekusi bot: instant (jual sekarang), monitor (pantau saldo), atau counter (auto sell on buy)")
    p.add_argument("--percent", "-p", type=float, default=100.0, help="Persentase saldo token yang ingin dijual (1-100%%)")
    p.add_argument("--poll", type=float, default=2.0, help="Interval pemantauan dalam detik (khusus mode monitor & counter)")
    p.add_argument("--fee", type=int, default=3000, help="Fee tier untuk Uniswap V3 (100, 500, 3000, 10000)")
    p.add_argument("--router", help="Alamat router kustom jika menggunakan uniswap_v2")
    p.add_argument("--pre-approve", action="store_true", help="Hanya jalankan transaksi Approve token ke router lalu keluar")
    p.add_argument("--sell-ratio", type=float, help="Persentase jumlah token yang akan dijual relatif terhadap jumlah pembelian (contoh: 98)")
    p.add_argument("--pool", help="Alamat LP Pool secara manual (mengabaikan deteksi otomatis)")
    
    args = p.parse_args()

    # Memuat variabel dari .env / env variables
    rpc_url = os.environ.get("RPC_URL", "")
    private_key = os.environ.get("PRIVATE_KEY", "")
    slippage = os.environ.get("SLIPPAGE", "5.0")
    gas_multiplier = os.environ.get("GAS_MULTIPLIER", "1.2")
    default_ca = os.environ.get("DEFAULT_TOKEN_CA", "")
    
    # Konfigurasi khusus Mode Counter-Sell
    env_sell_ratio = float(os.environ.get("SELL_RATIO_PERCENT", "98.0"))
    env_pool_address = os.environ.get("LP_POOL_ADDRESS", "")

    # Validasi Konfigurasi Dasar
    if not rpc_url or rpc_url.startswith("https://mainnet.base.org") and not private_key:
        # Prompt interaktif jika data sensitif belum diset
        log("Konfigurasi dasar tidak lengkap di file .env.", "⚠️")
    
    if not rpc_url:
        rpc_url = input("Masukkan RPC URL Base (misal: https://mainnet.base.org): ").strip()
    if not private_key:
        private_key = input("Masukkan Private Key dompet Anda: ").strip()
        if not private_key.startswith("0x") and len(private_key) == 64:
            private_key = "0x" + private_key

    # Inisialisasi Bot
    try:
        bot = BaseAutoSellBot(rpc_url, private_key, slippage, gas_multiplier)
    except Exception as e:
        log(f"Gagal inisialisasi bot: {e}", "❌")
        sys.exit(1)

    # Meminta CA Token jika belum disediakan
    token_ca = args.token or default_ca
    if not token_ca:
        token_ca = input("Masukkan Contract Address (CA) Token: ").strip()
    
    if not Web3.is_address(token_ca):
        log("Alamat CA Token tidak valid!", "❌")
        sys.exit(1)
        
    token_ca = Web3.to_checksum_address(token_ca)

    # Mendapatkan informasi token awal
    try:
        contract, symbol, name, decimals, balance = bot.get_token_info(token_ca)
    except Exception as e:
        log(str(e), "❌")
        sys.exit(1)

    # ── Mode Pre-Approve Saja ──
    if args.pre_approve:
        if args.dex == "aerodrome":
            router_address = DEX_CONFIG["aerodrome"]["router"]
        elif args.dex == "uniswap_v3":
            router_address = DEX_CONFIG["uniswap_v3"]["router"]
        elif args.dex == "uniswap_v2":
            router_address = Web3.to_checksum_address(args.router) if args.router else DEX_CONFIG["uniswap_v2"]["router"]
        
        bot.check_and_approve(contract, router_address, 2**256 - 1, symbol)
        sys.exit(0)

    # ── Mode Operasi Bot ──
    if args.mode == "instant":
        log("Memulai Mode Instant Sell...", "⚡")
        bot.sell_token(
            token_ca=token_ca,
            sell_percentage=args.percent,
            dex_choice=args.dex,
            fee_tier=args.fee,
            custom_router=args.router
        )
    elif args.mode == "monitor":
        bot.monitor_and_sell(
            token_ca=token_ca,
            sell_percentage=args.percent,
            dex_choice=args.dex,
            fee_tier=args.fee,
            custom_router=args.router,
            poll_interval=args.poll
        )
    elif args.mode == "counter":
        ratio_val = args.sell_ratio if args.sell_ratio is not None else env_sell_ratio
        pool_val = args.pool or env_pool_address
        
        # Untuk mode counter, default poll_interval disetel ke 1.0 detik (setiap detik) agar tidak terlalu cepat
        poll_val = args.poll if args.poll != 2.0 else 1.0
        
        bot.monitor_counter_sell(
            token_ca=token_ca,
            dex_choice=args.dex,
            fee_tier=args.fee,
            pool_override=pool_val if pool_val else None,
            poll_interval=poll_val,
            sell_ratio=ratio_val
        )

if __name__ == "__main__":
    main()
