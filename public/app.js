document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const navItems = document.querySelectorAll('.nav-item');
  const tabContents = document.querySelectorAll('.tab-content');
  const pageTitle = document.getElementById('pageTitle');
  const pageSubtitle = document.getElementById('pageSubtitle');
  
  const botStatusBadge = document.getElementById('botStatusBadge');
  const botStatusDesc = document.getElementById('botStatusDesc');
  const toggleBotBtn = document.getElementById('toggleBotBtn');
  const repriceNowBtn = document.getElementById('repriceNowBtn');
  const userBalanceText = document.getElementById('userBalanceText');
  
  // Dashboard Stats
  const statActiveListings = document.getElementById('statActiveListings');
  const statPingCount = document.getElementById('statPingCount');
  const statRepriceCount = document.getElementById('statRepriceCount');
  const statP2PStatus = document.getElementById('statP2PStatus');
  const navSalesCount = document.getElementById('navSalesCount');
  const recentLogStream = document.getElementById('recentLogStream');
  
  // Settings & Rules Forms
  const settingsForm = document.getElementById('settingsForm');
  const rulesForm = document.getElementById('rulesForm');
  const inputApiKey = document.getElementById('inputApiKey');
  const selectCurrency = document.getElementById('selectCurrency');
  const inputPingInterval = document.getElementById('inputPingInterval');
  const inputRepriceInterval = document.getElementById('inputRepriceInterval');
  
  const inputUndercut = document.getElementById('inputUndercut');
  const inputDefaultMin = document.getElementById('inputDefaultMin');
  const checkAutoList = document.getElementById('checkAutoList');
  
  // Buttons
  const btnRefreshData = document.getElementById('btnRefreshData');
  const btnDelistAll = document.getElementById('btnDelistAll');
  const btnRefreshSales = document.getElementById('btnRefreshSales');
  const btnRefreshInventory = document.getElementById('btnRefreshInventory');
  const btnRefreshP2P = document.getElementById('btnRefreshP2P');

  // Tables & Grids
  const salesTableBody = document.getElementById('salesTableBody');
  const inventoryGrid = document.getElementById('inventoryGrid');
  const p2pTradesList = document.getElementById('p2pTradesList');
  const fullLogStream = document.getElementById('fullLogStream');

  let currentStatus = null;

  // 1. Tab Navigation Handler
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const tab = item.getAttribute('data-tab');
      navItems.forEach(n => n.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      
      item.classList.add('active');
      const targetTab = document.getElementById(`tab-${tab}`);
      if (targetTab) targetTab.classList.add('active');

      // Update Page Headers
      switch (tab) {
        case 'dashboard':
          pageTitle.textContent = 'Dashboard';
          pageSubtitle.textContent = 'Real-time overview of Market.CSGO bot operations & balance';
          break;
        case 'sales':
          pageTitle.textContent = 'Active Sales';
          pageSubtitle.textContent = 'Manage items listed on Market.CSGO and update prices';
          loadSales();
          break;
        case 'inventory':
          pageTitle.textContent = 'Steam Inventory';
          pageSubtitle.textContent = 'Select items from your Steam CS2 inventory to list for sale';
          loadInventory();
          break;
        case 'rules':
          pageTitle.textContent = 'Pricing Strategy & Rules';
          pageSubtitle.textContent = 'Configure auto-undercut step and minimum price floors';
          break;
        case 'logs':
          pageTitle.textContent = 'Activity Log & P2P Trades';
          pageSubtitle.textContent = 'Monitor live engine heartbeats, sales events, and pending trade offers';
          loadP2PTrades();
          break;
        case 'settings':
          pageTitle.textContent = 'API Settings';
          pageSubtitle.textContent = 'Configure your Market.CSGO API Key and system intervals';
          break;
      }
    });
  });

  // 2. Fetch Bot Status & Balance
  async function fetchStatus() {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      if (data.success) {
        currentStatus = data;
        updateUI(data);
      }
    } catch (e) {
      console.error('Error fetching status:', e);
    }
  }

  // 3. Update UI Elements
  function updateUI(data) {
    // Bot Status Toggle Button & Badge
    if (data.isRunning) {
      botStatusBadge.textContent = 'RUNNING 24/7';
      botStatusBadge.classList.add('active');
      botStatusDesc.textContent = 'Bot daemon is active and processing 24/7 loops.';
      toggleBotBtn.className = 'btn btn-danger-outline btn-block mt-3';
      toggleBotBtn.innerHTML = '<i class="fa-solid fa-stop"></i> Stop 24/7 Bot';
    } else {
      botStatusBadge.textContent = 'STOPPED';
      botStatusBadge.classList.remove('active');
      botStatusDesc.textContent = 'Daemon is paused. Click to activate 24/7 trading.';
      toggleBotBtn.className = 'btn btn-primary btn-block mt-3';
      toggleBotBtn.innerHTML = '<i class="fa-solid fa-play"></i> Launch 24/7 Bot';
    }

    // Balance
    if (data.balance && data.balance.money !== undefined) {
      userBalanceText.textContent = `$${(data.balance.money / 100).toFixed(2)} USD / ${data.balance.money} RUB`;
    } else if (data.balance && data.balance.balances) {
      userBalanceText.textContent = `$${data.balance.balances.USD || 0} USD`;
    }

    // Stats Counters
    statActiveListings.textContent = data.stats.activeListingsCount || 0;
    navSalesCount.textContent = data.stats.activeListingsCount || 0;
    statPingCount.textContent = data.stats.pingsCount || 0;
    statRepriceCount.textContent = data.stats.repricesCount || 0;
    statP2PStatus.textContent = data.stats.p2pStatus || 'Online';

    // Summary Card
    if (data.settings) {
      document.getElementById('summaryCurrency').textContent = data.settings.currency || 'USD';
      document.getElementById('summaryUndercut').textContent = `- $${data.settings.undercutAmount || 0.01} (Undercut lowest competitor)`;
      document.getElementById('summaryMinFloor').textContent = `$${data.settings.defaultMinPriceFloor || 0.05}`;
      document.getElementById('summaryAutoList').textContent = data.settings.autoListNewItems ? 'Enabled (Auto-List Inventory)' : 'Disabled';
      document.getElementById('summaryPingInterval').textContent = `Every ${(data.settings.pingIntervalSec || 120) / 60} minutes`;

      // Fill settings forms if not focused
      if (document.activeElement !== inputApiKey) inputApiKey.value = data.settings.apiKey || '';
      if (document.activeElement !== selectCurrency) selectCurrency.value = data.settings.currency || 'USD';
      if (document.activeElement !== inputPingInterval) inputPingInterval.value = data.settings.pingIntervalSec || 120;
      if (document.activeElement !== inputRepriceInterval) inputRepriceInterval.value = data.settings.repriceIntervalSec || 180;
      
      if (document.activeElement !== inputUndercut) inputUndercut.value = data.settings.undercutAmount || 0.01;
      if (document.activeElement !== inputDefaultMin) inputDefaultMin.value = data.settings.defaultMinPriceFloor || 0.05;
      checkAutoList.checked = !!data.settings.autoListNewItems;
    }

    // Logs Streams
    renderLogs(data.logs || []);
  }

  function renderLogs(logs) {
    if (logs.length === 0) {
      recentLogStream.innerHTML = '<div class="empty-state">No activity logs recorded yet.</div>';
      fullLogStream.innerHTML = '<div class="empty-state">No activity logs recorded yet.</div>';
      return;
    }

    const html = logs.map(l => {
      const time = new Date(l.timestamp).toLocaleTimeString();
      return `<div class="log-item">
        <span class="log-time">[${time}]</span>
        <span class="log-msg ${l.type}">${escapeHtml(l.message)}</span>
      </div>`;
    }).join('');

    recentLogStream.innerHTML = html;
    fullLogStream.innerHTML = html;
  }

  // 4. Toggle Bot Start/Stop
  toggleBotBtn.addEventListener('click', async () => {
    const isRunning = currentStatus && currentStatus.isRunning;
    const endpoint = isRunning ? '/api/bot/stop' : '/api/bot/start';
    
    try {
      const res = await fetch(endpoint, { method: 'POST' });
      const data = await res.json();
      if (!data.success) {
        alert(`Failed: ${data.error}`);
      }
      fetchStatus();
    } catch (e) {
      alert(`Error toggling bot: ${e.message}`);
    }
  });

  // 5. Reprice Now Button
  repriceNowBtn.addEventListener('click', async () => {
    repriceNowBtn.disabled = true;
    repriceNowBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Repricing...';
    try {
      const res = await fetch('/api/bot/reprice-now', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert('Reprice scan executed successfully!');
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (e) {
      alert(`Error: ${e.message}`);
    } finally {
      repriceNowBtn.disabled = false;
      repriceNowBtn.innerHTML = '<i class="fa-solid fa-rotate"></i> Reprice Now';
      fetchStatus();
    }
  });

  // 6. Settings Form Submit
  settingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      apiKey: inputApiKey.value.trim(),
      currency: selectCurrency.value,
      pingIntervalSec: parseInt(inputPingInterval.value) || 120,
      repriceIntervalSec: parseInt(inputRepriceInterval.value) || 180
    };

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        alert('API Settings saved!');
        fetchStatus();
      } else {
        alert(`Error saving settings: ${data.error}`);
      }
    } catch (err) {
      alert(`Save failed: ${err.message}`);
    }
  });

  // 7. Rules Form Submit
  rulesForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      undercutAmount: parseFloat(inputUndercut.value) || 0.01,
      defaultMinPriceFloor: parseFloat(inputDefaultMin.value) || 0.05,
      autoListNewItems: checkAutoList.checked
    };

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        alert('Pricing rules updated!');
        fetchStatus();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      alert(`Save failed: ${err.message}`);
    }
  });

  // 8. Bulk Delist All Items
  btnDelistAll.addEventListener('click', async () => {
    if (!confirm('Are you sure you want to delist ALL items from sale on Market.CSGO?')) return;
    try {
      const res = await fetch('/api/listings/remove-all', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert('All items delisted successfully!');
        loadSales();
        fetchStatus();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (e) {
      alert(`Delist failed: ${e.message}`);
    }
  });

  // 9. Load Active Sales Table
  async function loadSales() {
    salesTableBody.innerHTML = '<tr><td colspan="6" class="text-center p-4"><i class="fa-solid fa-spinner fa-spin"></i> Loading Market Listings...</td></tr>';
    try {
      const res = await fetch('/api/listings');
      const json = await res.json();
      
      if (!json.success || !json.data || !Array.isArray(json.data.items)) {
        salesTableBody.innerHTML = `<tr><td colspan="6" class="text-center p-4 text-muted">${json.error || 'No active listings found or API Key not configured.'}</td></tr>`;
        return;
      }

      const items = json.data.items;
      if (items.length === 0) {
        salesTableBody.innerHTML = '<tr><td colspan="6" class="text-center p-4 text-muted">No items currently listed for sale.</td></tr>';
        return;
      }

      salesTableBody.innerHTML = items.map(item => {
        const cur = currentStatus && currentStatus.settings ? currentStatus.settings.currency : 'USD';
        const minFloor = currentStatus && currentStatus.settings.minPrices[item.market_hash_name] || currentStatus.settings.defaultMinPriceFloor || 0.05;
        const statusBadge = item.status == 1 ? '<span class="status-badge active">On Sale</span>' : '<span class="status-badge">Sold / Trade Pending</span>';
        
        return `
          <tr>
            <td><strong>${escapeHtml(item.market_hash_name)}</strong></td>
            <td>${statusBadge}</td>
            <td><strong>${item.price} ${cur}</strong></td>
            <td>$${minFloor} ${cur}</td>
            <td><small>${escapeHtml(item.market_hash_name)}</small></td>
            <td>
              <button class="btn btn-sm btn-secondary btn-set-price" data-id="${item.item_id || item.id}" data-price="${item.price}">
                <i class="fa-solid fa-pen"></i> Price
              </button>
              <button class="btn btn-sm btn-danger-outline btn-delist-item" data-id="${item.item_id || item.id}">
                <i class="fa-solid fa-trash"></i> Delist
              </button>
            </td>
          </tr>
        `;
      }).join('');

      // Add Event Listeners for inline edit/delist
      document.querySelectorAll('.btn-set-price').forEach(b => {
        b.addEventListener('click', () => setItemPrice(b.getAttribute('data-id'), b.getAttribute('data-price')));
      });

      document.querySelectorAll('.btn-delist-item').forEach(b => {
        b.addEventListener('click', () => delistSingleItem(b.getAttribute('data-id')));
      });

    } catch (e) {
      salesTableBody.innerHTML = `<tr><td colspan="6" class="text-center p-4 text-muted">Failed to load sales: ${e.message}</td></tr>`;
    }
  }

  async function setItemPrice(id, currentPrice) {
    const newPrice = prompt(`Enter new price in ${currentStatus.settings.currency || 'USD'} for listing #${id}:`, currentPrice);
    if (!newPrice || isNaN(newPrice)) return;

    try {
      const res = await fetch('/api/listings/set-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, price: parseFloat(newPrice) })
      });
      const data = await res.json();
      if (data.success) {
        alert('Price updated!');
        loadSales();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (e) {
      alert(`Update failed: ${e.message}`);
    }
  }

  async function delistSingleItem(id) {
    if (!confirm('Delist this item from sale?')) return;
    try {
      const res = await fetch('/api/listings/set-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, price: 0 })
      });
      const data = await res.json();
      if (data.success) {
        alert('Item delisted!');
        loadSales();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (e) {
      alert(`Delist failed: ${e.message}`);
    }
  }

  // 10. Load Steam Inventory Grid
  async function loadInventory() {
    inventoryGrid.innerHTML = '<div class="empty-state"><i class="fa-solid fa-spinner fa-spin"></i> Fetching Steam CS2 inventory...</div>';
    try {
      const res = await fetch('/api/inventory');
      const json = await res.json();
      
      if (!json.success || !json.data || !Array.isArray(json.data.items)) {
        inventoryGrid.innerHTML = `<div class="empty-state">${json.error || 'Inventory empty or Steam API unreachable.'}</div>`;
        return;
      }

      const items = json.data.items;
      if (items.length === 0) {
        inventoryGrid.innerHTML = '<div class="empty-state">No tradable items found in Steam Inventory.</div>';
        return;
      }

      inventoryGrid.innerHTML = items.map(item => {
        const iconUrl = item.icon_url ? `https://community.cloudflare.steamstatic.com/economy/image/${item.icon_url}/300fx300f` : '';
        return `
          <div class="inventory-card">
            ${iconUrl ? `<img src="${iconUrl}" alt="${escapeHtml(item.market_hash_name)}">` : ''}
            <div class="item-name">${escapeHtml(item.market_hash_name)}</div>
            <button class="btn btn-sm btn-primary btn-list-item mt-2" data-id="${item.id}" data-name="${escapeHtml(item.market_hash_name)}">
              <i class="fa-solid fa-plus"></i> List on Market
            </button>
          </div>
        `;
      }).join('');

      document.querySelectorAll('.btn-list-item').forEach(b => {
        b.addEventListener('click', () => listItemOnMarket(b.getAttribute('data-id'), b.getAttribute('data-name')));
      });

    } catch (e) {
      inventoryGrid.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`;
    }
  }

  async function listItemOnMarket(id, name) {
    const price = prompt(`Enter listing price for "${name}" in ${currentStatus.settings.currency || 'USD'}:`);
    if (!price || isNaN(price)) return;

    try {
      const res = await fetch('/api/listings/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, price: parseFloat(price) })
      });
      const data = await res.json();
      if (data.success) {
        alert(`Successfully listed "${name}" for ${price}!`);
        loadInventory();
        fetchStatus();
      } else {
        alert(`Error listing item: ${data.error}`);
      }
    } catch (e) {
      alert(`Listing failed: ${e.message}`);
    }
  }

  // 11. Load P2P Trade Offers
  async function loadP2PTrades() {
    p2pTradesList.innerHTML = '<div class="empty-state"><i class="fa-solid fa-spinner fa-spin"></i> Checking pending P2P trades...</div>';
    try {
      const res = await fetch('/api/p2p-trades');
      const json = await res.json();
      if (!json.success || !json.data || !Array.isArray(json.data.offers) || json.data.offers.length === 0) {
        p2pTradesList.innerHTML = '<div class="empty-state">No pending P2P trade requests right now.</div>';
        return;
      }

      p2pTradesList.innerHTML = json.data.offers.map(o => {
        return `
          <div class="alert alert-info mt-2">
            <i class="fa-solid fa-handshake"></i> <strong>Pending Trade Offer Required:</strong><br>
            Partner ID: <code>${o.partner}</code> | Token: <code>${o.token}</code><br>
            Offer Message: "<strong>${escapeHtml(o.tradeoffermessage || '')}</strong>"
          </div>
        `;
      }).join('');
    } catch (e) {
      p2pTradesList.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`;
    }
  }

  // Event Listeners for refresh buttons
  btnRefreshData.addEventListener('click', fetchStatus);
  btnRefreshSales.addEventListener('click', loadSales);
  btnRefreshInventory.addEventListener('click', loadInventory);
  btnRefreshP2P.addEventListener('click', loadP2PTrades);

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  // Poll status every 4 seconds
  fetchStatus();
  setInterval(fetchStatus, 4000);
});
