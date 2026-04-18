"use client";

import { useState, useEffect, useCallback } from "react";
import { supabaseClient } from "@/lib/supabaseClient";

type SocialAccount = {
  id: string;
  name: string;
  platform: string;
  handle: string;
};

type BoostReportItem = {
  id: string;
  account: string;
  account_handle: string;
  subject: string;
  date: string;
  platform: string;
  amount_chf: number;
  amount_formatted: string;
  post_url: string | null;
  boost_status: string;
};

type Summary = {
  total_posts: number;
  total_amount_chf: number;
  total_amount_formatted: string;
};

export default function BoostReportPage() {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [startDate, setStartDate] = useState<string>(() => {
    const firstDay = new Date();
    firstDay.setDate(1);
    return firstDay.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [selectedAccount, setSelectedAccount] = useState<string>("all");
  const [reportData, setReportData] = useState<BoostReportItem[]>([]);
  const [summary, setSummary] = useState<Summary>({
    total_posts: 0,
    total_amount_chf: 0,
    total_amount_formatted: "CHF 0.00",
  });
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch accounts on mount
  useEffect(() => {
    async function fetchAccounts() {
      const { data, error } = await supabaseClient
        .from("social_media_accounts")
        .select("id, name, platform, handle")
        .eq("is_active", true)
        .order("name");

      if (error) {
        console.error("Error fetching accounts:", error);
        setError("Failed to load accounts");
        return;
      }

      setAccounts(data || []);
    }

    fetchAccounts();
  }, []);

  // Fetch report data
  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      if (selectedAccount && selectedAccount !== "all") {
        params.append("accountId", selectedAccount);
      }

      const response = await fetch(`/api/reports/boost-report?${params.toString()}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to fetch report");
      }

      setReportData(result.data || []);
      setSummary(result.summary || { total_posts: 0, total_amount_chf: 0, total_amount_formatted: "CHF 0.00" });
    } catch (err) {
      console.error("Error fetching report:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch report");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, selectedAccount]);

  // Initial load
  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // Download CSV
  const downloadCSV = async () => {
    setDownloading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      if (selectedAccount && selectedAccount !== "all") {
        params.append("accountId", selectedAccount);
      }
      params.append("format", "csv");

      const response = await fetch(`/api/reports/boost-report?${params.toString()}`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to download CSV");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `boost-report-${startDate}-to-${endDate}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error downloading CSV:", err);
      setError(err instanceof Error ? err.message : "Failed to download CSV");
    } finally {
      setDownloading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50/80 via-white to-sky-50/60 p-4 sm:p-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
            Boost Report
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Report for reimbursement - Only boosted posts (Amount in CHF)
          </p>
        </div>

        {/* Important Notice */}
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50/50 p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h2 className="text-sm font-semibold text-amber-900">
                Important: Only Boosted Posts
              </h2>
              <p className="text-xs text-amber-700 mt-1">
                This report shows ONLY boosted posts. Amounts are in <strong>CHF (Swiss Francs)</strong> - NOT AED.
                If a post is boosted on multiple platforms (e.g., IG and TikTok), it appears as 2 separate entries.
              </p>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50/50 p-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Filters */}
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-slate-700 mb-1">
                Start Date
              </label>
              <input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none"
              />
            </div>
            <div>
              <label htmlFor="endDate" className="block text-sm font-medium text-slate-700 mb-1">
                End Date
              </label>
              <input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none"
              />
            </div>
            <div>
              <label htmlFor="account" className="block text-sm font-medium text-slate-700 mb-1">
                Account
              </label>
              <select
                id="account"
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none bg-white"
              >
                <option value="all">All Accounts</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} ({account.platform})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <button
                onClick={fetchReport}
                disabled={loading}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                )}
                Generate Report
              </button>
              <button
                onClick={downloadCSV}
                disabled={downloading || reportData.length === 0}
                className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {downloading ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                )}
                Download CSV
              </button>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
            <p className="text-sm text-blue-600 font-medium">Total Boosted Posts</p>
            <p className="text-2xl font-bold text-blue-900">{summary.total_posts}</p>
          </div>
          <div className="rounded-xl border border-green-200 bg-green-50/50 p-4">
            <p className="text-sm text-green-600 font-medium">Total Amount (CHF)</p>
            <p className="text-2xl font-bold text-green-900">{summary.total_amount_formatted}</p>
          </div>
        </div>

        {/* Report Table */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Account
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Subject
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Platform
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Amount (CHF)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center">
                      <svg className="w-6 h-6 animate-spin mx-auto text-slate-400" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <p className="text-sm text-slate-500 mt-2">Loading report...</p>
                    </td>
                  </tr>
                ) : reportData.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center">
                      <p className="text-sm text-slate-500">No boosted posts found for the selected filters</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Note: Only posts marked as &quot;boosted&quot; appear on this report
                      </p>
                    </td>
                  </tr>
                ) : (
                  reportData.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{item.account}</div>
                        {item.account_handle && (
                          <div className="text-xs text-slate-500">{item.account_handle}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {item.post_url ? (
                          <a
                            href={item.post_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:underline"
                          >
                            {item.subject}
                          </a>
                        ) : (
                          <span className="text-sm text-slate-700">{item.subject}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {formatDate(item.date)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 capitalize">
                          {item.platform}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900">
                        {item.amount_formatted}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Note */}
        <p className="text-xs text-slate-400 mt-4 text-center">
          Report generated for reimbursement purposes. Amounts shown in CHF (Swiss Francs).
          Only boosted posts are included. Send to Shenna for reimbursement.
        </p>
      </div>
    </div>
  );
}
