"use client";

import { ReactNode } from "react";
import Link from "next/link";
import DocumentPreviewTabsWrapper from "./DocumentPreviewTabsWrapper";
import CrmTabDropdown from "./CrmTabDropdown";
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
  | "medication";

interface PatientPageClientWrapperProps {
  patientId: string;
  medicalTab: MedicalTab;
  patientName?: string;
  children: ReactNode;
}

export default function PatientPageClientWrapper({
  patientId,
  medicalTab,
  patientName,
  children,
}: PatientPageClientWrapperProps) {
  const medicalTabs: { id: MedicalTab; label: string }[] = [
    { id: "cockpit", label: "Cockpit" },
    { id: "notes", label: "Consultations" },
    { id: "invoice", label: "Invoice" },
    { id: "medication", label: "Medication" },
    { id: "3d", label: "3D" },
    { id: "patient_information", label: "Patient Information" },
    { id: "documents", label: "Documents" },
    { id: "rendezvous", label: "Rendezvous" },
    { id: "forms", label: "Forms" },
    { id: "crm", label: "CRM" },
  ];

  return (
    <DocumentPreviewTabsWrapper
      patientId={patientId}
      medicalTab={medicalTab}
      medicalTabs={medicalTabs}
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
