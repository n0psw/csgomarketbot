document.addEventListener('DOMContentLoaded', () => {
  // Navigation & Tabs
  const navItems = document.querySelectorAll('.nav-item');
  const tabContents = document.querySelectorAll('.tab-content');
  const pageTitle = document.getElementById('pageTitle');
  const pageSubtitle = document.getElementById('pageSubtitle');
  
  // Header & Status Elements
  const botStatusBadge = document.getElementById('botStatusBadge');
  const statusText = document.getElementById('statusText');
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
  
  // Forms & Inputs
  const settingsForm = document.getElementById('settingsForm');
  const rulesForm = document.getElementById('rulesForm');
  const inputApiKey = document.getElementById('inputApiKey');
  const selectCurrency = document.getElementById('selectCurrency');
  const inputPingInterval = document.getElementById('inputPingInterval');
  const inputRepriceInterval = document.getElementById('inputRepriceInterval');
  
  const inputUndercut = document.getElementById('inputUndercut');
  const inputDefaultMin = document.getElementById('inputDefaultMin');
  const checkAutoList = document.getElementById('checkAutoList');
  
  // Search Inputs
  const salesSearchInput = document.getElementById('salesSearchInput');
  const inventorySearchInput = document.getElementById('inventorySearchInput');

  // Modal Elements
  const priceModalOverlay = document.getElementById('priceModalOverlay');
  const modalTitle = document.getElementById('modalTitle');
  const modalItemName = document.getElementById('modalItemName');
  const modalPriceInput = document.getElementById('modalPriceInput');
  const modalSaveBtn = document.getElementById('modalSaveBtn');
  const modalCancelBtn = document.getElementById('modalCancelBtn');
  const modalCloseBtn = document.getElementById('modalCloseBtn');

  // Action Buttons
  const btnRefreshData = document.getElementById('btnRefreshData');
  const btnDelistAll = document.getElementById('btnDelistAll');
  const btnRefreshSales = document.getElementById('btnRefreshSales');
  const btnRefreshInventory = document.getElementById('btnRefreshInventory');
  const btnRefreshP2P = document.getElementById('btnRefreshP2P');

  // Tables & Feeds
  const salesTableBody = document.getElementById('salesTableBody');
  const inventoryGrid = document.getElementById('inventoryGrid');
  const p2pTradesList = document.getElementById('p2pTradesList');
  const fullLogStream = document.getElementById('fullLogStream');

  let currentStatus = null;
  let rawSalesItems = [];
  let rawInventoryItems = [];
  let activeModalCallback = null;

  // 1. Tab Navigation
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const tab = item.getAttribute('data-tab');
      navItems.forEach(n => {
        n.classList.remove('active');
        n.setAttribute('aria-selected', 'false');
      });
      tabContents.forEach(c => c.classList.remove('active'));
      
      item.classList.add('active');
      item.setAttribute('aria-selected', 'true');
      const targetTab = document.getElementById(`tab-${tab}`);
      if (targetTab) targetTab.classList.add('active');

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

  // 2. Fetch Bot Status
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
    if (data.isRunning) {
      statusText.textContent = 'RUNNING 24/7';
      botStatusBadge.className = 'status-badge active';
      botStatusDesc.textContent = 'Bot daemon is active and processing 24/7 loops.';
      toggleBotBtn.className = 'btn btn-danger-outline btn-block mt-3';
      toggleBotBtn.innerHTML = '<i class="fa-solid fa-stop"></i> Stop 24/7 Bot';
    } else {
      statusText.textContent = 'STOPPED';
      botStatusBadge.className = 'status-badge';
      botStatusDesc.textContent = 'Daemon is paused. Click to activate 24/7 trading.';
      toggleBotBtn.className = 'btn btn-primary btn-block mt-3';
      toggleBotBtn.innerHTML = '<i class="fa-solid fa-play"></i> Launch 24/7 Bot';
    }

    // Balance
    if (data.balance && data.balance.money !== undefined) {
      userBalanceText.textContent = `$${(data.balance.money / 100).toFixed(2)} USD / ${data.balance.money} ₽`;
    } else if (data.balance && data.balance.balances) {
      userBalanceText.textContent = `$${data.balance.balances.USD || 0} USD`;
    }

    // Counters
    statActiveListings.textContent = data.stats.activeListingsCount || 0;
    navSalesCount.textContent = data.stats.activeListingsCount || 0;
    statPingCount.textContent = data.stats.pingsCount || 0;
    statRepriceCount.textContent = data.stats.repricesCount || 0;
    statP2PStatus.textContent = data.stats.p2pStatus || 'Online';

    // Summary
    if (data.settings) {
      document.getElementById('summaryCurrency').textContent = data.settings.currency || 'USD';
      document.getElementById('summaryUndercut').textContent = `- $${data.settings.undercutAmount || 0.01} (Undercut lowest competitor)`;
      document.getElementById('summaryMinFloor').textContent = `$${data.settings.defaultMinPriceFloor || 0.05}`;
      document.getElementById('summaryAutoList').textContent = data.settings.autoListNewItems ? 'Enabled' : 'Disabled';
      document.getElementById('summaryPingInterval').textContent = `Every ${(data.settings.pingIntervalSec || 120) / 60} minutes`;

      if (document.activeElement !== inputApiKey) inputApiKey.value = data.settings.apiKey || '';
      if (document.activeElement !== selectCurrency) selectCurrency.value = data.settings.currency || 'USD';
      if (document.activeElement !== inputPingInterval) inputPingInterval.value = data.settings.pingIntervalSec || 120;
      if (document.activeElement !== inputRepriceInterval) inputRepriceInterval.value = data.settings.repriceIntervalSec || 180;
      
      if (document.activeElement !== inputUndercut) inputUndercut.value = data.settings.undercutAmount || 0.01;
      if (document.activeElement !== inputDefaultMin) inputDefaultMin.value = data.settings.defaultMinPriceFloor || 0.05;
      checkAutoList.checked = !!data.settings.autoListNewItems;
    }

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

  // 4. Modal Dialog Helpers
  function openPriceModal(title, itemName, initialPrice, onSave) {
    modalTitle.textContent = title;
    modalItemName.textContent = itemName;
    modalPriceInput.value = initialPrice || '';
    activeModalCallback = onSave;
    priceModalOverlay.classList.add('active');
    modalPriceInput.focus();
  }

  function closePriceModal() {
    priceModalOverlay.classList.remove('active');
    activeModalCallback = null;
  }

  modalSaveBtn.addEventListener('click', () => {
    const val = parseFloat(modalPriceInput.value);
    if (!isNaN(val) && activeModalCallback) {
      activeModalCallback(val);
    }
    closePriceModal();
  });

  modalCancelBtn.addEventListener('click', closePriceModal);
  modalCloseBtn.addEventListener('click', closePriceModal);

  // 5. Bot Start/Stop
  toggleBotBtn.addEventListener('click', async () => {
    const isRunning = currentStatus && currentStatus.isRunning;
    const endpoint = isRunning ? '/api/bot/stop' : '/api/bot/start';
    
    try {
      const res = await fetch(endpoint, { method: 'POST' });
      const data = await res.json();
      if (!data.success) alert(`Failed: ${data.error}`);
      fetchStatus();
    } catch (e) {
      alert(`Error: ${e.message}`);
    }
  });

  // Reprice Now
  repriceNowBtn.addEventListener('click', async () => {
    repriceNowBtn.disabled = true;
    repriceNowBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Repricing...';
    try {
      const res = await fetch('/api/bot/reprice-now', { method: 'POST' });
      const data = await res.json();
      if (data.success) fetchStatus();
      else alert(`Error: ${data.error}`);
    } catch (e) {
      alert(`Error: ${e.message}`);
    } finally {
      repriceNowBtn.disabled = false;
      repriceNowBtn.innerHTML = '<i class="fa-solid fa-rotate"></i> Reprice Now';
    }
  });

  // Settings & Rules Submissions
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
      if (data.success) { fetchStatus(); } else alert(`Error: ${data.error}`);
    } catch (err) { alert(`Failed: ${err.message}`); }
  });

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
      if (data.success) fetchStatus(); else alert(`Error: ${data.error}`);
    } catch (err) { alert(`Failed: ${err.message}`); }
  });

  btnDelistAll.addEventListener('click', async () => {
    if (!confirm('Delist ALL items from sale?')) return;
    try {
      const res = await fetch('/api/listings/remove-all', { method: 'POST' });
      const data = await res.json();
      if (data.success) { loadSales(); fetchStatus(); } else alert(`Error: ${data.error}`);
    } catch (e) { alert(`Failed: ${e.message}`); }
  });

  // 6. Active Sales List & Filter
  async function loadSales() {
    salesTableBody.innerHTML = '<tr><td colspan="6" class="text-center p-4"><i class="fa-solid fa-spinner fa-spin"></i> Loading Market Listings...</td></tr>';
    try {
      const res = await fetch('/api/listings');
      const json = await res.json();
      if (!json.success || !json.data || !Array.isArray(json.data.items)) {
        salesTableBody.innerHTML = `<tr><td colspan="6" class="text-center p-4 text-muted">${json.error || 'No active listings.'}</td></tr>`;
        return;
      }
      rawSalesItems = json.data.items;
      renderSalesTable();
    } catch (e) {
      salesTableBody.innerHTML = `<tr><td colspan="6" class="text-center p-4 text-muted">Error: ${e.message}</td></tr>`;
    }
  }

  function renderSalesTable() {
    const query = salesSearchInput.value.toLowerCase().trim();
    const filtered = rawSalesItems.filter(i => (i.market_hash_name || '').toLowerCase().includes(query));

    if (filtered.length === 0) {
      salesTableBody.innerHTML = '<tr><td colspan="6" class="text-center p-4 text-muted">No matching items found.</td></tr>';
      return;
    }

    salesTableBody.innerHTML = filtered.map(item => {
      const cur = currentStatus && currentStatus.settings ? currentStatus.settings.currency : 'USD';
      const minFloor = currentStatus && currentStatus.settings.minPrices[item.market_hash_name] || currentStatus.settings.defaultMinPriceFloor || 0.05;
      const statusBadge = item.status == 1 ? '<span class="status-badge active"><span class="dot"></span> On Sale</span>' : '<span class="status-badge"><span class="dot"></span> Sold / Pending</span>';
      
      return `
        <tr>
          <td><strong>${escapeHtml(item.market_hash_name)}</strong></td>
          <td>${statusBadge}</td>
          <td><strong class="tabular-nums">${item.price} ${cur}</strong></td>
          <td class="tabular-nums">$${minFloor}</td>
          <td><small>${escapeHtml(item.market_hash_name)}</small></td>
          <td>
            <button class="btn btn-sm btn-secondary btn-set-price" data-id="${item.item_id || item.id}" data-name="${escapeHtml(item.market_hash_name)}" data-price="${item.price}">
              <i class="fa-solid fa-pen"></i> Price
            </button>
            <button class="btn btn-sm btn-danger-outline btn-delist-item" data-id="${item.item_id || item.id}">
              <i class="fa-solid fa-trash"></i> Delist
            </button>
          </td>
        </tr>
      `;
    }).join('');

    document.querySelectorAll('.btn-set-price').forEach(b => {
      b.addEventListener('click', () => {
        openPriceModal('Edit Listing Price', b.getAttribute('data-name'), b.getAttribute('data-price'), async (newPrice) => {
          await updateItemPrice(b.getAttribute('data-id'), newPrice);
        });
      });
    });

    document.querySelectorAll('.btn-delist-item').forEach(b => {
      b.addEventListener('click', () => delistItem(b.getAttribute('data-id')));
    });
  }

  salesSearchInput.addEventListener('input', renderSalesTable);

  async function updateItemPrice(id, price) {
    try {
      const res = await fetch('/api/listings/set-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, price })
      });
      const data = await res.json();
      if (data.success) loadSales(); else alert(`Error: ${data.error}`);
    } catch (e) { alert(`Failed: ${e.message}`); }
  }

  async function delistItem(id) {
    if (!confirm('Delist item from sale?')) return;
    await updateItemPrice(id, 0);
  }

  // 7. Inventory List & Filter
  async function loadInventory() {
    inventoryGrid.innerHTML = '<div class="empty-state"><i class="fa-solid fa-spinner fa-spin"></i> Fetching Steam CS2 inventory...</div>';
    try {
      const res = await fetch('/api/inventory');
      const json = await res.json();
      if (!json.success || !json.data || !Array.isArray(json.data.items)) {
        inventoryGrid.innerHTML = `<div class="empty-state">${json.error || 'Inventory empty or API Key missing.'}</div>`;
        return;
      }
      rawInventoryItems = json.data.items;
      renderInventoryGrid();
    } catch (e) {
      inventoryGrid.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`;
    }
  }

  function renderInventoryGrid() {
    const query = inventorySearchInput.value.toLowerCase().trim();
    const filtered = rawInventoryItems.filter(i => (i.market_hash_name || '').toLowerCase().includes(query));

    if (filtered.length === 0) {
      inventoryGrid.innerHTML = '<div class="empty-state">No matching inventory items found.</div>';
      return;
    }

    inventoryGrid.innerHTML = filtered.map(item => {
      const iconUrl = item.icon_url ? `https://community.cloudflare.steamstatic.com/economy/image/${item.icon_url}/300fx300f` : '';
      return `
        <div class="inventory-card">
          ${iconUrl ? `<img src="${iconUrl}" alt="${escapeHtml(item.market_hash_name)}" class="item-img-thumbnail">` : ''}
          <div class="item-name">${escapeHtml(item.market_hash_name)}</div>
          <button class="btn btn-sm btn-primary btn-list-item mt-2" data-id="${item.id}" data-name="${escapeHtml(item.market_hash_name)}">
            <i class="fa-solid fa-plus"></i> List on Market
          </button>
        </div>
      `;
    }).join('');

    document.querySelectorAll('.btn-list-item').forEach(b => {
      b.addEventListener('click', () => {
        openPriceModal('List Item on Market.CSGO', b.getAttribute('data-name'), '1.00', async (price) => {
          await listItem(b.getAttribute('data-id'), price);
        });
      });
    });
  }

  inventorySearchInput.addEventListener('input', renderInventoryGrid);

  async function listItem(id, price) {
    try {
      const res = await fetch('/api/listings/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, price })
      });
      const data = await res.json();
      if (data.success) { loadInventory(); fetchStatus(); } else alert(`Error: ${data.error}`);
    } catch (e) { alert(`Failed: ${e.message}`); }
  }

  // 8. P2P Trades
  async function loadP2PTrades() {
    p2pTradesList.innerHTML = '<div class="empty-state"><i class="fa-solid fa-spinner fa-spin"></i> Checking pending P2P trades...</div>';
    try {
      const res = await fetch('/api/p2p-trades');
      const json = await res.json();
      if (!json.success || !json.data || !Array.isArray(json.data.offers) || json.data.offers.length === 0) {
        p2pTradesList.innerHTML = '<div class="empty-state">No pending P2P trade requests right now.</div>';
        return;
      }
      p2pTradesList.innerHTML = json.data.offers.map(o => `
        <div class="alert alert-info mt-2">
          <i class="fa-solid fa-handshake"></i>
          <div>
            <strong>Pending Trade Offer Required:</strong><br>
            Partner ID: <code class="tabular-nums">${o.partner}</code> | Token: <code>${o.token}</code><br>
            Offer Message: "<strong>${escapeHtml(o.tradeoffermessage || '')}</strong>"
          </div>
        </div>
      `).join('');
    } catch (e) { p2pTradesList.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`; }
  }

  btnRefreshData.addEventListener('click', fetchStatus);
  btnRefreshSales.addEventListener('click', loadSales);
  btnRefreshInventory.addEventListener('click', loadInventory);
  btnRefreshP2P.addEventListener('click', loadP2PTrades);

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  fetchStatus();
  setInterval(fetchStatus, 4000);
});
