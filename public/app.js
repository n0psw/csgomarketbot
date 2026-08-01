document.addEventListener('DOMContentLoaded', () => {
  const navItems = document.querySelectorAll('.nav-item');
  const tabContents = document.querySelectorAll('.tab-content');
  const pageTitle = document.getElementById('pageTitle');
  const pageSubtitle = document.getElementById('pageSubtitle');
  
  const botStatusBadge = document.getElementById('botStatusBadge');
  const statusText = document.getElementById('statusText');
  const toggleBotBtn = document.getElementById('toggleBotBtn');
  const repriceNowBtn = document.getElementById('repriceNowBtn');
  const userBalanceText = document.getElementById('userBalanceText');
  
  const statActiveListings = document.getElementById('statActiveListings');
  const statPingCount = document.getElementById('statPingCount');
  const statRepriceCount = document.getElementById('statRepriceCount');
  const statP2PStatus = document.getElementById('statP2PStatus');
  const navSalesCount = document.getElementById('navSalesCount');
  const recentLogStream = document.getElementById('recentLogStream');
  
  const settingsForm = document.getElementById('settingsForm');
  const rulesForm = document.getElementById('rulesForm');
  const inputApiKey = document.getElementById('inputApiKey');
  const selectCurrency = document.getElementById('selectCurrency');
  const inputPingInterval = document.getElementById('inputPingInterval');
  const inputRepriceInterval = document.getElementById('inputRepriceInterval');
  
  const inputUndercut = document.getElementById('inputUndercut');
  const inputDefaultMin = document.getElementById('inputDefaultMin');
  const checkAutoList = document.getElementById('checkAutoList');
  
  const salesSearchInput = document.getElementById('salesSearchInput');
  const inventorySearchInput = document.getElementById('inventorySearchInput');

  const priceModalOverlay = document.getElementById('priceModalOverlay');
  const modalTitle = document.getElementById('modalTitle');
  const modalItemName = document.getElementById('modalItemName');
  const modalPriceInput = document.getElementById('modalPriceInput');
  const modalSaveBtn = document.getElementById('modalSaveBtn');
  const modalCancelBtn = document.getElementById('modalCancelBtn');
  const modalCloseBtn = document.getElementById('modalCloseBtn');

  const btnRefreshData = document.getElementById('repriceNowBtn');
  const btnDelistAll = document.getElementById('btnDelistAll');
  const btnRefreshSales = document.getElementById('btnRefreshSales');
  const btnRefreshInventory = document.getElementById('btnRefreshInventory');
  const btnRefreshP2P = document.getElementById('btnRefreshP2P');

  const salesTableBody = document.getElementById('salesTableBody');
  const inventoryGrid = document.getElementById('inventoryGrid');
  const p2pTradesList = document.getElementById('p2pTradesList');
  const fullLogStream = document.getElementById('fullLogStream');

  let currentStatus = null;
  let rawSalesItems = [];
  let rawInventoryItems = [];
  let activeModalCallback = null;

  // Helper for CS2 item rarity colors
  function getItemRarityColor(name) {
    if (!name) return 'var(--rarity-consumer)';
    const n = name.toLowerCase();
    if (n.includes('★') || n.includes('knife') || n.includes('gloves')) return 'var(--rarity-gold)';
    if (n.includes('covert') || n.includes('dragon lore') || n.includes('howl') || n.includes('asiimov') || n.includes('fade')) return 'var(--rarity-covert)';
    if (n.includes('classified') || n.includes('redline') || n.includes('hyper beast')) return 'var(--rarity-classified)';
    if (n.includes('restricted') || n.includes('decimator') || n.includes('muertos')) return 'var(--rarity-restricted)';
    if (n.includes('mil-spec') || n.includes('blue fissure')) return 'var(--rarity-milspec)';
    return 'var(--rarity-industrial)';
  }

  // Nav Switch
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const tab = item.getAttribute('data-tab');
      navItems.forEach(n => n.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      
      item.classList.add('active');
      const targetTab = document.getElementById(`tab-${tab}`);
      if (targetTab) targetTab.classList.add('active');

      switch (tab) {
        case 'dashboard':
          pageTitle.textContent = 'Trading Terminal Overview';
          pageSubtitle.textContent = 'Real-time stats, 24/7 heartbeat monitoring & account balance';
          break;
        case 'sales':
          pageTitle.textContent = 'Active Market Listings';
          pageSubtitle.textContent = 'Manage listed CS2 skins & dynamic prices';
          loadSales();
          break;
        case 'inventory':
          pageTitle.textContent = 'Steam CS2 Inventory';
          pageSubtitle.textContent = 'Select items from Steam inventory to put on sale';
          loadInventory();
          break;
        case 'rules':
          pageTitle.textContent = 'Repricer Strategy Rules';
          pageSubtitle.textContent = 'Undercut rules & minimum floor prices';
          break;
        case 'logs':
          pageTitle.textContent = 'Terminal Logs & P2P Offers';
          pageSubtitle.textContent = 'Monitor heartbeats & pending trade offers';
          loadP2PTrades();
          break;
        case 'settings':
          pageTitle.textContent = 'API Key Credentials';
          pageSubtitle.textContent = 'Set Market.CSGO API Key';
          break;
      }
    });
  });

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

  function updateUI(data) {
    if (data.isRunning) {
      statusText.textContent = 'RUNNING';
      botStatusBadge.className = 'status-indicator active';
      toggleBotBtn.className = 'btn btn-danger btn-block mt-3';
      toggleBotBtn.innerHTML = '<i class="fa-solid fa-stop"></i> Stop 24/7 Engine';
    } else {
      statusText.textContent = 'STOPPED';
      botStatusBadge.className = 'status-indicator';
      toggleBotBtn.className = 'btn btn-primary btn-block mt-3';
      toggleBotBtn.innerHTML = '<i class="fa-solid fa-play"></i> Start 24/7 Engine';
    }

    if (data.balance && data.balance.money !== undefined) {
      userBalanceText.textContent = `$${(data.balance.money / 100).toFixed(2)} USD / ${data.balance.money} ₽`;
    } else if (data.balance && data.balance.balances) {
      userBalanceText.textContent = `$${data.balance.balances.USD || 0} USD`;
    }

    statActiveListings.textContent = data.stats.activeListingsCount || 0;
    navSalesCount.textContent = data.stats.activeListingsCount || 0;
    statPingCount.textContent = data.stats.pingsCount || 0;
    statRepriceCount.textContent = data.stats.repricesCount || 0;
    statP2PStatus.textContent = data.stats.p2pStatus || 'Online';

    if (data.settings) {
      document.getElementById('summaryCurrency').textContent = data.settings.currency || 'USD';
      document.getElementById('summaryUndercut').textContent = `$${data.settings.undercutAmount || 0.01}`;
      document.getElementById('summaryMinFloor').textContent = `$${data.settings.defaultMinPriceFloor || 0.05}`;

      if (document.activeElement !== inputApiKey) inputApiKey.value = data.settings.apiKey || '';
      if (document.activeElement !== selectCurrency) selectCurrency.value = data.settings.currency || 'USD';
      if (document.activeElement !== inputPingInterval) inputPingInterval.value = data.settings.pingIntervalSec || 120;
      if (document.activeElement !== inputRepriceInterval) inputRepriceInterval.value = data.settings.repriceIntervalSec || 180;
      
      if (document.activeElement !== inputUndercut) inputUndercut.value = data.settings.undercutAmount || 0.01;
      if (document.activeElement !== inputDefaultMin) inputDefaultMin.value = data.settings.defaultMinPriceFloor || 0.05;
      if (checkAutoList) checkAutoList.checked = !!data.settings.autoListNewItems;
    }

    renderLogs(data.logs || []);
  }

  function renderLogs(logs) {
    if (!recentLogStream || !fullLogStream) return;
    if (logs.length === 0) {
      recentLogStream.innerHTML = '<div class="empty-state">No logs recorded yet.</div>';
      fullLogStream.innerHTML = '<div class="empty-state">No logs recorded yet.</div>';
      return;
    }

    const html = logs.map(l => {
      const time = new Date(l.timestamp).toLocaleTimeString();
      return `<div class="log-row">
        <span class="log-time">[${time}]</span>
        <span class="log-text ${l.type}">${escapeHtml(l.message)}</span>
      </div>`;
    }).join('');

    recentLogStream.innerHTML = html;
    fullLogStream.innerHTML = html;
  }

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
      if (data.success) fetchStatus(); else alert(`Error: ${data.error}`);
    } catch (err) { alert(`Failed: ${err.message}`); }
  });

  rulesForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      undercutAmount: parseFloat(inputUndercut.value) || 0.01,
      defaultMinPriceFloor: parseFloat(inputDefaultMin.value) || 0.05,
      autoListNewItems: checkAutoList ? checkAutoList.checked : false
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

  if (btnDelistAll) {
    btnDelistAll.addEventListener('click', async () => {
      if (!confirm('Delist ALL items from sale?')) return;
      try {
        const res = await fetch('/api/listings/remove-all', { method: 'POST' });
        const data = await res.json();
        if (data.success) { loadSales(); fetchStatus(); } else alert(`Error: ${data.error}`);
      } catch (e) { alert(`Failed: ${e.message}`); }
    });
  }

  async function loadSales() {
    salesTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px;">Loading active sales...</td></tr>';
    try {
      const res = await fetch('/api/listings');
      const json = await res.json();
      if (!json.success || !json.data || !Array.isArray(json.data.items)) {
        salesTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 20px; color: var(--text-muted);">${json.error || 'No active listings.'}</td></tr>`;
        return;
      }
      rawSalesItems = json.data.items;
      renderSalesTable();
    } catch (e) {
      salesTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 20px; color: var(--text-muted);">Error: ${e.message}</td></tr>`;
    }
  }

  function renderSalesTable() {
    const query = (salesSearchInput ? salesSearchInput.value : '').toLowerCase().trim();
    const filtered = rawSalesItems.filter(i => (i.market_hash_name || '').toLowerCase().includes(query));

    if (filtered.length === 0) {
      salesTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px; color: var(--text-muted);">No items found.</td></tr>';
      return;
    }

    salesTableBody.innerHTML = filtered.map(item => {
      const cur = currentStatus && currentStatus.settings ? currentStatus.settings.currency : 'USD';
      const minFloor = currentStatus && currentStatus.settings.minPrices[item.market_hash_name] || currentStatus.settings.defaultMinPriceFloor || 0.05;
      const rarityColor = getItemRarityColor(item.market_hash_name);
      const statusBadge = item.status == 1 ? '<span style="color: var(--status-emerald); font-weight:700;">● Listed</span>' : '<span style="color: var(--status-amber); font-weight:700;">● Pending Trade</span>';

      return `
        <tr>
          <td>
            <div class="item-title-box">
              <div class="name">${escapeHtml(item.market_hash_name)}</div>
              <div class="rarity-bar" style="background: ${rarityColor};"></div>
            </div>
          </td>
          <td>${statusBadge}</td>
          <td><strong class="tabular-nums">${item.price} ${cur}</strong></td>
          <td class="tabular-nums">$${minFloor}</td>
          <td>
            <button class="btn btn-sm btn-secondary btn-set-price" data-id="${item.item_id || item.id}" data-name="${escapeHtml(item.market_hash_name)}" data-price="${item.price}">
              <i class="fa-solid fa-pen"></i> Price
            </button>
            <button class="btn btn-sm btn-danger btn-delist-item" data-id="${item.item_id || item.id}">
              <i class="fa-solid fa-trash"></i>
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

  if (salesSearchInput) salesSearchInput.addEventListener('input', renderSalesTable);

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

  async function loadInventory() {
    inventoryGrid.innerHTML = '<div class="empty-state"><i class="fa-solid fa-spinner fa-spin"></i> Loading inventory...</div>';
    try {
      const res = await fetch('/api/inventory');
      const json = await res.json();
      if (!json.success || !json.data || !Array.isArray(json.data.items)) {
        inventoryGrid.innerHTML = `<div class="empty-state">${json.error || 'Inventory empty.'}</div>`;
        return;
      }
      rawInventoryItems = json.data.items;
      renderInventoryGrid();
    } catch (e) {
      inventoryGrid.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`;
    }
  }

  function renderInventoryGrid() {
    const query = (inventorySearchInput ? inventorySearchInput.value : '').toLowerCase().trim();
    const filtered = rawInventoryItems.filter(i => (i.market_hash_name || '').toLowerCase().includes(query));

    if (filtered.length === 0) {
      inventoryGrid.innerHTML = '<div class="empty-state">No matching inventory items found.</div>';
      return;
    }

    inventoryGrid.innerHTML = filtered.map(item => {
      const iconUrl = item.icon_url ? `https://community.cloudflare.steamstatic.com/economy/image/${item.icon_url}/300fx300f` : '';
      const rarityColor = getItemRarityColor(item.market_hash_name);
      return `
        <div class="item-card" style="border-bottom: 2px solid ${rarityColor};">
          <div class="img-box">
            ${iconUrl ? `<img src="${iconUrl}" alt="${escapeHtml(item.market_hash_name)}">` : ''}
          </div>
          <div class="title">${escapeHtml(item.market_hash_name)}</div>
          <button class="btn btn-sm btn-primary btn-list-item" data-id="${item.id}" data-name="${escapeHtml(item.market_hash_name)}">
            <i class="fa-solid fa-plus"></i> List
          </button>
        </div>
      `;
    }).join('');

    document.querySelectorAll('.btn-list-item').forEach(b => {
      b.addEventListener('click', () => {
        openPriceModal('List Item on Market', b.getAttribute('data-name'), '1.00', async (price) => {
          await listItem(b.getAttribute('data-id'), price);
        });
      });
    });
  }

  if (inventorySearchInput) inventorySearchInput.addEventListener('input', renderInventoryGrid);

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

  async function loadP2PTrades() {
    if (!p2pTradesList) return;
    p2pTradesList.innerHTML = '<div class="empty-state"><i class="fa-solid fa-spinner fa-spin"></i> Checking trade offers...</div>';
    try {
      const res = await fetch('/api/p2p-trades');
      const json = await res.json();
      if (!json.success || !json.data || !Array.isArray(json.data.offers) || json.data.offers.length === 0) {
        p2pTradesList.innerHTML = '<div class="empty-state">No pending P2P trade requests right now.</div>';
        return;
      }
      p2pTradesList.innerHTML = json.data.offers.map(o => `
        <div style="background: var(--status-blue-bg); border: 1px solid rgba(59, 130, 246, 0.2); padding: 12px; border-radius: var(--radius-md); font-size: 12px;">
          <strong style="color: var(--status-blue);">Pending P2P Trade Offer:</strong><br>
          Partner ID: <code class="tabular-nums">${o.partner}</code> | Token: <code>${o.token}</code><br>
          Message: "<strong>${escapeHtml(o.tradeoffermessage || '')}</strong>"
        </div>
      `).join('');
    } catch (e) { p2pTradesList.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`; }
  }

  if (btnRefreshSales) btnRefreshSales.addEventListener('click', loadSales);
  if (btnRefreshInventory) btnRefreshInventory.addEventListener('click', loadInventory);
  if (btnRefreshP2P) btnRefreshP2P.addEventListener('click', loadP2PTrades);

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  fetchStatus();
  setInterval(fetchStatus, 4000);
});
