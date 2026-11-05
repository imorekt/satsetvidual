import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const require = createRequire(import.meta.url);
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");

let waClient = null;
let isReady = false;
let isInitializing = false;
const messageQueue = [];

// Normalisasi nomor HP ke format WhatsApp JID (628xxx@c.us)
export function normalizeWhatsAppNumber(input) {
    if (!input) return null;
    let cleaned = String(input).replace(/[^0-9]/g, "");

    if (cleaned.startsWith("0")) {
        cleaned = "62" + cleaned.substring(1);
    } else if (cleaned.startsWith("8")) {
        cleaned = "62" + cleaned;
    }

    if (cleaned.length < 10 || cleaned.length > 16) {
        return null;
    }

    return {
        formattedNumber: "+" + cleaned,
        cleanNumber: cleaned,
        jid: cleaned + "@c.us"
    };
}

export function initWhatsApp() {
    if (waClient || isInitializing) return waClient;
    isInitializing = true;

    console.log("\x1b[36m[*] Menginisialisasi WhatsApp Web Notifier Client...\x1b[0m");

    waClient = new Client({
        authStrategy: new LocalAuth({ dataPath: path.join(__dirname, "wa_session") }),
        puppeteer: {
            headless: true,
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-accelerated-2d-canvas",
                "--no-first-run",
                "--no-zygote",
                "--disable-gpu"
            ]
        }
    });

    waClient.on("qr", (qr) => {
        console.log("\x1b[33m\n╔══════════════════════════════════════════════════════════════════╗");
        console.log("║           📱 SCAN QR CODE UNTUK LOGIN NOTIFIKASI WHATSAPP        ║");
        console.log("║   Buka WhatsApp di HP > Titik Tiga / Pengaturan > Perangkat      ║");
        console.log("║   Tertaut > Tautkan Perangkat, lalu scan QR Code di bawah:       ║");
        console.log("╚══════════════════════════════════════════════════════════════════╝\x1b[0m\n");
        qrcode.generate(qr, { small: true });
        console.log("\x1b[33mMenunggu pemindaian QR code WhatsApp...\x1b[0m\n");
    });

    waClient.on("loading_screen", (percent, message) => {
        console.log(`\x1b[36m[*] Menyiapkan WhatsApp Web: ${percent}% (${message || "Sinkronisasi"})...\x1b[0m`);
    });

    waClient.on("authenticated", () => {
        console.log("\x1b[32m[+] Autentikasi WhatsApp Berhasil! Sesi tersimpan aman di wa_session.\x1b[0m");
    });

    waClient.on("auth_failure", (msg) => {
        console.error("\x1b[31m[!] Autentikasi WhatsApp gagal:\x1b[0m", msg);
    });

    waClient.on("ready", async () => {
        isReady = true;
        console.log("\x1b[32m\n=======================================================");
        console.log("       ✅ WHATSAPP NOTIFIER BOT BERHASIL TERHUBUNG!    ");
        console.log("=======================================================\n\x1b[0m");

        // Kirim pesan tertunda jika ada
        if (messageQueue.length > 0) {
            console.log(`\x1b[33m[*] Mengirim ${messageQueue.length} pesan WhatsApp tertunda...\x1b[0m`);
            while (messageQueue.length > 0) {
                const item = messageQueue.shift();
                try {
                    await waClient.sendMessage(item.jid, item.message);
                    console.log(`\x1b[32m[WA] Pesan terkirim ke ${item.jid}\x1b[0m`);
                    if (item.resolve) item.resolve(true);
                } catch (e) {
                    console.error(`\x1b[31m[!] Gagal kirim queue WA ke ${item.jid}: ${e.message}\x1b[0m`);
                    if (item.reject) item.reject(e);
                }
                await new Promise((r) => setTimeout(r, 600));
            }
        }
    });

    waClient.on("disconnected", (reason) => {
        console.log("\x1b[31m[!] WhatsApp terputus:\x1b[0m", reason);
        isReady = false;
        isInitializing = false;
        waClient = null;
    });

    waClient.initialize().catch((err) => {
        console.error("\x1b[31m[!] Error saat initialize WhatsApp:\x1b[0m", err?.message || err);
    });

    return waClient;
}

export async function sendWhatsAppMessage(target, messageText) {
    if (!target) return false;

    let jid = target;
    if (!jid.includes("@")) {
        const parsed = normalizeWhatsAppNumber(target);
        if (!parsed) {
            console.error(`\x1b[31m[!] Format nomor WhatsApp tidak valid: ${target}\x1b[0m`);
            return false;
        }
        jid = parsed.jid;
    }

    if (!isReady || !waClient) {
        console.log(`\x1b[33m[*] WhatsApp belum login/ready. Pesan ke ${jid} dimasukkan ke antrean.\x1b[0m`);
        return new Promise((resolve, reject) => {
            messageQueue.push({ jid, message: messageText, resolve, reject });
        });
    }

    try {
        await waClient.sendMessage(jid, messageText);
        console.log(`\x1b[32m[WA NOTIF] Pesan terkirim ke ${jid}\x1b[0m`);
        return true;
    } catch (e) {
        console.error(`\x1b[31m[!] Gagal kirim notif WhatsApp ke ${jid}: ${e?.message || e}\x1b[0m`);
        return false;
    }
}

export function isWhatsAppReady() {
    return isReady;
}
