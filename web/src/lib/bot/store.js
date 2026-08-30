const globalForBots = global;

if (!globalForBots.botProcesses) {
  globalForBots.botProcesses = {};
}

export const botProcesses = globalForBots.botProcesses;
