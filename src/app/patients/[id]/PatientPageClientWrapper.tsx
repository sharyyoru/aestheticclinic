"use client";

import { ReactNode } from "react";
import Link from "next/link";
import DocumentPreviewTabsWrapper from "./DocumentPreviewTabsWrapper";
import CrmTabDropdown from "./CrmTabDropdown";
import MedicalTabDropdown from "./MedicalTabDropdown";
import AiCallButton from "./AiCallButton";

type MedicalTab =
  | "cockpit"
  | "notes"
  | "prescription"
  | "invoice"
  | "file"
  | "photo"
  | "3d"
  | "patient_information"
  | "documents"
  | "rendezvous"
  | "forms"
  | "crm"
  | "form_photos"
  | "medication"
  | "medical";

interface PatientPageClientWrapperProps {
  patientId: string;
  medicalTab: MedicalTab;
  patientName?: string;
  children: ReactNode;
}

// Medical sub-tabs that are grouped under the Medical dropdown
const MEDICAL_SUB_TABS = ["notes", "invoice", "medication", "3d", "patient_information", "documents", "rendezvous", "forms"];

export default function PatientPageClientWrapper({
  patientId,
  medicalTab,
  patientName,
  children,
}: PatientPageClientWrapperProps) {
  // Check if current tab is a medical sub-tab
  const isMedicalSubTab = MEDICAL_SUB_TABS.includes(medicalTab) || medicalTab === "medical";

  const medicalTabs: { id: MedicalTab; label: string }[] = [
    { id: "cockpit", label: "Cockpit" },
    { id: "medical", label: "Medical" },
    { id: "crm", label: "CRM" },
  ];

  return (
    <DocumentPreviewTabsWrapper
      patientId={patientId}
      medicalTab={medicalTab}
      medicalTabs={medicalTabs}
      MedicalTabDropdown={
        <MedicalTabDropdown patientId={patientId} isActive={isMedicalSubTab} />
      }
      CrmTabDropdown={
        <CrmTabDropdown patientId={patientId} isActive={medicalTab === "crm"} />
      }
      AiCallButton={
        <AiCallButton patientId={patientId} patientName={patientName} />
      }
    >
      {children}
    </DocumentPreviewTabsWrapper>
  );
}
