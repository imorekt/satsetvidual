import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { ethers } from 'ethers';

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

async function deployWithPureJs({ network, name, symbol, privateKey, supply, renounce, desc, web, tg, tw, logo }) {
  const isRobin = String(network).toUpperCase() === 'ROBINHOOD';
  const rpcUrl = isRobin ? 'https://rpc.mainnet.chain.robinhood.com' : 'https://mainnet.base.org';
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const cleanPk = privateKey.startsWith('0x') ? privateKey : '0x' + privateKey;
  const wallet = new ethers.Wallet(cleanPk, provider);

  const abiPath = path.join(process.cwd(), 'contract', 'Token_sol_CustomToken.abi');
  const binPath = path.join(process.cwd(), 'contract', 'Token_sol_CustomToken.bin');

  if (!fs.existsSync(abiPath) || !fs.existsSync(binPath)) {
    throw new Error('Contract ABI/BIN tidak ditemukan di folder contract/');
  }

  const abi = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
  let bytecode = fs.readFileSync(binPath, 'utf8').trim();
  if (!bytecode.startsWith('0x')) bytecode = '0x' + bytecode;

  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  const cleanSupply = BigInt(supply || '1000000000');
  const initialSupplyWei = cleanSupply * (10n ** 18n);

  const contract = await factory.deploy(
    name,
    symbol,
    initialSupplyWei,
    desc || '',
    web || '',
    tg || '',
    tw || '',
    logo || ''
  );

  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();
  const deployTx = contract.deploymentTransaction();

  let renounced = false;
  if (renounce) {
    try {
      const renTx = await contract.renounceOwnership();
      await renTx.wait(1);
      renounced = true;
    } catch (e) {
      console.warn('[PureJS Deploy] Gagal auto-renounce:', e.message);
    }
  }

  const explorerUrl = isRobin ? 'https://robin.etherscan.io' : 'https://basescan.org';
  const stdout = [
    `==================================================`,
    `🚀 TOKEN BERHASIL DIDELOY (PURE JAVASCRIPT)`,
    `==================================================`,
    `Network          : ${network}`,
    `Contract Address : ${contractAddress}`,
    `Deployer Wallet  : ${wallet.address}`,
    `Token Name       : ${name} (${symbol})`,
    `Total Supply     : ${cleanSupply.toLocaleString()}`,
    `Tx Hash          : ${deployTx?.hash || '-'}`,
    `Explorer Link    : ${explorerUrl}/token/${contractAddress}`,
    `Ownership        : ${renounced ? 'Renounced (0x000...)' : wallet.address}`,
    `==================================================`
  ].join('\n');

  return {
    success: true,
    stdout,
    contractAddress,
    txHash: deployTx?.hash || null,
    verified: false,
    renounced,
    mode: 'normal'
  };
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { network, name, symbol, privateKey, supply, renounce, deployMode, desc, web, tg, tw, logo } = body;

    if (!network || !name || !symbol || !privateKey) {
      return NextResponse.json({ success: false, error: "Network, Private Key, Name, dan Symbol wajib diisi" }, { status: 400 });
    }

    try {
      fs.writeFileSync('D:\\SEMUABOT\\deploy\\privatekey.txt', privateKey, 'utf8');
    } catch {}
    try {
      fs.writeFileSync('D:\\SEMUABOT\\NEWBOT\\deploy\\robin\\privatekey.txt', `Manual : ${privateKey}\n`, 'utf8');
    } catch {}

    const scriptPath = path.join(process.cwd(), 'src', 'app', 'api', 'deploy', 'deploy_runner.py');
    const normalizedMode = deployMode === 'thirdweb' ? 'thirdweb' : '1';
    const payloadStr = JSON.stringify({
      network,
      name,
      symbol,
      privateKey,
      supply: supply || '1000000000',
      deployMode: normalizedMode,
      renounce: renounce !== undefined ? Boolean(renounce) : true,
      desc: desc || '',
      web: web || '',
      tg: tg || '',
      tw: tw || '',
      logo: logo || ''
    });

    const pyBin = getPythonBin();
    const pyEnv = getPythonEnv();

    let runResult = await new Promise((resolve) => {
      let py;
      try {
        py = spawn(pyBin, [scriptPath, payloadStr], {
          env: pyEnv
        });
      } catch (err) {
        return resolve({ code: 1, stdout: '', stderr: err.message });
      }

      let stdout = '';
      let stderr = '';

      py.stdout.on('data', (chunk) => {
        stdout += chunk.toString('utf8');
      });

      py.stderr.on('data', (chunk) => {
        stderr += chunk.toString('utf8');
      });

      py.on('error', (err) => {
        resolve({ code: 1, stdout, stderr: stderr + '\n' + err.message });
      });

      py.on('close', (code) => {
        resolve({ code, stdout, stderr });
      });
    });

    // Jika Python gagal atau ENOENT, otomatis gunakan Pure JS deployer
    if (runResult.code !== 0 && (runResult.stderr.includes('ENOENT') || runResult.stderr.includes('python'))) {
      console.log('[API Deploy] Python tidak ditemukan, menjalankan Pure JavaScript deployer...');
      try {
        const pureJsRes = await deployWithPureJs({
          network,
          name,
          symbol,
          privateKey,
          supply,
          renounce: renounce !== undefined ? Boolean(renounce) : true,
          desc,
          web,
          tg,
          tw,
          logo
        });
        return NextResponse.json(pureJsRes);
      } catch (pureJsErr) {
        return NextResponse.json({
          success: false,
          error: `Gagal deploy via Pure JS: ${pureJsErr.message}`,
          stderr: pureJsErr.stack || pureJsErr.message
        }, { status: 500 });
      }
    }

    let cleanStdout = runResult.stdout || '';
    let resultMeta = null;

    const marker = '__DEPLOY_RESULT_JSON__:';
    const markerIdx = cleanStdout.indexOf(marker);
    if (markerIdx !== -1) {
      const jsonLine = cleanStdout.slice(markerIdx + marker.length).trim().split('\n')[0];
      cleanStdout = cleanStdout.slice(0, markerIdx).trim();
      try {
        resultMeta = JSON.parse(jsonLine);
      } catch {
        // Ignore parse error
      }
    }

    if (runResult.code !== 0 || !resultMeta || !resultMeta.contractAddress) {
      // Fallback kedua ke Pure JS jika python exit error
      try {
        console.log('[API Deploy] Script Python gagal, mencoba fallback ke Pure JS deployer...');
        const pureJsRes = await deployWithPureJs({
          network,
          name,
          symbol,
          privateKey,
          supply,
          renounce: renounce !== undefined ? Boolean(renounce) : true,
          desc,
          web,
          tg,
          tw,
          logo
        });
        return NextResponse.json(pureJsRes);
      } catch {
        const errMsg = (runResult.stderr || cleanStdout || 'Gagal memproses deploy').trim();
        return NextResponse.json({
          success: false,
          error: errMsg.split('\n').pop() || 'Kesalahan saat memproses deploy.',
          stderr: (cleanStdout ? cleanStdout + '\n' : '') + (runResult.stderr || '')
        }, { status: 500 });
      }
    }

    if (resultMeta && resultMeta.contractAddress) {
      const caAddr = resultMeta.contractAddress;
      try {
        const robinDeployedFile = ["D:", "SEMUABOT", "NEWBOT", "deploy", "robin", "deployed_CA.txt"].join(path.sep);
        if (fs.existsSync(path.dirname(robinDeployedFile))) {
          fs.appendFileSync(robinDeployedFile, `${caAddr}\n`, 'utf8');
        }
      } catch {}
      try {
        const scannerCaFile = ["D:", "SEMUABOT", "Scaner", "CA.txt"].join(path.sep);
        if (fs.existsSync(path.dirname(scannerCaFile))) {
          fs.writeFileSync(scannerCaFile, caAddr, 'utf8');
        }
      } catch {}
    }

    return NextResponse.json({
      success: true,
      stdout: cleanStdout,
      contractAddress: resultMeta.contractAddress,
      txHash: resultMeta.txHash,
      txSetClaimConditions: resultMeta.txSetClaimConditions || null,
      txMintToken: resultMeta.txMintToken || null,
      verified: resultMeta.verified,
      renounced: resultMeta.renounced,
      mode: resultMeta.mode || normalizedMode
    });

  } catch (error) {
    console.error("[API] Error saat deploy:", error);
    return NextResponse.json({
      success: false,
      error: "Kesalahan saat memproses deploy.",
      details: error.message || String(error)
    }, { status: 500 });
  }
}
