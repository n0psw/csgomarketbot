const axios = require('axios');

/**
 * Market.CSGO (Sunstrike Market) API v2 Client
 * Official Documentation: https://market.csgo.com/en/api
 */
class MarketApi {
  constructor(apiKey = '', currency = 'USD') {
    this.apiKey = apiKey;
    this.currency = currency; // USD, EUR, RUB
    this.baseUrl = 'https://market.csgo.com/api/v2';
    
    // Rate Limiting: Max 4 requests per second to stay safely below 5 RPS limit
    this.requestQueue = [];
    this.isProcessingQueue = false;
    this.lastRequestTime = 0;
    this.minIntervalMs = 250; // 250ms = 4 req/sec
  }

  setCredentials(apiKey, currency = 'USD') {
    this.apiKey = apiKey;
    this.currency = currency;
  }

  /**
   * Enforce rate limit (max 4 requests per second)
   */
  async request(endpoint, params = {}, method = 'GET', body = null) {
    if (!this.apiKey && !endpoint.includes('prices/')) {
      throw new Error('API Key is missing. Please set your Market.CSGO API Key in Settings.');
    }

    return new Promise((resolve, reject) => {
      this.requestQueue.push({ endpoint, params, method, body, resolve, reject });
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.isProcessingQueue || this.requestQueue.length === 0) return;
    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      const now = Date.now();
      const timeSinceLast = now - this.lastRequestTime;
      if (timeSinceLast < this.minIntervalMs) {
        await new Promise(r => setTimeout(r, this.minIntervalMs - timeSinceLast));
      }

      const item = this.requestQueue.shift();
      this.lastRequestTime = Date.now();

      try {
        const url = item.endpoint.startsWith('http')
          ? item.endpoint
          : `${this.baseUrl}/${item.endpoint}`;
        
        const queryParams = { ...item.params };
        if (this.apiKey && !url.includes('prices/')) {
          queryParams.key = this.apiKey;
        }

        const reqConfig = {
          method: item.method,
          url,
          params: queryParams,
          timeout: 10000
        };

        if (item.method === 'POST') {
          if (item.body) {
            reqConfig.data = typeof item.body === 'string' ? item.body : JSON.stringify(item.body);
            reqConfig.headers = { 'Content-Type': 'application/json' };
          } else {
            reqConfig.data = '';
            reqConfig.headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
          }
        }

        const response = await axios(reqConfig);

        item.resolve(response.data);
      } catch (err) {
        const errMsg = err.response && err.response.data
          ? (err.response.data.error || JSON.stringify(err.response.data))
          : err.message;
        item.reject(new Error(`Market API Error [${item.endpoint}]: ${errMsg}`));
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * 1. Get user balance & money status
   */
  async getMoney() {
    return this.request('get-money');
  }

  /**
   * 2. Ping engine - Keep 24/7 online status (Required every 2-3 min)
   * Supports optional Steam WebAPI access_token and proxy
   */
  async pingNew(accessToken = '', proxy = '') {
    const body = {};
    if (accessToken) body.access_token = accessToken;
    if (proxy) body.proxy = proxy;
    return this.request('ping-new', {}, 'POST', Object.keys(body).length > 0 ? body : null);
  }

  /**
   * 3. Get user Steam inventory items available for sale
   */
  async getMyInventory() {
    return this.request('my-inventory');
  }

  /**
   * 4. Get items currently listed on sale or sold
   */
  async getItems() {
    return this.request('items');
  }

  /**
   * 5. Add item to sale
   * @param {string} id - Steam item assetid
   * @param {number} priceCents - Price in cents (e.g. 10.50 USD = 1050)
   * @param {string} cur - USD, RUB, EUR
   */
  async addToSale(id, priceCents, cur = this.currency) {
    return this.request('add-to-sale', {
      id,
      price: Math.round(priceCents),
      cur
    });
  }

  /**
   * Helper to convert price float to API integer units based on currency.
   * RUB: 1 RUB = 100 kopecks (x100)
   * USD / EUR: 1 USD/EUR = 1000 units (x1000)
   */
  getPriceUnits(priceFloat, currency = this.currency) {
    const cur = (currency || 'USD').toUpperCase();
    const mult = (cur === 'USD' || cur === 'EUR') ? 1000 : 100;
    return Math.round(parseFloat(priceFloat) * mult);
  }

  /**
   * 6. Change price of listed item (or delist if price = 0)
   * @param {string} itemCustomId - Market item listing ID or assetid
   * @param {number} priceUnits - New price in API units (kopecks for RUB, thousandths for USD/EUR)
   * @param {string} cur - USD, RUB, EUR
   */
  async setPrice(itemCustomId, priceUnits, cur = this.currency) {
    return this.request('set-price', {
      id: itemCustomId,
      item_id: itemCustomId,
      price: Math.round(priceUnits),
      cur: cur.toUpperCase()
    });
  }

  /**
   * 7. Delist item (set price to 0)
   */
  async removeFormSale(itemCustomId) {
    return this.setPrice(itemCustomId, 0, this.currency);
  }

  /**
   * 8. Remove all items from sale
   */
  async removeAllFromSale() {
    return this.request('remove-all-from-sale');
  }

  /**
   * 9. Fetch market-wide lowest prices database (Public Endpoint)
   * @param {string} currency - USD, RUB, EUR
   */
  async getMarketPrices(currency = this.currency) {
    const url = `https://market.csgo.com/api/v2/prices/${currency.toUpperCase()}.json`;
    return this.request(url);
  }

  /**
   * 10. Fetch pending P2P trade requests for sold items
   */
  async getTradeRequestGiveP2PAll() {
    return this.request('trade-request-give-p2p-all');
  }

  // ═══════════════════════════════════════════════════════
  // NEW: Analytics & History
  // ═══════════════════════════════════════════════════════

  /**
   * 11. Get purchase/sale history
   * @param {string} dateFrom - DD-MM-YYYY or UNIX timestamp
   * @param {string} dateTo - UNIX timestamp (optional)
   */
  async getHistory(dateFrom, dateTo) {
    const params = {};
    if (dateFrom) params.date = dateFrom;
    if (dateTo) params.date_end = dateTo;
    return this.request('history', params);
  }

  /**
   * 12. Get full operation history (buys, sells, deposits, withdrawals)
   * @param {string} dateFrom - DD-MM-YYYY or UNIX timestamp
   * @param {string} dateTo - UNIX timestamp (optional)
   */
  async getOperationHistory(dateFrom, dateTo) {
    const params = {};
    if (dateFrom) params.date = dateFrom;
    if (dateTo) params.date_end = dateTo;
    return this.request('operation-history', params);
  }

  // ═══════════════════════════════════════════════════════
  // NEW: Search & Price Monitoring
  // ═══════════════════════════════════════════════════════

  /**
   * 13. Search for a single item by market_hash_name
   * Returns all current listings for this item with prices
   * @param {string} hashName - e.g. "AK-47 | Redline (Field-Tested)"
   */
  async searchItemByHashName(hashName) {
    return this.request('search-item-by-hash-name', {
      hash_name: hashName
    });
  }

  /**
   * 14. Bulk search items by multiple hash names
   * @param {string[]} hashNames - Array of market_hash_name values
   */
  async searchListItems(hashNames) {
    const listParam = hashNames.join(',');
    return this.request('search-list-items-by-hash-name-all', {
      list_hash_name: listParam
    });
  }

  // ═══════════════════════════════════════════════════════
  // NEW: Mass Operations
  // ═══════════════════════════════════════════════════════

  /**
   * 15. Mass set prices for multiple items at once
   * @param {Array<{id: string, priceUnits: number}>} items
   */
  async massSetPrice(items, cur = this.currency) {
    const itemsPayload = items.map(i => ({
      item_id: i.id || i.item_id,
      price: Math.round(i.priceUnits !== undefined ? i.priceUnits : i.price)
    }));

    return this.request('mass-set-price', {
      items: JSON.stringify(itemsPayload),
      cur: cur.toUpperCase()
    });
  }

  /**
   * 16. Mass set prices by market_hash_name
   * @param {Array<{hash_name: string, price: number}>} items
   */
  async massSetPriceByHashName(items, cur = this.currency) {
    const hashNames = items.map(i => i.hash_name).join(',');
    const prices = items.map(i => Math.round(i.price)).join(',');
    return this.request('mass-set-price-mhn', {
      hash_name: hashNames,
      price: prices,
      cur
    });
  }

  /**
   * 17. Mass add items to sale (up to 50 at once)
   * @param {Array<{id: string, price: number}>} items - [{id: assetId, price: cents}]
   * @param {string} cur - Currency
   */
  async massAddToSale(items, cur = this.currency) {
    // Build the items param as JSON string: {"id":"price","id2":"price2",...}
    const itemsObj = {};
    items.forEach(i => {
      itemsObj[i.id] = Math.round(i.price);
    });
    return this.request('mass-add-to-sale', {
      items: JSON.stringify(itemsObj),
      cur
    });
  }

  // ═══════════════════════════════════════════════════════
  // NEW: Inventory & Account
  // ═══════════════════════════════════════════════════════

  /**
   * 18. Force refresh Steam inventory cache on market side
   */
  async updateInventory() {
    return this.request('update-inventory');
  }

  /**
   * 19. Get Steam ID associated with this API key
   */
  async getMySteamId() {
    return this.request('get-my-steam-id');
  }

  // ═══════════════════════════════════════════════════════
  // NEW: Buy & Orders
  // ═══════════════════════════════════════════════════════

  /**
   * 20. Buy an item from market
   * @param {string} id - Market item listing ID
   * @param {number} price - Price in cents
   * @param {string} customId - Your unique custom ID for tracking
   */
  async buyItem(id, price, customId) {
    const params = { id, price: Math.round(price) };
    if (customId) params.custom_id = customId;
    return this.request('buy', params);
  }

  /**
   * 21. Get active buy orders
   */
  async getOrders() {
    return this.request('get-orders');
  }

  /**
   * 22. Get buy orders execution log
   */
  async getOrdersLog() {
    return this.request('get-orders-log');
  }

  // ═══════════════════════════════════════════════════════
  // NEW: WebSocket
  // ═══════════════════════════════════════════════════════

  /**
   * 23. Get WebSocket token for real-time notifications
   * Token is valid for 10 minutes, connect to wss://wsprice.csgo.com
   */
  async getWsToken() {
    return this.request('get-ws-token');
  }
}

module.exports = MarketApi;
