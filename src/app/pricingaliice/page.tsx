"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { 
  Building2, CheckCircle, HardDrive,
  Rocket, Stethoscope, Calculator, ArrowRight,
  ChevronDown, X, Loader2
} from "lucide-react";

// Currency rates (CHF as base)
const CURRENCIES = {
  CHF: { symbol: "CHF", rate: 1, name: "Swiss Franc" },
  EUR: { symbol: "€", rate: 0.94, name: "Euro" },
  USD: { symbol: "$", rate: 1.12, name: "US Dollar" },
};

type CurrencyCode = keyof typeof CURRENCIES;

// Pricing Tiers (prices in CHF)
const TIERS = [
  {
    name: "Starter",
    price: 1490,
    onboarding: 2500,
    description: "Essential CRM & Booking",
    color: "from-blue-500 to-blue-600",
    users: "Up to 5 Users",
    storage: "1 TB",
    features: [
      { name: "Patient Management", included: true, category: "core" },
      { name: "Appointment Booking", included: true, category: "core" },
      { name: "Basic Calendar/Agenda", included: true, category: "core" },
      { name: "Lead Management", included: true, category: "core" },
      { name: "Tasks & Reminders", included: true, category: "core" },
      { name: "Email Notifications", included: true, category: "core" },
      { name: "Deals Pipeline", included: false, category: "business" },
      { name: "Invoicing (TARDOC)", included: false, category: "business" },
      { name: "Workflow Automation", included: false, category: "automation" },
      { name: "Marketing Campaigns", included: false, category: "automation" },
      { name: "AI Assistant (Aliice)", included: false, category: "ai" },
      { name: "Crisalix 3D Integration", included: false, category: "ai" },
      { name: "WhatsApp Integration", included: false, category: "integrations" },
      { name: "Advanced Analytics", included: false, category: "analytics" },
    ],
  },
  {
    name: "Professional",
    price: 2240,
    onboarding: 3500,
    description: "Full CRM + ERP + Booking",
    color: "from-emerald-500 to-teal-600",
    popular: true,
    users: "Up to 15 Users",
    storage: "1 TB",
    features: [
      { name: "Patient Management", included: true, category: "core" },
      { name: "Appointment Booking", included: true, category: "core" },
      { name: "Advanced Calendar/Agenda", included: true, category: "core" },
      { name: "Lead Management & Import", included: true, category: "core" },
      { name: "Tasks & Reminders", included: true, category: "core" },
      { name: "Email Notifications", included: true, category: "core" },
      { name: "Deals Pipeline", included: true, category: "business" },
      { name: "Invoicing (TARDOC)", included: true, category: "business" },
      { name: "Workflow Automation", included: true, category: "automation" },
      { name: "Marketing Campaigns", included: true, category: "automation" },
      { name: "AI Assistant (Aliice)", included: false, category: "ai" },
      { name: "Crisalix 3D Integration", included: false, category: "ai" },
      { name: "WhatsApp Integration", included: false, category: "integrations" },
      { name: "Advanced Analytics", included: true, category: "analytics" },
    ],
  },
  {
    name: "Enterprise",
    price: 3200,
    onboarding: 5500,
    description: "Everything + AI & Integrations",
    color: "from-purple-500 to-indigo-600",
    users: "Unlimited Users",
    storage: "2 TB",
    features: [
      { name: "Patient Management", included: true, category: "core" },
      { name: "Appointment Booking", included: true, category: "core" },
      { name: "Advanced Calendar/Agenda", included: true, category: "core" },
      { name: "Lead Management & Import", included: true, category: "core" },
      { name: "Tasks & Reminders", included: true, category: "core" },
      { name: "Email Notifications", included: true, category: "core" },
      { name: "Deals Pipeline", included: true, category: "business" },
      { name: "Invoicing (TARDOC)", included: true, category: "business" },
      { name: "Workflow Automation", included: true, category: "automation" },
      { name: "Marketing Campaigns", included: true, category: "automation" },
      { name: "AI Assistant (Aliice Chat)", included: true, category: "ai" },
      { name: "Crisalix 3D Integration", included: true, category: "ai" },
      { name: "WhatsApp Integration", included: true, category: "integrations" },
      { name: "Advanced Analytics", included: true, category: "analytics" },
    ],
  },
];

// Feature categories for grouping
const FEATURE_CATEGORIES = [
  { id: "core", name: "Core Features", color: "text-blue-400" },
  { id: "business", name: "Business Tools", color: "text-emerald-400" },
  { id: "automation", name: "Automation", color: "text-amber-400" },
  { id: "ai", name: "AI & 3D", color: "text-purple-400" },
  { id: "integrations", name: "Integrations", color: "text-pink-400" },
  { id: "analytics", name: "Analytics", color: "text-cyan-400" },
];

// Competitors (prices in CHF)
const COMPETITORS = [
  { name: "Hubspot", type: "CRM", monthly: 3000, annual: 36000, storage: "Based on Contacts" },
  { name: "Axenita", type: "ERP", monthly: 1200, annual: 14400, storage: "Based on Contacts" },
  { name: "OneDoc", type: "Booking", monthly: 227, annual: 2724, storage: "Based on Doctors" },
];

// Storage options
const STORAGE_OPTIONS = [
  { tb: 0, label: "Included Storage Only" },
  { tb: 1, label: "+1 TB" },
  { tb: 2, label: "+2 TB" },
  { tb: 3, label: "+3 TB" },
  { tb: 5, label: "+5 TB" },
  { tb: 10, label: "+10 TB" },
];

const STORAGE_PRICE_PER_TB = 50; // CHF per TB per month

export default function PricingAliicePage() {
  const [currency, setCurrency] = useState<CurrencyCode>("CHF");
  const [selectedTier, setSelectedTier] = useState(1);
  const [extraStorage, setExtraStorage] = useState(0);
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "annual">("monthly");
  const [currencyDropdownOpen, setCurrencyDropdownOpen] = useState(false);
  const [showInquiryModal, setShowInquiryModal] = useState(false);
  const [inquiryForm, setInquiryForm] = useState({ name: "", email: "", mobile: "" });
  const [inquiryLoading, setInquiryLoading] = useState(false);
  const [inquirySuccess, setInquirySuccess] = useState(false);
  const [inquiryError, setInquiryError] = useState("");

  const handleInquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInquiryLoading(true);
    setInquiryError("");
    try {
      const res = await fetch("/api/public/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inquiryForm),
      });
      if (!res.ok) throw new Error("Failed to send");
      setInquirySuccess(true);
      setInquiryForm({ name: "", email: "", mobile: "" });
    } catch {
      setInquiryError("Failed to send inquiry. Please try again.");
    } finally {
      setInquiryLoading(false);
    }
  };

  const openInquiryModal = () => {
    setShowInquiryModal(true);
    setInquirySuccess(false);
    setInquiryError("");
  };

  const currencyData = CURRENCIES[currency];
  
  const formatPrice = (priceCHF: number) => {
    const converted = Math.round(priceCHF * currencyData.rate);
    return `${currencyData.symbol} ${converted.toLocaleString()}`;
  };

  const tier = TIERS[selectedTier];
  const monthlySubscription = tier.price;
  const monthlyStorage = extraStorage * STORAGE_PRICE_PER_TB;
  const monthlyTotal = monthlySubscription + monthlyStorage;
  const annualTotal = monthlyTotal * 12;
  const annualDiscount = billingPeriod === "annual" ? 0.10 : 0; // 10% annual discount
  const finalMonthly = billingPeriod === "annual" ? monthlyTotal * 0.9 : monthlyTotal;
  const finalAnnual = finalMonthly * 12;

  const competitorTotal = COMPETITORS.reduce((sum, c) => sum + c.monthly, 0);
  const competitorAnnual = COMPETITORS.reduce((sum, c) => sum + c.annual, 0);
  const monthlySavings = ((competitorTotal - tier.price) / competitorTotal * 100).toFixed(0);
  const annualSavings = ((competitorAnnual - tier.price * 12) / competitorAnnual * 100).toFixed(0);

  // Group features by category
  const groupedFeatures = useMemo(() => {
    const groups: Record<string, { name: string; tiers: boolean[] }[]> = {};
    FEATURE_CATEGORIES.forEach(cat => {
      groups[cat.id] = [];
    });
    
    TIERS[0].features.forEach((feature, idx) => {
      const tierValues = TIERS.map(t => t.features[idx].included);
      if (!groups[feature.category]) groups[feature.category] = [];
      groups[feature.category].push({ name: feature.name, tiers: tierValues });
    });
    
    return groups;
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Image
            src="/logos/aliice-logo.png"
            alt="Aliice Logo"
            width={120}
            height={40}
          />
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-white hidden sm:block">Subscription Pricing</h1>
            
            {/* Currency Switcher */}
            <div className="relative">
              <button
                onClick={() => setCurrencyDropdownOpen(!currencyDropdownOpen)}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700/50 hover:bg-slate-700 rounded-lg text-white transition-colors"
              >
                <span className="font-semibold">{currency}</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${currencyDropdownOpen ? "rotate-180" : ""}`} />
              </button>
              {currencyDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-slate-800 rounded-xl border border-slate-700 shadow-xl overflow-hidden z-50">
                  {Object.entries(CURRENCIES).map(([code, data]) => (
                    <button
                      key={code}
                      onClick={() => {
                        setCurrency(code as CurrencyCode);
                        setCurrencyDropdownOpen(false);
                      }}
                      className={`w-full px-4 py-3 text-left hover:bg-slate-700/50 transition-colors flex items-center justify-between ${
                        currency === code ? "bg-emerald-500/20 text-emerald-400" : "text-white"
                      }`}
                    >
                      <span>{data.name}</span>
                      <span className="font-semibold">{data.symbol}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12 space-y-16">
        {/* Hero Section */}
        <section className="text-center">
          <div className="inline-block px-4 py-2 bg-emerald-500/20 rounded-full text-emerald-400 text-sm font-medium mb-6">
            SIMPLE & TRANSPARENT PRICING
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Choose Your Perfect Plan
          </h2>
          <p className="text-xl text-slate-300 max-w-3xl mx-auto mb-8">
            One platform that replaces CRM + ERP + Booking systems. 
            Save up to <span className="text-emerald-400 font-semibold">{monthlySavings}%</span> compared to using separate tools.
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-4 mb-12">
            <span className={`text-lg ${billingPeriod === "monthly" ? "text-white font-semibold" : "text-slate-400"}`}>
              Monthly
            </span>
            <button
              onClick={() => setBillingPeriod(billingPeriod === "monthly" ? "annual" : "monthly")}
              className={`relative w-16 h-8 rounded-full transition-colors ${
                billingPeriod === "annual" ? "bg-emerald-500" : "bg-slate-600"
              }`}
            >
              <div
                className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-transform ${
                  billingPeriod === "annual" ? "translate-x-9" : "translate-x-1"
                }`}
              />
            </button>
            <span className={`text-lg ${billingPeriod === "annual" ? "text-white font-semibold" : "text-slate-400"}`}>
              Annual
            </span>
            {billingPeriod === "annual" && (
              <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 text-sm font-medium rounded-full">
                Save 10%
              </span>
            )}
          </div>
        </section>

        {/* Pricing Tiers */}
        <section>
          <div className="grid md:grid-cols-3 gap-6">
            {TIERS.map((t, index) => (
              <div
                key={t.name}
                onClick={() => setSelectedTier(index)}
                className={`relative rounded-2xl p-6 border-2 cursor-pointer transition-all ${
                  selectedTier === index
                    ? "border-emerald-500 bg-slate-800/80 scale-105 shadow-2xl shadow-emerald-500/20"
                    : "border-slate-700/50 bg-slate-800/50 hover:border-slate-600"
                }`}
              >
                {t.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-emerald-500 rounded-full text-xs font-semibold text-white">
                    MOST POPULAR
                  </div>
                )}
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${t.color} flex items-center justify-center mb-4`}>
                  {index === 0 && <Rocket className="w-6 h-6 text-white" />}
                  {index === 1 && <Building2 className="w-6 h-6 text-white" />}
                  {index === 2 && <Stethoscope className="w-6 h-6 text-white" />}
                </div>
                <h3 className="text-xl font-bold text-white mb-1">{t.name}</h3>
                <p className="text-slate-400 text-sm mb-4">{t.description}</p>
                <div className="mb-2">
                  <span className="text-4xl font-bold text-white">
                    {formatPrice(billingPeriod === "annual" ? t.price * 0.9 : t.price)}
                  </span>
                  <span className="text-slate-400">/month</span>
                </div>
                {billingPeriod === "annual" && (
                  <p className="text-sm text-emerald-400 mb-4">
                    {formatPrice(t.price * 12 * 0.9)}/year (save {formatPrice(t.price * 12 * 0.1)})
                  </p>
                )}
                <div className="mb-6 p-3 bg-slate-700/30 rounded-lg space-y-1">
                  <p className="text-sm text-slate-300">
                    <span className="text-amber-400 font-semibold">{formatPrice(t.onboarding)}</span> one-time setup
                  </p>
                  <p className="text-xs text-slate-400">{t.users} • {t.storage} included</p>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {t.features.map((feature) => (
                    <div key={feature.name} className="flex items-center gap-2">
                      <CheckCircle className={`w-4 h-4 flex-shrink-0 ${feature.included ? "text-emerald-400" : "text-slate-600"}`} />
                      <span className={`text-sm ${feature.included ? "text-slate-300" : "text-slate-500 line-through"}`}>
                        {feature.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Storage Pricing */}
        <section>
          <div className="bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-2xl p-8 border border-blue-500/30">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-blue-500/30 rounded-xl">
                <HardDrive className="w-8 h-8 text-blue-400" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white">Storage Options</h3>
                <p className="text-slate-400">For files, documents, and media</p>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <p className="text-5xl font-bold text-white mb-2">{TIERS[selectedTier].storage}</p>
                <p className="text-slate-300">Included with {TIERS[selectedTier].name} plan</p>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-6">
                <p className="text-slate-300 mb-2">Need more storage?</p>
                <p className="text-3xl font-bold text-amber-400">
                  {formatPrice(STORAGE_PRICE_PER_TB)}<span className="text-lg text-slate-400">/month per TB</span>
                </p>
                <p className="text-sm text-slate-400 mt-2">Add as much as you need</p>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Breakdown by Category */}
        <section>
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-white mb-3">Feature Breakdown</h2>
            <p className="text-slate-400">What&apos;s included in each tier</p>
          </div>

          <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-4 gap-px bg-slate-700">
              <div className="bg-slate-800 p-4">
                <p className="text-slate-400 font-medium">Feature</p>
              </div>
              {TIERS.map((t) => (
                <div key={t.name} className={`bg-gradient-to-br ${t.color} p-4 text-center`}>
                  <p className="text-white font-bold">{t.name}</p>
                  <p className="text-white/80 text-sm">{formatPrice(t.price)}/mo</p>
                </div>
              ))}
            </div>
            
            {/* Features grouped by category */}
            {FEATURE_CATEGORIES.map((category) => (
              <div key={category.id}>
                <div className="bg-slate-700/50 px-4 py-2">
                  <p className={`font-semibold ${category.color}`}>{category.name}</p>
                </div>
                <div className="divide-y divide-slate-700/50">
                  {groupedFeatures[category.id]?.map((feature) => (
                    <div key={feature.name} className="grid grid-cols-4">
                      <div className="p-4 text-slate-300 text-sm">{feature.name}</div>
                      {feature.tiers.map((included, idx) => (
                        <div key={idx} className="p-4 text-center">
                          {included ? (
                            <CheckCircle className="w-5 h-5 text-emerald-400 mx-auto" />
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Price Comparison */}
        <section>
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-white mb-3">Price Comparison</h2>
            <p className="text-slate-400">How Aliice compares to using separate tools</p>
          </div>

          <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-700/50">
                <tr>
                  <th className="text-left px-6 py-4 text-slate-300 font-semibold">Solution</th>
                  <th className="text-center px-6 py-4 text-slate-300 font-semibold">Type</th>
                  <th className="text-center px-6 py-4 text-slate-300 font-semibold">Monthly</th>
                  <th className="text-center px-6 py-4 text-slate-300 font-semibold">Annual</th>
                  <th className="text-center px-6 py-4 text-slate-300 font-semibold">Storage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {COMPETITORS.map((comp) => (
                  <tr key={comp.name} className="hover:bg-slate-700/30">
                    <td className="px-6 py-4">
                      <p className="text-white font-medium text-lg">{comp.name}</p>
                    </td>
                    <td className="text-center px-6 py-4">
                      <span className="text-sky-400 text-sm">{comp.type}</span>
                    </td>
                    <td className="text-center px-6 py-4">
                      <p className="text-white font-semibold">{formatPrice(comp.monthly)}</p>
                    </td>
                    <td className="text-center px-6 py-4">
                      <p className="text-white font-semibold">{formatPrice(comp.annual)}</p>
                    </td>
                    <td className="text-center px-6 py-4 text-slate-400 text-sm">{comp.storage}</td>
                  </tr>
                ))}
                <tr className="bg-slate-700/30">
                  <td colSpan={2} className="px-6 py-3 text-right">
                    <p className="text-slate-400 font-medium">Combined Total:</p>
                  </td>
                  <td className="text-center px-6 py-3">
                    <p className="text-red-400 font-bold text-lg">{formatPrice(competitorTotal)}</p>
                  </td>
                  <td className="text-center px-6 py-3">
                    <p className="text-red-400 font-bold">{formatPrice(competitorAnnual)}</p>
                  </td>
                  <td></td>
                </tr>
                <tr className="bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border-t-2 border-emerald-500">
                  <td className="px-6 py-5">
                    <p className="text-white font-bold text-xl">Aliice</p>
                    <p className="text-emerald-400 text-sm">CRM + ERP + Booking</p>
                  </td>
                  <td className="text-center px-6 py-5">
                    <span className="text-emerald-400 text-sm font-medium">All-in-One</span>
                  </td>
                  <td className="text-center px-6 py-5">
                    <p className="text-emerald-400 font-bold text-xl">{formatPrice(tier.price)}</p>
                  </td>
                  <td className="text-center px-6 py-5">
                    <p className="text-emerald-400 font-bold text-xl">{formatPrice(tier.price * 12)}</p>
                  </td>
                  <td className="text-center px-6 py-5 text-white font-medium">Starts at 1 TB</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-8 grid md:grid-cols-3 gap-6">
            <div className="bg-red-500/10 rounded-xl p-6 border border-red-500/30 text-center">
              <p className="text-slate-400 mb-2">Competitors Combined</p>
              <p className="text-3xl font-bold text-red-400">{formatPrice(competitorTotal)}/mo</p>
            </div>
            <div className="bg-emerald-500/10 rounded-xl p-6 border border-emerald-500/30 text-center">
              <p className="text-slate-400 mb-2">Aliice {tier.name}</p>
              <p className="text-3xl font-bold text-emerald-400">{formatPrice(tier.price)}/mo</p>
            </div>
            <div className="bg-blue-500/10 rounded-xl p-6 border border-blue-500/30 text-center">
              <p className="text-slate-400 mb-2">Your Monthly Savings</p>
              <p className="text-3xl font-bold text-blue-400">{formatPrice(competitorTotal - tier.price)}</p>
            </div>
          </div>
        </section>

        {/* Subscription Calculator */}
        <section>
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/20 rounded-full text-purple-400 text-sm font-medium mb-4">
              <Calculator className="w-4 h-4" />
              PRICING CALCULATOR
            </div>
            <h2 className="text-3xl font-bold text-white mb-3">Calculate Your Cost</h2>
            <p className="text-slate-400">Configure your subscription and see the total</p>
          </div>

          <div className="bg-slate-800/50 rounded-2xl p-8 border border-slate-700/50">
            <div className="grid md:grid-cols-2 gap-8 mb-8">
              {/* Tier Selection */}
              <div>
                <label className="block text-white font-medium mb-4">Select Plan</label>
                <div className="space-y-3">
                  {TIERS.map((t, index) => (
                    <button
                      key={t.name}
                      onClick={() => setSelectedTier(index)}
                      className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                        selectedTier === index
                          ? "border-emerald-500 bg-emerald-500/10"
                          : "border-slate-700 bg-slate-700/30 hover:border-slate-600"
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-white font-semibold">{t.name}</p>
                          <p className="text-slate-400 text-sm">{t.description}</p>
                        </div>
                        <p className="text-white font-bold">{formatPrice(t.price)}/mo</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Storage Selection */}
              <div>
                <label className="block text-white font-medium mb-4">Additional Storage</label>
                <div className="space-y-3">
                  {STORAGE_OPTIONS.map((opt) => (
                    <button
                      key={opt.tb}
                      onClick={() => setExtraStorage(opt.tb)}
                      className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                        extraStorage === opt.tb
                          ? "border-blue-500 bg-blue-500/10"
                          : "border-slate-700 bg-slate-700/30 hover:border-slate-600"
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <p className="text-white font-semibold">{opt.label}</p>
                        <p className="text-white font-bold">
                          {opt.tb === 0 ? "Included" : `+${formatPrice(opt.tb * STORAGE_PRICE_PER_TB)}/mo`}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="bg-gradient-to-r from-emerald-500/20 to-teal-500/20 rounded-2xl p-6 border border-emerald-500/30">
              <h4 className="text-lg font-semibold text-white mb-4">Your Subscription Summary</h4>
              <div className="space-y-3 mb-6">
                <div className="flex justify-between items-center py-2 border-b border-slate-700/50">
                  <span className="text-slate-300">{tier.name} Plan</span>
                  <span className="text-white font-semibold">{formatPrice(monthlySubscription)}/mo</span>
                </div>
                {extraStorage > 0 && (
                  <div className="flex justify-between items-center py-2 border-b border-slate-700/50">
                    <span className="text-slate-300">Additional Storage ({extraStorage} TB)</span>
                    <span className="text-white font-semibold">{formatPrice(monthlyStorage)}/mo</span>
                  </div>
                )}
                {billingPeriod === "annual" && (
                  <div className="flex justify-between items-center py-2 border-b border-slate-700/50">
                    <span className="text-emerald-400">Annual Discount (10%)</span>
                    <span className="text-emerald-400 font-semibold">-{formatPrice(monthlyTotal * 0.1)}/mo</span>
                  </div>
                )}
                <div className="flex justify-between items-center py-2 border-b border-slate-700/50">
                  <span className="text-slate-300">One-time Setup Fee</span>
                  <span className="text-amber-400 font-semibold">{formatPrice(tier.onboarding)}</span>
                </div>
              </div>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                  <p className="text-slate-400 text-sm mb-1">Monthly Total</p>
                  <p className="text-3xl font-bold text-white">{formatPrice(finalMonthly)}</p>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                  <p className="text-slate-400 text-sm mb-1">Annual Total</p>
                  <p className="text-3xl font-bold text-emerald-400">{formatPrice(finalAnnual)}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="text-center py-12">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to Get Started?</h2>
          <p className="text-slate-400 mb-8 max-w-2xl mx-auto">
            Join clinics that are saving time and money with Aliice&apos;s all-in-one platform.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <button
              onClick={openInquiryModal}
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-xl hover:from-emerald-600 hover:to-teal-600 transition-all"
            >
              Start Free Trial
              <ArrowRight className="w-5 h-5" />
            </button>
            <button
              onClick={openInquiryModal}
              className="inline-flex items-center gap-2 px-8 py-4 bg-slate-700 text-white font-semibold rounded-xl hover:bg-slate-600 transition-all"
            >
              Contact Sales
            </button>
          </div>
        </section>
      </main>

      {/* Inquiry Modal */}
      {showInquiryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl">
            <button
              onClick={() => setShowInquiryModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="p-8">
              {inquirySuccess ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-emerald-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">Thank You!</h3>
                  <p className="text-slate-400 mb-6">We&apos;ll be in touch shortly.</p>
                  <button
                    onClick={() => setShowInquiryModal(false)}
                    className="px-6 py-3 bg-emerald-500 text-white font-semibold rounded-xl hover:bg-emerald-600 transition-colors"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <>
                  <h3 className="text-2xl font-bold text-white mb-2">Get Started with Aliice</h3>
                  <p className="text-slate-400 mb-6">Fill in your details and we&apos;ll contact you soon.</p>

                  <form onSubmit={handleInquirySubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Name</label>
                      <input
                        type="text"
                        required
                        value={inquiryForm.name}
                        onChange={(e) => setInquiryForm({ ...inquiryForm, name: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-colors"
                        placeholder="Your name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
                      <input
                        type="email"
                        required
                        value={inquiryForm.email}
                        onChange={(e) => setInquiryForm({ ...inquiryForm, email: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-colors"
                        placeholder="you@clinic.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Mobile</label>
                      <input
                        type="tel"
                        required
                        value={inquiryForm.mobile}
                        onChange={(e) => setInquiryForm({ ...inquiryForm, mobile: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-colors"
                        placeholder="+41 79 123 4567"
                      />
                    </div>

                    {inquiryError && (
                      <p className="text-red-400 text-sm">{inquiryError}</p>
                    )}

                    <button
                      type="submit"
                      disabled={inquiryLoading}
                      className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-xl hover:from-emerald-600 hover:to-teal-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {inquiryLoading ? (
                        <><Loader2 className="w-5 h-5 animate-spin" /> Sending...</>
                      ) : (
                        <>Submit Inquiry<ArrowRight className="w-5 h-5" /></>
                      )}
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
