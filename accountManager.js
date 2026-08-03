const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const BotEngine = require('./botEngine');

const ACCOUNTS_FILE = path.join(__dirname, 'accounts.json');

/**
 * AccountManager — manages multiple independent BotEngine instances.
 * Each account has its own API key, bot daemon, settings, logs, and data file.
 */
class AccountManager {
  constructor() {
    /** @type {Map<string, BotEngine>} */
    this.accounts = new Map();

    this.loadAccounts();
  }

  /**
   * Load accounts from accounts.json and instantiate BotEngine per account.
   * Migrates old data.json into a "default" account on first run.
   */
  loadAccounts() {
    // Migration: if accounts.json doesn't exist but old data.json does, create a default account
    if (!fs.existsSync(ACCOUNTS_FILE)) {
      const oldDataFile = path.join(__dirname, 'data.json');
      let migratedSettings = {};

      if (fs.existsSync(oldDataFile)) {
        try {
          const oldData = JSON.parse(fs.readFileSync(oldDataFile, 'utf8'));
          migratedSettings = oldData.settings || {};
          console.log('[AccountManager] Migrated existing data.json into default account.');
        } catch (e) {
          console.error('[AccountManager] Failed to read old data.json for migration:', e.message);
        }
      }

      const defaultId = 'default';
      const accountsList = [{
        id: defaultId,
        name: 'Main Account'
      }];
      fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accountsList, null, 2), 'utf8');

      // Copy old data to the new per-account data file
      const newDataFile = path.join(__dirname, `data-${defaultId}.json`);
      if (fs.existsSync(oldDataFile) && !fs.existsSync(newDataFile)) {
        fs.copyFileSync(oldDataFile, newDataFile);
      }
    }

    // Load accounts list
    try {
      const raw = fs.readFileSync(ACCOUNTS_FILE, 'utf8');
      const accountsList = JSON.parse(raw);

      for (const acct of accountsList) {
        const engine = new BotEngine(acct.id, acct.name);
        this.accounts.set(acct.id, engine);
      }
    } catch (e) {
      console.error('[AccountManager] Failed to load accounts.json:', e.message);
    }

    if (this.accounts.size === 0) {
      // Fallback: create a blank default account
      const engine = new BotEngine('default', 'Main Account');
      this.accounts.set('default', engine);
      this.saveAccounts();
    }

    console.log(`[AccountManager] Loaded ${this.accounts.size} account(s).`);
  }

  /**
   * Persist the accounts list (id + name only, settings stored in per-account data files).
   */
  saveAccounts() {
    try {
      const list = Array.from(this.accounts.values()).map(e => ({
        id: e.accountId,
        name: e.accountName
      }));
      fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(list, null, 2), 'utf8');
    } catch (e) {
      console.error('[AccountManager] Failed to save accounts.json:', e.message);
    }
  }

  /**
   * Get a BotEngine by account ID.
   * @param {string} id
   * @returns {BotEngine|null}
   */
  getAccount(id) {
    return this.accounts.get(id) || null;
  }

  /**
   * Get the first account (fallback default).
   * @returns {BotEngine}
   */
  getDefaultAccount() {
    return this.accounts.values().next().value;
  }

  /**
   * Resolve an account by id, fallback to default.
   * @param {string|undefined} id
   * @returns {BotEngine}
   */
  resolve(id) {
    if (id && this.accounts.has(id)) return this.accounts.get(id);
    return this.getDefaultAccount();
  }

  /**
   * List all accounts with their running status.
   * @returns {Array<{id, name, isRunning, activeListingsCount, apiKeySet}>}
   */
  listAccounts() {
    return Array.from(this.accounts.values()).map(e => ({
      id: e.accountId,
      name: e.accountName,
      isRunning: e.isRunning,
      activeListingsCount: e.stats.activeListingsCount,
      pingsCount: e.stats.pingsCount,
      lastPingTime: e.stats.lastPingTime,
      p2pStatus: e.stats.p2pStatus,
      apiKeySet: !!(e.settings.apiKey),
      currency: e.settings.currency || 'USD'
    }));
  }

  /**
   * Add a new account.
   * @param {string} name - Display name
   * @param {string} [apiKey] - Optional API key to pre-configure
   * @param {string} [currency] - Optional currency (USD/EUR/RUB)
   * @returns {{id: string, name: string}}
   */
  addAccount(name, apiKey = '', currency = 'USD') {
    const id = crypto.randomBytes(6).toString('hex'); // 12 hex chars
    const engine = new BotEngine(id, name, { apiKey, currency });
    this.accounts.set(id, engine);
    this.saveAccounts();
    console.log(`[AccountManager] Added account: "${name}" (id: ${id})`);
    return { id, name };
  }

  /**
   * Remove an account and stop its bot.
   * @param {string} id
   * @returns {boolean}
   */
  removeAccount(id) {
    const engine = this.accounts.get(id);
    if (!engine) return false;

    if (engine.isRunning) engine.stop();

    // Delete per-account data file
    try {
      if (fs.existsSync(engine.dataFile)) {
        fs.unlinkSync(engine.dataFile);
      }
    } catch (e) {
      console.error(`[AccountManager] Could not delete data file for ${id}:`, e.message);
    }

    this.accounts.delete(id);
    this.saveAccounts();
    console.log(`[AccountManager] Removed account: "${engine.accountName}" (id: ${id})`);
    return true;
  }

  /**
   * Rename an account.
   * @param {string} id
   * @param {string} newName
   * @returns {boolean}
   */
  renameAccount(id, newName) {
    const engine = this.accounts.get(id);
    if (!engine) return false;
    engine.accountName = newName;
    this.saveAccounts();
    return true;
  }
}

module.exports = new AccountManager();
