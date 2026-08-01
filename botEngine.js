const fs = require('fs');
const path = require('path');
const MarketApi = require('./marketApi');

const DATA_FILE = path.join(__dirname, 'data.json');

class BotEngine {
  constructor() {
    this.api = new MarketApi();
    this.isRunning = false;
    
    this.settings = {
      apiKey: '',
      currency: 'USD',
      undercutAmount: 0.01, // Undercut lowest price by 0.01 USD (1 cent)
      autoListNewItems: false,
      autoListDiscount: 0, // % discount off market price when auto-listing
      defaultMinPriceFloor: 0.05, // Minimum safety floor in USD
      minPrices: {}, // Custom min price per market_hash_name { "AK-47 | Redline (FT)": 10.00 }
      pingIntervalSec: 120, // 2 minutes
      repriceIntervalSec: 180, // 3 minutes
    };

    this.stats = {
      totalSales: 0,
      totalEarned: 0,
      activeListingsCount: 0,
      repricesCount: 0,
      pingsCount: 0,
      lastPingTime: null,
      lastRepriceTime: null,
      p2pStatus: 'Unknown'
    };

    this.logs = [];
    this.pingTimer = null;
    this.repriceTimer = null;

    this.loadData();
    this.api.setCredentials(this.settings.apiKey, this.settings.currency);
  }

  loadData() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        const data = JSON.parse(raw);
        if (data.settings) this.settings = { ...this.settings, ...data.settings };
        if (data.stats) this.stats = { ...this.stats, ...data.stats };
        if (data.logs) this.logs = data.logs.slice(-200); // Keep last 200 logs
      }
    } catch (e) {
      console.error('Error loading data.json:', e.message);
    }
  }

  saveData() {
    try {
      const data = {
        settings: this.settings,
        stats: this.stats,
        logs: this.logs.slice(-200)
      };
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
      console.error('Error saving data.json:', e.message);
    }
  }

  log(type, message) {
    const entry = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 4),
      timestamp: new Date().toISOString(),
      type, // 'info', 'success', 'warn', 'error'
      message
    };
    this.logs.unshift(entry);
    if (this.logs.length > 200) this.logs.pop();
    console.log(`[${type.toUpperCase()}] ${entry.message}`);
    this.saveData();
    return entry;
  }

  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    this.api.setCredentials(this.settings.apiKey, this.settings.currency);
    this.saveData();
    this.log('info', 'Bot settings updated successfully.');
  }

  start() {
    if (this.isRunning) return;
    if (!this.settings.apiKey) {
      this.log('error', 'Cannot start bot: Market.CSGO API Key is not configured!');
      throw new Error('API Key missing');
    }

    this.isRunning = true;
    this.log('success', '🤖 24/7 Market.CSGO Bot Daemon STARTED!');

    // Run initial loops immediately
    this.runPingCycle();
    this.runRepriceCycle();

    // Setup interval timers
    this.pingTimer = setInterval(() => this.runPingCycle(), this.settings.pingIntervalSec * 1000);
    this.repriceTimer = setInterval(() => this.runRepriceCycle(), this.settings.repriceIntervalSec * 1000);
  }

  stop() {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.pingTimer) clearInterval(this.pingTimer);
    if (this.repriceTimer) clearInterval(this.repriceTimer);
    this.pingTimer = null;
    this.repriceTimer = null;
    this.log('warn', '🛑 24/7 Market.CSGO Bot Daemon STOPPED.');
  }

  /**
   * 24/7 Ping Heartbeat Engine
   */
  async runPingCycle() {
    if (!this.isRunning && this.stats.pingsCount > 0) return;
    try {
      const res = await this.api.pingNew();
      if (res && (res.success || res.ping === 'ok')) {
        this.stats.pingsCount++;
        this.stats.lastPingTime = new Date().toISOString();
        this.stats.p2pStatus = res.p2p ? 'Active (P2P OK)' : 'Disabled';
        this.log('info', `Heartbeat ping-new OK. Online status maintained. (P2P: ${res.p2p ? 'Active' : 'Offline'})`);
      } else {
        this.log('warn', `Ping warning response: ${JSON.stringify(res)}`);
      }
    } catch (err) {
      this.log('error', `Ping heartbeat failed: ${err.message}`);
    }
  }

  /**
   * Auto-Repricer Engine: Scans competitors & updates prices to stay #1
   */
  async runRepriceCycle() {
    if (!this.isRunning && this.stats.repricesCount > 0) return;
    this.log('info', '🔄 Starting auto-repricing scan...');
    try {
      // 1. Fetch user active listings
      const itemsRes = await this.api.getItems();
      if (!itemsRes || !itemsRes.success || !Array.isArray(itemsRes.items)) {
        this.log('warn', 'Could not fetch active listings or inventory items.');
        return;
      }

      const activeItems = itemsRes.items.filter(item => item.status === 1 || item.status === '1');
      this.stats.activeListingsCount = activeItems.length;

      // Check for pending trades (sold items requiring P2P offer)
      const pendingTrades = itemsRes.items.filter(item => item.status === 2 || item.status === '2' || item.status === 3 || item.status === '3');
      if (pendingTrades.length > 0) {
        this.log('warn', `⚠️ ALERT: You have ${pendingTrades.length} item(s) sold requiring P2P trade offer creation!`);
        this.checkPendingP2PTrades();
      }

      if (activeItems.length === 0) {
        this.log('info', 'No active listings on sale to reprice.');
        // If auto-listing is enabled, check inventory
        if (this.settings.autoListNewItems) {
          await this.autoListInventoryItems();
        }
        return;
      }

      // 2. Fetch market-wide prices database
      const marketPricesRes = await this.api.getMarketPrices(this.settings.currency);
      const marketPricesMap = {};

      if (marketPricesRes && marketPricesRes.items && Array.isArray(marketPricesRes.items)) {
        marketPricesRes.items.forEach(p => {
          if (p.market_hash_name && p.price) {
            marketPricesMap[p.market_hash_name] = parseFloat(p.price);
          }
        });
      }

      let repricedItemsCount = 0;

      // 3. Process each listed item
      for (const item of activeItems) {
        const hashName = item.market_hash_name;
        const currentPriceFloat = parseFloat(item.price); // Price in currency units
        const lowestMarketPrice = marketPricesMap[hashName];

        if (!lowestMarketPrice) {
          continue;
        }

        // Calculate min price floor
        const customMin = this.settings.minPrices[hashName];
        const minFloor = (customMin !== undefined && customMin > 0)
          ? customMin
          : (this.settings.defaultMinPriceFloor || 0.05);

        // Calculate target undercut price
        let targetPrice = lowestMarketPrice - this.settings.undercutAmount;
        if (targetPrice < minFloor) {
          targetPrice = minFloor;
        }

        // Round to 2 decimals
        targetPrice = Math.round(targetPrice * 100) / 100;

        // Convert to cents for API (10.50 USD -> 1050)
        const targetPriceCents = Math.round(targetPrice * 100);
        const currentPriceCents = Math.round(currentPriceFloat * 100);

        // If target price is lower or higher than current listing price by > 1 cent
        if (Math.abs(targetPriceCents - currentPriceCents) >= 1) {
          try {
            await this.api.setPrice(item.item_id || item.id, targetPriceCents, this.settings.currency);
            repricedItemsCount++;
            this.stats.repricesCount++;
            this.log('success', `🏷️ Repriced "${hashName}": ${currentPriceFloat} -> ${targetPrice} ${this.settings.currency} (Market min: ${lowestMarketPrice})`);
          } catch (e) {
            this.log('error', `Failed to reprice "${hashName}": ${e.message}`);
          }
        }
      }

      this.stats.lastRepriceTime = new Date().toISOString();
      this.log('info', `Reprice cycle complete. Updated ${repricedItemsCount} out of ${activeItems.length} item(s).`);

      // 4. Auto-list items if enabled
      if (this.settings.autoListNewItems) {
        await this.autoListInventoryItems();
      }

    } catch (err) {
      this.log('error', `Reprice cycle error: ${err.message}`);
    }
  }

  /**
   * Auto-list items from Steam inventory onto Market.CSGO
   */
  async autoListInventoryItems() {
    try {
      const invRes = await this.api.getMyInventory();
      if (!invRes || !invRes.success || !Array.isArray(invRes.items) || invRes.items.length === 0) {
        return;
      }

      const marketPricesRes = await this.api.getMarketPrices(this.settings.currency);
      const marketPricesMap = {};
      if (marketPricesRes && marketPricesRes.items && Array.isArray(marketPricesRes.items)) {
        marketPricesRes.items.forEach(p => {
          if (p.market_hash_name && p.price) {
            marketPricesMap[p.market_hash_name] = parseFloat(p.price);
          }
        });
      }

      let listedCount = 0;
      for (const item of invRes.items) {
        if (!item.tradable) continue;

        const hashName = item.market_hash_name;
        const lowestMarketPrice = marketPricesMap[hashName] || 0.10;
        const customMin = this.settings.minPrices[hashName] || this.settings.defaultMinPriceFloor;

        // Calculate price with undercut or discount
        let targetPrice = lowestMarketPrice - this.settings.undercutAmount;
        if (targetPrice < customMin) targetPrice = customMin;

        const priceCents = Math.round(targetPrice * 100);

        try {
          await this.api.addToSale(item.id, priceCents, this.settings.currency);
          listedCount++;
          this.log('success', `📦 Auto-listed "${hashName}" for ${targetPrice} ${this.settings.currency}`);
        } catch (e) {
          this.log('error', `Failed to auto-list "${hashName}": ${e.message}`);
        }
      }

      if (listedCount > 0) {
        this.log('info', `Auto-listing complete: Listed ${listedCount} new item(s) from inventory.`);
      }
    } catch (err) {
      this.log('error', `Auto-listing error: ${err.message}`);
    }
  }

  /**
   * Fetch P2P trade offer instructions for sold items
   */
  async checkPendingP2PTrades() {
    try {
      const tradesRes = await this.api.getTradeRequestGiveP2PAll();
      if (tradesRes && tradesRes.success && Array.isArray(tradesRes.offers)) {
        for (const offer of tradesRes.offers) {
          this.log('warn', `📋 P2P Trade Offer Pending: Partner ID=${offer.partner}, Token=${offer.token}, Trade Message="${offer.tradeoffermessage || ''}". Please send trade in Steam!`);
        }
      }
    } catch (e) {
      this.log('error', `P2P Trades fetch error: ${e.message}`);
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      settings: this.settings,
      stats: this.stats,
      logs: this.logs.slice(0, 50)
    };
  }
}

module.exports = new BotEngine();
