import { BaseAutoSellBot } from "./BaseAutoSellBot.js";
import fs from "fs";
import path from "path";

const userName = process.argv[2];
const profileName = process.argv[3];

if (!userName || !profileName) {
  console.error("Missing userName or profileName");
  process.exit(1);
}

const userDir = path.join(process.cwd(), "..", "..", "..", "..", "data_user", userName, profileName);
const envPath = path.join(userDir, ".env");

try {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const config = { userId: userName, profileName: profileName };
  
  envContent.split('\n').forEach(line => {
    const [key, ...rest] = line.split('=');
    if (key && rest.length > 0) {
      const val = rest.join('=').trim();
      if (key.trim() === 'RPC_URL') config.rpcUrl = val;
      if (key.trim() === 'PRIVATE_KEY') config.privateKey = val;
      if (key.trim() === 'DEFAULT_TOKEN_CA') config.tokenCa = val;
      if (key.trim() === 'LP_POOL_ADDRESS') config.lpPool = val;
      if (key.trim() === 'SLIPPAGE') config.slippage = parseFloat(val);
      if (key.trim() === 'SELL_RATIO_PERCENT') config.sellRatio = parseFloat(val);
    }
  });

  config.dexChoice = "aerodrome"; 
  
  const bot = new BaseAutoSellBot(config);
  bot.start().catch(err => {
    console.error("Bot crash:", err);
    bot.errorLog(`Crash: ${err.message}`);
    process.exit(1);
  });

} catch (err) {
  console.error("Failed to start bot:", err);
  process.exit(1);
}
