"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";

type MedicationSubTab = "medicine" | "prescription" | "consumables";

type PatientPrescription = {
    journal_entry_id: string;
    patient_id: string;
    mandator_id: string;
    therapy_id: string;
    prescription_line_id: string | null;
    prescription_sheet_id: string | null;
    product_name: string;
    product_no: number | null;
    product_type: string | null;
    product_state: string | null;
    amount_morning: string | null;
    amount_noon: string | null;
    amount_evening: string | null;
    amount_night: string | null;
    custom_dose: string | null;
    quantity: number | null;
    intake_kind: string | null;
    intake_note: string | null;
    intake_from_date: string | null;
    decision_summary: string | null;
    show_in_mediplan: boolean | null;
    active: boolean | null;
};

export default function MedicationCard({ patientId }: { patientId: string }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [medications, setMedications] = useState<PatientPrescription[]>([]);
    const [loading, setLoading] = useState(false);

    const rawSubTab = searchParams?.get("med_sub");
    const subTab: MedicationSubTab =
        rawSubTab === "medicine" || rawSubTab === "prescription" || rawSubTab === "consumables"
            ? rawSubTab
            : "medicine";

    useEffect(() => {
        loadMedications();
    }, [patientId]);

    async function loadMedications() {
        setLoading(true);
        const { data, error } = await supabaseClient
            .from("patient_prescriptions")
            .select("*")
            .eq("patient_id", patientId)
            .eq("active", true)
            .order("intake_from_date", { ascending: false });

        if (data) setMedications(data);
        setLoading(false);
    }

    // Filter logic
    const filteredMedications = medications.filter((med) => {
        if (subTab === "prescription") {
            return med.prescription_sheet_id !== null;
        } else if (subTab === "consumables") {
            return med.product_type === null || med.product_type !== "MEDICATION";
        } else {
            // medicine
            return med.prescription_sheet_id === null && med.product_type === "MEDICATION";
        }
    });

    // Group prescriptions by prescription_sheet_id
    const groupedPrescriptions =
        subTab === "prescription"
            ? filteredMedications.reduce(
                (acc, med) => {
                    const sheetId = med.prescription_sheet_id || "unknown";
                    if (!acc[sheetId]) acc[sheetId] = [];
                    acc[sheetId].push(med);
                    return acc;
                },
                {} as Record<string, PatientPrescription[]>,
            )
            : {};

    function changeSubTab(newSubTab: MedicationSubTab) {
        const params = new URLSearchParams(searchParams?.toString());
        params.set("med_sub", newSubTab);
        router.push(`?${params.toString()}`);
    }

    return (
        <div className="rounded-xl border border-slate-200/80 bg-white/90 p-4 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
            {/* Sub-tab navigation */}
            <div className="mb-4 border-b border-slate-200">
                <nav className="-mb-px flex gap-4 text-xs font-medium">
                    <button
                        onClick={() => changeSubTab("medicine")}
                        className={
                            (subTab === "medicine"
                                ? "border-sky-500 text-sky-600"
                                : "border-transparent text-slate-500 hover:border-slate-200 hover:text-slate-700") +
                            " inline-flex items-center border-b-2 px-1.5 py-2"
                        }
                    >
                        Medicine
                    </button>
                    <button
                        onClick={() => changeSubTab("prescription")}
                        className={
                            (subTab === "prescription"
                                ? "border-sky-500 text-sky-600"
                                : "border-transparent text-slate-500 hover:border-slate-200 hover:text-slate-700") +
                            " inline-flex items-center border-b-2 px-1.5 py-2"
                        }
                    >
                        Prescription
                    </button>
                    <button
                        onClick={() => changeSubTab("consumables")}
                        className={
                            (subTab === "consumables"
                                ? "border-sky-500 text-sky-600"
                                : "border-transparent text-slate-500 hover:border-slate-200 hover:text-slate-700") +
                            " inline-flex items-center border-b-2 px-1.5 py-2"
                        }
                    >
                        Consumables
                    </button>
                </nav>
            </div>

            {/* Content */}
            {loading ? (
                <div className="py-8 text-center text-sm text-slate-500">Loading...</div>
            ) : (
                <div className="space-y-3">
                    {subTab === "prescription" ? (
                        // Grouped prescription view with headers
                        Object.entries(groupedPrescriptions).length > 0 ? (
                            Object.entries(groupedPrescriptions).map(([sheetId, items]) => {
                                const firstItem = items[0];
                                const prescriptionDate = firstItem.intake_from_date
                                    ? new Date(firstItem.intake_from_date).toLocaleDateString("fr-CH", {
                                        weekday: "short",
                                        day: "2-digit",
                                        month: "2-digit",
                                        year: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                    })
                                    : "";

                                return (
                                    <div key={sheetId} className="rounded-lg border border-slate-200 bg-white">
                                        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2">
                                            <div className="flex items-center gap-2">
                                                <button className="text-slate-400 hover:text-slate-600">
                                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                    </svg>
                                                </button>
                                                <span className="text-xs font-semibold text-slate-700">
                                                    {prescriptionDate.toUpperCase()} ORDONNANCE
                                                </span>
                                            </div>
                                            <button className="text-slate-400 hover:text-slate-600">
                                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                                                </svg>
                                            </button>
                                        </div>
                                        <PrescriptionTable medications={items} />
                                    </div>
                                );
                            })
                        ) : (
                            <div className="py-8 text-center text-sm text-slate-500">No prescriptions found</div>
                        )
                    ) : subTab === "medicine" ? (
                        // Medicine table view
                        filteredMedications.length > 0 ? (
                            <MedicationTable medications={filteredMedications} />
                        ) : (
                            <div className="py-8 text-center text-sm text-slate-500">No medicine found</div>
                        )
                    ) : (
                        // Consumables list view
                        <>
                            {filteredMedications.length > 0 ? (
                                filteredMedications.map((med) => (
                                    <MedicationRow key={med.journal_entry_id} medication={med} />
                                ))
                            ) : (
                                <div className="py-8 text-center text-sm text-slate-500">
                                    No consumables found
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}


function MedicationTable({ medications }: { medications: PatientPrescription[] }) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-xs">
                <thead>
                    <tr className="border-b border-slate-200 bg-cyan-50">
                        <th className="px-2 py-2 text-left font-medium text-slate-600">PRODUIT</th>
                        <th className="px-2 py-2 text-center font-medium text-slate-600">TP</th>
                        <th className="px-2 py-2 text-left font-medium text-slate-600">POSOLOGIE</th>
                        <th className="px-2 py-2 text-left font-medium text-slate-600">REMARQUE POUR POSOLOGIE</th>
                        <th className="px-2 py-2 text-left font-medium text-slate-600">DURÉE</th>
                        <th className="px-2 py-2 text-left font-medium text-slate-600">INDICATIONS</th>
                        <th className="px-2 py-2 text-center font-medium text-slate-600">DE...</th>
                        <th className="px-2 py-2 text-center font-medium text-slate-600">COMMENTAIRE INTERNE</th>
                        <th className="px-2 py-2 text-center font-medium text-slate-600">P</th>
                        <th className="px-2 py-2 text-center font-medium text-slate-600">CDS</th>
                    </tr>
                </thead>
                <tbody>
                    {medications.map((med) => (
                        <MedicationTableRow key={med.journal_entry_id} medication={med} />
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function MedicationTableRow({ medication }: { medication: PatientPrescription }) {
    const dosage = [
        medication.amount_morning || "-",
        medication.amount_noon || "-",
        medication.amount_evening || "-",
        medication.amount_night || "-",
    ].join("-");

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return "-";
        return new Date(dateStr).toLocaleDateString("fr-CH");
    };

    const duration = medication.intake_from_date
        ? `${formatDate(medication.intake_from_date)} - indéfini`
        : "-";

    // Check if medication has special status icons
    const hasWarning = medication.product_state === "REMOVED_FROM_CATALOG";

    return (
        <tr className="border-b border-slate-100 hover:bg-slate-50">
            <td className="px-2 py-3">
                <div className="flex items-center gap-2">
                    <button className="text-slate-400 hover:text-slate-600">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                    </button>
                    <div>
                        <div className="font-medium text-slate-900">{medication.product_name}</div>
                        {medication.product_no && (
                            <div className="text-[10px] text-slate-500">#{medication.product_no}</div>
                        )}
                    </div>
                </div>
            </td>
            <td className="px-2 py-3 text-center">
                <div className="flex items-center justify-center gap-1">
                    {hasWarning && (
                        <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="10" strokeWidth={2} />
                            <line x1="4" y1="4" x2="20" y2="20" strokeWidth={2} />
                        </svg>
                    )}
                    <span className="font-medium text-slate-700">
                        {medication.intake_kind === "ACUTE" ? "M" : "F"}
                    </span>
                </div>
            </td>
            <td className="px-2 py-3 text-center text-slate-700">
                {dosage !== "----" && dosage !== "---" ? dosage : "-"}
            </td>
            <td className="px-2 py-3 text-center text-slate-600">
                {medication.intake_note || "-"}
            </td>
            <td className="px-2 py-3 text-slate-700">{duration}</td>
            <td className="px-2 py-3 text-slate-700">
                {medication.decision_summary ? (
                    <div className="flex items-center gap-1">
                        <button
                            className="rounded-full p-1 hover:bg-slate-100"
                            title={medication.decision_summary}
                        >
                            <svg className="h-4 w-4 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
                                <path
                                    fillRule="evenodd"
                                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                                    clipRule="evenodd"
                                />
                            </svg>
                        </button>
                        <span className="text-xs">Abcédex</span>
                    </div>
                ) : (
                    <span className="text-slate-300">-</span>
                )}
            </td>
            <td className="px-2 py-3 text-center">
                <button className="rounded-full p-1 hover:bg-slate-100">
                    <svg className="h-4 w-4 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
                        <path
                            fillRule="evenodd"
                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                            clipRule="evenodd"
                        />
                    </svg>
                </button>
            </td>
            <td className="px-2 py-3 text-center">
                <button className="rounded-full p-1 hover:bg-slate-100">
                    <svg className="h-4 w-4 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
                        <path
                            fillRule="evenodd"
                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                            clipRule="evenodd"
                        />
                    </svg>
                </button>
            </td>
            <td className="px-2 py-3 text-center">
                <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                    defaultChecked
                />
            </td>
            <td className="px-2 py-3 text-center">
                <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                    defaultChecked
                />
            </td>
        </tr>
    );
}


function PrescriptionTable({ medications }: { medications: PatientPrescription[] }) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-xs">
                <tbody>
                    {medications.map((med) => (
                        <PrescriptionTableRow key={med.journal_entry_id} medication={med} />
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function PrescriptionTableRow({ medication }: { medication: PatientPrescription }) {
    const dosage = [
        medication.amount_morning || "-",
        medication.amount_noon || "-",
        medication.amount_evening || "-",
        medication.amount_night || "-",
    ].join("-");

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return "-";
        return new Date(dateStr).toLocaleDateString("fr-CH");
    };

    const startDate = formatDate(medication.intake_from_date);
    const dateRange = medication.intake_from_date ? `${startDate} - indéfini` : "indéfini";

    // Get quantity display
    const quantityDisplay = medication.quantity ? `${medication.quantity} pce` : "-";

    return (
        <tr className="border-b border-slate-100 hover:bg-slate-50">
            <td className="px-3 py-2 text-slate-700">
                <span className="font-medium text-slate-900">
                    {medication.intake_kind === "ACUTE" ? "M" : "F"}
                </span>
            </td>
            <td className="px-3 py-2">
                <div className="font-medium text-slate-900">{medication.product_name}</div>
            </td>
            <td className="px-3 py-2 text-slate-600">{quantityDisplay}</td>
            <td className="px-3 py-2 text-center">
                <span className="font-medium text-slate-700">
                    {medication.intake_kind === "ACUTE" ? "M" : "F"}
                </span>
            </td>
            <td className="px-3 py-2 text-center text-slate-700">
                {dosage !== "----" && dosage !== "---" ? dosage : "-"}
            </td>
            <td className="px-3 py-2 text-slate-700">{dateRange}</td>
            <td className="px-3 py-2 text-center text-slate-600">1</td>
            <td className="px-3 py-2 text-center text-slate-600">-</td>
            <td className="px-3 py-2 text-right">
                <div className="flex items-center justify-end gap-1">
                    <button className="rounded p-1 hover:bg-slate-100">
                        <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                    </button>
                    <button className="rounded p-1 hover:bg-slate-100">
                        <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                        </svg>
                    </button>
                </div>
            </td>
        </tr>
    );
}

function MedicationRow({ medication }: { medication: PatientPrescription }) {
    const dosage = [
        medication.amount_morning || "-",
        medication.amount_noon || "-",
        medication.amount_evening || "-",
        medication.amount_night || "-",
    ].join("-");

    return (
        <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <div className="font-semibold text-slate-900">{medication.product_name}</div>
                    {medication.product_no && (
                        <div className="text-xs text-slate-500">Product #{medication.product_no}</div>
                    )}
                </div>
                {medication.intake_kind && (
                    <span
                        className={
                            "rounded-full px-2 py-0.5 text-[10px] font-medium " +
                            (medication.intake_kind === "ACUTE"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-blue-100 text-blue-700")
                        }
                    >
                        {medication.intake_kind === "ACUTE" ? "M" : "F"}
                    </span>
                )}
            </div>

            {dosage !== "---" && dosage !== "----" && (
                <div className="mt-2 text-xs text-slate-600">
                    <span className="font-medium">Posologie:</span> {dosage}
                </div>
            )}

            {medication.intake_note && (
                <div className="mt-1 text-xs text-slate-600">
                    <span className="font-medium">Instructions:</span> {medication.intake_note}
                </div>
            )}

            {medication.intake_from_date && (
                <div className="mt-1 text-xs text-slate-500">
                    {new Date(medication.intake_from_date).toLocaleDateString("fr-CH")}
                </div>
            )}

            {medication.decision_summary && (
                <div className="mt-1 text-xs text-slate-500">{medication.decision_summary}</div>
            )}
        </div>
    );
}
