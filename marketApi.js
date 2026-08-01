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
  async request(endpoint, params = {}, method = 'GET') {
    if (!this.apiKey && !endpoint.includes('prices/')) {
      throw new Error('API Key is missing. Please set your Market.CSGO API Key in Settings.');
    }

    return new Promise((resolve, reject) => {
      this.requestQueue.push({ endpoint, params, method, resolve, reject });
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

        const response = await axios({
          method: item.method,
          url,
          params: queryParams,
          timeout: 10000
        });

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
   */
  async pingNew() {
    return this.request('ping-new');
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
   * 6. Change price of listed item (or delist if price = 0)
   * @param {string} itemCustomId - Market item listing ID or assetid
   * @param {number} priceCents - New price in cents
   * @param {string} cur - USD, RUB, EUR
   */
  async setPrice(itemCustomId, priceCents, cur = this.currency) {
    return this.request('set-price', {
      id: itemCustomId,
      price: Math.round(priceCents),
      cur
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
}

module.exports = MarketApi;
