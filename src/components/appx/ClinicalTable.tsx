"use client";

import { useState, useMemo, ReactNode } from "react";

// Type definitions for clinical data
interface Appointment {
  id: string;
  date: string;
  time: string;
  reason: string;
  provider?: string;
  status: "scheduled" | "completed" | "cancelled" | "no_show";
  location?: string;
}

interface Invoice {
  id: string;
  number: string;
  date: string;
  amount: number;
  paid: number;
  status: "paid" | "pending" | "overdue" | "partial";
  dueDate?: string;
}

interface Note {
  id: string;
  date: string;
  author: string;
  content: string;
  type?: "clinical" | "admin" | "billing";
}

interface MedicalRecord {
  id: string;
  date: string;
  type: string;
  provider: string;
  diagnosis?: string;
  notes?: string;
}

type DataType = "appointments" | "invoices" | "notes" | "records";

interface ClinicalTableProps<T> {
  data: T[];
  type: DataType;
  onRowClick?: (item: T) => void;
  maxHeight?: string;
  showFilters?: boolean;
}

// Status pill component
function StatusPill({ status }: { status: string }) {
  const statusClass = status.toLowerCase().replace(/\s+/g, "_");
  return (
    <span className={`status-pill ${statusClass}`}>
      {status}
    </span>
  );
}

// Truncated text with expand
function TruncatedText({ text, maxLength = 60 }: { text: string; maxLength?: number }) {
  const [expanded, setExpanded] = useState(false);
  
  if (text.length <= maxLength) {
    return <span>{text}</span>;
  }
  
  return (
    <span>
      {expanded ? text : `${text.slice(0, maxLength)}...`}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setExpanded(!expanded);
        }}
        className="ml-1 text-cyan-400 hover:text-cyan-300 text-xs font-medium"
      >
        {expanded ? "less" : "more"}
      </button>
    </span>
  );
}

// Format currency
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("de-CH", {
    style: "currency",
    currency: "CHF",
  }).format(amount);
}

// Format date
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// Format time
function formatTime(timeStr: string): string {
  if (!timeStr) return "";
  const [hours, minutes] = timeStr.split(":");
  return `${hours}:${minutes}`;
}

// Appointments Table
function AppointmentsTable({ 
  data, 
  onRowClick 
}: { 
  data: Appointment[]; 
  onRowClick?: (item: Appointment) => void;
}) {
  return (
    <table className="clinical-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Time</th>
          <th>Reason</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {data.map((apt) => (
          <tr 
            key={apt.id} 
            onClick={() => onRowClick?.(apt)}
            className={onRowClick ? "cursor-pointer" : ""}
          >
            <td className="whitespace-nowrap font-medium">
              {formatDate(apt.date)}
            </td>
            <td className="whitespace-nowrap text-slate-300">
              {formatTime(apt.time)}
            </td>
            <td>
              <TruncatedText text={apt.reason} maxLength={40} />
            </td>
            <td>
              <StatusPill status={apt.status} />
            </td>
          </tr>
        ))}
        {data.length === 0 && (
          <tr>
            <td colSpan={4} className="text-center text-slate-500 py-8">
              No appointments found
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

// Invoices Table
function InvoicesTable({ 
  data, 
  onRowClick 
}: { 
  data: Invoice[]; 
  onRowClick?: (item: Invoice) => void;
}) {
  return (
    <table className="clinical-table">
      <thead>
        <tr>
          <th>Invoice</th>
          <th>Date</th>
          <th className="text-right">Amount</th>
          <th className="text-right">Balance</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {data.map((inv) => (
          <tr 
            key={inv.id} 
            onClick={() => onRowClick?.(inv)}
            className={onRowClick ? "cursor-pointer" : ""}
          >
            <td className="whitespace-nowrap font-mono text-cyan-400">
              #{inv.number}
            </td>
            <td className="whitespace-nowrap text-slate-300">
              {formatDate(inv.date)}
            </td>
            <td className="whitespace-nowrap text-right">
              {formatCurrency(inv.amount)}
            </td>
            <td className={`whitespace-nowrap text-right font-medium ${
              inv.amount - inv.paid > 0 ? "text-amber-400" : "text-emerald-400"
            }`}>
              {formatCurrency(inv.amount - inv.paid)}
            </td>
            <td>
              <StatusPill status={inv.status} />
            </td>
          </tr>
        ))}
        {data.length === 0 && (
          <tr>
            <td colSpan={5} className="text-center text-slate-500 py-8">
              No invoices found
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

// Notes Table
function NotesTable({ 
  data, 
  onRowClick 
}: { 
  data: Note[]; 
  onRowClick?: (item: Note) => void;
}) {
  return (
    <table className="clinical-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Author</th>
          <th>Note</th>
        </tr>
      </thead>
      <tbody>
        {data.map((note) => (
          <tr 
            key={note.id} 
            onClick={() => onRowClick?.(note)}
            className={onRowClick ? "cursor-pointer" : ""}
          >
            <td className="whitespace-nowrap text-slate-300">
              {formatDate(note.date)}
            </td>
            <td className="whitespace-nowrap">
              <span className="text-cyan-400">{note.author}</span>
            </td>
            <td>
              <TruncatedText text={note.content} maxLength={80} />
            </td>
          </tr>
        ))}
        {data.length === 0 && (
          <tr>
            <td colSpan={3} className="text-center text-slate-500 py-8">
              No notes found
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

// Medical Records Table
function RecordsTable({ 
  data, 
  onRowClick 
}: { 
  data: MedicalRecord[]; 
  onRowClick?: (item: MedicalRecord) => void;
}) {
  return (
    <table className="clinical-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Type</th>
          <th>Provider</th>
          <th>Diagnosis</th>
        </tr>
      </thead>
      <tbody>
        {data.map((record) => (
          <tr 
            key={record.id} 
            onClick={() => onRowClick?.(record)}
            className={onRowClick ? "cursor-pointer" : ""}
          >
            <td className="whitespace-nowrap text-slate-300">
              {formatDate(record.date)}
            </td>
            <td className="whitespace-nowrap">
              <span className="text-cyan-400">{record.type}</span>
            </td>
            <td className="whitespace-nowrap">
              {record.provider}
            </td>
            <td>
              <TruncatedText text={record.diagnosis || "—"} maxLength={50} />
            </td>
          </tr>
        ))}
        {data.length === 0 && (
          <tr>
            <td colSpan={4} className="text-center text-slate-500 py-8">
              No records found
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

// Tab filter component
interface TabFiltersProps {
  activeTab: DataType;
  onTabChange: (tab: DataType) => void;
  counts: Record<DataType, number>;
}

function TabFilters({ activeTab, onTabChange, counts }: TabFiltersProps) {
  const tabs: { key: DataType; label: string; icon: ReactNode }[] = [
    {
      key: "appointments",
      label: "Appointments",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      key: "invoices",
      label: "Invoices",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z" />
        </svg>
      ),
    },
    {
      key: "notes",
      label: "Notes",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      key: "records",
      label: "Records",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
    },
  ];

  return (
    <div className="flex gap-1 p-1 bg-slate-800/50 rounded-xl mb-3">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onTabChange(tab.key)}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
            activeTab === tab.key
              ? "bg-cyan-500/20 text-cyan-400"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
          }`}
        >
          {tab.icon}
          <span className="hidden sm:inline">{tab.label}</span>
          <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] ${
            activeTab === tab.key ? "bg-cyan-500/30" : "bg-slate-700"
          }`}>
            {counts[tab.key]}
          </span>
        </button>
      ))}
    </div>
  );
}

// Main ClinicalDataView component with tabs
interface ClinicalDataViewProps {
  appointments: Appointment[];
  invoices: Invoice[];
  notes: Note[];
  records: MedicalRecord[];
  onAppointmentClick?: (apt: Appointment) => void;
  onInvoiceClick?: (inv: Invoice) => void;
  onNoteClick?: (note: Note) => void;
  onRecordClick?: (record: MedicalRecord) => void;
  maxHeight?: string;
  defaultTab?: DataType;
}

export function ClinicalDataView({
  appointments,
  invoices,
  notes,
  records,
  onAppointmentClick,
  onInvoiceClick,
  onNoteClick,
  onRecordClick,
  maxHeight = "300px",
  defaultTab = "appointments",
}: ClinicalDataViewProps) {
  const [activeTab, setActiveTab] = useState<DataType>(defaultTab);
  
  const counts = useMemo(() => ({
    appointments: appointments.length,
    invoices: invoices.length,
    notes: notes.length,
    records: records.length,
  }), [appointments.length, invoices.length, notes.length, records.length]);

  return (
    <div className="jarvis-glass rounded-xl overflow-hidden">
      <div className="p-3 border-b border-slate-700/50">
        <TabFilters 
          activeTab={activeTab} 
          onTabChange={setActiveTab} 
          counts={counts} 
        />
      </div>
      
      <div 
        className="overflow-auto jarvis-scroll"
        style={{ maxHeight }}
      >
        {activeTab === "appointments" && (
          <AppointmentsTable data={appointments} onRowClick={onAppointmentClick} />
        )}
        {activeTab === "invoices" && (
          <InvoicesTable data={invoices} onRowClick={onInvoiceClick} />
        )}
        {activeTab === "notes" && (
          <NotesTable data={notes} onRowClick={onNoteClick} />
        )}
        {activeTab === "records" && (
          <RecordsTable data={records} onRowClick={onRecordClick} />
        )}
      </div>
    </div>
  );
}

// Export individual tables for standalone use
export { AppointmentsTable, InvoicesTable, NotesTable, RecordsTable, TabFilters };
export type { Appointment, Invoice, Note, MedicalRecord, DataType };
