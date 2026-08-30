import fs from 'fs';
import path from 'path';

const STATS_FILE = path.join(process.cwd(), '..', 'data_user', 'global_stats.json');

class GlobalStats {
  constructor() {
    this.stats = {
      totalProfit: 0,
      totalSells: 0,
      totalFails: 0,
      totalUptimeMs: 0,
      lastResetDate: new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Jakarta' }), 
      history24h: []
    };
    this.load();
    
    if (typeof global !== 'undefined' && !global.uptimeTrackerStarted) {
      global.uptimeTrackerStarted = true;
      setInterval(() => this.tickUptime(), 1000);
    }
  }

  load() {
    try {
      if (fs.existsSync(STATS_FILE)) {
        const data = fs.readFileSync(STATS_FILE, 'utf-8');
        this.stats = { ...this.stats, ...JSON.parse(data) };
        this._checkDailyReset();
      } else {
        this.save();
      }
    } catch (err) {
      console.error("Failed to load global stats:", err);
    }
  }

  save() {
    try {
      const dir = path.dirname(STATS_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(STATS_FILE, JSON.stringify(this.stats, null, 2));
    } catch (err) {
      console.error("Failed to save global stats:", err);
    }
  }

  _checkDailyReset() {
    const todayWib = new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Jakarta' });
    if (this.stats.lastResetDate !== todayWib) {
      this.stats.history24h = []; // Reset history for new day
      this.stats.lastResetDate = todayWib;
      this.save();
    }
  }

  recordSale(isSuccess, profitUsd) {
    this._checkDailyReset();

    if (isSuccess) {
      this.stats.totalSells += 1;
      this.stats.totalProfit += profitUsd;
      
      this.stats.history24h.push({
        time: Date.now(),
        profit: profitUsd
      });
      
      // Limit history size to prevent massive files, 200 is plenty for one day
      if (this.stats.history24h.length > 200) {
        this.stats.history24h.shift();
      }
    } else {
      this.stats.totalFails += 1;
    }

    this.save();
  }

  tickUptime() {
    let isRunning = false;
    try {
      const { botProcesses } = require('./store.js');
      const activeBots = Object.keys(botProcesses).filter(k => botProcesses[k].isRunning);
      isRunning = activeBots.length > 0;
    } catch(e) {}

    if (isRunning) {
      this.stats.totalUptimeMs = (this.stats.totalUptimeMs || 0) + 1000;
      this.uptimeSaveCounter = (this.uptimeSaveCounter || 0) + 1000;
      if (this.uptimeSaveCounter >= 10000) {
        this.save();
        this.uptimeSaveCounter = 0;
      }
    }
  }

  getStats() {
    this._checkDailyReset();
    
    const profit24h = this.stats.history24h.reduce((sum, item) => sum + item.profit, 0);
    const successRate = this.stats.totalSells + this.stats.totalFails > 0 
      ? (this.stats.totalSells / (this.stats.totalSells + this.stats.totalFails)) * 100
      : 0;

    return {
      totalProfit: this.stats.totalProfit,
      totalSells: this.stats.totalSells,
      successRate: successRate,
      profit24h: profit24h,
      history24h: this.stats.history24h,
      uptimeMs: this.stats.totalUptimeMs || 0
    };
  }
}

export const globalStats = new GlobalStats();
