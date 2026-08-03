require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const accountManager = require('./accountManager');
const ProfitTracker = require('./profitTracker');

const app = express();
const PORT = process.env.PORT || 3000;

// ProfitTracker is per-account, created lazily
const profitTrackers = new Map();

function getProfitTracker(bot) {
  if (!profitTrackers.has(bot.accountId)) {
    profitTrackers.set(bot.accountId, new ProfitTracker(bot.api));
  }
  return profitTrackers.get(bot.accountId);
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ═══════════════════════════════════════════════════════
// ACCOUNT MANAGEMENT ROUTES
// ═══════════════════════════════════════════════════════

// List all accounts
app.get('/api/accounts', (req, res) => {
  try {
    res.json({ success: true, accounts: accountManager.listAccounts() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Add a new account
app.post('/api/accounts', (req, res) => {
  try {
    const { name, apiKey, currency } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Account name is required' });
    }
    const account = accountManager.addAccount(name.trim(), apiKey || '', currency || 'USD');
    res.json({ success: true, account });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Rename an account
app.put('/api/accounts/:id', (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'New name is required' });
    }
    const ok = accountManager.renameAccount(req.params.id, name.trim());
    if (!ok) return res.status(404).json({ success: false, error: 'Account not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete an account
app.delete('/api/accounts/:id', (req, res) => {
  try {
    // Prevent deleting the last account
    if (accountManager.accounts.size <= 1) {
      return res.status(400).json({ success: false, error: 'Cannot delete the last account' });
    }
    const ok = accountManager.removeAccount(req.params.id);
    if (!ok) return res.status(404).json({ success: false, error: 'Account not found' });
    profitTrackers.delete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Start bot for a specific account
app.post('/api/accounts/:id/start', (req, res) => {
  try {
    const bot = accountManager.getAccount(req.params.id);
    if (!bot) return res.status(404).json({ success: false, error: 'Account not found' });
    bot.start();
    res.json({ success: true, isRunning: bot.isRunning });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Stop bot for a specific account
app.post('/api/accounts/:id/stop', (req, res) => {
  try {
    const bot = accountManager.getAccount(req.params.id);
    if (!bot) return res.status(404).json({ success: false, error: 'Account not found' });
    bot.stop();
    res.json({ success: true, isRunning: bot.isRunning });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════
// HELPER — resolve bot from ?account= query or body.account
// ═══════════════════════════════════════════════════════
function getBot(req) {
  const id = req.query.account || req.body?.account;
  return accountManager.resolve(id);
}

// ═══════════════════════════════════════════════════════
// EXISTING BOT ROUTES (all account-scoped via ?account=id)
// ═══════════════════════════════════════════════════════

// 1. Get bot status, statistics, balance, settings, and logs
app.get('/api/status', async (req, res) => {
  try {
    const bot = getBot(req);
    let balance = { success: false, RUB: 0, USD: 0, EUR: 0 };
    if (bot.settings.apiKey) {
      try {
        const moneyRes = await bot.api.getMoney();
        if (moneyRes && (moneyRes.money !== undefined || moneyRes.balances)) {
          balance = moneyRes;
          if (moneyRes.currency) {
            bot.settings.currency = moneyRes.currency;
            bot.api.currency = moneyRes.currency;
          }
        }
      } catch (e) {
        // Balance error ignored if invalid key
      }
    }

    const status = bot.getStatus();
    res.json({
      success: true,
      accountId: bot.accountId,
      accountName: bot.accountName,
      balance,
      ...status
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Start Bot 24/7 Daemon
app.post('/api/bot/start', (req, res) => {
  try {
    const bot = getBot(req);
    bot.start();
    res.json({ success: true, isRunning: bot.isRunning });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 3. Stop Bot 24/7 Daemon
app.post('/api/bot/stop', (req, res) => {
  try {
    const bot = getBot(req);
    bot.stop();
    res.json({ success: true, isRunning: bot.isRunning });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Update Settings
app.post('/api/settings', (req, res) => {
  try {
    const bot = getBot(req);
    bot.updateSettings(req.body);
    res.json({ success: true, settings: bot.settings });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 5. Trigger manual re-pricing run
app.post('/api/bot/reprice-now', async (req, res) => {
  try {
    const bot = getBot(req);
    await bot.runRepriceCycle();
    res.json({ success: true, message: 'Reprice cycle completed' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Get user Steam inventory
app.get('/api/inventory', async (req, res) => {
  try {
    const bot = getBot(req);
    const data = await bot.api.getMyInventory();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Get user active market listings (enhanced with market prices)
app.get('/api/listings', async (req, res) => {
  try {
    const bot = getBot(req);
    const data = await bot.api.getItems();

    let marketPrices = {};
    try {
      const pricesRes = await bot.api.getMarketPrices(bot.settings.currency);
      if (pricesRes && pricesRes.items && Array.isArray(pricesRes.items)) {
        pricesRes.items.forEach(p => {
          if (p.market_hash_name && p.price) {
            marketPrices[p.market_hash_name] = parseFloat(p.price);
          }
        });
      }
    } catch (e) {
      // Non-critical: market prices unavailable
    }

    res.json({ success: true, data, marketPrices });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. Add item to sale
app.post('/api/listings/add', async (req, res) => {
  try {
    const bot = getBot(req);
    const { id, price, cur } = req.body;
    if (!id || !price) return res.status(400).json({ success: false, error: 'Missing item id or price' });
    
    const currency = cur || bot.settings.currency || 'USD';
    const priceUnits = bot.api.getPriceUnits(price, currency);
    const result = await bot.api.addToSale(id, priceUnits, currency);
    bot.log('success', `Manually listed item ${id} for ${price} ${currency}`);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 9. Update listing price or delist item
app.post('/api/listings/set-price', async (req, res) => {
  try {
    const bot = getBot(req);
    const { id, price, cur } = req.body;
    if (!id || price === undefined) return res.status(400).json({ success: false, error: 'Missing item id or price' });
    
    const currency = cur || bot.settings.currency || 'USD';
    const priceUnits = bot.api.getPriceUnits(price, currency);
    const result = await bot.api.setPrice(id, priceUnits, currency);
    bot.log('info', `Set price for item ${id} to ${price} ${currency}`);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 10. Delist all items from sale
app.post('/api/listings/remove-all', async (req, res) => {
  try {
    const bot = getBot(req);
    const result = await bot.api.removeAllFromSale();
    bot.log('warn', 'Delisted all items from sale on Market.CSGO');
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 11. Fetch pending P2P trade requests for sold items
app.get('/api/p2p-trades', async (req, res) => {
  try {
    const bot = getBot(req);
    const data = await bot.api.getTradeRequestGiveP2PAll();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 12. Get trade history
app.get('/api/history', async (req, res) => {
  try {
    const bot = getBot(req);
    const { from, to } = req.query;
    const data = await bot.api.getHistory(from, to);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 13. Get profit statistics (computed from history)
app.get('/api/profit-stats', async (req, res) => {
  try {
    const bot = getBot(req);
    const profitTracker = getProfitTracker(bot);
    // Update profitTracker API reference in case it changed
    profitTracker.api = bot.api;
    const forceRefresh = req.query.refresh === 'true';
    const stats = await profitTracker.getStats(forceRefresh);
    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 14. Mass add items to sale (up to 50)
app.post('/api/listings/mass-add', async (req, res) => {
  try {
    const bot = getBot(req);
    const { items, cur } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Missing items array' });
    }
    if (items.length > 50) {
      return res.status(400).json({ success: false, error: 'Max 50 items per batch' });
    }

    const result = await bot.api.massAddToSale(items, cur || bot.settings.currency);
    bot.log('success', `📦 Mass-listed ${items.length} item(s) on Market.CSGO`);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 15. Mass set prices (with automatic single-item fallback)
app.post('/api/listings/mass-set-price', async (req, res) => {
  try {
    const bot = getBot(req);
    const { items, cur } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Missing items array' });
    }

    const currency = cur || bot.settings.currency || 'USD';
    const itemsWithUnits = items.map(i => ({
      id: i.id || i.item_id,
      price: i.price,
      priceUnits: i.priceUnits !== undefined ? i.priceUnits : bot.api.getPriceUnits(i.price, currency)
    }));

    let result = null;
    let massSuccess = false;

    try {
      result = await bot.api.massSetPrice(itemsWithUnits, currency);
      if (result && (result.success || result.result)) {
        massSuccess = true;
      }
    } catch (e) {
      // Mass set price failed, falling back to single items
    }

    if (!massSuccess) {
      let successCount = 0;
      for (const item of itemsWithUnits) {
        try {
          await bot.api.setPrice(item.id, item.priceUnits, currency);
          successCount++;
        } catch (singleErr) {
          console.error(`Single setPrice failed for ${item.id}:`, singleErr.message);
        }
      }
      bot.log('info', `🏷️ Repriced ${successCount}/${items.length} item(s) on Market.CSGO via fallback`);
      return res.json({ success: true, count: successCount, fallback: true });
    }

    bot.log('info', `🏷️ Mass-repriced ${items.length} item(s) on Market.CSGO`);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 16. Search market by item name (competitive monitoring)
app.get('/api/market-search/:name', async (req, res) => {
  try {
    const bot = getBot(req);
    const hashName = decodeURIComponent(req.params.name);
    const data = await bot.api.searchItemByHashName(hashName);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 17. Force refresh Steam inventory on market side
app.post('/api/inventory/update', async (req, res) => {
  try {
    const bot = getBot(req);
    const result = await bot.api.updateInventory();
    bot.log('info', '🔄 Forced Steam inventory refresh on Market.CSGO');
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 18. Get operation history (full: buys, sells, deposits, withdrawals)
app.get('/api/operation-history', async (req, res) => {
  try {
    const bot = getBot(req);
    const { from, to } = req.query;
    const data = await bot.api.getOperationHistory(from, to);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`🚀 Market.CSGO 24/7 Trading Bot Web UI is Live!`);
  console.log(`🌐 Open in Browser: http://localhost:${PORT}`);
  console.log(`📁 Accounts loaded: ${accountManager.accounts.size}`);
  console.log(`=================================================`);
});
