"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { 
  Users, Zap, Building2, 
  CheckCircle, TrendingUp, HardDrive,
  Rocket, Stethoscope, Target, PieChart, ArrowRight
} from "lucide-react";

// Team & Operating Costs
const TEAM_COSTS = {
  wilson: { name: "Wilson", role: "Lead Developer", salary: 6500 },
  ralf: { name: "Ralf", role: "Developer", salary: 800 },
  mac: { name: "Mac", role: "Developer", salary: 800 },
};

const OPERATING_COSTS = {
  ai: { name: "AI Costs", cost: 300 },
  supabase: { name: "Supabase", cost: 25 },
  vercel: { name: "Vercel", cost: 40 },
  electricity: { name: "Electricity", cost: 50 },
};

// Pricing Tiers
const TIERS = [
  {
    name: "Starter",
    price: 1490,
    onboarding: 2500,
    description: "Essential CRM & Booking",
    color: "from-blue-500 to-blue-600",
    features: [
      { name: "Patient Management", included: true },
      { name: "Appointment Booking", included: true },
      { name: "Basic Calendar/Agenda", included: true },
      { name: "Lead Management", included: true },
      { name: "Tasks & Reminders", included: true },
      { name: "Email Notifications", included: true },
      { name: "1 TB Storage", included: true },
      { name: "Up to 5 Users", included: true },
      { name: "Deals Pipeline", included: false },
      { name: "Invoicing (TARDOC)", included: false },
      { name: "Workflow Automation", included: false },
      { name: "Marketing Campaigns", included: false },
      { name: "AI Assistant", included: false },
      { name: "Crisalix 3D Integration", included: false },
      { name: "WhatsApp Integration", included: false },
      { name: "Advanced Analytics", included: false },
    ],
  },
  {
    name: "Professional",
    price: 2240,
    onboarding: 3500,
    description: "Full CRM + ERP + Booking",
    color: "from-emerald-500 to-teal-600",
    popular: true,
    features: [
      { name: "Patient Management", included: true },
      { name: "Appointment Booking", included: true },
      { name: "Advanced Calendar/Agenda", included: true },
      { name: "Lead Management & Import", included: true },
      { name: "Tasks & Reminders", included: true },
      { name: "Email Notifications", included: true },
      { name: "1 TB Storage", included: true },
      { name: "Up to 15 Users", included: true },
      { name: "Deals Pipeline", included: true },
      { name: "Invoicing (TARDOC)", included: true },
      { name: "Workflow Automation", included: true },
      { name: "Marketing Campaigns", included: true },
      { name: "AI Assistant", included: false },
      { name: "Crisalix 3D Integration", included: false },
      { name: "WhatsApp Integration", included: false },
      { name: "Advanced Analytics", included: true },
    ],
  },
  {
    name: "Enterprise",
    price: 3200,
    onboarding: 5500,
    description: "Everything + AI & Integrations",
    color: "from-purple-500 to-indigo-600",
    features: [
      { name: "Patient Management", included: true },
      { name: "Appointment Booking", included: true },
      { name: "Advanced Calendar/Agenda", included: true },
      { name: "Lead Management & Import", included: true },
      { name: "Tasks & Reminders", included: true },
      { name: "Email Notifications", included: true },
      { name: "2 TB Storage", included: true },
      { name: "Unlimited Users", included: true },
      { name: "Deals Pipeline", included: true },
      { name: "Invoicing (TARDOC)", included: true },
      { name: "Workflow Automation", included: true },
      { name: "Marketing Campaigns", included: true },
      { name: "AI Assistant (Aliice Chat)", included: true },
      { name: "Crisalix 3D Integration", included: true },
      { name: "WhatsApp Integration", included: true },
      { name: "Advanced Analytics", included: true },
    ],
  },
];

// Competitors
const COMPETITORS = [
  { name: "Hubspot", type: "CRM", monthly: 3000, annual: 36000, storage: "Based on Contacts" },
  { name: "Axenita", type: "ERP", monthly: 1200, annual: 14400, storage: "Based on Contacts" },
  { name: "OneDoc", type: "Booking", monthly: 227, annual: 2724, storage: "Based on Doctors" },
];

export default function PricingPage() {
  const [subscriptions, setSubscriptions] = useState(6);
  const [selectedTier, setSelectedTier] = useState(1);
  const [extraStorage, setExtraStorage] = useState(0);

  const totalTeamCost = useMemo(() => 
    Object.values(TEAM_COSTS).reduce((sum, member) => sum + member.salary, 0),
  []);

  const totalOperatingCost = useMemo(() => 
    Object.values(OPERATING_COSTS).reduce((sum, item) => sum + item.cost, 0),
  []);

  const totalMonthlyCosts = totalTeamCost + totalOperatingCost;

  const tier = TIERS[selectedTier];
  const monthlyRevenue = subscriptions * tier.price;
  const storageRevenue = subscriptions * extraStorage * 50;
  const totalMonthlyRevenue = monthlyRevenue + storageRevenue;
  const additionalCostsPerSub = subscriptions > 6 ? (subscriptions - 6) * 405 : 0;
  const netRevenue = totalMonthlyRevenue - totalMonthlyCosts - additionalCostsPerSub;

  const competitorTotal = COMPETITORS.reduce((sum, c) => sum + c.monthly, 0);
  const competitorAnnual = COMPETITORS.reduce((sum, c) => sum + c.annual, 0);
  const monthlySavings = ((competitorTotal - tier.price) / competitorTotal * 100).toFixed(0);
  const annualSavings = ((competitorAnnual - tier.price * 12) / competitorAnnual * 100).toFixed(0);

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
          <h1 className="text-xl font-bold text-white">Business Model & Pricing</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12 space-y-16">
        {/* Executive Summary for Investors */}
        <section className="text-center">
          <div className="inline-block px-4 py-2 bg-emerald-500/20 rounded-full text-emerald-400 text-sm font-medium mb-6">
            INVESTOR OVERVIEW
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            All-in-One Clinic Management Platform
          </h2>
          <p className="text-xl text-slate-300 max-w-3xl mx-auto mb-12">
            Aliice replaces 3 expensive tools (CRM + ERP + Booking) with one unified platform, 
            saving clinics <span className="text-emerald-400 font-semibold">49% on software costs</span> while 
            providing superior functionality.
          </p>

          {/* Key Metrics Cards */}
          <div className="grid md:grid-cols-4 gap-6 mb-12">
            <div className="bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 rounded-2xl p-6 border border-emerald-500/30">
              <Target className="w-8 h-8 text-emerald-400 mx-auto mb-3" />
              <p className="text-3xl font-bold text-white">$2,240</p>
              <p className="text-slate-400 text-sm">Monthly Subscription</p>
            </div>
            <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 rounded-2xl p-6 border border-blue-500/30">
              <PieChart className="w-8 h-8 text-blue-400 mx-auto mb-3" />
              <p className="text-3xl font-bold text-white">49%</p>
              <p className="text-slate-400 text-sm">Cheaper Than Competitors</p>
            </div>
            <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 rounded-2xl p-6 border border-purple-500/30">
              <Users className="w-8 h-8 text-purple-400 mx-auto mb-3" />
              <p className="text-3xl font-bold text-white">$8,515</p>
              <p className="text-slate-400 text-sm">Monthly Operating Cost</p>
            </div>
            <div className="bg-gradient-to-br from-amber-500/20 to-amber-600/10 rounded-2xl p-6 border border-amber-500/30">
              <TrendingUp className="w-8 h-8 text-amber-400 mx-auto mb-3" />
              <p className="text-3xl font-bold text-white">4 Clients</p>
              <p className="text-slate-400 text-sm">Break-Even Point</p>
            </div>
          </div>

          {/* Simple Value Proposition */}
          <div className="bg-slate-800/50 rounded-2xl p-8 border border-slate-700/50 max-w-4xl mx-auto">
            <h3 className="text-2xl font-bold text-white mb-6">The Business Model</h3>
            <div className="grid md:grid-cols-3 gap-8 text-left">
              <div>
                <div className="text-4xl mb-3">💰</div>
                <h4 className="text-lg font-semibold text-white mb-2">Revenue</h4>
                <p className="text-slate-400">$2,240/month per clinic subscription + $50/TB extra storage + $3,500 one-time onboarding</p>
              </div>
              <div>
                <div className="text-4xl mb-3">📊</div>
                <h4 className="text-lg font-semibold text-white mb-2">Costs</h4>
                <p className="text-slate-400">$8,515/month fixed (3 developers + infrastructure). Scales efficiently with growth.</p>
              </div>
              <div>
                <div className="text-4xl mb-3">🚀</div>
                <h4 className="text-lg font-semibold text-white mb-2">Scalability</h4>
                <p className="text-slate-400">Each new client adds $2,240 revenue with minimal marginal cost increase.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 1: Team & Operating Costs */}
        <section>
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-white mb-3">Team & Operating Costs</h2>
            <p className="text-slate-400">Monthly expenses to run Aliice</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Team Costs */}
            <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <Users className="w-5 h-5 text-blue-400" />
                </div>
                <h3 className="text-xl font-semibold text-white">Development Team</h3>
              </div>
              <div className="space-y-4">
                {Object.values(TEAM_COSTS).map((member) => (
                  <div key={member.name} className="flex justify-between items-center py-3 border-b border-slate-700/50">
                    <div>
                      <p className="text-white font-medium">{member.name}</p>
                      <p className="text-sm text-slate-400">{member.role}</p>
                    </div>
                    <p className="text-lg font-semibold text-emerald-400">${member.salary.toLocaleString()}</p>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-2">
                  <p className="text-slate-300 font-medium">Team Subtotal</p>
                  <p className="text-xl font-bold text-white">${totalTeamCost.toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* Operating Costs */}
            <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <Zap className="w-5 h-5 text-purple-400" />
                </div>
                <h3 className="text-xl font-semibold text-white">Operating Expenses</h3>
              </div>
              <div className="space-y-4">
                {Object.values(OPERATING_COSTS).map((item) => (
                  <div key={item.name} className="flex justify-between items-center py-3 border-b border-slate-700/50">
                    <p className="text-white font-medium">{item.name}</p>
                    <p className="text-lg font-semibold text-amber-400">${item.cost}</p>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-2">
                  <p className="text-slate-300 font-medium">Operating Subtotal</p>
                  <p className="text-xl font-bold text-white">${totalOperatingCost}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Total Costs Summary */}
          <div className="mt-8 bg-gradient-to-r from-red-500/20 to-orange-500/20 rounded-2xl p-6 border border-red-500/30">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-slate-300 text-lg">Total Monthly Operating Costs</p>
                <p className="text-sm text-slate-400">Base costs before scaling</p>
              </div>
              <p className="text-4xl font-bold text-white">${totalMonthlyCosts.toLocaleString()}</p>
            </div>
          </div>
        </section>

        {/* Section 2: Pricing Tiers */}
        <section>
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-white mb-3">Subscription Tiers</h2>
            <p className="text-slate-400">Choose the right plan for your clinic</p>
          </div>

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
                <div className="mb-4">
                  <span className="text-4xl font-bold text-white">${t.price.toLocaleString()}</span>
                  <span className="text-slate-400">/month</span>
                </div>
                <div className="mb-6 p-3 bg-slate-700/30 rounded-lg">
                  <p className="text-sm text-slate-300">
                    <span className="text-amber-400 font-semibold">${t.onboarding.toLocaleString()}</span> one-time onboarding
                  </p>
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

        {/* Section 3: Storage Pricing */}
        <section>
          <div className="bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-2xl p-8 border border-blue-500/30">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-blue-500/30 rounded-xl">
                <HardDrive className="w-8 h-8 text-blue-400" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white">Storage</h3>
                <p className="text-slate-400">For Files and Contacts</p>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <p className="text-5xl font-bold text-white mb-2">1 TB</p>
                <p className="text-slate-300">Included with all plans</p>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-6">
                <p className="text-slate-300 mb-2">Additional Storage</p>
                <p className="text-3xl font-bold text-amber-400">$50<span className="text-lg text-slate-400">/month</span></p>
                <p className="text-sm text-slate-400 mt-2">For every additional 1 TB of storage</p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 4: Interactive Revenue Calculator */}
        <section>
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-white mb-3">Revenue Calculator</h2>
            <p className="text-slate-400">Interactive cost vs. revenue projection</p>
          </div>

          <div className="bg-slate-800/50 rounded-2xl p-8 border border-slate-700/50">
            <div className="grid md:grid-cols-2 gap-8 mb-8">
              <div>
                <label className="block text-white font-medium mb-4">
                  Number of Clinic Subscriptions
                </label>
                <input
                  type="range"
                  min="1"
                  max="50"
                  value={subscriptions}
                  onChange={(e) => setSubscriptions(parseInt(e.target.value))}
                  className="w-full h-3 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <div className="flex justify-between mt-2">
                  <span className="text-slate-400">1</span>
                  <span className="text-3xl font-bold text-emerald-400">{subscriptions}</span>
                  <span className="text-slate-400">50</span>
                </div>
              </div>

              <div>
                <label className="block text-white font-medium mb-4">
                  Avg. Extra Storage per Client (TB)
                </label>
                <input
                  type="range"
                  min="0"
                  max="5"
                  value={extraStorage}
                  onChange={(e) => setExtraStorage(parseInt(e.target.value))}
                  className="w-full h-3 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <div className="flex justify-between mt-2">
                  <span className="text-slate-400">0</span>
                  <span className="text-3xl font-bold text-blue-400">{extraStorage} TB</span>
                  <span className="text-slate-400">5</span>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-3 text-slate-400 font-medium">Metric</th>
                    <th className="text-right py-3 text-slate-400 font-medium">Monthly</th>
                    <th className="text-right py-3 text-slate-400 font-medium">Annual</th>
                  </tr>
                </thead>
                <tbody className="text-white">
                  <tr className="border-b border-slate-700/50">
                    <td className="py-3">Subscription Revenue ({tier.name} @ ${tier.price.toLocaleString()}/mo × {subscriptions})</td>
                    <td className="text-right text-emerald-400 font-semibold">${monthlyRevenue.toLocaleString()}</td>
                    <td className="text-right text-emerald-400">${(monthlyRevenue * 12).toLocaleString()}</td>
                  </tr>
                  <tr className="border-b border-slate-700/50">
                    <td className="py-3">Storage Revenue ({extraStorage} TB × $50 × {subscriptions} clients)</td>
                    <td className="text-right text-blue-400 font-semibold">${storageRevenue.toLocaleString()}</td>
                    <td className="text-right text-blue-400">${(storageRevenue * 12).toLocaleString()}</td>
                  </tr>
                  <tr className="border-b border-slate-700/50 bg-slate-700/30">
                    <td className="py-3 font-semibold">Total Revenue</td>
                    <td className="text-right text-white font-bold text-lg">${totalMonthlyRevenue.toLocaleString()}</td>
                    <td className="text-right text-white font-bold">${(totalMonthlyRevenue * 12).toLocaleString()}</td>
                  </tr>
                  <tr className="border-b border-slate-700/50">
                    <td className="py-3">Base Operating Costs</td>
                    <td className="text-right text-red-400">-${totalMonthlyCosts.toLocaleString()}</td>
                    <td className="text-right text-red-400">-${(totalMonthlyCosts * 12).toLocaleString()}</td>
                  </tr>
                  <tr className="border-b border-slate-700/50">
                    <td className="py-3">Additional Scaling Costs ({subscriptions > 6 ? subscriptions - 6 : 0} extra clients × $405)</td>
                    <td className="text-right text-orange-400">-${additionalCostsPerSub.toLocaleString()}</td>
                    <td className="text-right text-orange-400">-${(additionalCostsPerSub * 12).toLocaleString()}</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr className={`${netRevenue >= 0 ? "bg-emerald-500/20" : "bg-red-500/20"}`}>
                    <td className="py-4 font-bold text-lg">Net Revenue</td>
                    <td className={`text-right font-bold text-2xl ${netRevenue >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      ${netRevenue.toLocaleString()}
                    </td>
                    <td className={`text-right font-bold ${netRevenue >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      ${(netRevenue * 12).toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="mt-6 text-center">
              {netRevenue < 0 ? (
                <p className="text-red-400">
                  Need <span className="font-bold">{Math.ceil((totalMonthlyCosts - totalMonthlyRevenue) / tier.price + subscriptions)}</span> subscriptions to break even
                </p>
              ) : (
                <p className="text-emerald-400 font-medium">
                  ✓ Profitable with {subscriptions} subscriptions at {tier.name} tier
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Section 5: Competitor Comparison */}
        <section>
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-white mb-3">Price Comparison</h2>
            <p className="text-slate-400">How Aliice stacks up against alternatives</p>
          </div>

          <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-700/50">
                <tr>
                  <th className="text-left px-6 py-4 text-slate-300 font-semibold">App</th>
                  <th className="text-center px-6 py-4 text-slate-300 font-semibold">Monthly Cost</th>
                  <th className="text-center px-6 py-4 text-slate-300 font-semibold">Annual Cost</th>
                  <th className="text-center px-6 py-4 text-slate-300 font-semibold">Storage</th>
                  <th className="text-center px-6 py-4 text-slate-300 font-semibold">Monthly %</th>
                  <th className="text-center px-6 py-4 text-slate-300 font-semibold">Annual %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {COMPETITORS.map((comp) => (
                  <tr key={comp.name} className="hover:bg-slate-700/30">
                    <td className="px-6 py-4">
                      <p className="text-white font-medium text-lg">{comp.name}</p>
                      <p className="text-sky-400 text-sm">{comp.type}</p>
                    </td>
                    <td className="text-center px-6 py-4">
                      <span className="text-slate-400">USD</span>
                      <p className="text-white font-semibold">${comp.monthly.toLocaleString()}</p>
                    </td>
                    <td className="text-center px-6 py-4">
                      <span className="text-slate-400">USD</span>
                      <p className="text-white font-semibold">${comp.annual.toLocaleString()}</p>
                    </td>
                    <td className="text-center px-6 py-4 text-slate-400">{comp.storage}</td>
                    <td className="text-center px-6 py-4 text-slate-500">-</td>
                    <td className="text-center px-6 py-4 text-slate-500">-</td>
                  </tr>
                ))}
                <tr className="bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border-t-2 border-emerald-500">
                  <td className="px-6 py-5">
                    <p className="text-white font-bold text-xl">Aliice</p>
                    <p className="text-emerald-400 text-sm">CRM + ERP + Booking</p>
                  </td>
                  <td className="text-center px-6 py-5">
                    <span className="text-slate-400">USD</span>
                    <p className="text-emerald-400 font-bold text-xl">${tier.price.toLocaleString()}</p>
                  </td>
                  <td className="text-center px-6 py-5">
                    <span className="text-slate-400">USD</span>
                    <p className="text-emerald-400 font-bold text-xl">${(tier.price * 12).toLocaleString()}</p>
                  </td>
                  <td className="text-center px-6 py-5 text-white font-medium">Starts at 1 TB</td>
                  <td className="text-center px-6 py-5">
                    <span className="text-emerald-400 font-bold text-lg">{monthlySavings}% Cheaper</span>
                    <p className="text-emerald-300 text-xs">than all 3 Combined</p>
                  </td>
                  <td className="text-center px-6 py-5">
                    <span className="text-emerald-400 font-bold text-lg">{annualSavings}% Cheaper</span>
                    <p className="text-emerald-300 text-xs">than all 3 Combined</p>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-8 grid md:grid-cols-3 gap-6">
            <div className="bg-red-500/10 rounded-xl p-6 border border-red-500/30 text-center">
              <p className="text-slate-400 mb-2">Competitors Combined Monthly</p>
              <p className="text-3xl font-bold text-red-400">${competitorTotal.toLocaleString()}</p>
            </div>
            <div className="bg-emerald-500/10 rounded-xl p-6 border border-emerald-500/30 text-center">
              <p className="text-slate-400 mb-2">Aliice {tier.name} Monthly</p>
              <p className="text-3xl font-bold text-emerald-400">${tier.price.toLocaleString()}</p>
            </div>
            <div className="bg-blue-500/10 rounded-xl p-6 border border-blue-500/30 text-center">
              <p className="text-slate-400 mb-2">Monthly Savings</p>
              <p className="text-3xl font-bold text-blue-400">${(competitorTotal - tier.price).toLocaleString()}</p>
            </div>
          </div>
        </section>

        {/* Section 6: Feature Comparison by Tier */}
        <section>
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-white mb-3">Feature Breakdown</h2>
            <p className="text-slate-400">What&apos;s included in each tier</p>
          </div>

          <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 overflow-hidden">
            <div className="grid grid-cols-4 gap-px bg-slate-700">
              <div className="bg-slate-800 p-4">
                <p className="text-slate-400 font-medium">Feature</p>
              </div>
              {TIERS.map((t) => (
                <div key={t.name} className={`bg-gradient-to-br ${t.color} p-4 text-center`}>
                  <p className="text-white font-bold">{t.name}</p>
                  <p className="text-white/80 text-sm">${t.price}/mo</p>
                </div>
              ))}
            </div>
            <div className="divide-y divide-slate-700/50">
              {TIERS[0].features.map((_, i) => (
                <div key={i} className="grid grid-cols-4">
                  <div className="p-4 text-slate-300 text-sm">{TIERS[0].features[i].name}</div>
                  {TIERS.map((t) => (
                    <div key={t.name} className="p-4 text-center">
                      {t.features[i].included ? (
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
        </section>

        {/* Growth Projections for Investors */}
        <section>
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-white mb-3">Growth Projections</h2>
            <p className="text-slate-400">Revenue scaling with client acquisition</p>
          </div>

          <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-700/50">
                <tr>
                  <th className="text-left px-6 py-4 text-slate-300 font-semibold">Clients</th>
                  <th className="text-center px-6 py-4 text-slate-300 font-semibold">Monthly Revenue</th>
                  <th className="text-center px-6 py-4 text-slate-300 font-semibold">Monthly Costs</th>
                  <th className="text-center px-6 py-4 text-slate-300 font-semibold">Net Profit</th>
                  <th className="text-center px-6 py-4 text-slate-300 font-semibold">Annual Profit</th>
                  <th className="text-center px-6 py-4 text-slate-300 font-semibold">Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {[3, 6, 10, 15, 25, 50].map((clients) => {
                  const revenue = clients * 2240;
                  const scalingCost = clients > 6 ? (clients - 6) * 405 : 0;
                  const totalCost = 8515 + scalingCost;
                  const profit = revenue - totalCost;
                  const margin = ((profit / revenue) * 100).toFixed(0);
                  const isBreakEven = profit >= 0;
                  return (
                    <tr key={clients} className={`${isBreakEven ? "" : "bg-red-500/10"}`}>
                      <td className="px-6 py-4 text-white font-medium">{clients} clinics</td>
                      <td className="text-center px-6 py-4 text-emerald-400 font-semibold">${revenue.toLocaleString()}</td>
                      <td className="text-center px-6 py-4 text-red-400">${totalCost.toLocaleString()}</td>
                      <td className={`text-center px-6 py-4 font-bold ${isBreakEven ? "text-emerald-400" : "text-red-400"}`}>
                        ${profit.toLocaleString()}
                      </td>
                      <td className={`text-center px-6 py-4 ${isBreakEven ? "text-emerald-400" : "text-red-400"}`}>
                        ${(profit * 12).toLocaleString()}
                      </td>
                      <td className={`text-center px-6 py-4 font-semibold ${isBreakEven ? "text-blue-400" : "text-red-400"}`}>
                        {isBreakEven ? `${margin}%` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-8 grid md:grid-cols-3 gap-6">
            <div className="bg-emerald-500/10 rounded-xl p-6 border border-emerald-500/30 text-center">
              <p className="text-slate-400 mb-2">With 10 Clients</p>
              <p className="text-3xl font-bold text-emerald-400">$13,850/mo</p>
              <p className="text-sm text-slate-400">Net Profit</p>
            </div>
            <div className="bg-blue-500/10 rounded-xl p-6 border border-blue-500/30 text-center">
              <p className="text-slate-400 mb-2">With 25 Clients</p>
              <p className="text-3xl font-bold text-blue-400">$39,780/mo</p>
              <p className="text-sm text-slate-400">Net Profit</p>
            </div>
            <div className="bg-purple-500/10 rounded-xl p-6 border border-purple-500/30 text-center">
              <p className="text-slate-400 mb-2">With 50 Clients</p>
              <p className="text-3xl font-bold text-purple-400">$85,685/mo</p>
              <p className="text-sm text-slate-400">Net Profit</p>
            </div>
          </div>
        </section>

        {/* Footer CTA */}
        <section className="text-center py-12">
          <h2 className="text-3xl font-bold text-white mb-4">Interested in Aliice?</h2>
          <p className="text-slate-400 mb-8 max-w-2xl mx-auto">
            Contact us to learn more about investment opportunities or to schedule a product demo.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="/"
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-xl hover:from-emerald-600 hover:to-teal-600 transition-all"
            >
              View Product Demo
              <ArrowRight className="w-5 h-5" />
            </a>
            <a
              href="mailto:wilson@mutant.ae"
              className="inline-flex items-center gap-2 px-8 py-4 bg-slate-700 text-white font-semibold rounded-xl hover:bg-slate-600 transition-all"
            >
              Contact Us
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}
