const fs = require('fs');
const path = require('path');

const PROFIT_CACHE_FILE = path.join(__dirname, 'profit-cache.json');

/**
 * Profit Tracker Module
 * Calculates profit/loss, ROI, and analytics from Market.CSGO trade history
 */
class ProfitTracker {
  constructor(api) {
    this.api = api;
    this.cache = {
      lastFetch: null,
      history: [],
      operations: [],
      stats: null
    };
    this.loadCache();
  }

  loadCache() {
    try {
      if (fs.existsSync(PROFIT_CACHE_FILE)) {
        const raw = fs.readFileSync(PROFIT_CACHE_FILE, 'utf8');
        const data = JSON.parse(raw);
        if (data) this.cache = { ...this.cache, ...data };
      }
    } catch (e) {
      console.error('ProfitTracker: Error loading cache:', e.message);
    }
  }

  saveCache() {
    try {
      fs.writeFileSync(PROFIT_CACHE_FILE, JSON.stringify(this.cache, null, 2), 'utf8');
    } catch (e) {
      console.error('ProfitTracker: Error saving cache:', e.message);
    }
  }

  /**
   * Fetch trade history from the API and compute profit stats.
   * @param {string} dateFrom - DD-MM-YYYY or UNIX timestamp
   * @param {string} dateTo - UNIX timestamp (optional)
   * @returns {object} Computed profit statistics
   */
  async fetchAndCompute(dateFrom, dateTo) {
    // Fetch sale/purchase history
    let historyItems = [];
    try {
      const histRes = await this.api.getHistory(dateFrom, dateTo);
      if (histRes && histRes.success && Array.isArray(histRes.history)) {
        historyItems = histRes.history;
      }
    } catch (e) {
      console.error('ProfitTracker: History fetch error:', e.message);
    }

    // Fetch operation history (deposits, withdrawals, etc.)
    let operations = [];
    try {
      const opRes = await this.api.getOperationHistory(dateFrom, dateTo);
      if (opRes && opRes.success && Array.isArray(opRes.history)) {
        operations = opRes.history;
      }
    } catch (e) {
      console.error('ProfitTracker: Operations fetch error:', e.message);
    }

    this.cache.history = historyItems;
    this.cache.operations = operations;
    this.cache.lastFetch = new Date().toISOString();

    const stats = this.computeStats(historyItems, operations);
    this.cache.stats = stats;
    this.saveCache();

    return stats;
  }

  /**
   * Compute profit/loss statistics from raw history data
   */
  computeStats(historyItems, operations) {
    const sales = [];
    const purchases = [];

    // Classify history items
    for (const item of historyItems) {
      const entry = {
        hashName: item.market_hash_name || item.hash_name || 'Unknown',
        price: parseFloat(item.received || item.price || 0),
        rawPrice: parseFloat(item.price || 0),
        time: item.time || item.date || null,
        event: item.event || item.stage || '',
        id: item.item_id || item.id || ''
      };

      // "sell" events mean we received money, "buy" events mean we spent money
      if (item.event === 'sell' || item.stage === 'done' || item.received) {
        entry.price = parseFloat(item.received || item.price || 0);
        sales.push(entry);
      } else if (item.event === 'buy' || item.stage === 'buy') {
        entry.price = parseFloat(item.price || 0);
        purchases.push(entry);
      } else {
        // Default: treat as sale if there's a positive received value
        if (parseFloat(item.received || 0) > 0) {
          entry.price = parseFloat(item.received);
          sales.push(entry);
        }
      }
    }

    // Aggregate by item name
    const itemStats = {};
    for (const sale of sales) {
      if (!itemStats[sale.hashName]) {
        itemStats[sale.hashName] = { sold: 0, soldAmount: 0, bought: 0, boughtAmount: 0 };
      }
      itemStats[sale.hashName].sold++;
      itemStats[sale.hashName].soldAmount += sale.price;
    }
    for (const purchase of purchases) {
      if (!itemStats[purchase.hashName]) {
        itemStats[purchase.hashName] = { sold: 0, soldAmount: 0, bought: 0, boughtAmount: 0 };
      }
      itemStats[purchase.hashName].bought++;
      itemStats[purchase.hashName].boughtAmount += purchase.price;
    }

    const totalSalesAmount = sales.reduce((sum, s) => sum + s.price, 0);
    const totalPurchasesAmount = purchases.reduce((sum, p) => sum + p.price, 0);
    const totalProfit = totalSalesAmount - totalPurchasesAmount;

    // Find best and worst items by revenue
    const itemEntries = Object.entries(itemStats).map(([name, data]) => ({
      name,
      ...data,
      netProfit: data.soldAmount - data.boughtAmount
    }));
    itemEntries.sort((a, b) => b.netProfit - a.netProfit);

    const bestItem = itemEntries[0] || null;
    const worstItem = itemEntries[itemEntries.length - 1] || null;

    // Daily breakdown
    const dailyBreakdown = {};
    for (const sale of sales) {
      const day = sale.time ? new Date(sale.time * 1000).toISOString().split('T')[0] : 'unknown';
      if (!dailyBreakdown[day]) dailyBreakdown[day] = { sales: 0, amount: 0 };
      dailyBreakdown[day].sales++;
      dailyBreakdown[day].amount += sale.price;
    }

    // Convert to sorted array for charts
    const dailyChart = Object.entries(dailyBreakdown)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30); // Last 30 days

    return {
      totalSales: sales.length,
      totalPurchases: purchases.length,
      totalSalesAmount: Math.round(totalSalesAmount * 100) / 100,
      totalPurchasesAmount: Math.round(totalPurchasesAmount * 100) / 100,
      totalProfit: Math.round(totalProfit * 100) / 100,
      roi: totalPurchasesAmount > 0
        ? Math.round((totalProfit / totalPurchasesAmount) * 10000) / 100
        : 0,
      bestItem: bestItem ? {
        name: bestItem.name,
        revenue: Math.round(bestItem.soldAmount * 100) / 100,
        count: bestItem.sold
      } : null,
      worstItem: worstItem && worstItem.netProfit < 0 ? {
        name: worstItem.name,
        loss: Math.round(worstItem.netProfit * 100) / 100,
        count: worstItem.sold + worstItem.bought
      } : null,
      topItems: itemEntries.slice(0, 10).map(i => ({
        name: i.name,
        sold: i.sold,
        bought: i.bought,
        revenue: Math.round(i.soldAmount * 100) / 100,
        spent: Math.round(i.boughtAmount * 100) / 100,
        profit: Math.round(i.netProfit * 100) / 100
      })),
      dailyChart,
      recentSales: sales.slice(0, 50).map(s => ({
        name: s.hashName,
        price: Math.round(s.price * 100) / 100,
        time: s.time
      })),
      operationsCount: operations.length,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Get cached stats or fetch fresh if stale (older than 5 min)
   */
  async getStats(forceRefresh = false) {
    const fiveMin = 5 * 60 * 1000;
    const isStale = !this.cache.lastFetch ||
      (Date.now() - new Date(this.cache.lastFetch).getTime()) > fiveMin;

    if (forceRefresh || isStale) {
      // Fetch last 30 days by default
      const thirtyDaysAgo = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
      return this.fetchAndCompute(thirtyDaysAgo.toString());
    }

    return this.cache.stats;
  }
}

module.exports = ProfitTracker;
