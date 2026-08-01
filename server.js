const express = require('express');
const cors = require('cors');
const path = require('path');
const bot = require('./botEngine');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 1. Get bot status, statistics, balance, settings, and logs
app.get('/api/status', async (req, res) => {
  try {
    let balance = { success: false, RUB: 0, USD: 0, EUR: 0 };
    if (bot.settings.apiKey) {
      try {
        const moneyRes = await bot.api.getMoney();
        if (moneyRes && (moneyRes.money !== undefined || moneyRes.balances)) {
          balance = moneyRes;
        }
      } catch (e) {
        // Balance error ignored if invalid key
      }
    }

    const status = bot.getStatus();
    res.json({
      success: true,
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
    bot.start();
    res.json({ success: true, isRunning: bot.isRunning });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 3. Stop Bot 24/7 Daemon
app.post('/api/bot/stop', (req, res) => {
  try {
    bot.stop();
    res.json({ success: true, isRunning: bot.isRunning });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Update Settings
app.post('/api/settings', (req, res) => {
  try {
    bot.updateSettings(req.body);
    res.json({ success: true, settings: bot.settings });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 5. Trigger manual re-pricing run
app.post('/api/bot/reprice-now', async (req, res) => {
  try {
    await bot.runRepriceCycle();
    res.json({ success: true, message: 'Reprice cycle completed' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Get user Steam inventory
app.get('/api/inventory', async (req, res) => {
  try {
    const data = await bot.api.getMyInventory();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Get user active market listings
app.get('/api/listings', async (req, res) => {
  try {
    const data = await bot.api.getItems();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. Add item to sale
app.post('/api/listings/add', async (req, res) => {
  try {
    const { id, price, cur } = req.body;
    if (!id || !price) return res.status(400).json({ success: false, error: 'Missing item id or price' });
    
    // Price in cents
    const priceCents = Math.round(parseFloat(price) * 100);
    const result = await bot.api.addToSale(id, priceCents, cur || bot.settings.currency);
    bot.log('success', `Manually listed item ${id} for ${price} ${cur || bot.settings.currency}`);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 9. Update listing price or delist item
app.post('/api/listings/set-price', async (req, res) => {
  try {
    const { id, price, cur } = req.body;
    if (!id || price === undefined) return res.status(400).json({ success: false, error: 'Missing item id or price' });
    
    const priceCents = Math.round(parseFloat(price) * 100);
    const result = await bot.api.setPrice(id, priceCents, cur || bot.settings.currency);
    bot.log('info', `Set price for item ${id} to ${price} ${cur || bot.settings.currency}`);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 10. Delist all items from sale
app.post('/api/listings/remove-all', async (req, res) => {
  try {
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
    const data = await bot.api.getTradeRequestGiveP2PAll();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`🚀 Market.CSGO 24/7 Trading Bot Web UI is Live!`);
  console.log(`🌐 Open in Browser: http://localhost:${PORT}`);
  console.log(`=================================================`);
});
