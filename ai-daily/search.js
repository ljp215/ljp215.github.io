import { SEARCH_SECTION_LABELS, searchIndex, tokenizeSearchText } from "./search-runtime.js";

const form = document.querySelector("[data-search-form]");
const input = document.querySelector("[data-search-input]");
const status = document.querySelector("[data-search-status]");
const resultsRoot = document.querySelector("[data-search-results]");
const filtersRoot = document.querySelector("[data-search-filters]");
let index = null;
let activeSection = "all";

initialize();

async function initialize() {
  const params = new URLSearchParams(location.search);
  const query = params.get("q") || "";
  input.value = query;
  form.addEventListener("submit", handleSubmit);
  filtersRoot.addEventListener("click", handleFilterClick);
  if (!query.trim()) return;
  await runSearch(query);
}

function handleSubmit(event) {
  event.preventDefault();
  const query = input.value.trim();
  const url = new URL(location.href);
  if (query) url.searchParams.set("q", query);
  else url.searchParams.delete("q");
  history.replaceState(null, "", url);
  activeSection = "all";
  runSearch(query);
}

function handleFilterClick(event) {
  const button = event.target.closest("[data-search-section]");
  if (!button || !input.value.trim()) return;
  activeSection = button.dataset.searchSection;
  updateFilterState();
  renderResults(searchIndex(index, input.value, { section: activeSection, limit: 50 }), input.value);
}

async function runSearch(query) {
  if (!query.trim()) {
    status.textContent = "";
    resultsRoot.replaceChildren();
    filtersRoot.hidden = true;
    return;
  }

  status.textContent = "正在检索…";
  try {
    index ||= await fetchIndex();
    filtersRoot.hidden = false;
    updateFilterState();
    renderResults(searchIndex(index, query, { section: activeSection, limit: 50 }), query);
  } catch (error) {
    console.error(error);
    status.textContent = "搜索索引加载失败，请稍后重试。";
    resultsRoot.replaceChildren();
  }
}

async function fetchIndex() {
  const response = await fetch("/ai-daily/search-index.json", { cache: "no-cache" });
  if (!response.ok) throw new Error(`search index HTTP ${response.status}`);
  return response.json();
}

function renderResults(results, query) {
  status.textContent = results.length ? `找到 ${results.length} 条相关内容` : "没有找到相关内容";
  resultsRoot.innerHTML = results.map((result) => `<article class="search-result">
    <div class="search-result-meta">
      <time datetime="${escapeHtml(result.date)}">${escapeHtml(result.date)}</time>
      <span>${escapeHtml(result.section_label)}</span>
      ${result.entity ? `<strong>${highlightText(result.entity, query)}</strong>` : ""}
    </div>
    <h2><a href="${escapeHtml(result.url)}">${highlightText(result.title, query)}</a></h2>
    ${result.snippet ? `<p>${highlightText(result.snippet, query)}</p>` : ""}
    <div class="search-result-footer">
      <span>相关度 ${formatScore(result.score)}</span>
      ${result.source_display ? `<em>${escapeHtml(result.source_display)}</em>` : ""}
    </div>
  </article>`).join("");
}

function updateFilterState() {
  for (const button of filtersRoot.querySelectorAll("[data-search-section]")) {
    const active = button.dataset.searchSection === activeSection;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
    if (button.dataset.searchSection !== "all") {
      button.textContent = SEARCH_SECTION_LABELS[button.dataset.searchSection] || button.textContent;
    }
  }
}

function highlightText(value, query) {
  const text = String(value || "");
  const terms = [...new Set(tokenizeSearchText(query).filter((term) => term.length >= 2))]
    .sort((left, right) => right.length - left.length)
    .slice(0, 8);
  if (!terms.length) return escapeHtml(text);

  const ranges = [];
  const lowerText = text.toLocaleLowerCase("zh-CN");
  for (const term of terms) {
    const lowerTerm = term.toLocaleLowerCase("zh-CN");
    let start = lowerText.indexOf(lowerTerm);
    while (start !== -1) {
      ranges.push([start, start + lowerTerm.length]);
      start = lowerText.indexOf(lowerTerm, start + lowerTerm.length);
    }
  }
  if (!ranges.length) return escapeHtml(text);

  ranges.sort((left, right) => left[0] - right[0] || right[1] - left[1]);
  const merged = [];
  for (const range of ranges) {
    const last = merged.at(-1);
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([...range]);
  }

  let cursor = 0;
  let html = "";
  for (const [start, end] of merged) {
    html += escapeHtml(text.slice(cursor, start));
    html += `<mark>${escapeHtml(text.slice(start, end))}</mark>`;
    cursor = end;
  }
  return html + escapeHtml(text.slice(cursor));
}

function formatScore(value) {
  return Number(value || 0).toFixed(1);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
