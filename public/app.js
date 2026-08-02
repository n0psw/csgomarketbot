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

  const btnDelistAll = document.getElementById('btnDelistAll');
  const btnRefreshSales = document.getElementById('btnRefreshSales');
  const btnRefreshInventory = document.getElementById('btnRefreshInventory');
  const btnRefreshP2P = document.getElementById('btnRefreshP2P');
  const btnListAllInventory = document.getElementById('btnListAllInventory');
  const btnForceRefreshInv = document.getElementById('btnForceRefreshInv');
  const btnRefreshProfit = document.getElementById('btnRefreshProfit');

  const salesTableBody = document.getElementById('salesTableBody');
  const inventoryGrid = document.getElementById('inventoryGrid');
  const p2pTradesList = document.getElementById('p2pTradesList');
  const fullLogStream = document.getElementById('fullLogStream');
  const inventoryCountLabel = document.getElementById('inventoryCountLabel');

  // Analytics elements
  const statTotalProfit = document.getElementById('statTotalProfit');
  const statTotalSales = document.getElementById('statTotalSales');
  const statSalesRevenue = document.getElementById('statSalesRevenue');
  const statROI = document.getElementById('statROI');
  const topItemsBody = document.getElementById('topItemsBody');
  const recentSalesBody = document.getElementById('recentSalesBody');
  const profitChartContainer = document.getElementById('profitChartContainer');
  const chartEmptyState = document.getElementById('chartEmptyState');

  let currentStatus = null;
  let rawSalesItems = [];
  let rawInventoryItems = [];
  let currentMarketPrices = {};
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

  function getCurrencySymbol() {
    const cur = currentStatus?.settings?.currency || 'USD';
    if (cur === 'RUB') return '₽';
    if (cur === 'EUR') return '€';
    return '$';
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
        case 'analytics':
          pageTitle.textContent = 'Profit Analytics';
          pageSubtitle.textContent = 'Revenue tracking, ROI, top items & daily performance';
          loadProfitStats();
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

  // ═══════════════════════════════════════════════════════
  // LISTINGS — Enhanced with Market Prices
  // ═══════════════════════════════════════════════════════

  async function loadSales() {
    salesTableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px;">Loading active sales...</td></tr>';
    try {
      const res = await fetch('/api/listings');
      const json = await res.json();
      if (!json.success || !json.data || !Array.isArray(json.data.items)) {
        salesTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 20px; color: var(--text-muted);">${json.error || 'No active listings.'}</td></tr>`;
        return;
      }
      rawSalesItems = json.data.items;
      currentMarketPrices = json.marketPrices || {};
      renderSalesTable();
    } catch (e) {
      salesTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 20px; color: var(--text-muted);">Error: ${e.message}</td></tr>`;
    }
  }

  function renderSalesTable() {
    const query = (salesSearchInput ? salesSearchInput.value : '').toLowerCase().trim();
    const filtered = rawSalesItems.filter(i => (i.market_hash_name || '').toLowerCase().includes(query));
    const sym = getCurrencySymbol();

    if (filtered.length === 0) {
      salesTableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px; color: var(--text-muted);">No items found.</td></tr>';
      return;
    }

    salesTableBody.innerHTML = filtered.map(item => {
      const cur = currentStatus?.settings?.currency || 'USD';
      const minFloor = currentStatus?.settings?.minPrices?.[item.market_hash_name] || currentStatus?.settings?.defaultMinPriceFloor || 0.05;
      const rarityColor = getItemRarityColor(item.market_hash_name);
      const statusBadge = item.status == 1
        ? '<span style="color: var(--status-emerald); font-weight:700;">● Listed</span>'
        : '<span style="color: var(--status-amber); font-weight:700;">● Pending</span>';

      const ourPrice = parseFloat(item.price);
      const marketMin = currentMarketPrices[item.market_hash_name];
      let marketMinDisplay = '<span class="text-neutral">—</span>';
      let gapDisplay = '<span class="gap-badge gap-neutral">—</span>';

      if (marketMin !== undefined) {
        marketMinDisplay = `<span class="tabular-nums">${sym}${marketMin.toFixed(2)}</span>`;
        const gap = ourPrice - marketMin;
        const gapPct = marketMin > 0 ? ((gap / marketMin) * 100).toFixed(1) : 0;
        if (gap < -0.005) {
          gapDisplay = `<span class="gap-badge gap-positive">${sym}${gap.toFixed(2)} (${gapPct}%)</span>`;
        } else if (gap > 0.005) {
          gapDisplay = `<span class="gap-badge gap-negative">+${sym}${gap.toFixed(2)} (+${Math.abs(gapPct)}%)</span>`;
        } else {
          gapDisplay = `<span class="gap-badge gap-positive">= #1</span>`;
        }
      }

      return `
        <tr>
          <td>
            <div class="item-title-box">
              <div class="name">${escapeHtml(item.market_hash_name)}</div>
              <div class="rarity-bar" style="background: ${rarityColor};"></div>
            </div>
          </td>
          <td>${statusBadge}</td>
          <td><strong class="tabular-nums">${sym}${ourPrice.toFixed(2)}</strong></td>
          <td>${marketMinDisplay}</td>
          <td>${gapDisplay}</td>
          <td class="tabular-nums">${sym}${minFloor}</td>
          <td>
            <button class="btn btn-sm btn-success btn-top1-item" data-id="${item.item_id || item.id}" data-name="${escapeHtml(item.market_hash_name)}" data-market-min="${marketMin || ''}">
              <i class="fa-solid fa-bolt"></i> Top-1
            </button>
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

    document.querySelectorAll('.btn-top1-item').forEach(b => {
      b.addEventListener('click', async () => {
        const id = b.getAttribute('data-id');
        const hashName = b.getAttribute('data-name');
        const marketMinRaw = b.getAttribute('data-market-min');
        
        let marketMin = parseFloat(marketMinRaw);
        if (isNaN(marketMin) || marketMin <= 0) {
          alert(`Could not detect current market min price for "${hashName}".`);
          return;
        }

        const undercut = currentStatus?.settings?.undercutAmount || 0.01;
        const minFloor = currentStatus?.settings?.minPrices?.[hashName] || currentStatus?.settings?.defaultMinPriceFloor || 0.05;

        let targetPrice = Math.max(marketMin - undercut, minFloor);
        targetPrice = Math.round(targetPrice * 100) / 100;

        b.disabled = true;
        b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        await updateItemPrice(id, targetPrice);
      });
    });

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

  const btnMatchAllTop1 = document.getElementById('btnMatchAllTop1');
  if (btnMatchAllTop1) {
    btnMatchAllTop1.addEventListener('click', async () => {
      if (rawSalesItems.length === 0) return;

      const undercut = currentStatus?.settings?.currency === 'RUB' ? 0.01 : (currentStatus?.settings?.undercutAmount || 0.01);
      const undercutStep = currentStatus?.settings?.undercutAmount || 0.01;
      
      const itemsToUpdate = [];
      for (const item of rawSalesItems) {
        const hashName = item.market_hash_name;
        const marketMin = currentMarketPrices[hashName];
        if (!marketMin) continue;

        const minFloor = currentStatus?.settings?.minPrices?.[hashName] || currentStatus?.settings?.defaultMinPriceFloor || 0.05;
        let targetPrice = Math.max(marketMin - undercutStep, minFloor);
        targetPrice = Math.round(targetPrice * 100) / 100;
        
        const currentPriceFloat = parseFloat(item.price);
        if (Math.abs(targetPrice - currentPriceFloat) >= 0.009) {
          itemsToUpdate.push({
            id: item.item_id || item.id,
            price: targetPrice // human readable float (e.g. 3880.21)
          });
        }
      }

      if (itemsToUpdate.length === 0) {
        alert('All items are already at Top-1 price!');
        return;
      }

      if (!confirm(`Match Top-1 price for ${itemsToUpdate.length} item(s)?`)) return;

      btnMatchAllTop1.disabled = true;
      btnMatchAllTop1.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Updating...';

      try {
        const res = await fetch('/api/listings/mass-set-price', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: itemsToUpdate })
        });
        const data = await res.json();
        if (data.success) {
          setTimeout(() => { loadSales(); fetchStatus(); }, 800);
        } else {
          alert(`Error: ${data.error || 'Failed to update prices'}`);
        }
      } catch (e) {
        alert(`Error: ${e.message}`);
      } finally {
        btnMatchAllTop1.disabled = false;
        btnMatchAllTop1.innerHTML = '<i class="fa-solid fa-bolt"></i> Set All to Top-1';
      }
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
      if (data.success) {
        setTimeout(() => { loadSales(); fetchStatus(); }, 800);
      } else {
        alert(`Market API Error: ${data.error || 'Failed to set price'}`);
      }
    } catch (e) { alert(`Failed: ${e.message}`); }
  }

  async function delistItem(id) {
    if (!confirm('Delist item from sale?')) return;
    await updateItemPrice(id, 0);
  }

  // ═══════════════════════════════════════════════════════
  // INVENTORY — With Mass List & Force Refresh
  // ═══════════════════════════════════════════════════════

  async function loadInventory() {
    inventoryGrid.innerHTML = '<div class="empty-state"><i class="fa-solid fa-spinner fa-spin"></i> Loading inventory...</div>';
    try {
      const res = await fetch('/api/inventory');
      const json = await res.json();
      if (!json.success || !json.data || !Array.isArray(json.data.items)) {
        inventoryGrid.innerHTML = `<div class="empty-state">${json.error || 'Inventory empty.'}</div>`;
        if (inventoryCountLabel) inventoryCountLabel.textContent = '0 items';
        return;
      }
      rawInventoryItems = json.data.items;
      if (inventoryCountLabel) inventoryCountLabel.textContent = `${rawInventoryItems.length} items`;
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

  // Mass list all tradable inventory items
  if (btnListAllInventory) {
    btnListAllInventory.addEventListener('click', async () => {
      if (rawInventoryItems.length === 0) {
        alert('No inventory items loaded. Click "Fetch Inventory" first.');
        return;
      }
      const tradable = rawInventoryItems.filter(i => i.tradable !== false);
      if (tradable.length === 0) {
        alert('No tradable items in inventory.');
        return;
      }
      if (!confirm(`List ${tradable.length} item(s) at market undercut price?`)) return;

      btnListAllInventory.disabled = true;
      btnListAllInventory.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Listing...';
      try {
        // Use mass-add if available, fallback to individual
        const items = tradable.map(i => ({
          id: i.id,
          price: 100 // $1.00 default, will be auto-repriced
        }));

        // Batch in groups of 50
        for (let i = 0; i < items.length; i += 50) {
          const batch = items.slice(i, i + 50);
          await fetch('/api/listings/mass-add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: batch })
          });
        }
        loadInventory();
        fetchStatus();
      } catch (e) {
        alert(`Error: ${e.message}`);
      } finally {
        btnListAllInventory.disabled = false;
        btnListAllInventory.innerHTML = '<i class="fa-solid fa-plus"></i> List All';
      }
    });
  }

  // Force refresh Steam inventory on market side
  if (btnForceRefreshInv) {
    btnForceRefreshInv.addEventListener('click', async () => {
      btnForceRefreshInv.disabled = true;
      btnForceRefreshInv.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Syncing...';
      try {
        await fetch('/api/inventory/update', { method: 'POST' });
        // Wait a moment then reload
        setTimeout(() => loadInventory(), 1500);
      } catch (e) {
        alert(`Error: ${e.message}`);
      } finally {
        setTimeout(() => {
          btnForceRefreshInv.disabled = false;
          btnForceRefreshInv.innerHTML = '<i class="fa-solid fa-rotate"></i> Sync Steam';
        }, 2000);
      }
    });
  }

  // ═══════════════════════════════════════════════════════
  // ANALYTICS — Profit Tracking & Charts
  // ═══════════════════════════════════════════════════════

  async function loadProfitStats(forceRefresh = false) {
    try {
      const url = forceRefresh ? '/api/profit-stats?refresh=true' : '/api/profit-stats';
      const res = await fetch(url);
      const json = await res.json();

      if (!json.success || !json.stats) {
        if (chartEmptyState) chartEmptyState.textContent = 'No analytics data available. Make sure your API key is configured.';
        return;
      }

      const s = json.stats;
      const sym = getCurrencySymbol();

      // Update KPI cards
      if (statTotalProfit) {
        const profitVal = s.totalProfit || 0;
        statTotalProfit.textContent = `${sym}${profitVal.toFixed(2)}`;
        statTotalProfit.className = `val tabular-nums ${profitVal >= 0 ? 'text-profit' : 'text-loss'}`;
      }
      if (statTotalSales) statTotalSales.textContent = s.totalSales || 0;
      if (statSalesRevenue) statSalesRevenue.textContent = `${sym}${(s.totalSalesAmount || 0).toFixed(2)}`;
      if (statROI) {
        const roi = s.roi || 0;
        statROI.textContent = `${roi >= 0 ? '+' : ''}${roi}%`;
        statROI.className = `val tabular-nums ${roi >= 0 ? 'text-profit' : 'text-loss'}`;
      }

      // Render bar chart
      renderBarChart(s.dailyChart || []);

      // Render top items table
      renderTopItems(s.topItems || []);

      // Render recent sales
      renderRecentSales(s.recentSales || []);

    } catch (e) {
      console.error('Analytics error:', e);
      if (chartEmptyState) chartEmptyState.textContent = 'Error loading analytics.';
    }
  }

  function renderBarChart(dailyData) {
    if (!profitChartContainer) return;

    if (dailyData.length === 0) {
      if (chartEmptyState) chartEmptyState.textContent = 'No daily data available yet.';
      return;
    }

    if (chartEmptyState) chartEmptyState.style.display = 'none';

    const maxAmount = Math.max(...dailyData.map(d => d.amount), 0.01);
    const sym = getCurrencySymbol();

    const barsHtml = dailyData.map(d => {
      const heightPct = Math.max((d.amount / maxAmount) * 100, 2);
      const dayLabel = d.date.slice(5); // MM-DD
      return `<div class="bar" style="height: ${heightPct}%;" title="${d.date}: ${sym}${d.amount.toFixed(2)} (${d.sales} sales)">
        <div class="bar-tooltip">${d.date}<br>${sym}${d.amount.toFixed(2)} · ${d.sales} sales</div>
      </div>`;
    }).join('');

    const labelsHtml = dailyData.map(d => `<span>${d.date.slice(8)}</span>`).join('');

    // Replace canvas with CSS bar chart
    profitChartContainer.innerHTML = `
      <div class="bar-chart">${barsHtml}</div>
      <div class="bar-chart-labels">${labelsHtml}</div>
    `;
  }

  function renderTopItems(items) {
    if (!topItemsBody) return;
    const sym = getCurrencySymbol();

    if (items.length === 0) {
      topItemsBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px;" class="text-dim">No item data available.</td></tr>';
      return;
    }

    topItemsBody.innerHTML = items.map(item => {
      const profitClass = item.profit >= 0 ? 'text-profit' : 'text-loss';
      const rarityColor = getItemRarityColor(item.name);
      return `
        <tr>
          <td>
            <div class="item-title-box">
              <div class="name">${escapeHtml(item.name)}</div>
              <div class="rarity-bar" style="background: ${rarityColor};"></div>
            </div>
          </td>
          <td class="tabular-nums">${item.sold}</td>
          <td class="tabular-nums">${sym}${item.revenue.toFixed(2)}</td>
          <td class="tabular-nums">${sym}${item.spent.toFixed(2)}</td>
          <td class="tabular-nums ${profitClass}" style="font-weight: 700;">${item.profit >= 0 ? '+' : ''}${sym}${item.profit.toFixed(2)}</td>
        </tr>
      `;
    }).join('');
  }

  function renderRecentSales(sales) {
    if (!recentSalesBody) return;
    const sym = getCurrencySymbol();

    if (sales.length === 0) {
      recentSalesBody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 20px;" class="text-dim">No recent sales.</td></tr>';
      return;
    }

    recentSalesBody.innerHTML = sales.map(sale => {
      const timeStr = sale.time ? new Date(sale.time * 1000).toLocaleString() : '—';
      return `
        <tr>
          <td>${escapeHtml(sale.name)}</td>
          <td class="tabular-nums" style="font-weight: 600;">${sym}${sale.price.toFixed(2)}</td>
          <td class="text-dim" style="font-size: 11px;">${timeStr}</td>
        </tr>
      `;
    }).join('');
  }

  if (btnRefreshProfit) {
    btnRefreshProfit.addEventListener('click', async () => {
      btnRefreshProfit.disabled = true;
      btnRefreshProfit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading...';
      await loadProfitStats(true);
      btnRefreshProfit.disabled = false;
      btnRefreshProfit.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> Refresh Data';
    });
  }

  // ═══════════════════════════════════════════════════════
  // P2P TRADES
  // ═══════════════════════════════════════════════════════

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

  // ═══════════════════════════════════════════════════════
  // EVENT LISTENERS
  // ═══════════════════════════════════════════════════════

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
