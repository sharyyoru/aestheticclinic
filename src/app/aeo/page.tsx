"use client";

import { useState, useEffect } from "react";

type KeywordData = {
  Ph?: string;      // Keyword/Phrase
  Nq?: string;      // Search Volume
  Cp?: string;      // CPC
  Co?: string;      // Competition
  Nr?: string;      // Number of Results
  Td?: string;      // Trends
  Kd?: string;      // Keyword Difficulty
  Rr?: string;      // Related Relevance
  Po?: string;      // Position
  Tr?: string;      // Traffic
  database?: string;
};

type GeneratedArticle = {
  titleTag: string;
  metaDescription: string;
  content: string;
  keyword: string;
  language: string;
  wordCount: number;
  generatedAt: string;
};

type ContentPlan = {
  id: string;
  keyword: string;
  volume: number;
  difficulty: number;
  priority: "high" | "medium" | "low";
  status: "planned" | "writing" | "review" | "published";
  scheduledDate: string | null;
  article?: GeneratedArticle;
};

const AESTHETIC_KEYWORDS = [
  "botox geneva",
  "lip filler switzerland",
  "hyaluronic acid injection",
  "aesthetic clinic geneva",
  "rhinoplasty switzerland",
  "facelift geneva",
  "skin rejuvenation",
  "anti aging treatment",
  "dermal fillers",
  "cosmetic surgery switzerland",
  "non surgical facelift",
  "laser skin treatment",
  "body contouring",
  "fat reduction treatment",
  "medical spa geneva",
];

const EU_DATABASES = [
  { code: "ch", name: "Switzerland", flag: "🇨🇭" },
  { code: "fr", name: "France", flag: "🇫🇷" },
  { code: "de", name: "Germany", flag: "🇩🇪" },
  { code: "uk", name: "United Kingdom", flag: "🇬🇧" },
  { code: "it", name: "Italy", flag: "🇮🇹" },
];

function formatNumber(num: string | number): string {
  const n = typeof num === "string" ? parseInt(num, 10) : num;
  if (isNaN(n)) return "-";
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return n.toString();
}

function getDifficultyColor(kd: string | number): string {
  const d = typeof kd === "string" ? parseFloat(kd) : kd;
  if (isNaN(d)) return "bg-slate-100 text-slate-600";
  if (d < 30) return "bg-emerald-100 text-emerald-700";
  if (d < 50) return "bg-amber-100 text-amber-700";
  if (d < 70) return "bg-orange-100 text-orange-700";
  return "bg-red-100 text-red-700";
}

function getPriorityScore(volume: number, difficulty: number): number {
  // Higher volume + lower difficulty = better opportunity
  return (volume / 100) * (100 - difficulty);
}

export default function AEOPage() {
  const [activeTab, setActiveTab] = useState<"research" | "content" | "articles">("research");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDatabase, setSelectedDatabase] = useState("ch");
  const [searchKeyword, setSearchKeyword] = useState("");
  
  // Research data
  const [keywordData, setKeywordData] = useState<KeywordData | null>(null);
  const [relatedKeywords, setRelatedKeywords] = useState<KeywordData[]>([]);
  const [questions, setQuestions] = useState<KeywordData[]>([]);
  const [domainKeywords, setDomainKeywords] = useState<KeywordData[]>([]);
  
  // Content planning
  const [contentPlan, setContentPlan] = useState<ContentPlan[]>([]);
  const [selectedKeywordForArticle, setSelectedKeywordForArticle] = useState<string | null>(null);
  
  // Article generation
  const [generatingArticle, setGeneratingArticle] = useState(false);
  const [generatedArticle, setGeneratedArticle] = useState<GeneratedArticle | null>(null);
  const [articleLanguage, setArticleLanguage] = useState<"en" | "fr" | "de">("en");
  const [articleType, setArticleType] = useState<"blog" | "landing" | "faq" | "guide">("blog");

  // API connection test on load
  useEffect(() => {
    testApiConnection();
    loadDomainKeywords();
  }, []);

  async function testApiConnection() {
    try {
      const res = await fetch("/api/aeo/semrush");
      const data = await res.json();
      if (!data.success) {
        setError("Semrush API connection failed: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      setError("Failed to connect to Semrush API");
    }
  }

  async function loadDomainKeywords() {
    try {
      const res = await fetch("/api/aeo/semrush", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "domain_keywords",
          domain: "aesthetics-ge.ch",
          database: selectedDatabase,
          limit: 100,
        }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setDomainKeywords(data.data);
      }
    } catch (err) {
      console.error("Failed to load domain keywords:", err);
    }
  }

  async function searchKeywordData() {
    if (!searchKeyword.trim()) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Fetch keyword overview
      const overviewRes = await fetch("/api/aeo/semrush", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "keyword_overview",
          keyword: searchKeyword,
          database: selectedDatabase,
        }),
      });
      const overviewData = await overviewRes.json();
      if (overviewData.success && overviewData.data?.length > 0) {
        setKeywordData(overviewData.data[0]);
      }

      // Fetch related keywords
      const relatedRes = await fetch("/api/aeo/semrush", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "related_keywords",
          keyword: searchKeyword,
          database: selectedDatabase,
          limit: 30,
        }),
      });
      const relatedData = await relatedRes.json();
      if (relatedData.success && relatedData.data) {
        setRelatedKeywords(relatedData.data);
      }

      // Fetch questions
      const questionsRes = await fetch("/api/aeo/semrush", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "keyword_questions",
          keyword: searchKeyword,
          database: selectedDatabase,
          limit: 20,
        }),
      });
      const questionsData = await questionsRes.json();
      if (questionsData.success && questionsData.data) {
        setQuestions(questionsData.data);
      }
    } catch (err) {
      setError("Failed to fetch keyword data");
    } finally {
      setLoading(false);
    }
  }

  function addToContentPlan(keyword: string, volume: string, difficulty: string) {
    const vol = parseInt(volume, 10) || 0;
    const diff = parseFloat(difficulty) || 50;
    const priority = diff < 30 && vol > 100 ? "high" : diff < 50 ? "medium" : "low";

    const newItem: ContentPlan = {
      id: `${Date.now()}-${keyword}`,
      keyword,
      volume: vol,
      difficulty: diff,
      priority,
      status: "planned",
      scheduledDate: null,
    };

    setContentPlan(prev => {
      if (prev.some(p => p.keyword.toLowerCase() === keyword.toLowerCase())) {
        return prev;
      }
      return [...prev, newItem].sort((a, b) => 
        getPriorityScore(b.volume, b.difficulty) - getPriorityScore(a.volume, a.difficulty)
      );
    });
  }

  async function generateArticle(keyword: string) {
    setGeneratingArticle(true);
    setSelectedKeywordForArticle(keyword);
    setError(null);

    try {
      const relatedKws = relatedKeywords.slice(0, 10).map(k => k.Ph || "").filter(Boolean);
      const questionsList = questions.slice(0, 5).map(q => q.Ph || "").filter(Boolean);

      const res = await fetch("/api/aeo/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword,
          relatedKeywords: relatedKws,
          questions: questionsList,
          targetAudience: "European adults interested in aesthetic medicine and cosmetic procedures",
          articleType,
          language: articleLanguage,
          tone: "professional",
          wordCount: 1500,
        }),
      });

      const data = await res.json();
      if (data.success && data.article) {
        setGeneratedArticle(data.article);
        
        // Update content plan with article
        setContentPlan(prev => prev.map(p => 
          p.keyword.toLowerCase() === keyword.toLowerCase()
            ? { ...p, article: data.article, status: "review" as const }
            : p
        ));
        
        setActiveTab("articles");
      } else {
        setError(data.error || "Failed to generate article");
      }
    } catch (err) {
      setError("Failed to generate article");
    } finally {
      setGeneratingArticle(false);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg">
              <span className="text-2xl">🎯</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">AEO & SEO Content Hub</h1>
              <p className="text-slate-500">
                Powered by Semrush API • Optimized for{" "}
                <a href="https://www.aesthetics-ge.ch/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  aesthetics-ge.ch
                </a>
              </p>
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-2">
          {[
            { id: "research", label: "Keyword Research", icon: "🔍" },
            { id: "content", label: "Content Plan", icon: "📋", badge: contentPlan.length },
            { id: "articles", label: "Generated Articles", icon: "✍️" },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition ${
                activeTab === tab.id
                  ? "bg-blue-600 text-white shadow-lg"
                  : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
              {tab.badge ? (
                <span className={`ml-1 rounded-full px-2 py-0.5 text-xs ${
                  activeTab === tab.id ? "bg-white/20" : "bg-blue-100 text-blue-600"
                }`}>
                  {tab.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {/* Research Tab */}
        {activeTab === "research" && (
          <div className="space-y-6">
            {/* Search Bar */}
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row">
                <div className="flex-1">
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Search Keyword
                  </label>
                  <input
                    type="text"
                    value={searchKeyword}
                    onChange={e => setSearchKeyword(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && searchKeywordData()}
                    placeholder="e.g., botox geneva, lip filler..."
                    className="w-full rounded-lg border border-slate-200 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Database
                  </label>
                  <select
                    value={selectedDatabase}
                    onChange={e => setSelectedDatabase(e.target.value)}
                    className="rounded-lg border border-slate-200 px-4 py-2.5 focus:border-blue-500 focus:outline-none"
                  >
                    {EU_DATABASES.map(db => (
                      <option key={db.code} value={db.code}>
                        {db.flag} {db.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={searchKeywordData}
                    disabled={loading || !searchKeyword.trim()}
                    className="rounded-lg bg-blue-600 px-6 py-2.5 font-medium text-white shadow-lg transition hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loading ? "Searching..." : "Analyze"}
                  </button>
                </div>
              </div>

              {/* Quick Keywords */}
              <div className="mt-4">
                <p className="mb-2 text-xs text-slate-500">Quick search:</p>
                <div className="flex flex-wrap gap-2">
                  {AESTHETIC_KEYWORDS.slice(0, 8).map(kw => (
                    <button
                      key={kw}
                      onClick={() => {
                        setSearchKeyword(kw);
                        setTimeout(searchKeywordData, 100);
                      }}
                      className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 hover:bg-slate-200"
                    >
                      {kw}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Keyword Overview */}
            {keywordData && (
              <div className="rounded-xl bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-lg font-semibold text-slate-900">
                  Keyword Overview: "{keywordData.Ph || searchKeyword}"
                </h2>
                <div className="grid gap-4 sm:grid-cols-4">
                  <div className="rounded-lg bg-blue-50 p-4">
                    <p className="text-sm text-blue-600">Search Volume</p>
                    <p className="text-2xl font-bold text-blue-900">
                      {formatNumber(keywordData.Nq || "0")}
                    </p>
                    <p className="text-xs text-blue-500">monthly searches</p>
                  </div>
                  <div className="rounded-lg bg-emerald-50 p-4">
                    <p className="text-sm text-emerald-600">CPC</p>
                    <p className="text-2xl font-bold text-emerald-900">
                      ${keywordData.Cp || "0"}
                    </p>
                    <p className="text-xs text-emerald-500">cost per click</p>
                  </div>
                  <div className="rounded-lg bg-amber-50 p-4">
                    <p className="text-sm text-amber-600">Competition</p>
                    <p className="text-2xl font-bold text-amber-900">
                      {(parseFloat(keywordData.Co || "0") * 100).toFixed(0)}%
                    </p>
                    <p className="text-xs text-amber-500">advertiser competition</p>
                  </div>
                  <div className={`rounded-lg p-4 ${getDifficultyColor(keywordData.Kd || "0")}`}>
                    <p className="text-sm">Keyword Difficulty</p>
                    <p className="text-2xl font-bold">
                      {keywordData.Kd || "N/A"}
                    </p>
                    <p className="text-xs">SEO difficulty score</p>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => addToContentPlan(
                      keywordData.Ph || searchKeyword,
                      keywordData.Nq || "0",
                      keywordData.Kd || "50"
                    )}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    + Add to Content Plan
                  </button>
                  <button
                    onClick={() => generateArticle(keywordData.Ph || searchKeyword)}
                    disabled={generatingArticle}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {generatingArticle ? "Generating..." : "✨ Generate Article"}
                  </button>
                </div>
              </div>
            )}

            {/* Related Keywords & Questions */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Related Keywords */}
              {relatedKeywords.length > 0 && (
                <div className="rounded-xl bg-white p-6 shadow-sm">
                  <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
                    <span>🔗</span> Related Keywords
                    <span className="text-sm font-normal text-slate-500">
                      ({relatedKeywords.length})
                    </span>
                  </h3>
                  <div className="max-h-96 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-slate-50">
                        <tr className="text-left text-xs text-slate-500">
                          <th className="p-2">Keyword</th>
                          <th className="p-2 text-right">Volume</th>
                          <th className="p-2 text-right">KD</th>
                          <th className="p-2"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {relatedKeywords.map((kw, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-2 font-medium text-slate-700">{kw.Ph}</td>
                            <td className="p-2 text-right text-slate-600">
                              {formatNumber(kw.Nq || "0")}
                            </td>
                            <td className="p-2 text-right">
                              <span className={`rounded px-2 py-0.5 text-xs ${getDifficultyColor(kw.Kd || "0")}`}>
                                {kw.Kd || "-"}
                              </span>
                            </td>
                            <td className="p-2">
                              <button
                                onClick={() => addToContentPlan(kw.Ph || "", kw.Nq || "0", kw.Kd || "50")}
                                className="text-blue-600 hover:text-blue-700"
                              >
                                +
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Questions (AEO) */}
              {questions.length > 0 && (
                <div className="rounded-xl bg-white p-6 shadow-sm">
                  <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
                    <span>❓</span> Questions (AEO Opportunities)
                    <span className="text-sm font-normal text-slate-500">
                      ({questions.length})
                    </span>
                  </h3>
                  <div className="max-h-96 space-y-2 overflow-y-auto">
                    {questions.map((q, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between rounded-lg bg-gradient-to-r from-purple-50 to-indigo-50 p-3"
                      >
                        <p className="text-sm text-slate-700">{q.Ph}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">
                            {formatNumber(q.Nq || "0")} vol
                          </span>
                          <button
                            onClick={() => addToContentPlan(q.Ph || "", q.Nq || "0", q.Kd || "50")}
                            className="rounded bg-indigo-600 px-2 py-1 text-xs text-white hover:bg-indigo-700"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Domain Keywords */}
            {domainKeywords.length > 0 && (
              <div className="rounded-xl bg-white p-6 shadow-sm">
                <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
                  <span>🌐</span> Current Rankings: aesthetics-ge.ch
                  <span className="text-sm font-normal text-slate-500">
                    ({domainKeywords.length} keywords)
                  </span>
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr className="text-left text-xs text-slate-500">
                        <th className="p-3">Keyword</th>
                        <th className="p-3 text-center">Position</th>
                        <th className="p-3 text-right">Volume</th>
                        <th className="p-3 text-right">Traffic</th>
                        <th className="p-3 text-right">KD</th>
                        <th className="p-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {domainKeywords.slice(0, 20).map((kw, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-3 font-medium text-slate-700">{kw.Ph}</td>
                          <td className="p-3 text-center">
                            <span className={`rounded-full px-2 py-1 text-xs font-bold ${
                              parseInt(kw.Po || "100") <= 3
                                ? "bg-emerald-100 text-emerald-700"
                                : parseInt(kw.Po || "100") <= 10
                                ? "bg-blue-100 text-blue-700"
                                : "bg-slate-100 text-slate-600"
                            }`}>
                              #{kw.Po}
                            </span>
                          </td>
                          <td className="p-3 text-right text-slate-600">
                            {formatNumber(kw.Nq || "0")}
                          </td>
                          <td className="p-3 text-right text-emerald-600">
                            {formatNumber(kw.Tr || "0")}
                          </td>
                          <td className="p-3 text-right">
                            <span className={`rounded px-2 py-0.5 text-xs ${getDifficultyColor(kw.Kd || "0")}`}>
                              {kw.Kd || "-"}
                            </span>
                          </td>
                          <td className="p-3">
                            <button
                              onClick={() => {
                                setSearchKeyword(kw.Ph || "");
                                searchKeywordData();
                              }}
                              className="text-blue-600 hover:text-blue-700"
                            >
                              Analyze
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Content Plan Tab */}
        {activeTab === "content" && (
          <div className="space-y-6">
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">
                  Content Calendar ({contentPlan.length} topics)
                </h2>
                <div className="flex gap-2">
                  <select
                    value={articleLanguage}
                    onChange={e => setArticleLanguage(e.target.value as typeof articleLanguage)}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="en">🇬🇧 English</option>
                    <option value="fr">🇫🇷 French</option>
                    <option value="de">🇩🇪 German</option>
                  </select>
                  <select
                    value={articleType}
                    onChange={e => setArticleType(e.target.value as typeof articleType)}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="blog">📝 Blog Post</option>
                    <option value="landing">🎯 Landing Page</option>
                    <option value="faq">❓ FAQ Article</option>
                    <option value="guide">📖 Comprehensive Guide</option>
                  </select>
                </div>
              </div>

              {contentPlan.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="mb-3 text-4xl">📋</div>
                  <p className="text-slate-500">No topics in your content plan yet</p>
                  <p className="mt-1 text-sm text-slate-400">
                    Add keywords from the Research tab to start planning
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {contentPlan.map(item => (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between rounded-lg border p-4 ${
                        item.priority === "high"
                          ? "border-emerald-200 bg-emerald-50"
                          : item.priority === "medium"
                          ? "border-amber-200 bg-amber-50"
                          : "border-slate-200 bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <span className={`text-lg ${
                          item.priority === "high" ? "text-emerald-600" :
                          item.priority === "medium" ? "text-amber-600" : "text-slate-400"
                        }`}>
                          {item.priority === "high" ? "🔥" : item.priority === "medium" ? "⚡" : "📌"}
                        </span>
                        <div>
                          <p className="font-medium text-slate-900">{item.keyword}</p>
                          <p className="text-sm text-slate-500">
                            Volume: {formatNumber(item.volume)} • KD: {item.difficulty}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                          item.status === "published" ? "bg-emerald-100 text-emerald-700" :
                          item.status === "review" ? "bg-blue-100 text-blue-700" :
                          item.status === "writing" ? "bg-amber-100 text-amber-700" :
                          "bg-slate-100 text-slate-600"
                        }`}>
                          {item.status}
                        </span>
                        {item.article ? (
                          <button
                            onClick={() => {
                              setGeneratedArticle(item.article!);
                              setActiveTab("articles");
                            }}
                            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
                          >
                            View Article
                          </button>
                        ) : (
                          <button
                            onClick={() => generateArticle(item.keyword)}
                            disabled={generatingArticle}
                            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
                          >
                            {generatingArticle && selectedKeywordForArticle === item.keyword
                              ? "Generating..."
                              : "Generate"}
                          </button>
                        )}
                        <button
                          onClick={() => setContentPlan(prev => prev.filter(p => p.id !== item.id))}
                          className="text-slate-400 hover:text-red-500"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Generated Articles Tab */}
        {activeTab === "articles" && (
          <div className="space-y-6">
            {generatedArticle ? (
              <div className="rounded-xl bg-white p-6 shadow-sm">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      Generated Article
                    </h2>
                    <p className="text-sm text-slate-500">
                      Keyword: {generatedArticle.keyword} • {generatedArticle.wordCount} words • {generatedArticle.language.toUpperCase()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => copyToClipboard(generatedArticle.content)}
                      className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
                    >
                      📋 Copy Article
                    </button>
                    <button
                      onClick={() => copyToClipboard(`${generatedArticle.titleTag}\n\n${generatedArticle.metaDescription}\n\n${generatedArticle.content}`)}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      📋 Copy All
                    </button>
                  </div>
                </div>

                {/* Meta Info */}
                <div className="mb-6 space-y-3 rounded-lg bg-slate-50 p-4">
                  <div>
                    <label className="text-xs font-medium text-slate-500">TITLE TAG</label>
                    <p className="font-medium text-slate-900">{generatedArticle.titleTag}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500">META DESCRIPTION</label>
                    <p className="text-slate-700">{generatedArticle.metaDescription}</p>
                  </div>
                </div>

                {/* Article Content */}
                <div className="prose prose-slate max-w-none">
                  <div className="rounded-lg border border-slate-200 p-6">
                    {generatedArticle.content.split("\n").map((line, idx) => {
                      if (line.startsWith("# ")) {
                        return <h1 key={idx} className="mb-4 text-2xl font-bold">{line.slice(2)}</h1>;
                      }
                      if (line.startsWith("## ")) {
                        return <h2 key={idx} className="mb-3 mt-6 text-xl font-semibold">{line.slice(3)}</h2>;
                      }
                      if (line.startsWith("### ")) {
                        return <h3 key={idx} className="mb-2 mt-4 text-lg font-medium">{line.slice(4)}</h3>;
                      }
                      if (line.startsWith("- ")) {
                        return <li key={idx} className="ml-4">{line.slice(2)}</li>;
                      }
                      if (line.trim() === "") {
                        return <br key={idx} />;
                      }
                      return <p key={idx} className="mb-3 text-slate-700">{line}</p>;
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl bg-white py-16 text-center shadow-sm">
                <div className="mb-4 text-5xl">✍️</div>
                <h3 className="mb-2 text-lg font-semibold text-slate-900">
                  No articles generated yet
                </h3>
                <p className="text-slate-500">
                  Generate an article from the Research or Content Plan tab
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
