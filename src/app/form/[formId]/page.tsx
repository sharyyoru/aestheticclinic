"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { getAlternateLanguageFormId, getFormById, FormDefinition, FormField, FormSection, FormContentBlock } from "@/lib/formDefinitions";
import Image from "next/image";

type FormData = Record<string, string | boolean | string[]>;

type PatientInfo = {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  gender?: string | null;
  dob?: string | null;
  marital_status?: string | null;
  nationality?: string | null;
  street_address?: string | null;
  street_number?: string | null;
  postal_code?: string | null;
  town?: string | null;
  country?: string | null;
  country_code?: string | null;
  profession?: string | null;
  current_employer?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  emergency_contact_relation?: string | null;
  language_preference?: string | null;
};

const BREAST_SURGERY_FORM_IDS = new Set([
  "questionnaire-anesthesie-fr",
  "questionnaire-anesthesie-en",
  "consentement-anesthesie-fr",
  "consentement-anesthesie-en",
  "consentement-augmentation-mammaire-fr",
  "consentement-augmentation-mammaire-en",
  "consentement-lift-reduction-fr",
  "consentement-lift-reduction-en",
  "consentement-eclaire-fr",
  "consentement-eclaire-en",
  "preoperative-instructions-en",
  "consignes-pre-post-op-fr",
]);

function getFormFieldIds(form: FormDefinition): Set<string> {
  return new Set(form.sections.flatMap((section) => section.fields.map((field) => field.id)));
}

function addPrefillValue(
  prefill: FormData,
  fieldIds: Set<string>,
  possibleFieldIds: string[],
  value: string | null | undefined
) {
  if (!value) return;

  possibleFieldIds.forEach((fieldId) => {
    if (fieldIds.has(fieldId)) {
      prefill[fieldId] = value;
    }
  });
}

function buildPatientPrefill(patient: PatientInfo, form: FormDefinition): FormData {
  const fieldIds = getFormFieldIds(form);
  const prefill: FormData = {};
  const fullName = [patient.first_name, patient.last_name].filter(Boolean).join(" ").trim();
  const address = [patient.street_number, patient.street_address].filter(Boolean).join(" ").trim();
  const phone = [patient.country_code, patient.phone].filter(Boolean).join(" ").trim();

  addPrefillValue(prefill, fieldIds, ["full_name", "patient_name", "name"], fullName);
  addPrefillValue(prefill, fieldIds, ["first_name", "given_name", "prenom"], patient.first_name);
  addPrefillValue(prefill, fieldIds, ["last_name", "surname", "family_name", "nom"], patient.last_name);
  addPrefillValue(prefill, fieldIds, ["date_of_birth", "dob", "birth_date"], patient.dob);
  addPrefillValue(prefill, fieldIds, ["email", "patient_email"], patient.email);
  addPrefillValue(prefill, fieldIds, ["phone", "telephone", "telephone_number", "private_phone", "patient_phone"], phone || patient.phone);
  addPrefillValue(prefill, fieldIds, ["gender", "sex"], patient.gender);
  addPrefillValue(prefill, fieldIds, ["marital_status"], patient.marital_status);
  addPrefillValue(prefill, fieldIds, ["nationality"], patient.nationality);
  addPrefillValue(prefill, fieldIds, ["street_address", "address"], patient.street_address);
  addPrefillValue(prefill, fieldIds, ["street_number"], patient.street_number);
  addPrefillValue(prefill, fieldIds, ["full_address"], address);
  addPrefillValue(prefill, fieldIds, ["postal_code", "zip_code"], patient.postal_code);
  addPrefillValue(prefill, fieldIds, ["town", "city"], patient.town);
  addPrefillValue(prefill, fieldIds, ["country"], patient.country);
  addPrefillValue(prefill, fieldIds, ["profession", "occupation"], patient.profession);
  addPrefillValue(prefill, fieldIds, ["current_employer", "employer"], patient.current_employer);
  addPrefillValue(prefill, fieldIds, ["emergency_contact_name"], patient.emergency_contact_name);
  addPrefillValue(prefill, fieldIds, ["emergency_contact_phone"], patient.emergency_contact_phone);
  addPrefillValue(
    prefill,
    fieldIds,
    ["emergency_contact_relation", "emergency_contact_relationship"],
    patient.emergency_contact_relation
  );

  return prefill;
}

function SignatureCanvas({ 
  value, 
  onChange,
  label 
}: { 
  value: string; 
  onChange: (value: string) => void;
  label: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set up canvas
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Load existing signature if any
    if (value) {
      const img = new window.Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
      };
      img.src = value;
    }
  }, []);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const dataUrl = canvas.toDataURL("image/png");
    onChange(dataUrl);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onChange("");
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      <div className="relative rounded-lg border-2 border-dashed border-slate-300 bg-white">
        <canvas
          ref={canvasRef}
          width={400}
          height={150}
          className="w-full cursor-crosshair touch-none"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        <button
          type="button"
          onClick={clearSignature}
          className="absolute right-2 top-2 rounded bg-slate-100 px-2 py-1 text-xs text-slate-600 hover:bg-slate-200"
        >
          Clear
        </button>
      </div>
      <p className="text-xs text-slate-500">Draw your signature above</p>
    </div>
  );
}

function FormFieldComponent({
  field,
  value,
  onChange,
  language,
}: {
  field: FormField;
  value: string | boolean | string[];
  onChange: (value: string | boolean | string[]) => void;
  language: "en" | "fr";
}) {
  const label = language === "fr" && field.labelFr ? field.labelFr : field.label;
  const placeholder = language === "fr" && field.placeholderFr ? field.placeholderFr : field.placeholder;

  switch (field.type) {
    case "text":
    case "email":
    case "phone":
      return (
        <div className="space-y-1">
          <label htmlFor={field.id} className="block text-sm font-medium text-slate-700">
            {label}
            {field.required && <span className="ml-1 text-red-500">*</span>}
          </label>
          <input
            type={field.type === "phone" ? "tel" : field.type}
            id={field.id}
            value={value as string || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            required={field.required}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
          />
        </div>
      );

    case "number":
      return (
        <div className="space-y-1">
          <label htmlFor={field.id} className="block text-sm font-medium text-slate-700">
            {label}
            {field.required && <span className="ml-1 text-red-500">*</span>}
          </label>
          <input
            type="number"
            id={field.id}
            value={value as string || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            required={field.required}
            min={field.validation?.min}
            max={field.validation?.max}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
          />
        </div>
      );

    case "date":
      return (
        <div className="space-y-1">
          <label htmlFor={field.id} className="block text-sm font-medium text-slate-700">
            {label}
            {field.required && <span className="ml-1 text-red-500">*</span>}
          </label>
          <input
            type="date"
            id={field.id}
            value={value as string || ""}
            onChange={(e) => onChange(e.target.value)}
            required={field.required}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
          />
        </div>
      );

    case "textarea":
      return (
        <div className="space-y-1">
          <label htmlFor={field.id} className="block text-sm font-medium text-slate-700">
            {label}
            {field.required && <span className="ml-1 text-red-500">*</span>}
          </label>
          <textarea
            id={field.id}
            value={value as string || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            required={field.required}
            rows={3}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
          />
        </div>
      );

    case "checkbox":
      return (
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            id={field.id}
            checked={value as boolean || false}
            onChange={(e) => onChange(e.target.checked)}
            required={field.required}
            className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
          />
          <label htmlFor={field.id} className="text-sm text-slate-700">
            {label}
            {field.required && <span className="ml-1 text-red-500">*</span>}
          </label>
        </div>
      );

    case "radio":
      return (
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700">
            {label}
            {field.required && <span className="ml-1 text-red-500">*</span>}
          </p>
          <div className="space-y-2">
            {field.options?.map((option) => {
              const optionLabel = language === "fr" && option.labelFr ? option.labelFr : option.label;
              return (
                <label key={option.value} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="radio"
                    name={field.id}
                    value={option.value}
                    checked={value === option.value}
                    onChange={(e) => onChange(e.target.value)}
                    required={field.required}
                    className="h-4 w-4 border-slate-300 text-sky-600 focus:ring-sky-500"
                  />
                  {optionLabel}
                </label>
              );
            })}
          </div>
        </div>
      );

    case "select":
      return (
        <div className="space-y-1">
          <label htmlFor={field.id} className="block text-sm font-medium text-slate-700">
            {label}
            {field.required && <span className="ml-1 text-red-500">*</span>}
          </label>
          <select
            id={field.id}
            value={value as string || ""}
            onChange={(e) => onChange(e.target.value)}
            required={field.required}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
          >
            <option value="">{language === "fr" ? "Sélectionner..." : "Select..."}</option>
            {field.options?.map((option) => {
              const optionLabel = language === "fr" && option.labelFr ? option.labelFr : option.label;
              return (
                <option key={option.value} value={option.value}>
                  {optionLabel}
                </option>
              );
            })}
          </select>
        </div>
      );

    case "signature":
      return (
        <SignatureCanvas
          value={value as string || ""}
          onChange={(v) => onChange(v)}
          label={`${label}${field.required ? " *" : ""}`}
        />
      );

    default:
      return null;
  }
}

function FormContentBlockComponent({
  block,
  language,
}: {
  block: FormContentBlock;
  language: "en" | "fr";
}) {
  if (block.type === "paragraph") {
    const text = language === "fr" && block.textFr ? block.textFr : block.text;

    return <p className="whitespace-pre-line text-sm leading-6 text-slate-700">{text}</p>;
  }

  const items = language === "fr" && block.itemsFr ? block.itemsFr : block.items;
  const ListTag = block.type === "ordered-list" ? "ol" : "ul";
  const listClassName = block.type === "ordered-list"
    ? "list-decimal space-y-1 pl-5 text-sm leading-6 text-slate-700"
    : "list-disc space-y-1 pl-5 text-sm leading-6 text-slate-700";

  return (
    <ListTag className={listClassName}>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ListTag>
  );
}

function FormSectionComponent({
  section,
  formData,
  onChange,
  language,
}: {
  section: FormSection;
  formData: FormData;
  onChange: (fieldId: string, value: string | boolean | string[]) => void;
  language: "en" | "fr";
}) {
  const title = language === "fr" && section.titleFr ? section.titleFr : section.title;
  const description = language === "fr" && section.descriptionFr ? section.descriptionFr : section.description;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="mb-2 text-lg font-semibold text-slate-900">{title}</h3>
      {description && <p className="mb-4 text-sm text-slate-600">{description}</p>}
      {section.content && section.content.length > 0 && (
        <div className="mb-5 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
          {section.content.map((block, index) => (
            <FormContentBlockComponent
              key={`${section.id}-content-${index}`}
              block={block}
              language={language}
            />
          ))}
        </div>
      )}
      <div className="space-y-4">
        {section.fields.map((field) => (
          <FormFieldComponent
            key={field.id}
            field={field}
            value={formData[field.id] || (field.type === "checkbox" ? false : "")}
            onChange={(value) => onChange(field.id, value)}
            language={language}
          />
        ))}
      </div>
    </div>
  );
}

function PdfTextInput({
  id,
  value,
  onChange,
  className = "min-w-24 flex-1",
  type = "text",
}: {
  id: string;
  value: string | boolean | string[];
  onChange: (fieldId: string, value: string | boolean | string[]) => void;
  className?: string;
  type?: "text" | "number" | "date" | "phone";
}) {
  return (
    <input
      type={type === "phone" ? "tel" : type}
      value={(value as string) || ""}
      onChange={(event) => onChange(id, event.target.value)}
      className={`${className} border-0 border-b border-dotted border-slate-500 bg-transparent px-1 py-0.5 text-[13px] leading-5 text-slate-900 outline-none focus:border-sky-500 focus:ring-0`}
    />
  );
}

function PdfTextarea({
  id,
  value,
  onChange,
  rows = 2,
}: {
  id: string;
  value: string | boolean | string[];
  onChange: (fieldId: string, value: string | boolean | string[]) => void;
  rows?: number;
}) {
  return (
    <textarea
      value={(value as string) || ""}
      onChange={(event) => onChange(id, event.target.value)}
      rows={rows}
      className="w-full resize-none border-0 bg-[repeating-linear-gradient(to_bottom,transparent_0,transparent_27px,#64748b_28px)] px-1 py-0 text-[13px] leading-7 text-slate-900 outline-none focus:ring-0"
    />
  );
}

function PdfCheckbox({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string | boolean | string[];
  onChange: (fieldId: string, value: string | boolean | string[]) => void;
}) {
  return (
    <label className="inline-flex items-center gap-1 whitespace-nowrap text-[13px] leading-5 text-slate-900">
      <input
        type="checkbox"
        checked={Boolean(value)}
        onChange={(event) => onChange(id, event.target.checked)}
        className="h-3 w-3 rounded-none border-slate-500 text-sky-600 focus:ring-1 focus:ring-sky-400"
      />
      {label}
    </label>
  );
}

function PdfRadioChoice({
  id,
  option,
  label,
  value,
  onChange,
}: {
  id: string;
  option: string;
  label: string;
  value: string | boolean | string[];
  onChange: (fieldId: string, value: string | boolean | string[]) => void;
}) {
  return (
    <label className="inline-flex items-center gap-1 whitespace-nowrap text-[13px] leading-5 text-slate-900">
      <input
        type="radio"
        name={id}
        value={option}
        checked={value === option}
        onChange={(event) => onChange(id, event.target.value)}
        className="h-3 w-3 border-slate-500 text-sky-600 focus:ring-1 focus:ring-sky-400"
      />
      {label}
    </label>
  );
}

function PdfYesNo({
  id,
  value,
  onChange,
  yesLabel = "Yes",
  noLabel = "No",
}: {
  id: string;
  value: string | boolean | string[];
  onChange: (fieldId: string, value: string | boolean | string[]) => void;
  yesLabel?: string;
  noLabel?: string;
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
      <PdfRadioChoice id={id} option="yes" label={yesLabel} value={value} onChange={onChange} />
      <PdfRadioChoice id={id} option="no" label={noLabel} value={value} onChange={onChange} />
    </span>
  );
}

function PdfQuestion({
  number,
  children,
}: {
  number: number;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="text-[13px] leading-5 text-slate-900">{number}- {children}</div>
    </div>
  );
}

function getFieldLabel(field: FormField, language: "en" | "fr") {
  return language === "fr" && field.labelFr ? field.labelFr : field.label;
}

function PdfDocumentField({
  field,
  value,
  onChange,
  language,
}: {
  field: FormField;
  value: string | boolean | string[];
  onChange: (fieldId: string, value: string | boolean | string[]) => void;
  language: "en" | "fr";
}) {
  const label = getFieldLabel(field, language);

  if (field.type === "checkbox") {
    return (
      <div className="py-1">
        <PdfCheckbox id={field.id} label={`${label}${field.required ? " *" : ""}`} value={value} onChange={onChange} />
      </div>
    );
  }

  if (field.type === "radio") {
    return (
      <div className="space-y-1 py-1">
        <p className="text-[13px] leading-5 text-slate-900">{label}{field.required ? " *" : ""}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {field.options?.map((option) => (
            <PdfRadioChoice
              key={option.value}
              id={field.id}
              option={option.value}
              label={language === "fr" && option.labelFr ? option.labelFr : option.label}
              value={value}
              onChange={onChange}
            />
          ))}
        </div>
      </div>
    );
  }

  if (field.type === "signature") {
    return (
      <div className="py-2">
        <SignatureCanvas
          value={(value as string) || ""}
          onChange={(signature) => onChange(field.id, signature)}
          label={`${label}${field.required ? " *" : ""}`}
        />
      </div>
    );
  }

  if (field.type === "textarea") {
    return (
      <div className="space-y-1 py-1">
        <p className="text-[13px] leading-5 text-slate-900">{label}{field.required ? " *" : ""}</p>
        <PdfTextarea id={field.id} value={value} onChange={onChange} rows={3} />
      </div>
    );
  }

  const inputType = field.type === "date" || field.type === "number" || field.type === "phone"
    ? field.type
    : "text";

  return (
    <div className="flex flex-wrap items-end gap-2 py-1">
      <span className="text-[13px] leading-5 text-slate-900">{label}{field.required ? " *" : ""}:</span>
      <PdfTextInput id={field.id} type={inputType} value={value} onChange={onChange} />
    </div>
  );
}

function PdfDocumentLine({
  line,
  formData,
  onChange,
  fieldIds,
}: {
  line: string;
  formData: FormData;
  onChange: (fieldId: string, value: string | boolean | string[]) => void;
  fieldIds: Set<string>;
}) {
  const trimmed = line.trim();
  if (!trimmed) return <div className="h-3" />;

  const lower = trimmed.toLowerCase();
  const normalized = lower.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  if (/^(nom|surname|name)\s*:/.test(normalized)) {
    const fieldId = normalized.startsWith("name") && fieldIds.has("first_name")
      ? "first_name"
      : fieldIds.has("last_name")
        ? "last_name"
        : "full_name";
    return (
      <div className="flex flex-wrap items-end gap-2">
        <span>{trimmed.split(":")[0]}:</span>
        <PdfTextInput id={fieldId} value={formData[fieldId]} onChange={onChange} />
      </div>
    );
  }

  if (/^(prenom|first name)\s*:/.test(normalized)) {
    const fieldId = fieldIds.has("first_name") ? "first_name" : "full_name";
    return (
      <div className="flex flex-wrap items-end gap-2">
        <span>{trimmed.split(":")[0]}:</span>
        <PdfTextInput id={fieldId} value={formData[fieldId]} onChange={onChange} />
      </div>
    );
  }

  if (/^(date de naissance|date of birth)\s*:/.test(normalized)) {
    return (
      <div className="flex flex-wrap items-end gap-2">
        <span>{trimmed.split(":")[0]}:</span>
        <PdfTextInput id="date_of_birth" type="date" value={formData.date_of_birth} onChange={onChange} className="w-44" />
      </div>
    );
  }

  if (/^(date|geneva, the|a \(lieu\)|à \(lieu\))\s*:/.test(lower) || /^date\s*:/.test(normalized)) {
    return (
      <div className="flex flex-wrap items-end gap-2">
        <span>{trimmed.split(":")[0]}:</span>
        <PdfTextInput id="signature_date" type="date" value={formData.signature_date} onChange={onChange} className="w-44" />
      </div>
    );
  }

  if (normalized.includes("signature")) {
    return <p className="pt-2 font-semibold">{trimmed.replace(/[_…]+/g, "").trim()}</p>;
  }

  const isHeading =
    trimmed.length < 90 &&
    (trimmed === trimmed.toUpperCase() || /^[A-Z][A-Za-zÀ-ÿ' -]+:$/.test(trimmed));

  if (isHeading) {
    return <p className="pt-2 font-semibold">{trimmed}</p>;
  }

  if (/^[-•]/.test(trimmed)) {
    return <p className="pl-4">{trimmed}</p>;
  }

  return <p>{trimmed}</p>;
}

function PdfDocumentContent({
  blocks,
  formData,
  onChange,
  fieldIds,
}: {
  blocks: FormContentBlock[];
  formData: FormData;
  onChange: (fieldId: string, value: string | boolean | string[]) => void;
  fieldIds: Set<string>;
}) {
  return (
    <div className="space-y-1 whitespace-pre-wrap">
      {blocks.flatMap((block, blockIndex) => {
        if (block.type === "paragraph") {
          return block.text.trim().split("\n").map((line, lineIndex) => (
            <PdfDocumentLine
              key={`${blockIndex}-${lineIndex}`}
              line={line}
              formData={formData}
              onChange={onChange}
              fieldIds={fieldIds}
            />
          ));
        }

        return block.items.map((item, itemIndex) => (
          <p key={`${blockIndex}-${itemIndex}`} className="pl-4">
            {block.type === "ordered-list" ? `${itemIndex + 1}. ` : "• "}{item}
          </p>
        ));
      })}
    </div>
  );
}

function GenericPdfDocumentForm({
  form,
  formData,
  onChange,
}: {
  form: FormDefinition;
  formData: FormData;
  onChange: (fieldId: string, value: string | boolean | string[]) => void;
}) {
  const sourceBlocks = form.sections.flatMap((section) => section.content || []);
  const fieldIds = getFormFieldIds(form);
  const fields = form.sections
    .flatMap((section) => section.fields)
    .filter((field) => {
      if (sourceBlocks.length === 0) return true;
      return !["full_name", "first_name", "last_name", "date_of_birth", "signature_date"].includes(field.id);
    });
  const title = form.language === "fr" && form.nameFr ? form.nameFr : form.name;

  return (
    <div className="mx-auto w-full max-w-[794px] bg-white px-6 py-7 text-slate-950 shadow-sm ring-1 ring-slate-200 sm:px-10">
      <div className="space-y-6 font-serif text-[13px] leading-5">
        <h2 className="font-sans text-xl font-semibold text-slate-950">{title}</h2>
        {sourceBlocks.length > 0 && (
          <PdfDocumentContent blocks={sourceBlocks} formData={formData} onChange={onChange} fieldIds={fieldIds} />
        )}
        {fields.length > 0 && (
          <div className="space-y-2 border-t border-slate-200 pt-4">
            {fields.map((field) => (
              <PdfDocumentField
                key={field.id}
                field={field}
                value={formData[field.id] || (field.type === "checkbox" ? false : "")}
                onChange={onChange}
                language={form.language}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AnesthesiaQuestionnairePdfForm({
  language,
  formData,
  onChange,
}: {
  language: "en" | "fr";
  formData: FormData;
  onChange: (fieldId: string, value: string | boolean | string[]) => void;
}) {
  const isFr = language === "fr";
  const t = {
    title: isFr ? "Questionnaire d'Anesthésie" : "Anesthesia questionnaire",
    surname: isFr ? "Nom" : "Surname",
    name: isFr ? "Prénom" : "Name",
    dob: isFr ? "Né(e) le" : "Date of birth",
    height: isFr ? "Taille" : "Height",
    weight: isFr ? "Poids" : "Weight",
    physician: isFr ? "Médecin traitant" : "Attending physician",
    operation: isFr ? "Date de votre opération" : "Planned operation",
    operationDate: isFr ? "Chirurgien" : "Date of operation",
    insurance: isFr ? "N°CADA assurance" : "N°CADA insurance",
    phone: isFr ? "Tél privé" : "Telephone number",
    yes: isFr ? "Oui" : "Yes",
    no: isFr ? "Non" : "No",
    which: isFr ? "Lequel ?" : "Which one ?",
    whichPlural: isFr ? "Lesquels ?" : "Which one ?",
    q1: isFr ? "Avez-vous eu un traitement médical ces derniers mois ?" : "Have you had any medical treatment in recent months ?",
    q2: isFr ? "Prenez-vous des médicaments tous les jours (y compris somnifères, laxatifs, aspirine et médicaments homéopathiques) ?" : "Do you take medication every day ?",
    q3: isFr ? "Avez-vous eu de la fièvre ces derniers jours ?" : "Have you had a fever in the past few days ?",
    q4: isFr ? "Avez-vous des allergies (médicaments, pansements, aliments, désinfectants) ?" : "Do you have allergies (drugs, dressings, food, disinfectants) ?",
    reaction: isFr ? "Spécifier si : éruption cutanée, oedème de Quincke, difficultés respiratoires, choc anaphylactique" : "Specify the type of reaction: rashes, angioedema, anaphylactic shock",
    q5: isFr ? "Opérations précédentes et type d'anesthésie : a=complète, b=péridurale ou rachidienne, c=locale" : "Previous surgical operations and type of anesthesia : a=general, b=spinal block or epidural anesthesia, c=local anesthesia",
    op: isFr ? "Opération" : "Surgical operation",
    year: isFr ? "Année" : "Year",
    anesthesia: isFr ? "Anesthésie" : "Anesthesia",
    moreOps: isFr ? "Si plus d'opérations veuillez préciser l'opération, l'année et le type d'anesthésie (a,b ou c)." : "If more surgical operations, please specify the operation, the year and type of anesthesia (a,b, ou c).",
    q6: isFr ? "Avez-vous eu des problèmes particuliers en rapport avec l'anesthésie (nausées, vomissements, difficultés de réveil, etc.) ?" : "Have you had any particular problems with the anesthesia (nausea, vomiting, difficulties waking up, etc.) ?",
    q7: isFr ? "Un de vos proches parents a-t-il eu des problèmes lors d'une anesthésie ?" : "Did you have or do you have:",
    q8: isFr ? "Avez-vous eu ou avez-vous des problèmes :" : "Do you have a disease that is not mentioned in the previous list?",
    q9: isFr ? "Avez-vous une maladie qui n'est pas mentionnée dans la liste précédente?" : "Are you prone to prolonged bleeding?",
    q10: isFr ? "Êtes-vous sujet aux saignements prolongés ?" : "Do you have?",
    q11: isFr ? "Avez-vous?" : "Do you smoke or have you smoked?",
    q12: isFr ? "Fumez-vous ou avez-vous fumé?" : "Do you use drugs?",
    q13: isFr ? "Consommez-vous des drogues?" : "Do you drink alcohol?",
    q14: isFr ? "Buvez-vous de l'alcool?" : "Are you rather?",
    q15: isFr ? "Êtes-vous plutôt ?" : "Another feature not mentioned previously?",
    q16: isFr ? "Autre particularité non mentionnée précédemment?" : "In case of emergency, please provide the contact details of one of your relatives and your relationship to this person:",
    q17: isFr ? "En cas d'urgence, veuillez indiquer les coordonnées d'un de vos proches et votre lien avec cette personne :" : "",
    women: isFr ? "Pour les femmes :" : "For women :",
    pill: isFr ? "Prenez-vous la pilule ?" : "Are you taking contraceptive pill ?",
    pregnant: isFr ? "Êtes-vous enceinte ou susceptible de l'être ?" : "Are you pregnant or likely to be ?",
    breastfeeding: isFr ? "Allaitez-vous ?" : "Are you breastfeeding ?",
  };

  const medicalGroups = isFr
    ? [
        ["Cardiaques :", [["palpitations", "Palpitations"], ["arrhythmia", "Troubles du rythme"], ["angina", "Angine de poitrine"], ["infarct", "Infarctus"], ["heart_failure", "Insuffisance cardiaque"], ["heart_murmur", "Souffle au coeur"]]],
        ["Vasculaires :", [["hypertension", "Hypertension artérielle"], ["arteritis", "Artérite"], ["phlebitis", "Phlébite"], ["pulmonary_embolism", "Embolie pulmonaire"], ["coagulation", "Problèmes de coagulation"], ["varicose_veins", "Varices"]]],
        ["Respiratoires :", [["asthma_detail", "Asthme"], ["sleep_apnea", "APNEE DU SOMMEIL"], ["chronic_bronchitis", "Bronchite chronique"], ["snoring", "Ronflement"], ["emphysema", "Emphysème"]]],
        ["Nerveux :", [["stroke", "Accident vasculaire cérébral"], ["epilepsy", "Épilepsie"], ["depression", "Dépression"], ["anxiety_attack", "Crise d'angoisse"]]],
        ["Urinaires :", [["renal_failure", "Insuffisance rénale"], ["kidney_stones", "Infections, calculs"]]],
        ["Métaboliques :", [["diabetes_with_insulin", "Diabète avec insuline ?"], ["cholesterol", "Cholestérol - Triglycérides"], ["thyroid_disease", "Maladies de la thyroïde"]]],
        ["Infectieux :", [["hepatitis_b", "Hépatite B"], ["hepatitis_c", "Hépatite C"], ["hiv", "HIV - SIDA"]]],
        ["Digestifs :", [["ulcer", "Ulcère"], ["cirrhosis", "Cirrhose"], ["hiatal_hernia", "Hernie hiatale"], ["acid_reflux", "Reflux gastriques"], ["jaundice", "Jaunisse"]]],
        ["Oculaires :", [["glaucoma", "Glaucome"], ["single_eye", "Oeil unique"]]],
      ]
    : [
        ["Heart:", [["palpitations", "Palpitations"], ["arrhythmia", "Arrhythmia"], ["angina", "Angina pectoris"], ["infarct", "Infarct"], ["heart_failure", "Heart failure"], ["heart_murmur", "Heart murmur"]]],
        ["Circulation:", [["hypertension", "High blood pressure"], ["arteritis", "Arteritis"], ["phlebitis", "Phlebitis"], ["pulmonary_embolism", "Pulmonary embolism"], ["coagulation", "Coagulation problems"], ["varicose_veins", "Varicose veins"]]],
        ["Lungs:", [["asthma_detail", "Asthma"], ["sleep_apnea", "SLEEP APNEA"], ["chronic_bronchitis", "Chronic bronchitis"], ["snoring", "Snoring"], ["emphysema", "Emphysema"]]],
        ["Nervous system:", [["stroke", "Stroke"], ["epilepsy", "Epilepsy"], ["depression", "Depression"], ["anxiety_attack", "Anxiety attack"]]],
        ["Urinary system:", [["renal_failure", "Renal failure"], ["kidney_stones", "Infections, kidney stones"]]],
        ["Metabolic:", [["diabetes_with_insulin", "Diabete with insulin ?"], ["cholesterol", "Cholesterol - Triglycerides"], ["thyroid_disease", "Thyroid disease"]]],
        ["Infectious diseases:", [["hepatitis_b", "Hepatitis B"], ["hepatitis_c", "Hepatitis C"], ["hiv", "HIV - SIDA"]]],
        ["Digestive system, liver:", [["ulcer", "Stomach or duodenum ulcer"], ["cirrhosis", "Cirrhosis"], ["hiatal_hernia", "Gastro oesophageal hernia"], ["acid_reflux", "Acid reflux"], ["jaundice", "Jaundice"]]],
        ["Ophtalmology:", [["glaucoma", "Glaucoma"], ["single_eye", "Single eye"]]],
      ];

  return (
    <div className="mx-auto w-full max-w-[794px] bg-white px-6 py-7 text-slate-950 shadow-sm ring-1 ring-slate-200 sm:px-10">
      <div className="space-y-5 font-serif text-[13px] leading-5">
        <h2 className="font-sans text-xl font-semibold text-slate-950">{t.title}</h2>

        <div className="space-y-2">
          <div className="flex flex-wrap items-end gap-x-2 gap-y-1">
            <span>{t.surname}:</span><PdfTextInput id="last_name" value={formData.last_name} onChange={onChange} />
            <span>{t.name}:</span><PdfTextInput id="first_name" value={formData.first_name} onChange={onChange} />
            <span>{t.dob}:</span><PdfTextInput id="date_of_birth" type="date" value={formData.date_of_birth} onChange={onChange} className="w-36" />
          </div>
          <div className="flex flex-wrap items-end gap-x-2 gap-y-1">
            <span>{t.height}:</span><PdfTextInput id="height" type="number" value={formData.height} onChange={onChange} className="w-20" />
            <span>{t.weight}:</span><PdfTextInput id="weight" type="number" value={formData.weight} onChange={onChange} className="w-20" />
            <span>{t.physician}:</span><PdfTextInput id="attending_physician" value={formData.attending_physician} onChange={onChange} />
          </div>
          <div className="flex flex-wrap items-end gap-x-2 gap-y-1">
            <span>{t.operation}:</span><PdfTextInput id={isFr ? "operation_date" : "planned_operation"} type={isFr ? "date" : "text"} value={formData[isFr ? "operation_date" : "planned_operation"]} onChange={onChange} />
            <span>{t.operationDate}:</span><PdfTextInput id={isFr ? "surgeon" : "operation_date"} type={isFr ? "text" : "date"} value={formData[isFr ? "surgeon" : "operation_date"]} onChange={onChange} className="w-40" />
          </div>
          <div className="flex flex-wrap items-end gap-x-2 gap-y-1">
            <span>{t.insurance}:</span><PdfTextInput id="insurance_number" value={formData.insurance_number} onChange={onChange} className="w-52" />
            <span>{t.phone}:</span><PdfTextInput id="private_phone" type="phone" value={formData.private_phone} onChange={onChange} className="w-44" />
          </div>
        </div>

        <PdfQuestion number={1}>{t.q1}</PdfQuestion>
        <div><PdfRadioChoice id="recent_medical_treatment" option="yes" label={`${t.yes}, ${t.which}`} value={formData.recent_medical_treatment} onChange={onChange} /> <PdfRadioChoice id="recent_medical_treatment" option="no" label={t.no} value={formData.recent_medical_treatment} onChange={onChange} /></div>
        <PdfTextarea id="recent_medical_treatment_details" value={formData.recent_medical_treatment_details} onChange={onChange} rows={2} />

        <PdfQuestion number={2}>{t.q2}</PdfQuestion>
        <div><PdfRadioChoice id="daily_medication" option="yes" label={`${t.yes}, ${t.which}`} value={formData.daily_medication} onChange={onChange} /> <PdfRadioChoice id="daily_medication" option="no" label={t.no} value={formData.daily_medication} onChange={onChange} /></div>
        <PdfTextarea id="daily_medication_details" value={formData.daily_medication_details} onChange={onChange} rows={3} />

        <PdfQuestion number={3}>{t.q3}</PdfQuestion>
        <PdfYesNo id="recent_fever" value={formData.recent_fever} onChange={onChange} yesLabel={t.yes} noLabel={t.no} />

        <PdfQuestion number={4}>{t.q4}</PdfQuestion>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          <PdfRadioChoice id="allergies" option="yes" label={`${t.yes} (${t.reaction})`} value={formData.allergies} onChange={onChange} />
          <PdfRadioChoice id="allergies" option="no" label={t.no} value={formData.allergies} onChange={onChange} />
        </div>
        <div className="flex items-end gap-2"><span>{isFr ? "Lesquelles ?" : "Which one ??"}</span><PdfTextInput id="allergy_details" value={formData.allergy_details} onChange={onChange} /></div>

        <PdfQuestion number={5}>{t.q5}</PdfQuestion>
        <div className="grid grid-cols-[1fr_90px_130px] gap-2 text-[12px] font-semibold">
          <span>{t.op}</span><span>{t.year}</span><span>{t.anesthesia}</span>
        </div>
        {[1, 2].map((row) => (
          <div key={row} className="grid grid-cols-[1fr_90px_130px] gap-2">
            <PdfTextInput id={`previous_operation_${row}`} value={formData[`previous_operation_${row}`]} onChange={onChange} className="w-full" />
            <PdfTextInput id={`previous_operation_${row}_year`} type="number" value={formData[`previous_operation_${row}_year`]} onChange={onChange} className="w-full" />
            <PdfTextInput id={`previous_operation_${row}_anesthesia`} value={formData[`previous_operation_${row}_anesthesia`]} onChange={onChange} className="w-full" />
          </div>
        ))}
        <p>{t.moreOps}</p>
        <PdfTextarea id="additional_previous_operations" value={formData.additional_previous_operations} onChange={onChange} rows={2} />

        <PdfQuestion number={6}>{t.q6}</PdfQuestion>
        <div><PdfRadioChoice id="anesthesia_problems" option="yes" label={`${t.yes}, ${t.whichPlural}`} value={formData.anesthesia_problems} onChange={onChange} /> <PdfRadioChoice id="anesthesia_problems" option="no" label={t.no} value={formData.anesthesia_problems} onChange={onChange} /></div>
        <PdfTextarea id="anesthesia_problems_details" value={formData.anesthesia_problems_details} onChange={onChange} rows={2} />

        {isFr && (
          <>
            <PdfQuestion number={7}>{t.q7}</PdfQuestion>
            <div><PdfRadioChoice id="family_anesthesia_problems" option="yes" label={`${t.yes}, ${t.whichPlural}`} value={formData.family_anesthesia_problems} onChange={onChange} /> <PdfRadioChoice id="family_anesthesia_problems" option="no" label={t.no} value={formData.family_anesthesia_problems} onChange={onChange} /></div>
            <PdfTextarea id="family_anesthesia_problems_details" value={formData.family_anesthesia_problems_details} onChange={onChange} rows={1} />
          </>
        )}

        <PdfQuestion number={isFr ? 8 : 7}>{isFr ? t.q8 : t.q7}</PdfQuestion>
        <div className="space-y-1">
          {medicalGroups.map(([group, options]) => (
            <div key={group as string} className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-semibold">{group as string}</span>
              {(options as string[][]).map(([id, label]) => (
                <PdfCheckbox key={id} id={id} label={label} value={formData[id]} onChange={onChange} />
              ))}
            </div>
          ))}
        </div>

        <PdfQuestion number={isFr ? 9 : 8}>{isFr ? t.q9 : t.q8}</PdfQuestion>
        <div><PdfRadioChoice id="other_disease" option="yes" label={`${t.yes}, ${t.which}`} value={formData.other_disease} onChange={onChange} /> <PdfRadioChoice id="other_disease" option="no" label={t.no} value={formData.other_disease} onChange={onChange} /></div>
        <PdfTextarea id="other_disease_details" value={formData.other_disease_details} onChange={onChange} rows={1} />

        <PdfQuestion number={isFr ? 10 : 9}>{isFr ? t.q10 : t.q9} <PdfYesNo id="prolonged_bleeding" value={formData.prolonged_bleeding} onChange={onChange} yesLabel={t.yes} noLabel={t.no} /></PdfQuestion>

        <PdfQuestion number={isFr ? 11 : 10}>{isFr ? t.q11 : t.q10}</PdfQuestion>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {[
            ["bridge", "Bridge"],
            ["loose_teeth", isFr ? "Dents branlantes" : "Loose teeth"],
            ["pivot_tooth", isFr ? "Dent à pivot, facettes" : "Pivot tooth, veneers"],
            ["dental_prosthesis", isFr ? "Prothèse dentaire" : "Dental prothesis"],
            ["hearing_aid", isFr ? "Prothèse auditive" : "Hearing aid"],
            ["pacemaker", "Pace maker"],
            ["contact_lenses", isFr ? "lentilles de contact" : "Contact lenses"],
          ].map(([id, label]) => (
            <PdfCheckbox key={id} id={id} label={label} value={formData[id]} onChange={onChange} />
          ))}
        </div>

        <PdfQuestion number={isFr ? 12 : 11}>{isFr ? t.q12 : t.q11}</PdfQuestion>
        <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
          <PdfRadioChoice id="smoker" option="yes" label={`${t.yes}, ${isFr ? "Combien de cigarettes par jour?" : "how many cigarettes per day?"}`} value={formData.smoker} onChange={onChange} />
          <PdfTextInput id="cigarettes_per_day" type="number" value={formData.cigarettes_per_day} onChange={onChange} className="w-28" />
          <PdfRadioChoice id="smoker" option="no" label={t.no} value={formData.smoker} onChange={onChange} />
        </div>
        <div className="flex items-end gap-2"><span>{isFr ? "Depuis combien de temps/pendant combien de temps?" : "For how long time?"}</span><PdfTextInput id="smoking_duration" value={formData.smoking_duration} onChange={onChange} /></div>

        <PdfQuestion number={isFr ? 13 : 12}>{isFr ? t.q13 : t.q12}</PdfQuestion>
        <div><PdfRadioChoice id="drug_use" option="yes" label={`${t.yes}, ${t.which}`} value={formData.drug_use} onChange={onChange} /> <PdfRadioChoice id="drug_use" option="no" label={t.no} value={formData.drug_use} onChange={onChange} /></div>
        <PdfTextarea id="drug_use_details" value={formData.drug_use_details} onChange={onChange} rows={1} />

        <PdfQuestion number={isFr ? 14 : 13}>{isFr ? t.q14 : t.q13} <PdfRadioChoice id="alcohol" option="never" label={isFr ? "Jamais" : "Never"} value={formData.alcohol} onChange={onChange} /> <PdfRadioChoice id="alcohol" option="occasionally" label={isFr ? "A l'occasion" : "Occasionally"} value={formData.alcohol} onChange={onChange} /> <PdfRadioChoice id="alcohol" option="regularly" label={isFr ? "Régulièrement" : "Regularly"} value={formData.alcohol} onChange={onChange} /></PdfQuestion>

        <PdfQuestion number={isFr ? 15 : 14}>{isFr ? t.q15 : t.q14} <PdfRadioChoice id="activity_level" option="athletic" label={isFr ? "Sportif" : "Athletic"} value={formData.activity_level} onChange={onChange} /> <PdfRadioChoice id="activity_level" option="active" label={isFr ? "Actif" : "Active"} value={formData.activity_level} onChange={onChange} /> <PdfRadioChoice id="activity_level" option="sedentary" label={isFr ? "Sédentaire" : "Sedentary"} value={formData.activity_level} onChange={onChange} /></PdfQuestion>

        <PdfQuestion number={isFr ? 16 : 15}>{isFr ? t.q16 : t.q15}</PdfQuestion>
        <PdfTextarea id="other_particularity" value={formData.other_particularity} onChange={onChange} rows={1} />

        <PdfQuestion number={isFr ? 17 : 16}>{isFr ? t.q17 : t.q16}</PdfQuestion>
        <PdfTextarea id="emergency_contact_name" value={formData.emergency_contact_name} onChange={onChange} rows={2} />

        <div className="space-y-1 pt-2">
          <p>{t.women} {t.pill} <PdfYesNo id="contraceptive_pill" value={formData.contraceptive_pill} onChange={onChange} yesLabel={t.yes} noLabel={t.no} /></p>
          <p>{t.pregnant} <PdfYesNo id="pregnant_or_likely" value={formData.pregnant_or_likely} onChange={onChange} yesLabel={t.yes} noLabel={t.no} /></p>
          <p>{t.breastfeeding} <PdfYesNo id="breastfeeding" value={formData.breastfeeding} onChange={onChange} yesLabel={t.yes} noLabel={t.no} /></p>
        </div>

        <div className="space-y-3 border-t border-slate-200 pt-4">
          <PdfCheckbox id="information_accurate" label={isFr ? "Je confirme que toutes les informations fournies sont exactes" : "I confirm that all information provided is accurate"} value={formData.information_accurate} onChange={onChange} />
          <SignatureCanvas value={(formData.signature as string) || ""} onChange={(value) => onChange("signature", value)} label={isFr ? "Signature *" : "Signature *"} />
          <div className="flex max-w-xs items-end gap-2"><span>{isFr ? "Date" : "Date"}:</span><PdfTextInput id="signature_date" type="date" value={formData.signature_date} onChange={onChange} className="w-40" /></div>
        </div>
      </div>
    </div>
  );
}

export default function PublicFormPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const formId = params.formId as string;
  const token = searchParams.get("token");

  const [form, setForm] = useState<FormDefinition | null>(null);
  const [formData, setFormData] = useState<FormData>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [patientInfo, setPatientInfo] = useState<PatientInfo | null>(null);

  useEffect(() => {
    async function loadForm() {
      try {
        setLoading(true);
        setError(null);

        // Get form definition
        const formDef = getFormById(formId);
        if (!formDef) {
          setError("Form not found");
          setLoading(false);
          return;
        }
        setForm(formDef);

        // If token is provided, load existing submission data
        if (token) {
          const response = await fetch(`/api/forms/submit?token=${token}`);
          const data = await response.json();

          if (!response.ok) {
            if (data.expired) {
              setError(formDef.language === "fr" 
                ? "Ce lien de formulaire a expiré. Veuillez contacter la clinique pour un nouveau lien."
                : "This form link has expired. Please contact the clinic for a new link.");
            } else {
              setError(data.error || "Failed to load form");
            }
            setLoading(false);
            return;
          }

          if (data.submission.status === "submitted") {
            setSubmitted(true);
          }

          if (data.submission.patient) {
            setPatientInfo(data.submission.patient);
          }

          const patientPrefill = data.submission.patient
            ? buildPatientPrefill(data.submission.patient, formDef)
            : {};
          const submissionData = data.submission.submissionData || {};

          setFormData((prev) => ({
            ...prev,
            ...patientPrefill,
            ...submissionData,
          }));
        }

        // Set signature_date to today's date by default
        const today = new Date().toISOString().split("T")[0];
        setFormData((prev) => ({
          ...prev,
          signature_date: prev.signature_date || today,
        }));

        setLoading(false);
      } catch (err) {
        console.error("Error loading form:", err);
        setError("Failed to load form");
        setLoading(false);
      }
    }

    loadForm();
  }, [formId, token]);

  const handleFieldChange = (fieldId: string, value: string | boolean | string[]) => {
    setFormData((prev) => ({
      ...prev,
      [fieldId]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!token) {
      setError("Invalid form link - no token provided");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const response = await fetch("/api/forms/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          submissionData: formData,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to submit form");
        setSubmitting(false);
        return;
      }

      setSubmitted(true);
      setSubmitting(false);
    } catch (err) {
      console.error("Error submitting form:", err);
      setError("Failed to submit form");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-sky-500"></div>
          <p className="mt-4 text-sm text-slate-600">Loading form...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md rounded-xl border border-red-200 bg-white p-6 text-center shadow-lg">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="mb-2 text-lg font-semibold text-slate-900">Error</h2>
          <p className="text-sm text-slate-600">{error}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md rounded-xl border border-emerald-200 bg-white p-6 text-center shadow-lg">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
            <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="mb-2 text-lg font-semibold text-slate-900">
            {form?.language === "fr" ? "Formulaire soumis" : "Form Submitted"}
          </h2>
          <p className="text-sm text-slate-600">
            {form?.language === "fr"
              ? "Merci d'avoir rempli ce formulaire. Vos réponses ont été enregistrées."
              : "Thank you for completing this form. Your responses have been recorded."}
          </p>
        </div>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="text-center">
          <p className="text-sm text-slate-600">Form not found</p>
        </div>
      </div>
    );
  }

  const formTitle = form.language === "fr" && form.nameFr ? form.nameFr : form.name;
  const formDescription = form.language === "fr" && form.descriptionFr ? form.descriptionFr : form.description;
  const alternateLanguageFormId = getAlternateLanguageFormId(form.id);
  const alternateLanguageForm = alternateLanguageFormId ? getFormById(alternateLanguageFormId) : undefined;
  const alternateLanguageUrl = alternateLanguageForm
    ? `/form/${alternateLanguageForm.id}${token ? `?token=${encodeURIComponent(token)}` : ""}`
    : null;
  const isAnesthesiaQuestionnaire = form.id === "questionnaire-anesthesie-fr" || form.id === "questionnaire-anesthesie-en";
  const isBreastSurgeryForm = BREAST_SURGERY_FORM_IDS.has(form.id);

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="mx-auto max-w-2xl px-4">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mb-4 flex justify-center">
            <Image
              src="/logos/aesthetics-logo.svg"
              alt="Aesthetics Clinic"
              width={140}
              height={40}
              className="h-10 w-auto"
            />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{formTitle}</h1>
          <p className="mt-2 text-sm text-slate-600">{formDescription}</p>
          {alternateLanguageUrl && alternateLanguageForm && (
            <a
              href={alternateLanguageUrl}
              className="mt-4 inline-flex items-center rounded-full border border-sky-200 bg-white px-4 py-2 text-xs font-semibold text-sky-700 shadow-sm hover:bg-sky-50"
            >
              {form.language === "fr" ? "Switch to English" : "Passer en français"}
            </a>
          )}
          {patientInfo && (
            <p className="mt-2 text-sm font-medium text-sky-600">
              {form.language === "fr" ? "Patient:" : "Patient:"} {patientInfo.first_name} {patientInfo.last_name}
            </p>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {isAnesthesiaQuestionnaire ? (
            <AnesthesiaQuestionnairePdfForm
              language={form.language}
              formData={formData}
              onChange={handleFieldChange}
            />
          ) : isBreastSurgeryForm ? (
            <GenericPdfDocumentForm
              form={form}
              formData={formData}
              onChange={handleFieldChange}
            />
          ) : (
            form.sections.map((section) => (
              <FormSectionComponent
                key={section.id}
                section={section}
                formData={formData}
                onChange={handleFieldChange}
                language={form.language}
              />
            ))
          )}

          {/* Submit Button */}
          <div className="flex justify-center pt-4">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-sky-500 px-8 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting
                ? form.language === "fr"
                  ? "Envoi en cours..."
                  : "Submitting..."
                : form.language === "fr"
                ? "Soumettre le formulaire"
                : "Submit Form"}
            </button>
          </div>
        </form>

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-slate-500">
          <p>
            {form.language === "fr"
              ? "Les informations que vous fournissez sont confidentielles et sécurisées."
              : "The information you provide is confidential and secure."}
          </p>
        </div>
      </div>
    </div>
  );
}
