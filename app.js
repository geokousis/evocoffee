const STORAGE_KEY = "evocoffee.v1";

const state = loadData();
const sliderPairs = [];

const formatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});
const moneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

const chartColors = ["#4cf7a5", "#e6c36a", "#6ab7ff", "#ff8f5c", "#9b7bff", "#7df5ff"];

const elements = {
  metricBeans: document.getElementById("metric-beans"),
  metricMilk: document.getElementById("metric-milk"),
  metricPurchaseCount: document.getElementById("metric-purchase-count"),
  metricPurchaseAvg: document.getElementById("metric-purchase-avg"),
  metricSpend: document.getElementById("metric-spend"),
  metricTop: document.getElementById("metric-top"),
  lowStock: document.getElementById("low-stock"),
  tableInventory: document.getElementById("table-inventory"),
  tablePurchases: document.getElementById("table-purchases"),
  storageForm: document.getElementById("storage-form"),
  purchaseForm: document.getElementById("purchase-form"),
  chartInventoryBrands: document.getElementById("chart-inventory-brands"),
  chartSpend: document.getElementById("chart-spend"),
  chartSpenders: document.getElementById("chart-spenders"),
  chartCount: document.getElementById("chart-count"),
  chartShare: document.getElementById("chart-share"),
  seedDemo: document.getElementById("seed-demo"),
  exportData: document.getElementById("export-data"),
  importData: document.getElementById("import-data"),
  clearData: document.getElementById("clear-data"),
};

init();

function init() {
  setDefaultDates();
  attachEvents();
  initSliders();
  renderAll();
}

function setDefaultDates() {
  const today = new Date().toISOString().slice(0, 10);
  const dateInput = elements.purchaseForm.querySelector("input[type='date']");
  if (dateInput) {
    dateInput.value = today;
  }
}

function attachEvents() {
  elements.storageForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    const capsLor = toNumber(form.get("caps_lor"));
    const capsIlly = toNumber(form.get("caps_illy"));
    const capsOther = toNumber(form.get("caps_other"));
    const capsules = capsLor + capsIlly + capsOther;
    const milk = toNumber(form.get("milk"));

    state.inventory.beans_g = capsules;
    state.inventory.milk_l = milk;
    state.inventory.updated_at = new Date().toISOString();
    state.inventory.reason = "";
    state.inventory.brand_counts = {
      LOR: capsLor,
      Illy: capsIlly,
      Other: capsOther,
    };

    state.inventoryLog.unshift({
      id: crypto.randomUUID(),
      date: new Date().toISOString().slice(0, 10),
      capsules,
      capsLor,
      capsIlly,
      capsOther,
      milk,
    });

    event.target.reset();
    saveData();
    renderAll();
  });

  elements.purchaseForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    const entry = {
      id: crypto.randomUUID(),
      date: form.get("date"),
      buyer: form.get("buyer")?.trim() || "",
      amount: toNumber(form.get("amount")),
      notes: form.get("notes")?.trim() || "",
    };

    if (!entry.buyer || entry.amount <= 0) {
      return;
    }

    state.purchases.unshift(entry);
    saveData();
    renderAll();
    event.target.reset();
    setDefaultDates();
  });

  elements.exportData.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `evocoffee-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  });

  elements.importData.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        hydrateState(parsed);
        saveData();
        renderAll();
      } catch (error) {
        console.warn("Invalid import", error);
      }
    };
    reader.readAsText(file);
  });

  elements.clearData.addEventListener("click", () => {
    const confirmed = confirm("Clear all EvoCoffee data? This cannot be undone.");
    if (!confirmed) return;
    localStorage.removeItem(STORAGE_KEY);
    const fresh = defaultState();
    Object.assign(state, fresh);
    renderAll();
  });

  elements.seedDemo.addEventListener("click", () => {
    const confirmed = confirm("Load demo data? This will replace current records.");
    if (!confirmed) return;
    const demo = buildDemoState();
    Object.assign(state, demo);
    saveData();
    renderAll();
  });
}

function renderAll() {
  updateMetrics();
  updateTables();
  updateLowStock();
  updateCharts();
  syncInventoryForm();
}

function updateMetrics() {
  const totalSpend = totalSpendValue();
  const purchaseCount = state.purchases.length;
  const avgPurchase = purchaseCount ? totalSpend / purchaseCount : 0;
  const topSpender = getTopSpender();

  elements.metricBeans.textContent = `${formatter.format(state.inventory.beans_g)} caps`;
  elements.metricMilk.textContent = `${formatter.format(state.inventory.milk_l)} L`;
  elements.metricPurchaseCount.textContent = formatter.format(purchaseCount);
  elements.metricPurchaseAvg.textContent = moneyFormatter.format(avgPurchase);
  elements.metricSpend.textContent = moneyFormatter.format(totalSpend);
  elements.metricTop.textContent = topSpender || "None yet";
}

function updateTables() {
  elements.tableInventory.innerHTML = renderRows(
    state.inventoryLog.slice(0, 5),
    4,
    (entry) => `
      <tr>
        <td>${entry.date}</td>
        <td>${formatter.format(entry.capsules)} caps</td>
        <td>${formatter.format(entry.milk)} L</td>
        <td>${escapeHtml(formatBrandBreakdown(entry))}</td>
      </tr>
    `
  );

  elements.tablePurchases.innerHTML = renderRows(
    state.purchases.slice(0, 5),
    4,
    (entry) => `
      <tr>
        <td>${entry.date}</td>
        <td>${escapeHtml(entry.buyer)}</td>
        <td>${moneyFormatter.format(entry.amount)}</td>
        <td>${escapeHtml(entry.notes || "-")}</td>
      </tr>
    `
  );
}

function formatBrandBreakdown(entry) {
  const lor = entry.capsLor ?? 0;
  const illy = entry.capsIlly ?? 0;
  const other = entry.capsOther ?? 0;

  if (lor || illy || other) {
    return `LOR ${formatter.format(lor)} | Illy ${formatter.format(illy)} | Other ${formatter.format(other)}`;
  }

  if (entry.brand) {
    return `${entry.brand} ${formatter.format(entry.capsules || 0)}`;
  }

  return "-";
}

function updateLowStock() {
  const warnings = [];
  if (state.inventory.beans_g < 10) {
    warnings.push("Capsules below 10 — time to reorder.");
  }
  if (state.inventory.milk_l < 2) {
    warnings.push("Milk below 2L — stock up.");
  }
  elements.lowStock.textContent = warnings.join(" ");
}

function updateCharts() {
  const brandData = inventoryBrandShare();
  renderDonutChart(elements.chartInventoryBrands, brandData.labels, brandData.values, {
    colors: ["#4cf7a5", "#e6c36a", "#6ab7ff"],
    legendFormat: (value) => `${formatter.format(value)} caps`,
    centerFormatter: (value) => `${formatter.format(value)} caps`,
  });

  const spendSeries = groupByMonth(state.purchases, (entry) => entry.amount);
  renderLineChart(elements.chartSpend, spendSeries.labels, spendSeries.values, {
    stroke: "#e6c36a",
    fill: "rgba(230, 195, 106, 0.2)",
    legendFormat: (value) => moneyFormatter.format(value),
  });

  const countSeries = groupByMonth(state.purchases, () => 1);
  renderBarChart(elements.chartCount, countSeries.labels, countSeries.values, {
    colors: ["#4cf7a5"],
    legendFormat: (value) => `${formatter.format(value)} purchases`,
  });

  const spenders = topSpenders();
  renderBarChart(elements.chartSpenders, spenders.labels, spenders.values, {
    colors: chartColors,
    legendFormat: (value) => moneyFormatter.format(value),
  });

  const share = spendShare();
  renderDonutChart(elements.chartShare, share.labels, share.values, {
    colors: chartColors,
    legendFormat: (value) => moneyFormatter.format(value),
  });
}

function initSliders() {
  sliderPairs.length = 0;
  const inputs = elements.storageForm.querySelectorAll("input[data-slider]");
  inputs.forEach((input) => {
    const key = input.dataset.slider;
    const range = elements.storageForm.querySelector(`input[data-slider-for='${key}']`);
    if (!range) return;
    const defaultMax = toNumber(range.dataset.maxDefault) || toNumber(range.max) || 100;
    const pair = { input, range, defaultMax };
    sliderPairs.push(pair);

    input.addEventListener("input", () => syncSliderPair(pair));
    range.addEventListener("input", () => {
      input.value = range.value;
    });
  });
  syncSliders();
}

function syncSliderPair(pair) {
  const value = toNumber(pair.input.value);
  const currentMax = toNumber(pair.range.max) || pair.defaultMax;
  if (value > currentMax) {
    pair.range.max = Math.max(pair.defaultMax, value);
  }
  pair.range.value = value;
}

function syncSliders() {
  sliderPairs.forEach((pair) => syncSliderPair(pair));
}

function inventoryBrandShare() {
  const fallback = { LOR: 0, Illy: 0, Other: 0 };
  const counts = state.inventory.brand_counts || fallback;

  let lor = counts.LOR || 0;
  let illy = counts.Illy || 0;
  let other = counts.Other || 0;

  if (!lor && !illy && !other && state.inventoryLog.length) {
    const entry = state.inventoryLog[0];
    if (entry.capsLor || entry.capsIlly || entry.capsOther) {
      lor = entry.capsLor || 0;
      illy = entry.capsIlly || 0;
      other = entry.capsOther || 0;
    } else if (entry.brand) {
      if (entry.brand === "LOR") lor = entry.capsules || 0;
      else if (entry.brand === "Illy") illy = entry.capsules || 0;
      else other = entry.capsules || 0;
    }
  }
  if (!lor && !illy && !other && state.inventory.beans_g > 0) {
    other = state.inventory.beans_g;
  }

  return {
    labels: ["LOR", "Illy", "Other"],
    values: [lor, illy, other],
  };
}

function renderLineChart(container, labels, values, options) {
  if (!values.length) {
    renderEmptyChart(container);
    return;
  }

  const width = 320;
  const height = 160;
  const padding = 20;
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const range = max - min || 1;
  const step = values.length > 1 ? innerWidth / (values.length - 1) : 0;

  const points = values.map((value, index) => {
    const x = padding + step * index;
    const y = padding + innerHeight - ((value - min) / range) * innerHeight;
    return [x, y];
  });

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point[0]},${point[1]}`)
    .join(" ");
  const areaPath = `${linePath} L ${padding + innerWidth},${padding + innerHeight} L ${padding},${padding + innerHeight} Z`;

  const legend = buildLegend(
    labels.slice(-4),
    values.slice(-4),
    options.legendFormat,
    [options.stroke]
  );

  container.innerHTML = `
    <div class="chart-svg">
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Line chart">
        <defs>
          <linearGradient id="line-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stop-color="${options.fill}" />
            <stop offset="100%" stop-color="rgba(0,0,0,0)" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="${width}" height="${height}" fill="transparent" />
        ${renderGridLines(width, height, padding, 3)}
        <path d="${areaPath}" fill="url(#line-fill)" />
        <path d="${linePath}" fill="none" stroke="${options.stroke}" stroke-width="3" />
        ${renderPoints(points, options.stroke)}
      </svg>
    </div>
    ${legend}
  `;
}

function renderBarChart(container, labels, values, options) {
  if (!values.length) {
    renderEmptyChart(container);
    return;
  }

  const width = 320;
  const height = 160;
  const padding = 20;
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;
  const max = Math.max(...values, 1);
  const barCount = values.length;
  const gap = 8;
  const barWidth = Math.max(10, (innerWidth - gap * (barCount - 1)) / barCount);

  const bars = values
    .map((value, index) => {
      const barHeight = (value / max) * innerHeight;
      const x = padding + index * (barWidth + gap);
      const y = padding + innerHeight - barHeight;
      const color = options.colors[index % options.colors.length];
      return `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="6" fill="${color}" />`;
    })
    .join("");

  const legend = buildLegend(labels, values, options.legendFormat, options.colors);

  container.innerHTML = `
    <div class="chart-svg">
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Bar chart">
        <rect x="0" y="0" width="${width}" height="${height}" fill="transparent" />
        ${renderGridLines(width, height, padding, 3)}
        ${bars}
      </svg>
    </div>
    ${legend}
  `;
}

function renderDonutChart(container, labels, values, options) {
  if (!values.length || values.every((value) => value === 0)) {
    renderEmptyChart(container);
    return;
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  const size = 160;
  const radius = 52;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;
  const arcs = values
    .map((value, index) => {
      const fraction = value / total;
      const dash = fraction * circumference;
      const color = options.colors[index % options.colors.length];
      const arc = `
        <circle
          cx="${center}"
          cy="${center}"
          r="${radius}"
          fill="transparent"
          stroke="${color}"
          stroke-width="18"
          stroke-dasharray="${dash} ${circumference - dash}"
          stroke-dashoffset="${-offset}"
          stroke-linecap="round"
        />
      `;
      offset += dash;
      return arc;
    })
    .join("");

  const legend = buildLegend(labels, values, options.legendFormat, options.colors);
  const centerText = options.centerFormatter ? options.centerFormatter(total) : moneyFormatter.format(total);

  container.innerHTML = `
    <div class="chart-svg">
      <svg viewBox="0 0 ${size} ${size}" role="img" aria-label="Donut chart">
        <circle cx="${center}" cy="${center}" r="${radius}" fill="transparent" stroke="rgba(255,255,255,0.08)" stroke-width="18" />
        ${arcs}
        <text x="${center}" y="${center}" fill="#e6f3ea" font-size="14" font-family="IBM Plex Mono" text-anchor="middle" dominant-baseline="middle">
          ${escapeHtml(centerText)}
        </text>
      </svg>
    </div>
    ${legend}
  `;
}

function renderGridLines(width, height, padding, count) {
  const lines = [];
  for (let i = 1; i <= count; i += 1) {
    const y = padding + ((height - padding * 2) / (count + 1)) * i;
    lines.push(`<line x1="${padding}" y1="${y}" x2="${width - padding}" y2="${y}" stroke="rgba(255,255,255,0.06)" stroke-width="1" />`);
  }
  return lines.join("");
}

function renderPoints(points, color) {
  return points
    .map((point) => `<circle cx="${point[0]}" cy="${point[1]}" r="4" fill="${color}" />`)
    .join("");
}

function renderEmptyChart(container) {
  container.innerHTML = `
    <div class="chart-svg">
      <div class="chart-empty">No data yet.</div>
    </div>
  `;
}

function buildLegend(labels, values, formatterFn, colors) {
  if (!labels.length) return "";
  const items = labels
    .map((label, index) => {
      const value = values[index];
      const formatted = formatterFn ? formatterFn(value) : formatter.format(value);
      const color = colors[index % colors.length];
      return `
        <div class="chart-legend-item">
          <div class="chart-legend-label">
            <span class="legend-swatch" style="--swatch: ${color}"></span>
            <span>${escapeHtml(label)}</span>
          </div>
          <span>${escapeHtml(formatted)}</span>
        </div>
      `;
    })
    .join("");
  return `<div class="chart-legend">${items}</div>`;
}

function groupByMonth(entries, getValue) {
  const map = new Map();
  entries.forEach((entry) => {
    if (!entry.date) return;
    const month = entry.date.slice(0, 7);
    const value = getValue(entry);
    map.set(month, (map.get(month) || 0) + value);
  });

  const labels = Array.from(map.keys()).sort();
  const values = labels.map((label) => map.get(label));
  return { labels, values };
}

function totalSpendValue() {
  return state.purchases.reduce((sum, entry) => sum + entry.amount, 0);
}

function topSpenders() {
  const map = new Map();
  state.purchases.forEach((entry) => {
    if (!entry.buyer) return;
    map.set(entry.buyer, (map.get(entry.buyer) || 0) + entry.amount);
  });
  const sorted = Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  return {
    labels: sorted.map(([name]) => name),
    values: sorted.map(([, value]) => value),
  };
}

function spendShare() {
  const map = new Map();
  state.purchases.forEach((entry) => {
    if (!entry.buyer) return;
    map.set(entry.buyer, (map.get(entry.buyer) || 0) + entry.amount);
  });

  const sorted = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, 4);
  const restTotal = sorted.slice(4).reduce((sum, [, value]) => sum + value, 0);

  const labels = top.map(([name]) => name);
  const values = top.map(([, value]) => value);

  if (restTotal > 0) {
    labels.push("Other");
    values.push(restTotal);
  }

  return { labels, values };
}

function getTopSpender() {
  const { labels, values } = topSpenders();
  if (!labels.length) return "";
  return `${labels[0]} (${moneyFormatter.format(values[0])})`;
}

function syncInventoryForm() {
  const lorInput = elements.storageForm.querySelector("input[name='caps_lor']");
  const illyInput = elements.storageForm.querySelector("input[name='caps_illy']");
  const otherInput = elements.storageForm.querySelector("input[name='caps_other']");
  const milkInput = elements.storageForm.querySelector("input[name='milk']");
  const brands = state.inventory.brand_counts || { LOR: 0, Illy: 0, Other: 0 };
  if (lorInput) lorInput.value = Math.max(brands.LOR || 0, 0);
  if (illyInput) illyInput.value = Math.max(brands.Illy || 0, 0);
  if (otherInput) otherInput.value = Math.max(brands.Other || 0, 0);
  if (milkInput) milkInput.value = Math.max(state.inventory.milk_l, 0);
  syncSliders();
}

function renderRows(entries, columnCount, renderRow) {
  if (!entries.length) {
    return `
      <tr>
        <td colspan="${columnCount}">No data yet.</td>
      </tr>
    `;
  }
  return entries.map(renderRow).join("");
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function loadData() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return defaultState();
  try {
    const parsed = JSON.parse(stored);
    return hydrateState(parsed);
  } catch (error) {
    return defaultState();
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function defaultState() {
  return {
    purchases: [],
    inventoryLog: [],
    inventory: {
      beans_g: 0,
      milk_l: 0,
      updated_at: null,
      reason: "",
      brand_counts: {
        LOR: 0,
        Illy: 0,
        Other: 0,
      },
    },
  };
}

function hydrateState(parsed) {
  const fresh = defaultState();
  if (parsed && typeof parsed === "object") {
    fresh.purchases = Array.isArray(parsed.purchases) ? parsed.purchases : [];
    fresh.inventoryLog = Array.isArray(parsed.inventoryLog)
      ? parsed.inventoryLog.map((entry) => {
          const brand = entry.brand || entry.reason || "";
          const capsLor = entry.capsLor ?? (brand === "LOR" ? entry.capsules || 0 : 0);
          const capsIlly = entry.capsIlly ?? (brand === "Illy" ? entry.capsules || 0 : 0);
          const capsOther =
            entry.capsOther ?? (brand && brand !== "LOR" && brand !== "Illy" ? entry.capsules || 0 : 0);
          return {
            ...entry,
            brand,
            capsLor,
            capsIlly,
            capsOther,
          };
        })
      : [];
    fresh.inventory = {
      ...fresh.inventory,
      ...(parsed.inventory || {}),
    };
  }
  if (!fresh.inventory.brand_counts || typeof fresh.inventory.brand_counts !== "object") {
    const latest = fresh.inventoryLog[0];
    if (latest) {
      fresh.inventory.brand_counts = {
        LOR: latest.capsLor || 0,
        Illy: latest.capsIlly || 0,
        Other: latest.capsOther || 0,
      };
    } else {
      fresh.inventory.brand_counts = { LOR: 0, Illy: 0, Other: 0 };
    }
  }
  Object.assign(state, fresh);
  return state;
}

function buildDemoState() {
  const today = new Date();
  const daysAgo = (days) => {
    const date = new Date(today);
    date.setDate(date.getDate() - days);
    return date.toISOString().slice(0, 10);
  };

  const demo = defaultState();
  demo.purchases = [
    {
      id: crypto.randomUUID(),
      date: daysAgo(30),
      buyer: "Priya",
      amount: 54.5,
      notes: "Capsules + filters",
    },
    {
      id: crypto.randomUUID(),
      date: daysAgo(18),
      buyer: "Marcus",
      amount: 38.2,
      notes: "Milk + cups",
    },
    {
      id: crypto.randomUUID(),
      date: daysAgo(6),
      buyer: "Lena",
      amount: 89.1,
      notes: "Monthly restock",
    },
  ];

  demo.inventoryLog = [
    {
      id: crypto.randomUUID(),
      date: daysAgo(10),
      capsules: 140,
      capsLor: 90,
      capsIlly: 30,
      capsOther: 20,
      milk: 4.5,
      brand: "LOR",
    },
    {
      id: crypto.randomUUID(),
      date: daysAgo(2),
      capsules: 90,
      capsLor: 40,
      capsIlly: 35,
      capsOther: 15,
      milk: 2.8,
      brand: "Illy",
    },
  ];

  demo.inventory.beans_g = 90;
  demo.inventory.milk_l = 2.8;
  demo.inventory.brand_counts = {
    LOR: 40,
    Illy: 35,
    Other: 15,
  };
  demo.inventory.updated_at = new Date().toISOString();
  demo.inventory.reason = "Demo seed";
  return demo;
}
