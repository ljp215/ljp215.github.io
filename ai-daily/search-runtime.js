export const SEARCH_INDEX_VERSION = 1;

export const SEARCH_SECTION_LABELS = Object.freeze({
  company_updates: "大厂动态",
  technical_progress: "技术进展",
  industry_views: "行业观点",
  papers: "Hugging Face Papers"
});

const SECTION_SLUGS = Object.freeze({
  company_updates: "company-updates",
  technical_progress: "technical-progress",
  industry_views: "industry-views",
  papers: "technical-progress"
});

const FIELD_WEIGHTS = Object.freeze({
  entity: 12,
  title: 8,
  topics: 6,
  section: 4,
  summary: 3,
  insight: 2,
  evidence: 1.5,
  body: 1
});

export function buildSearchIndex(reports = [], options = {}) {
  const internalDocuments = reports
    .filter((report) => report?.date)
    .flatMap((report) => collectReportDocuments(report));
  const postings = new Map();

  for (let documentIndex = 0; documentIndex < internalDocuments.length; documentIndex += 1) {
    const document = internalDocuments[documentIndex];
    const weightedTerms = weightedDocumentTerms(document);
    document.length = roundScore([...weightedTerms.values()].reduce((sum, value) => sum + value, 0));

    for (const [term, frequency] of weightedTerms) {
      if (!postings.has(term)) postings.set(term, []);
      postings.get(term).push([documentIndex, roundScore(frequency)]);
    }
  }

  const averageLength = internalDocuments.length
    ? internalDocuments.reduce((sum, document) => sum + document.length, 0) / internalDocuments.length
    : 0;
  const generatedAt = options.generatedAt || new Date().toISOString();

  return {
    version: SEARCH_INDEX_VERSION,
    generated_at: generatedAt,
    document_count: internalDocuments.length,
    average_document_length: roundScore(averageLength),
    documents: internalDocuments.map(stripPrivateFields),
    postings: Object.fromEntries([...postings.entries()].sort(([left], [right]) => left.localeCompare(right)))
  };
}

export function searchIndex(index, query, options = {}) {
  const cleanQuery = normalizeSearchText(query);
  if (!cleanQuery || !index?.document_count) return [];

  const section = String(options.section || "all");
  const limit = Math.max(1, Math.min(100, Number(options.limit || 30)));
  const documents = index.documents || [];
  const scores = new Map();
  const matchedTerms = new Map();
  const queryTerms = expandQueryTerms(index.postings || {}, tokenizeSearchText(cleanQuery));
  const averageLength = Math.max(1, Number(index.average_document_length || 1));
  const documentCount = Math.max(1, Number(index.document_count || documents.length));

  for (const [term, queryWeight] of queryTerms) {
    const termPostings = index.postings?.[term] || [];
    const documentFrequency = termPostings.length;
    if (!documentFrequency) continue;
    const inverseDocumentFrequency = Math.log(1 + ((documentCount - documentFrequency + 0.5) / (documentFrequency + 0.5)));

    for (const [documentIndex, weightedFrequency] of termPostings) {
      const document = documents[documentIndex];
      if (!document || (section !== "all" && document.section !== section)) continue;
      const length = Math.max(1, Number(document.length || averageLength));
      const saturation = weightedFrequency + 1.2 * (0.25 + 0.75 * (length / averageLength));
      const termScore = inverseDocumentFrequency * ((weightedFrequency * 2.2) / saturation) * queryWeight;
      scores.set(documentIndex, (scores.get(documentIndex) || 0) + termScore);
      if (!matchedTerms.has(documentIndex)) matchedTerms.set(documentIndex, new Set());
      matchedTerms.get(documentIndex).add(term);
    }
  }

  const referenceDate = options.now || newestDocumentDate(documents);
  const compactQuery = compactSearchText(cleanQuery);
  const results = [];

  for (const [documentIndex, baseScore] of scores) {
    const document = documents[documentIndex];
    let score = baseScore + phraseMatchBonus(document, compactQuery);
    score *= freshnessMultiplier(document.date, referenceDate);
    results.push({
      ...document,
      score: roundScore(score),
      matched_terms: [...(matchedTerms.get(documentIndex) || [])],
      snippet: selectSearchSnippet(document, cleanQuery)
    });
  }

  return results
    .sort((left, right) => right.score - left.score || right.date.localeCompare(left.date) || left.title.localeCompare(right.title))
    .slice(0, limit);
}

export function tokenizeSearchText(value) {
  const normalized = normalizeSearchText(value);
  const chunks = normalized.match(/[a-z0-9]+(?:[._+#-]+[a-z0-9]+)*[+#]*|[\u3400-\u9fff]+/g) || [];
  const terms = [];

  for (const chunk of chunks) {
    if (/^[\u3400-\u9fff]+$/.test(chunk)) {
      if (chunk.length === 1) terms.push(chunk);
      if (chunk.length <= 12) terms.push(chunk);
      for (const size of [2, 3]) {
        if (chunk.length < size) continue;
        for (let index = 0; index <= chunk.length - size; index += 1) {
          terms.push(chunk.slice(index, index + size));
        }
      }
      continue;
    }

    terms.push(chunk);
    for (const part of chunk.split(/[._+#-]+/).filter((part) => part.length >= 2)) {
      if (part !== chunk) terms.push(part);
    }
  }

  return terms;
}

export function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("zh-CN")
    .replace(/\s+/g, " ")
    .trim();
}

export function searchNewsAnchor(item, section, index) {
  return safeAnchor(`event-${item?.event_id || `${section}-${index + 1}`}`);
}

export function searchPaperAnchor(paper, index) {
  return safeAnchor(`paper-${paper?.id || paper?.arxiv_id || index + 1}`);
}

function collectReportDocuments(report) {
  const documents = [];
  const sectionEntries = [
    ["company_updates", report.sections?.company_updates || []],
    ["technical_progress", report.sections?.technical_progress || []],
    ["industry_views", report.sections?.industry_views || []]
  ];

  for (const [section, items] of sectionEntries) {
    items.forEach((item, index) => {
      documents.push(newsDocument(report.date, section, item, index));
    });
  }

  for (const [index, paper] of (report.paper_digest?.items || []).entries()) {
    documents.push(paperDocument(report.date, paper, index));
  }

  return documents.filter((document) => document.title);
}

function newsDocument(date, section, item, index) {
  const anchor = searchNewsAnchor(item, section, index);
  const topics = [
    item.event_type_label,
    ...(item.memory_subjects || []).map((subject) => subject?.label),
    ...(item.tags || [])
  ].filter(Boolean);
  const summary = cleanText(item.ai_summary || item.brief || item.translation_zh || "");
  const insight = cleanText(item.memory_note || "");

  return {
    id: `${date}:${anchor}`,
    anchor,
    date,
    section,
    section_label: SEARCH_SECTION_LABELS[section],
    title: cleanText(item.title || item.social_original_text || ""),
    entity: cleanText(item.entity || ""),
    summary,
    insight,
    topics,
    source_display: cleanText(item.source_display || ""),
    url: `/ai-daily/${date}/?event=${encodeURIComponent(anchor)}#${SECTION_SLUGS[section]}`,
    _evidence: cleanText([...(item.evidence_titles || []), ...(item.evidence_summaries || [])].join(" ")),
    _body: cleanText([item.social_original_text, item.translation_zh].filter(Boolean).join(" "))
  };
}

function paperDocument(date, paper, index) {
  const anchor = searchPaperAnchor(paper, index);
  const title = cleanText(paper.title_zh || paper.title || "");
  const summary = cleanText(paper.takeaway_zh || paper.summary_zh || paper.abstract_zh || paper.abstract || "");

  return {
    id: `${date}:${anchor}`,
    anchor,
    date,
    section: "papers",
    section_label: SEARCH_SECTION_LABELS.papers,
    title,
    entity: "Hugging Face Papers",
    summary,
    insight: "",
    topics: (paper.tags || []).filter(Boolean).map(cleanText),
    source_display: "Hugging Face",
    url: `/ai-daily/${date}/?event=${encodeURIComponent(anchor)}#technical-progress`,
    _evidence: cleanText([paper.title, paper.title_zh].filter(Boolean).join(" ")),
    _body: cleanText([paper.abstract, paper.abstract_zh].filter(Boolean).join(" "))
  };
}

function weightedDocumentTerms(document) {
  const terms = new Map();
  const fields = [
    [document.entity, FIELD_WEIGHTS.entity],
    [document.title, FIELD_WEIGHTS.title],
    [document.topics.join(" "), FIELD_WEIGHTS.topics],
    [document.section_label, FIELD_WEIGHTS.section],
    [document.summary, FIELD_WEIGHTS.summary],
    [document.insight, FIELD_WEIGHTS.insight],
    [document._evidence, FIELD_WEIGHTS.evidence],
    [document._body, FIELD_WEIGHTS.body]
  ];

  for (const [text, weight] of fields) {
    const counts = new Map();
    for (const term of tokenizeSearchText(text)) counts.set(term, (counts.get(term) || 0) + 1);
    for (const [term, count] of counts) {
      const weightedFrequency = weight * (1 + Math.log(count));
      terms.set(term, (terms.get(term) || 0) + weightedFrequency);
    }
  }

  return terms;
}

function stripPrivateFields(document) {
  const { _evidence, _body, ...publicDocument } = document;
  return publicDocument;
}

function expandQueryTerms(postings, rawTerms) {
  const expanded = new Map();
  const allTerms = Object.keys(postings);

  for (const term of new Set(rawTerms)) {
    if (postings[term]) expanded.set(term, 1);
    if (!/^[a-z0-9]/.test(term) || term.length < 4) continue;

    let prefixMatches = 0;
    for (const candidate of allTerms) {
      if (candidate === term || !candidate.startsWith(term)) continue;
      expanded.set(candidate, Math.max(expanded.get(candidate) || 0, 0.35));
      prefixMatches += 1;
      if (prefixMatches >= 8) break;
    }
  }

  return expanded;
}

function phraseMatchBonus(document, compactQuery) {
  if (!compactQuery) return 0;
  const entity = compactSearchText(document.entity);
  const title = compactSearchText(document.title);
  const topics = compactSearchText((document.topics || []).join(" "));
  const summary = compactSearchText(document.summary);
  const insight = compactSearchText(document.insight);
  let bonus = 0;

  if (entity === compactQuery) bonus += 18;
  else if (entity.includes(compactQuery)) bonus += 9;
  if (title.includes(compactQuery)) bonus += 8;
  if (topics.includes(compactQuery)) bonus += 5;
  if (summary.includes(compactQuery)) bonus += 3;
  if (insight.includes(compactQuery)) bonus += 2;
  return bonus;
}

function freshnessMultiplier(date, referenceDate) {
  const dateValue = Date.parse(`${date}T00:00:00Z`);
  const referenceValue = Date.parse(`${referenceDate}T00:00:00Z`);
  if (!Number.isFinite(dateValue) || !Number.isFinite(referenceValue)) return 1;
  const ageDays = Math.max(0, (referenceValue - dateValue) / 86_400_000);
  return 1 + 0.06 * Math.exp(-ageDays / 120);
}

function newestDocumentDate(documents) {
  return documents.reduce((latest, document) => document.date > latest ? document.date : latest, "1970-01-01");
}

function selectSearchSnippet(document, query) {
  const fields = [document.summary, document.insight, document.title].filter(Boolean);
  const compactQuery = compactSearchText(query);
  const matched = fields.find((field) => compactSearchText(field).includes(compactQuery));
  const text = matched || fields[0] || "";
  return text.length > 180 ? `${text.slice(0, 179)}…` : text;
}

function compactSearchText(value) {
  return normalizeSearchText(value).replace(/[^a-z0-9\u3400-\u9fff]+/g, "");
}

function safeAnchor(value) {
  return String(value || "item")
    .normalize("NFKC")
    .replace(/[^A-Za-z0-9_.:-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function roundScore(value) {
  return Math.round(Number(value || 0) * 1000) / 1000;
}
