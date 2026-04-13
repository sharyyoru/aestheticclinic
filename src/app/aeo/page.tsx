"use client";

import { useState, useEffect } from "react";

type KeywordData = {
  // Short codes
  Ph?: string;
  Nq?: string;
  Cp?: string;
  Co?: string;
  Nr?: string;
  Td?: string;
  Kd?: string;
  Rr?: string;
  Po?: string;
  Tr?: string;
  // Full names from API
  Keyword?: string;
  "Search Volume"?: string;
  CPC?: string;
  Competition?: string;
  "Number of Results"?: string;
  Trends?: string;
  "Keyword Difficulty"?: string;
  "Keyword Difficulty Index"?: string;
  "Related Relevance"?: string;
  Position?: string;
  "Traffic (%)"?: string;
  Traffic?: string;
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
  articles?: Record<string, GeneratedArticle>;  // Multi-language
};

type MediaFile = {
  name: string;
  path: string;
  size: number;
  type: string;
  url: string | null;
  publicUrl?: string;
  tags?: string[];
  createdAt?: string;
};

type BacklinksOverview = {
  ascore?: string;
  total?: string;
  domains_num?: string;
  urls_num?: string;
  follows_num?: string;
  nofollows_num?: string;
};

type Backlink = {
  page_ascore?: string;
  source_url?: string;
  source_title?: string;
  target_url?: string;
  anchor?: string;
  first_seen?: string;
  last_seen?: string;
  nofollow?: string;
};

type DeepAnalysis = {
  overview: KeywordData | null;
  related: KeywordData[];
  questions: KeywordData[];
  broadMatch: KeywordData[];
};

type Distribution = {
  id: string;
  article_id: string;
  service: string;
  external_id: string | null;
  status: string;
  title: string;
  placements_count: number;
  report_url: string | null;
  submitted_at: string;
  completed_at: string | null;
  cost: number;
  metadata: {
    categories?: string[];
    country?: string;
    language?: string;
    error?: string;
  };
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

function formatNumber(num: string | number | undefined): string {
  if (num === undefined || num === null || num === "") return "-";
  const n = typeof num === "string" ? parseInt(num, 10) : num;
  if (isNaN(n)) return "-";
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return n.toString();
}

// Helper to get keyword value (handles both short codes and full names)
function getKw(data: KeywordData): string {
  return data.Keyword || data.Ph || "";
}

function getVolume(data: KeywordData): string {
  return data["Search Volume"] || data.Nq || "0";
}

function getCpc(data: KeywordData): string {
  return data.CPC || data.Cp || "0";
}

function getCompetition(data: KeywordData): string {
  return data.Competition || data.Co || "0";
}

function getDifficulty(data: KeywordData): string {
  return data["Keyword Difficulty Index"] || data["Keyword Difficulty"] || data.Kd || "0";
}

function getPosition(data: KeywordData): string {
  return data.Position || data.Po || "-";
}

function getTraffic(data: KeywordData): string {
  return data["Traffic (%)"] || data.Traffic || data.Tr || "0";
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
  const [activeTab, setActiveTab] = useState<"research" | "content" | "articles" | "media" | "backlinks" | "distribute">("research");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDatabase, setSelectedDatabase] = useState("ch");
  const [searchKeyword, setSearchKeyword] = useState("");
  
  // Research data
  const [keywordData, setKeywordData] = useState<KeywordData | null>(null);
  const [relatedKeywords, setRelatedKeywords] = useState<KeywordData[]>([]);
  const [questions, setQuestions] = useState<KeywordData[]>([]);
  const [domainKeywords, setDomainKeywords] = useState<KeywordData[]>([]);
  const [deepAnalysis, setDeepAnalysis] = useState<DeepAnalysis | null>(null);
  const [analyzingKeyword, setAnalyzingKeyword] = useState<string | null>(null);
  
  // Content planning
  const [contentPlan, setContentPlan] = useState<ContentPlan[]>([]);
  const [selectedKeywordForArticle, setSelectedKeywordForArticle] = useState<string | null>(null);
  
  // Article generation
  const [generatingArticle, setGeneratingArticle] = useState(false);
  const [generatedArticle, setGeneratedArticle] = useState<GeneratedArticle | null>(null);
  const [multilingualArticles, setMultilingualArticles] = useState<Record<string, GeneratedArticle> | null>(null);
  const [articleLanguage, setArticleLanguage] = useState<"en" | "fr" | "de">("en");
  const [generateAllLanguages, setGenerateAllLanguages] = useState(true);
  const [articleType, setArticleType] = useState<"blog" | "landing" | "faq" | "guide">("blog");

  // Media library
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<string[]>([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  // Backlinks
  const [backlinksOverview, setBacklinksOverview] = useState<BacklinksOverview | null>(null);
  const [backlinks, setBacklinks] = useState<Backlink[]>([]);
  const [loadingBacklinks, setLoadingBacklinks] = useState(false);

  // Distribution
  const [distributions, setDistributions] = useState<Distribution[]>([]);
  const [distributionCategories, setDistributionCategories] = useState<string[]>([]);
  const [submittingDistribution, setSubmittingDistribution] = useState(false);
  const [prnowConnected, setPrnowConnected] = useState(false);

  // API connection test on load
  useEffect(() => {
    testApiConnection();
    loadDomainKeywords();
    loadMediaFiles();
    loadBacklinksData();
    loadDistributions();
    testPRNowConnection();
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

  async function loadMediaFiles() {
    try {
      const res = await fetch("/api/aeo/media");
      const data = await res.json();
      if (data.success && data.files) {
        setMediaFiles(data.files);
      }
    } catch (err) {
      console.error("Failed to load media files:", err);
    }
  }

  async function loadBacklinksData() {
    setLoadingBacklinks(true);
    try {
      // Load overview
      const overviewRes = await fetch("/api/aeo/semrush", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "backlinks_overview",
          domain: "aesthetics-ge.ch",
        }),
      });
      const overviewData = await overviewRes.json();
      if (overviewData.success && overviewData.data?.[0]) {
        setBacklinksOverview(overviewData.data[0]);
      }

      // Load backlinks list
      const backlinksRes = await fetch("/api/aeo/semrush", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "backlinks",
          domain: "aesthetics-ge.ch",
          limit: 50,
        }),
      });
      const backlinksData = await backlinksRes.json();
      if (backlinksData.success && backlinksData.data) {
        setBacklinks(backlinksData.data);
      }
    } catch (err) {
      console.error("Failed to load backlinks:", err);
    } finally {
      setLoadingBacklinks(false);
    }
  }

  async function analyzeKeywordDeep(keyword: string) {
    setAnalyzingKeyword(keyword);
    setDeepAnalysis(null);
    try {
      const res = await fetch("/api/aeo/semrush", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "keyword_deep_analysis",
          keyword,
          database: selectedDatabase,
        }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setDeepAnalysis(data.data);
        // Also update the main keyword data
        if (data.data.overview) {
          setKeywordData(data.data.overview);
        }
        if (data.data.related) {
          setRelatedKeywords(data.data.related);
        }
        if (data.data.questions) {
          setQuestions(data.data.questions);
        }
        setSearchKeyword(keyword);
      }
    } catch (err) {
      setError("Failed to analyze keyword");
    } finally {
      setAnalyzingKeyword(null);
    }
  }

  async function uploadMedia(file: File) {
    setUploadingMedia(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "articles");

      const res = await fetch("/api/aeo/media", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success && data.file) {
        setMediaFiles(prev => [data.file, ...prev]);
      }
    } catch (err) {
      setError("Failed to upload media");
    } finally {
      setUploadingMedia(false);
    }
  }

  async function loadDistributions() {
    try {
      const res = await fetch("/api/aeo/distribute");
      const data = await res.json();
      if (data.success && data.distributions) {
        setDistributions(data.distributions);
      }
    } catch (err) {
      console.error("Failed to load distributions:", err);
    }
  }

  async function testPRNowConnection() {
    try {
      const res = await fetch("/api/aeo/distribute?action=test");
      const data = await res.json();
      setPrnowConnected(data.success);
      
      // Load categories if connected
      if (data.success) {
        const catRes = await fetch("/api/aeo/distribute?action=categories");
        const catData = await catRes.json();
        if (catData.success && catData.categories) {
          setDistributionCategories(catData.categories);
        }
      }
    } catch (err) {
      console.error("PRNow connection test failed:", err);
      setPrnowConnected(false);
    }
  }

  async function submitForDistribution(article: GeneratedArticle) {
    setSubmittingDistribution(true);
    try {
      const res = await fetch("/api/aeo/distribute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit",
          title: article.titleTag,
          content: article.content,
          summary: article.metaDescription,
          categories: ["Healthcare", "Beauty & Personal Care"],
          country: "Switzerland",
          language: article.language,
          articleId: `${article.keyword}-${article.language}-${Date.now()}`,
        }),
      });
      const data = await res.json();
      
      if (data.success) {
        // Reload distributions
        await loadDistributions();
        setActiveTab("distribute");
      } else {
        setError(data.error || "Failed to submit for distribution");
      }
    } catch (err) {
      setError("Failed to submit for distribution");
    } finally {
      setSubmittingDistribution(false);
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
    setMultilingualArticles(null);

    try {
      const relatedKws = relatedKeywords.slice(0, 10).map(k => getKw(k)).filter(Boolean);
      const questionsList = questions.slice(0, 5).map(q => getKw(q)).filter(Boolean);

      // Get selected media URLs
      const mediaUrls = selectedMedia.map(path => {
        const file = mediaFiles.find(f => f.path === path);
        return file?.url || file?.publicUrl || "";
      }).filter(Boolean);

      const requestBody: Record<string, unknown> = {
        keyword,
        relatedKeywords: relatedKws,
        questions: questionsList,
        targetAudience: "European adults interested in aesthetic medicine and cosmetic procedures",
        articleType,
        tone: "professional",
        wordCount: 1500,
        mediaUrls,
      };

      // If generating all languages, use the languages array
      if (generateAllLanguages) {
        requestBody.languages = ["en", "fr", "de"];
      } else {
        requestBody.language = articleLanguage;
      }

      const res = await fetch("/api/aeo/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const data = await res.json();
      
      if (data.success) {
        if (data.multilingual && data.articles) {
          // Multi-language response
          setMultilingualArticles(data.articles);
          setGeneratedArticle(data.articles.en || data.articles.fr || data.articles.de);
          
          // Update content plan with all articles
          setContentPlan(prev => prev.map(p => 
            p.keyword.toLowerCase() === keyword.toLowerCase()
              ? { ...p, articles: data.articles, article: data.articles.en, status: "review" as const }
              : p
          ));
        } else if (data.article) {
          // Single language response
          setGeneratedArticle(data.article);
          setMultilingualArticles(null);
          
          // Update content plan with article
          setContentPlan(prev => prev.map(p => 
            p.keyword.toLowerCase() === keyword.toLowerCase()
              ? { ...p, article: data.article, status: "review" as const }
              : p
          ));
        }
        
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
        <div className="mb-6 flex flex-wrap gap-2">
          {[
            { id: "research", label: "Keyword Research", icon: "🔍" },
            { id: "content", label: "Content Plan", icon: "📋", badge: contentPlan.length },
            { id: "articles", label: "Generated Articles", icon: "✍️" },
            { id: "media", label: "Media Library", icon: "🖼️", badge: mediaFiles.length },
            { id: "distribute", label: "Distribute", icon: "📤", badge: distributions.length },
            { id: "backlinks", label: "Backlinks", icon: "🔗", badge: backlinks.length },
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
                  Keyword Overview: "{getKw(keywordData) || searchKeyword}"
                </h2>
                <div className="grid gap-4 sm:grid-cols-4">
                  <div className="rounded-lg bg-blue-50 p-4">
                    <p className="text-sm text-blue-600">Search Volume</p>
                    <p className="text-2xl font-bold text-blue-900">
                      {formatNumber(getVolume(keywordData))}
                    </p>
                    <p className="text-xs text-blue-500">monthly searches</p>
                  </div>
                  <div className="rounded-lg bg-emerald-50 p-4">
                    <p className="text-sm text-emerald-600">CPC</p>
                    <p className="text-2xl font-bold text-emerald-900">
                      ${getCpc(keywordData)}
                    </p>
                    <p className="text-xs text-emerald-500">cost per click</p>
                  </div>
                  <div className="rounded-lg bg-amber-50 p-4">
                    <p className="text-sm text-amber-600">Competition</p>
                    <p className="text-2xl font-bold text-amber-900">
                      {(parseFloat(getCompetition(keywordData)) * 100).toFixed(0)}%
                    </p>
                    <p className="text-xs text-amber-500">advertiser competition</p>
                  </div>
                  <div className={`rounded-lg p-4 ${getDifficultyColor(getDifficulty(keywordData))}`}>
                    <p className="text-sm">Keyword Difficulty</p>
                    <p className="text-2xl font-bold">
                      {getDifficulty(keywordData) || "N/A"}
                    </p>
                    <p className="text-xs">SEO difficulty score</p>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => addToContentPlan(
                      getKw(keywordData) || searchKeyword,
                      getVolume(keywordData),
                      getDifficulty(keywordData)
                    )}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    + Add to Content Plan
                  </button>
                  <button
                    onClick={() => generateArticle(getKw(keywordData) || searchKeyword)}
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
                            <td className="p-2 font-medium text-slate-700">{getKw(kw)}</td>
                            <td className="p-2 text-right text-slate-600">
                              {formatNumber(getVolume(kw))}
                            </td>
                            <td className="p-2 text-right">
                              <span className={`rounded px-2 py-0.5 text-xs ${getDifficultyColor(getDifficulty(kw))}`}>
                                {getDifficulty(kw) || "-"}
                              </span>
                            </td>
                            <td className="p-2">
                              <button
                                onClick={() => addToContentPlan(getKw(kw), getVolume(kw), getDifficulty(kw))}
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
                        <p className="text-sm text-slate-700">{getKw(q)}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">
                            {formatNumber(getVolume(q))} vol
                          </span>
                          <button
                            onClick={() => addToContentPlan(getKw(q), getVolume(q), getDifficulty(q))}
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
                          <td className="p-3 font-medium text-slate-700">{getKw(kw)}</td>
                          <td className="p-3 text-center">
                            <span className={`rounded-full px-2 py-1 text-xs font-bold ${
                              parseInt(getPosition(kw)) <= 3
                                ? "bg-emerald-100 text-emerald-700"
                                : parseInt(getPosition(kw)) <= 10
                                ? "bg-blue-100 text-blue-700"
                                : "bg-slate-100 text-slate-600"
                            }`}>
                              #{getPosition(kw)}
                            </span>
                          </td>
                          <td className="p-3 text-right text-slate-600">
                            {formatNumber(getVolume(kw))}
                          </td>
                          <td className="p-3 text-right text-emerald-600">
                            {getTraffic(kw)}%
                          </td>
                          <td className="p-3 text-right">
                            <span className={`rounded px-2 py-0.5 text-xs ${getDifficultyColor(getDifficulty(kw))}`}>
                              {getDifficulty(kw) || "-"}
                            </span>
                          </td>
                          <td className="p-3">
                            <button
                              onClick={() => analyzeKeywordDeep(getKw(kw))}
                              disabled={analyzingKeyword === getKw(kw)}
                              className="text-blue-600 hover:text-blue-700 disabled:opacity-50"
                            >
                              {analyzingKeyword === getKw(kw) ? "Analyzing..." : "Analyze"}
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
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={generateAllLanguages}
                      onChange={e => setGenerateAllLanguages(e.target.checked)}
                      className="rounded"
                    />
                    <span>Generate EN/FR/DE</span>
                  </label>
                  {!generateAllLanguages && (
                    <select
                      value={articleLanguage}
                      onChange={e => setArticleLanguage(e.target.value as typeof articleLanguage)}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    >
                      <option value="en">🇬🇧 English</option>
                      <option value="fr">🇫🇷 French</option>
                      <option value="de">🇩🇪 German</option>
                    </select>
                  )}
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

            {/* Multi-language Articles */}
            {multilingualArticles && (
              <div className="mt-6 rounded-xl bg-white p-6 shadow-sm">
                <h3 className="mb-4 text-lg font-semibold text-slate-900">
                  📚 All Language Versions
                </h3>
                <div className="grid gap-4 md:grid-cols-3">
                  {(["en", "fr", "de"] as const).map(lang => {
                    const article = multilingualArticles[lang] as GeneratedArticle | undefined;
                    const langNames = { en: "English", fr: "French", de: "German" };
                    const langFlags = { en: "🇬🇧", fr: "🇫🇷", de: "🇩🇪" };
                    
                    return (
                      <div key={lang} className="rounded-lg border border-slate-200 p-4">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="font-medium">
                            {langFlags[lang]} {langNames[lang]}
                          </span>
                          {article?.content && (
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(article.content);
                              }}
                              className="text-sm text-blue-600 hover:text-blue-700"
                            >
                              Copy
                            </button>
                          )}
                        </div>
                        {article?.content ? (
                          <>
                            <p className="text-sm text-slate-600">{article.titleTag}</p>
                            <p className="mt-1 text-xs text-slate-400">{article.wordCount} words</p>
                          </>
                        ) : (
                          <p className="text-sm text-slate-400">Not generated</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Media Library Tab */}
        {activeTab === "media" && (
          <div className="space-y-6">
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">
                  Media Library ({mediaFiles.length} files)
                </h2>
                <label className="cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                  {uploadingMedia ? "Uploading..." : "📤 Upload Image"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) uploadMedia(file);
                    }}
                    disabled={uploadingMedia}
                  />
                </label>
              </div>

              <p className="mb-4 text-sm text-slate-500">
                Upload images to include in generated articles. Select images before generating to include them.
              </p>

              {mediaFiles.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="mb-3 text-4xl">🖼️</div>
                  <p className="text-slate-500">No media files yet</p>
                  <p className="mt-1 text-sm text-slate-400">
                    Upload images to use in your articles
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {mediaFiles.map((file, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        setSelectedMedia(prev =>
                          prev.includes(file.path)
                            ? prev.filter(p => p !== file.path)
                            : [...prev, file.path]
                        );
                      }}
                      className={`cursor-pointer rounded-lg border-2 p-2 transition ${
                        selectedMedia.includes(file.path)
                          ? "border-blue-500 bg-blue-50"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      {file.url && (
                        <img
                          src={file.url}
                          alt={file.name}
                          className="mb-2 h-32 w-full rounded object-cover"
                        />
                      )}
                      <p className="truncate text-sm font-medium text-slate-700">{file.name}</p>
                      <p className="text-xs text-slate-400">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                      {selectedMedia.includes(file.path) && (
                        <span className="mt-1 inline-block rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                          Selected
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {selectedMedia.length > 0 && (
                <div className="mt-4 rounded-lg bg-blue-50 p-3">
                  <p className="text-sm text-blue-700">
                    {selectedMedia.length} image(s) selected - will be included in next generated article
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Backlinks Tab */}
        {activeTab === "backlinks" && (
          <div className="space-y-6">
            {/* Overview Stats */}
            {backlinksOverview && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl bg-white p-6 shadow-sm">
                  <p className="text-sm text-slate-500">Authority Score</p>
                  <p className="text-3xl font-bold text-blue-600">
                    {backlinksOverview.ascore || "N/A"}
                  </p>
                </div>
                <div className="rounded-xl bg-white p-6 shadow-sm">
                  <p className="text-sm text-slate-500">Total Backlinks</p>
                  <p className="text-3xl font-bold text-emerald-600">
                    {formatNumber(backlinksOverview.total || "0")}
                  </p>
                </div>
                <div className="rounded-xl bg-white p-6 shadow-sm">
                  <p className="text-sm text-slate-500">Referring Domains</p>
                  <p className="text-3xl font-bold text-purple-600">
                    {formatNumber(backlinksOverview.domains_num || "0")}
                  </p>
                </div>
                <div className="rounded-xl bg-white p-6 shadow-sm">
                  <p className="text-sm text-slate-500">Follow Links</p>
                  <p className="text-3xl font-bold text-amber-600">
                    {formatNumber(backlinksOverview.follows_num || "0")}
                  </p>
                </div>
              </div>
            )}

            {/* Backlinks List */}
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">
                  Recent Backlinks
                </h2>
                <button
                  onClick={loadBacklinksData}
                  disabled={loadingBacklinks}
                  className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-200 disabled:opacity-50"
                >
                  {loadingBacklinks ? "Loading..." : "🔄 Refresh"}
                </button>
              </div>

              {backlinks.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="mb-3 text-4xl">🔗</div>
                  <p className="text-slate-500">
                    {loadingBacklinks ? "Loading backlinks data..." : "No backlinks data available"}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr className="text-left text-xs text-slate-500">
                        <th className="p-3">Source</th>
                        <th className="p-3">Anchor Text</th>
                        <th className="p-3 text-center">Score</th>
                        <th className="p-3">First Seen</th>
                        <th className="p-3">Type</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {backlinks.map((link, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-3">
                            <a
                              href={link.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline"
                            >
                              {link.source_title || new URL(link.source_url || "").hostname}
                            </a>
                          </td>
                          <td className="max-w-xs truncate p-3 text-slate-600">
                            {link.anchor || "(no anchor)"}
                          </td>
                          <td className="p-3 text-center">
                            <span className={`rounded-full px-2 py-1 text-xs font-bold ${
                              parseInt(link.page_ascore || "0") >= 50
                                ? "bg-emerald-100 text-emerald-700"
                                : parseInt(link.page_ascore || "0") >= 30
                                ? "bg-amber-100 text-amber-700"
                                : "bg-slate-100 text-slate-600"
                            }`}>
                              {link.page_ascore || "?"}
                            </span>
                          </td>
                          <td className="p-3 text-slate-500">
                            {link.first_seen ? new Date(link.first_seen).toLocaleDateString() : "-"}
                          </td>
                          <td className="p-3">
                            <span className={`rounded px-2 py-0.5 text-xs ${
                              link.nofollow === "true"
                                ? "bg-slate-100 text-slate-600"
                                : "bg-emerald-100 text-emerald-700"
                            }`}>
                              {link.nofollow === "true" ? "nofollow" : "follow"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Distribute Tab */}
        {activeTab === "distribute" && (
          <div className="space-y-6">
            {/* Connection Status */}
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Press Release Distribution
                  </h2>
                  <p className="text-sm text-slate-500">
                    Submit articles to 200+ news sites for backlinks via PRNow.io
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`flex items-center gap-2 rounded-full px-3 py-1 text-sm ${
                    prnowConnected 
                      ? "bg-emerald-100 text-emerald-700" 
                      : "bg-amber-100 text-amber-700"
                  }`}>
                    <span className={`h-2 w-2 rounded-full ${
                      prnowConnected ? "bg-emerald-500" : "bg-amber-500"
                    }`} />
                    {prnowConnected ? "PRNow Connected" : "API Key Required"}
                  </span>
                  <button
                    onClick={testPRNowConnection}
                    className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-200"
                  >
                    🔄 Refresh
                  </button>
                </div>
              </div>

              {!prnowConnected && (
                <div className="mt-4 rounded-lg bg-amber-50 p-4">
                  <h3 className="font-medium text-amber-800">Setup Required</h3>
                  <p className="mt-1 text-sm text-amber-700">
                    Add your PRNow API key to enable automatic distribution:
                  </p>
                  <code className="mt-2 block rounded bg-amber-100 p-2 text-xs text-amber-800">
                    PRNOW_API_KEY=prnow_your_key_here
                  </code>
                  <p className="mt-2 text-sm text-amber-700">
                    Get your API key at{" "}
                    <a 
                      href="https://prnow.io/white-label" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      prnow.io/white-label
                    </a>
                    {" "}(~$23/release for 200+ placements)
                  </p>
                </div>
              )}
            </div>

            {/* Submit Article for Distribution */}
            {generatedArticle && (
              <div className="rounded-xl bg-white p-6 shadow-sm">
                <h3 className="mb-4 text-lg font-semibold text-slate-900">
                  🚀 Submit for Distribution
                </h3>
                <div className="rounded-lg border border-slate-200 p-4">
                  <h4 className="font-medium text-slate-800">{generatedArticle.titleTag}</h4>
                  <p className="mt-1 text-sm text-slate-500">{generatedArticle.metaDescription}</p>
                  <div className="mt-3 flex items-center gap-3">
                    <span className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600">
                      {generatedArticle.language.toUpperCase()}
                    </span>
                    <span className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600">
                      {generatedArticle.wordCount} words
                    </span>
                  </div>
                  <button
                    onClick={() => submitForDistribution(generatedArticle)}
                    disabled={submittingDistribution || !prnowConnected}
                    className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {submittingDistribution ? "Submitting..." : "📤 Submit to PRNow (~$23)"}
                  </button>
                </div>

                {/* Multi-language Submit */}
                {multilingualArticles && Object.keys(multilingualArticles).length > 1 && (
                  <div className="mt-4">
                    <p className="mb-2 text-sm text-slate-600">Or submit all language versions:</p>
                    <div className="flex gap-2">
                      {(["en", "fr", "de"] as const).map(lang => {
                        const article = multilingualArticles[lang] as GeneratedArticle | undefined;
                        if (!article) return null;
                        return (
                          <button
                            key={lang}
                            onClick={() => submitForDistribution(article)}
                            disabled={submittingDistribution || !prnowConnected}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
                          >
                            {lang === "en" ? "🇬🇧" : lang === "fr" ? "🇫🇷" : "🇩🇪"} Submit {lang.toUpperCase()}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Distribution History */}
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">
                  📊 Distribution History ({distributions.length})
                </h3>
                <button
                  onClick={loadDistributions}
                  className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-200"
                >
                  🔄 Refresh
                </button>
              </div>

              {distributions.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="mb-3 text-4xl">📤</div>
                  <p className="text-slate-500">No distributions yet</p>
                  <p className="mt-1 text-sm text-slate-400">
                    Generate an article and submit it for distribution
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr className="text-left text-xs text-slate-500">
                        <th className="p-3">Title</th>
                        <th className="p-3 text-center">Status</th>
                        <th className="p-3 text-center">Placements</th>
                        <th className="p-3">Submitted</th>
                        <th className="p-3">Report</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {distributions.map((dist) => (
                        <tr key={dist.id} className="hover:bg-slate-50">
                          <td className="max-w-xs truncate p-3 font-medium text-slate-700">
                            {dist.title}
                          </td>
                          <td className="p-3 text-center">
                            <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                              dist.status === "completed"
                                ? "bg-emerald-100 text-emerald-700"
                                : dist.status === "submitted"
                                ? "bg-blue-100 text-blue-700"
                                : dist.status === "failed"
                                ? "bg-red-100 text-red-700"
                                : "bg-slate-100 text-slate-600"
                            }`}>
                              {dist.status}
                            </span>
                          </td>
                          <td className="p-3 text-center font-medium text-slate-700">
                            {dist.placements_count || "-"}
                          </td>
                          <td className="p-3 text-slate-500">
                            {new Date(dist.submitted_at).toLocaleDateString()}
                          </td>
                          <td className="p-3">
                            {dist.report_url ? (
                              <a
                                href={dist.report_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline"
                              >
                                View Report
                              </a>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Pricing Info */}
            <div className="rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 p-6">
              <h3 className="mb-3 font-semibold text-slate-900">💰 PRNow Pricing</h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg bg-white p-4 shadow-sm">
                  <p className="text-2xl font-bold text-blue-600">$23-30</p>
                  <p className="text-sm text-slate-600">Per release (volume)</p>
                </div>
                <div className="rounded-lg bg-white p-4 shadow-sm">
                  <p className="text-2xl font-bold text-emerald-600">200+</p>
                  <p className="text-sm text-slate-600">News placements</p>
                </div>
                <div className="rounded-lg bg-white p-4 shadow-sm">
                  <p className="text-2xl font-bold text-purple-600">5-7</p>
                  <p className="text-sm text-slate-600">Day delivery</p>
                </div>
                <div className="rounded-lg bg-white p-4 shadow-sm">
                  <p className="text-2xl font-bold text-amber-600">DA 69+</p>
                  <p className="text-sm text-slate-600">Max domain authority</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
