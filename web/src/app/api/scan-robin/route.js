import { NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

export const dynamic = "force-dynamic";

function getRobinDir() {
  return ["D:", "SEMUABOT", "NEWBOT", "deploy", "robin"].join(path.sep);
}

function getRobinTargetTxt() {
  return path.join(getRobinDir(), "target.txt");
}

function getRobinTxJson() {
  return path.join(getRobinDir(), "transaction.json");
}

function getPythonBin() {
  const localAppData = process.env.LOCALAPPDATA || (process.env.USERPROFILE ? path.join(process.env.USERPROFILE, "AppData", "Local") : "");
  const defaultWinPy = localAppData ? path.join(localAppData, "Programs", "Python", "Python312", "python.exe") : "";

  const candidates = [
    process.env.PYTHON_PATH,
    process.env.PYTHON_BIN,
    "/usr/bin/python3",
    "/usr/bin/python",
    "/usr/local/bin/python3",
    defaultWinPy,
    process.platform === "win32" ? "python" : "python3",
    "python3",
    "python"
  ].filter(Boolean);

  for (const c of candidates) {
    if (path.isAbsolute(c) && fs.existsSync(c)) {
      return c;
    }
  }
  return process.platform === "win32" ? "python" : "python3";
}

function getPythonEnv() {
  const localAppData = process.env.LOCALAPPDATA || (process.env.USERPROFILE ? path.join(process.env.USERPROFILE, "AppData", "Local") : "");
  const pyDir = localAppData ? path.join(localAppData, "Programs", "Python", "Python312") : "";
  const pyScripts = pyDir ? path.join(pyDir, "Scripts") : "";
  const existingPath = process.env.PATH || "";
  const extraPaths = [pyDir, pyScripts].filter(Boolean).join(";");
  return {
    ...process.env,
    PATH: extraPaths ? `${extraPaths};${existingPath}` : existingPath,
    PYTHONIOENCODING: "utf-8"
  };
}

function getLocalPcCachePath() {
  const baseDir = process.env.APPDATA || path.join(os.homedir(), ".config");
  const cacheDir = path.join(baseDir, "satset-web-cache");
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  return path.join(cacheDir, "scan_ca_cache.json");
}

function isValidEvmAddress(addr) {
  if (typeof addr !== "string") return false;
  const clean = addr.trim().toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(clean)) return false;
  if (clean === "0x0000000000000000000000000000000000000000") return false;
  return true;
}

export async function GET() {
  try {
    const filePath = getLocalPcCachePath();
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf8");
      const data = JSON.parse(raw);
      return NextResponse.json({ exists: true, data });
    }

    // Fallback: baca langsung dari D:\SEMUABOT\NEWBOT\deploy\robin\transaction.json jika cache web belum ada
    const txJsonPath = getRobinTxJson();
    if (fs.existsSync(txJsonPath)) {
      const raw = fs.readFileSync(txJsonPath, "utf8");
      const tj = JSON.parse(raw);
      const data = {
        robinTx: Array.isArray(tj.transaction) ? tj.transaction : [],
        robinTokenFrom: Array.isArray(tj.token_transfer?.from) ? tj.token_transfer.from : [],
        robinTokenTo: Array.isArray(tj.token_transfer?.to) ? tj.token_transfer.to : []
      };
      return NextResponse.json({ exists: true, data });
    }

    return NextResponse.json({ exists: false, data: null });
  } catch {
    return NextResponse.json({ exists: false, data: null });
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const filePath = getLocalPcCachePath();
    fs.writeFileSync(filePath, JSON.stringify(body, null, 2), "utf8");

    // Sinkronisasi dua arah ke D:\SEMUABOT\NEWBOT\deploy\robin\transaction.json
    try {
      const robinDir = getRobinDir();
      const txJsonPath = getRobinTxJson();
      if (fs.existsSync(robinDir)) {
        let existingTj = { transaction: [], token_transfer: { from: [], to: [] } };
        if (fs.existsSync(txJsonPath)) {
          try {
            existingTj = JSON.parse(fs.readFileSync(txJsonPath, "utf8"));
          } catch {}
        }
        if (Array.isArray(body.robinTx) && body.robinTx.length > 0) {
          existingTj.transaction = body.robinTx.filter(isValidEvmAddress);
        }
        if (Array.isArray(body.robinTokenFrom)) {
          if (!existingTj.token_transfer) existingTj.token_transfer = {};
          existingTj.token_transfer.from = body.robinTokenFrom.filter(isValidEvmAddress);
        }
        if (Array.isArray(body.robinTokenTo)) {
          if (!existingTj.token_transfer) existingTj.token_transfer = {};
          existingTj.token_transfer.to = body.robinTokenTo.filter(isValidEvmAddress);
        }
        fs.writeFileSync(txJsonPath, JSON.stringify(existingTj, null, 2), "utf8");
      }
    } catch (syncErr) {
      console.warn("[scan-robin] Sync to transaction.json skipped:", syncErr.message);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const targetAddress = String(body.targetAddress || "").trim();
    const pages = Array.isArray(body.pages) && body.pages.length > 0 ? body.pages : [1];
    const mode = String(body.mode || "transaction").trim();

    if (!isValidEvmAddress(targetAddress)) {
      return NextResponse.json(
        { error: "Alamat CA/Router tidak valid (harus 0x + 40 karakter hex)." },
        { status: 400 }
      );
    }

    const scriptPath = path.join(
      process.cwd(),
      "src",
      "app",
      "api",
      "scan-robin",
      "robin_scanner_runner.py"
    );

    if (!fs.existsSync(scriptPath)) {
      return NextResponse.json(
        { error: `Script runner tidak ditemukan: ${scriptPath}` },
        { status: 500 }
      );
    }

    const pyBin = getPythonBin();
    const pyEnv = getPythonEnv();

    const pyResult = await new Promise((resolve) => {
      let child;
      try {
        child = spawn(pyBin, [scriptPath, JSON.stringify(body)], {
          env: pyEnv
        });
      } catch (err) {
        return resolve({ code: 1, stdout: "", stderr: err.message });
      }

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString("utf8");
      });

      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString("utf8");
      });

      child.on("error", (err) => {
        resolve({ code: 1, stdout, stderr: stderr + "\n" + err.message });
      });

      child.on("close", (code) => {
        resolve({ code, stdout, stderr });
      });
    });

    if (pyResult.code !== 0) {
      console.error("[scan-robin runner error]", pyResult.stderr);
      return NextResponse.json(
        { error: pyResult.stderr || "Gagal memindai Robinhood Chain via scanner runner." },
        { status: 500 }
      );
    }

    let parsed;
    try {
      parsed = JSON.parse(pyResult.stdout.trim());
    } catch {
      return NextResponse.json(
        { error: "Format respon scanner runner tidak valid.", raw: pyResult.stdout },
        { status: 500 }
      );
    }

    // Sinkronisasi otomatis ke D:\SEMUABOT\NEWBOT\deploy\robin\target.txt
    // agar bot.py (Menu 3: Airdrop) langsung membaca wallet hasil scan
    try {
      const robinDir = getRobinDir();
      const targetTxtPath = getRobinTargetTxt();
      if (fs.existsSync(robinDir)) {
        let existingAddrs = new Set();
        if (fs.existsSync(targetTxtPath)) {
          const lines = fs.readFileSync(targetTxtPath, "utf8").split(/\r?\n/);
          for (const l of lines) {
            const clean = l.trim().toLowerCase();
            if (isValidEvmAddress(clean)) existingAddrs.add(clean);
          }
        }

        const freshAddrs = [];
        for (const resItem of parsed.results || []) {
          for (const a of resItem.addresses || []) {
            const lower = a.toLowerCase();
            if (isValidEvmAddress(lower) && !existingAddrs.has(lower)) {
              existingAddrs.add(lower);
              freshAddrs.push(lower);
            }
          }
        }

        if (freshAddrs.length > 0) {
          fs.appendFileSync(targetTxtPath, freshAddrs.join("\n") + "\n", "utf8");
        }
      }
    } catch (syncErr) {
      console.warn("[scan-robin] Gagal sinkronisasi ke target.txt:", syncErr.message);
    }

    return NextResponse.json(parsed);
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Gagal memproses pemindaian Robinhood" },
      { status: 500 }
    );
  }
}
