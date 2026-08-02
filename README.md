# ⚡ CS2 Market Pro Trader Bot

Автоматизированный торговый терминал и 24/7 бот для **market.csgo.com (Sunstrike Market API v2)**. Предназначен для автоподнятия скинов, динамического андеркатинга конкурентов, управления инвентарем и глубокого анализа прибыли (ROI/Profit Tracking).

![CS2 Market Bot Interface](https://img.shields.io/badge/CS2-Market_Bot-blue?style=for-the-badge&logo=counter-strike)
![Node.js](https://img.shields.io/badge/Node.js-18+-green?style=for-the-badge&logo=node.js)
![License](https://img.shields.io/badge/License-MIT-orange?style=for-the-badge)

---

## ✨ Основные возможности

### 🤖 24/7 Авто-трейдинг и Repricer
- **24/7 Heartbeat (Keep-Alive)** — поддержание онлайн-статуса и P2P соединения без необходимости держать вкладку сайта открытой.
- **Smart Repricer (Undercutting)** — автоматически мониторит минимальные цены на рынке и перебивает конкурентов на заданную величину ($0.01 и т.д.).
- **Min Price Floor** — защита от ухода в минус. Возможность настроить как глобальный минимальный порог цены, так и индивидуальный для каждого скина.
- **Rate Limiter** — встроенный менеджер очереди запросов (максимум 4 req/sec) для соблюдения лимитов API маркета без банов.

### 📊 Аналитика и Трекинг Прибыли
- **Profit & Loss Dashboard** — подсчёт чистой прибыли, валовой выручки и ROI за 30 дней.
- **Daily Revenue Chart** — интерактивный график дневного дохода.
- **Top Items & Recent Sales** — статистика лучших скинов по маржинальности и история последних продаж.

### 🏷️ Управление и Массовые Операции
- **Competitive Pricing Gap** — наглядное сравнение вашей цены с минимальной рыночной прямо в таблице активных лотов.
- **Mass Listing** — выставление всего доступного CS2 инвентаря в один клик.
- **Steam Inventory Sync** — принудительная синхронизация предметов с маркетом.

---

## 🛠️ Технологический стек

- **Backend:** Node.js, Express, Axios (API Client v2)
- **Frontend:** HTML5, CSS3 (Custom CS2 Dark Theme), Vanilla JavaScript
- **Architecture:** Async Request Queue, Local Storage & Cache System

---

## 🚀 Быстрый старт

### 1. Клонирование и установка зависимостей

```bash
git clone https://github.com/your-username/csgomarketbot.git
cd csgomarketbot
npm install
```

### 2. Запуск приложения

```bash
npm start
```

После запуска открывайте браузер по адресу: `http://localhost:3000`

---

## ⚙️ Настройка

1. Перейдите во вкладку **API Credentials** в веб-панели.
2. Введите ваш **Market.CSGO API Key** (можно получить в настройках аккаунта на market.csgo.com).
3. Выберите валюту (**USD**, **RUB**, **EUR**) и сохраните.
4. Во вкладке **Repricer Rules** настройте величину сбития цены (`Undercut Amount`) и минимальный порог (`Min Price Floor`).
5. Нажмите **Start 24/7 Engine** на сайдбаре!

---

## 📜 Структура проекта

```
csgomarketbot/
├── marketApi.js      # Полноценный API v2 клиент с встроенным Rate Limiter
├── botEngine.js      # Ядро бота (heartbeat ping, логика авто-репрайсера)
├── profitTracker.js  # Модуль аналитики и расчёта прибыли/ROI
├── server.js         # REST API сервер (Express)
├── public/           # Веб-интерфейс терминала
│   ├── index.html    # Структура UI (вкладки, таблицы, KPI)
│   ├── app.js        # Фронтенд логика и отрисовка графиков
│   └── styles.css    # CS2 Pro-Trader стиль и адаптивная вёрстка
└── data.json         # Локальное хранение настроек и логов
```

---

## 🛡️ Безопасность

- API ключ хранится локально на вашей машине и передаётся только напрямую к официальным эндпоинтам `market.csgo.com`.
- Файлы конфигурации и кэша прибыли внесены в `.gitignore`.

---

## 📝 Лицензия

Проект распространяется под лицензией MIT.
