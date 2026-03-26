"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";
import Image from "next/image";
import { Language, getTranslation } from "@/lib/intakeTranslations";
import { pushToDataLayer } from "@/components/GoogleTagManager";

type ViewState = "search" | "register";

export default function IntakePage() {
  const router = useRouter();
  const [view, setView] = useState<ViewState>("register");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState<Language>("en");

  // Get translations based on selected language
  const t = getTranslation(language);

  // Registration form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [countryCode, setCountryCode] = useState("+41"); // Switzerland default
  const [phone, setPhone] = useState("");
  const [regEmail, setRegEmail] = useState("");

  // Countries with whatsappEligible: true will receive WhatsApp notifications
  const countryCodes = [
    // WhatsApp-eligible countries (original list)
    { code: "+41", country: "Switzerland", flag: "🇨🇭", whatsappEligible: true },
    { code: "+33", country: "France", flag: "🇫🇷", whatsappEligible: true },
    { code: "+49", country: "Germany", flag: "🇩🇪", whatsappEligible: true },
    { code: "+39", country: "Italy", flag: "🇮🇹", whatsappEligible: true },
    { code: "+44", country: "UK", flag: "🇬🇧", whatsappEligible: true },
    { code: "+1", country: "USA/Canada", flag: "🇺🇸", whatsappEligible: true },
    { code: "+7", country: "Russia", flag: "🇷🇺", whatsappEligible: true },
    { code: "+34", country: "Spain", flag: "🇪🇸", whatsappEligible: true },
    { code: "+971", country: "UAE", flag: "🇦🇪", whatsappEligible: true },
    { code: "+966", country: "Saudi Arabia", flag: "🇸🇦", whatsappEligible: true },
    { code: "+43", country: "Austria", flag: "🇦🇹", whatsappEligible: true },
    // Other countries (no WhatsApp notifications)
    { code: "+93", country: "Afghanistan", flag: "🇦🇫", whatsappEligible: false },
    { code: "+355", country: "Albania", flag: "🇦🇱", whatsappEligible: false },
    { code: "+213", country: "Algeria", flag: "🇩🇿", whatsappEligible: false },
    { code: "+376", country: "Andorra", flag: "🇦🇩", whatsappEligible: false },
    { code: "+244", country: "Angola", flag: "🇦🇴", whatsappEligible: false },
    { code: "+54", country: "Argentina", flag: "🇦🇷", whatsappEligible: false },
    { code: "+374", country: "Armenia", flag: "🇦🇲", whatsappEligible: false },
    { code: "+61", country: "Australia", flag: "🇦🇺", whatsappEligible: false },
    { code: "+994", country: "Azerbaijan", flag: "🇦🇿", whatsappEligible: false },
    { code: "+973", country: "Bahrain", flag: "🇧🇭", whatsappEligible: false },
    { code: "+880", country: "Bangladesh", flag: "🇧🇩", whatsappEligible: false },
    { code: "+375", country: "Belarus", flag: "🇧🇾", whatsappEligible: false },
    { code: "+32", country: "Belgium", flag: "🇧🇪", whatsappEligible: false },
    { code: "+501", country: "Belize", flag: "🇧🇿", whatsappEligible: false },
    { code: "+229", country: "Benin", flag: "🇧🇯", whatsappEligible: false },
    { code: "+975", country: "Bhutan", flag: "🇧🇹", whatsappEligible: false },
    { code: "+591", country: "Bolivia", flag: "🇧🇴", whatsappEligible: false },
    { code: "+387", country: "Bosnia", flag: "🇧🇦", whatsappEligible: false },
    { code: "+267", country: "Botswana", flag: "🇧🇼", whatsappEligible: false },
    { code: "+55", country: "Brazil", flag: "🇧🇷", whatsappEligible: false },
    { code: "+673", country: "Brunei", flag: "🇧🇳", whatsappEligible: false },
    { code: "+359", country: "Bulgaria", flag: "🇧🇬", whatsappEligible: false },
    { code: "+226", country: "Burkina Faso", flag: "🇧🇫", whatsappEligible: false },
    { code: "+257", country: "Burundi", flag: "🇧🇮", whatsappEligible: false },
    { code: "+855", country: "Cambodia", flag: "🇰🇭", whatsappEligible: false },
    { code: "+237", country: "Cameroon", flag: "🇨🇲", whatsappEligible: false },
    { code: "+238", country: "Cape Verde", flag: "🇨🇻", whatsappEligible: false },
    { code: "+236", country: "Central African Republic", flag: "🇨🇫", whatsappEligible: false },
    { code: "+235", country: "Chad", flag: "🇹🇩", whatsappEligible: false },
    { code: "+56", country: "Chile", flag: "🇨🇱", whatsappEligible: false },
    { code: "+86", country: "China", flag: "🇨🇳", whatsappEligible: false },
    { code: "+57", country: "Colombia", flag: "🇨🇴", whatsappEligible: false },
    { code: "+269", country: "Comoros", flag: "🇰🇲", whatsappEligible: false },
    { code: "+243", country: "Congo (DRC)", flag: "🇨🇩", whatsappEligible: false },
    { code: "+242", country: "Congo (Republic)", flag: "🇨🇬", whatsappEligible: false },
    { code: "+506", country: "Costa Rica", flag: "🇨🇷", whatsappEligible: false },
    { code: "+385", country: "Croatia", flag: "🇭🇷", whatsappEligible: false },
    { code: "+53", country: "Cuba", flag: "🇨🇺", whatsappEligible: false },
    { code: "+357", country: "Cyprus", flag: "🇨🇾", whatsappEligible: false },
    { code: "+420", country: "Czech Republic", flag: "🇨🇿", whatsappEligible: false },
    { code: "+45", country: "Denmark", flag: "🇩🇰", whatsappEligible: false },
    { code: "+253", country: "Djibouti", flag: "🇩🇯", whatsappEligible: false },
    { code: "+593", country: "Ecuador", flag: "🇪🇨", whatsappEligible: false },
    { code: "+20", country: "Egypt", flag: "🇪🇬", whatsappEligible: false },
    { code: "+503", country: "El Salvador", flag: "🇸🇻", whatsappEligible: false },
    { code: "+240", country: "Equatorial Guinea", flag: "🇬🇶", whatsappEligible: false },
    { code: "+291", country: "Eritrea", flag: "🇪🇷", whatsappEligible: false },
    { code: "+372", country: "Estonia", flag: "🇪🇪", whatsappEligible: false },
    { code: "+251", country: "Ethiopia", flag: "🇪🇹", whatsappEligible: false },
    { code: "+679", country: "Fiji", flag: "🇫🇯", whatsappEligible: false },
    { code: "+358", country: "Finland", flag: "🇫🇮", whatsappEligible: false },
    { code: "+241", country: "Gabon", flag: "🇬🇦", whatsappEligible: false },
    { code: "+220", country: "Gambia", flag: "🇬🇲", whatsappEligible: false },
    { code: "+995", country: "Georgia", flag: "🇬🇪", whatsappEligible: false },
    { code: "+233", country: "Ghana", flag: "🇬🇭", whatsappEligible: false },
    { code: "+30", country: "Greece", flag: "🇬🇷", whatsappEligible: false },
    { code: "+502", country: "Guatemala", flag: "🇬🇹", whatsappEligible: false },
    { code: "+224", country: "Guinea", flag: "🇬🇳", whatsappEligible: false },
    { code: "+245", country: "Guinea-Bissau", flag: "🇬🇼", whatsappEligible: false },
    { code: "+592", country: "Guyana", flag: "🇬🇾", whatsappEligible: false },
    { code: "+509", country: "Haiti", flag: "🇭🇹", whatsappEligible: false },
    { code: "+504", country: "Honduras", flag: "🇭🇳", whatsappEligible: false },
    { code: "+852", country: "Hong Kong", flag: "🇭🇰", whatsappEligible: false },
    { code: "+36", country: "Hungary", flag: "🇭🇺", whatsappEligible: false },
    { code: "+354", country: "Iceland", flag: "🇮🇸", whatsappEligible: false },
    { code: "+91", country: "India", flag: "🇮🇳", whatsappEligible: false },
    { code: "+62", country: "Indonesia", flag: "🇮🇩", whatsappEligible: false },
    { code: "+98", country: "Iran", flag: "🇮🇷", whatsappEligible: false },
    { code: "+964", country: "Iraq", flag: "🇮🇶", whatsappEligible: false },
    { code: "+353", country: "Ireland", flag: "🇮🇪", whatsappEligible: false },
    { code: "+972", country: "Israel", flag: "🇮🇱", whatsappEligible: false },
    { code: "+225", country: "Ivory Coast", flag: "🇨🇮", whatsappEligible: false },
    { code: "+81", country: "Japan", flag: "🇯🇵", whatsappEligible: false },
    { code: "+962", country: "Jordan", flag: "🇯🇴", whatsappEligible: false },
    { code: "+254", country: "Kenya", flag: "🇰🇪", whatsappEligible: false },
    { code: "+965", country: "Kuwait", flag: "🇰🇼", whatsappEligible: false },
    { code: "+996", country: "Kyrgyzstan", flag: "🇰🇬", whatsappEligible: false },
    { code: "+856", country: "Laos", flag: "🇱🇦", whatsappEligible: false },
    { code: "+371", country: "Latvia", flag: "🇱🇻", whatsappEligible: false },
    { code: "+961", country: "Lebanon", flag: "🇱🇧", whatsappEligible: false },
    { code: "+266", country: "Lesotho", flag: "🇱🇸", whatsappEligible: false },
    { code: "+231", country: "Liberia", flag: "🇱🇷", whatsappEligible: false },
    { code: "+218", country: "Libya", flag: "🇱🇾", whatsappEligible: false },
    { code: "+423", country: "Liechtenstein", flag: "🇱🇮", whatsappEligible: false },
    { code: "+370", country: "Lithuania", flag: "🇱🇹", whatsappEligible: false },
    { code: "+352", country: "Luxembourg", flag: "🇱🇺", whatsappEligible: false },
    { code: "+853", country: "Macau", flag: "🇲🇴", whatsappEligible: false },
    { code: "+389", country: "North Macedonia", flag: "🇲🇰", whatsappEligible: false },
    { code: "+261", country: "Madagascar", flag: "🇲🇬", whatsappEligible: false },
    { code: "+265", country: "Malawi", flag: "🇲🇼", whatsappEligible: false },
    { code: "+60", country: "Malaysia", flag: "🇲🇾", whatsappEligible: false },
    { code: "+960", country: "Maldives", flag: "🇲🇻", whatsappEligible: false },
    { code: "+223", country: "Mali", flag: "🇲🇱", whatsappEligible: false },
    { code: "+356", country: "Malta", flag: "🇲🇹", whatsappEligible: false },
    { code: "+222", country: "Mauritania", flag: "🇲🇷", whatsappEligible: false },
    { code: "+230", country: "Mauritius", flag: "🇲🇺", whatsappEligible: false },
    { code: "+52", country: "Mexico", flag: "🇲🇽", whatsappEligible: false },
    { code: "+373", country: "Moldova", flag: "🇲🇩", whatsappEligible: false },
    { code: "+377", country: "Monaco", flag: "🇲🇨", whatsappEligible: false },
    { code: "+976", country: "Mongolia", flag: "🇲🇳", whatsappEligible: false },
    { code: "+382", country: "Montenegro", flag: "🇲🇪", whatsappEligible: false },
    { code: "+212", country: "Morocco", flag: "🇲🇦", whatsappEligible: false },
    { code: "+258", country: "Mozambique", flag: "🇲🇿", whatsappEligible: false },
    { code: "+95", country: "Myanmar", flag: "🇲🇲", whatsappEligible: false },
    { code: "+264", country: "Namibia", flag: "🇳🇦", whatsappEligible: false },
    { code: "+977", country: "Nepal", flag: "🇳🇵", whatsappEligible: false },
    { code: "+31", country: "Netherlands", flag: "🇳🇱", whatsappEligible: false },
    { code: "+64", country: "New Zealand", flag: "🇳🇿", whatsappEligible: false },
    { code: "+505", country: "Nicaragua", flag: "🇳🇮", whatsappEligible: false },
    { code: "+227", country: "Niger", flag: "🇳🇪", whatsappEligible: false },
    { code: "+234", country: "Nigeria", flag: "🇳🇬", whatsappEligible: false },
    { code: "+850", country: "North Korea", flag: "🇰🇵", whatsappEligible: false },
    { code: "+47", country: "Norway", flag: "🇳🇴", whatsappEligible: false },
    { code: "+968", country: "Oman", flag: "🇴🇲", whatsappEligible: false },
    { code: "+92", country: "Pakistan", flag: "🇵🇰", whatsappEligible: false },
    { code: "+970", country: "Palestine", flag: "🇵🇸", whatsappEligible: false },
    { code: "+507", country: "Panama", flag: "🇵🇦", whatsappEligible: false },
    { code: "+675", country: "Papua New Guinea", flag: "🇵🇬", whatsappEligible: false },
    { code: "+595", country: "Paraguay", flag: "🇵🇾", whatsappEligible: false },
    { code: "+51", country: "Peru", flag: "🇵🇪", whatsappEligible: false },
    { code: "+63", country: "Philippines", flag: "🇵🇭", whatsappEligible: false },
    { code: "+48", country: "Poland", flag: "🇵🇱", whatsappEligible: false },
    { code: "+351", country: "Portugal", flag: "🇵🇹", whatsappEligible: false },
    { code: "+974", country: "Qatar", flag: "🇶🇦", whatsappEligible: false },
    { code: "+40", country: "Romania", flag: "🇷🇴", whatsappEligible: false },
    { code: "+250", country: "Rwanda", flag: "🇷🇼", whatsappEligible: false },
    { code: "+685", country: "Samoa", flag: "🇼🇸", whatsappEligible: false },
    { code: "+378", country: "San Marino", flag: "🇸🇲", whatsappEligible: false },
    { code: "+221", country: "Senegal", flag: "🇸🇳", whatsappEligible: false },
    { code: "+381", country: "Serbia", flag: "🇷🇸", whatsappEligible: false },
    { code: "+248", country: "Seychelles", flag: "🇸🇨", whatsappEligible: false },
    { code: "+232", country: "Sierra Leone", flag: "🇸🇱", whatsappEligible: false },
    { code: "+65", country: "Singapore", flag: "🇸🇬", whatsappEligible: false },
    { code: "+421", country: "Slovakia", flag: "🇸🇰", whatsappEligible: false },
    { code: "+386", country: "Slovenia", flag: "🇸🇮", whatsappEligible: false },
    { code: "+677", country: "Solomon Islands", flag: "🇸🇧", whatsappEligible: false },
    { code: "+252", country: "Somalia", flag: "🇸🇴", whatsappEligible: false },
    { code: "+27", country: "South Africa", flag: "🇿🇦", whatsappEligible: false },
    { code: "+82", country: "South Korea", flag: "🇰🇷", whatsappEligible: false },
    { code: "+211", country: "South Sudan", flag: "🇸🇸", whatsappEligible: false },
    { code: "+94", country: "Sri Lanka", flag: "🇱🇰", whatsappEligible: false },
    { code: "+249", country: "Sudan", flag: "🇸🇩", whatsappEligible: false },
    { code: "+597", country: "Suriname", flag: "🇸🇷", whatsappEligible: false },
    { code: "+46", country: "Sweden", flag: "🇸🇪", whatsappEligible: false },
    { code: "+963", country: "Syria", flag: "🇸🇾", whatsappEligible: false },
    { code: "+886", country: "Taiwan", flag: "🇹🇼", whatsappEligible: false },
    { code: "+992", country: "Tajikistan", flag: "🇹🇯", whatsappEligible: false },
    { code: "+255", country: "Tanzania", flag: "🇹🇿", whatsappEligible: false },
    { code: "+66", country: "Thailand", flag: "🇹🇭", whatsappEligible: false },
    { code: "+670", country: "Timor-Leste", flag: "🇹🇱", whatsappEligible: false },
    { code: "+228", country: "Togo", flag: "🇹🇬", whatsappEligible: false },
    { code: "+676", country: "Tonga", flag: "🇹🇴", whatsappEligible: false },
    { code: "+216", country: "Tunisia", flag: "🇹🇳", whatsappEligible: false },
    { code: "+90", country: "Turkey", flag: "🇹🇷", whatsappEligible: false },
    { code: "+993", country: "Turkmenistan", flag: "🇹🇲", whatsappEligible: false },
    { code: "+256", country: "Uganda", flag: "🇺🇬", whatsappEligible: false },
    { code: "+380", country: "Ukraine", flag: "🇺🇦", whatsappEligible: false },
    { code: "+598", country: "Uruguay", flag: "🇺🇾", whatsappEligible: false },
    { code: "+998", country: "Uzbekistan", flag: "🇺🇿", whatsappEligible: false },
    { code: "+678", country: "Vanuatu", flag: "🇻🇺", whatsappEligible: false },
    { code: "+379", country: "Vatican City", flag: "🇻🇦", whatsappEligible: false },
    { code: "+58", country: "Venezuela", flag: "🇻🇪", whatsappEligible: false },
    { code: "+84", country: "Vietnam", flag: "🇻🇳", whatsappEligible: false },
    { code: "+967", country: "Yemen", flag: "🇾🇪", whatsappEligible: false },
    { code: "+260", country: "Zambia", flag: "🇿🇲", whatsappEligible: false },
    { code: "+263", country: "Zimbabwe", flag: "🇿🇼", whatsappEligible: false },
  ];

  async function handleEmailSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError(t.pleaseEnterEmail);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Check if patient exists
      const { data: patient } = await supabaseClient
        .from("patients")
        .select("id, first_name, last_name, email")
        .ilike("email", email.trim())
        .maybeSingle();

      if (patient) {
        // Patient exists - create submission and go to steps
        const { data: submission, error: subError } = await supabaseClient
          .from("patient_intake_submissions")
          .insert({
            patient_id: patient.id,
            status: "in_progress",
            current_step: 1,
          })
          .select("id")
          .single();

        if (subError) throw subError;

        // Push GTM event for form submission
        pushToDataLayer("aliice_form_submit");
        
        // Redirect to steps with submission ID and language
        router.push(`/intake/steps?sid=${submission?.id}&pid=${patient.id}&lang=${language}`);
      } else {
        // Patient doesn't exist - show registration form
        setRegEmail(email.trim());
        setView("register");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    
    if (!firstName.trim() || !lastName.trim() || !regEmail.trim() || !phone.trim()) {
      setError(t.allFieldsRequired);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Check if selected country is WhatsApp-eligible
      const selectedCountry = countryCodes.find(c => c.code === countryCode);
      const isWhatsAppEligible = selectedCountry?.whatsappEligible ?? false;

      // Create new patient
      const { data: newPatient, error: patientError } = await supabaseClient
        .from("patients")
        .insert({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: regEmail.trim().toLowerCase(),
          phone: `${countryCode}${phone.trim().replace(/^0+/, "")}`,
          country_code: countryCode,
          whatsapp_opt_in: isWhatsAppEligible,
          source: "intake_form",
        })
        .select("id")
        .single();

      if (patientError) throw patientError;

      // Create intake submission
      const { data: submission, error: subError } = await supabaseClient
        .from("patient_intake_submissions")
        .insert({
          patient_id: newPatient?.id,
          status: "in_progress",
          current_step: 1,
        })
        .select("id")
        .single();

      if (subError) throw subError;

      // Trigger patient_created workflow
      try {
        await fetch("/api/workflows/patient-created", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ patient_id: newPatient?.id }),
        });
      } catch {
        // Don't block on workflow trigger failure
        console.error("Failed to trigger patient_created workflow");
      }

      // Push GTM event for form submission
      pushToDataLayer("aliice_form_submit");
      
      // Redirect to steps with language
      router.push(`/intake/steps?sid=${submission?.id}&pid=${newPatient?.id}&lang=${language}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to register");
    } finally {
      setLoading(false);
    }
  }

  // Language selector component
  const LanguageSelector = () => (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setLanguage("en")}
        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
          language === "en"
            ? "bg-slate-800 text-white"
            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
        }`}
      >
        EN
      </button>
      <button
        onClick={() => setLanguage("fr")}
        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
          language === "fr"
            ? "bg-slate-800 text-white"
            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
        }`}
      >
        FR
      </button>
    </div>
  );

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex flex-col">
      {/* Header */}
      <header className="px-4 sm:px-6 py-4 flex items-center justify-between">
        <div></div>
        <LanguageSelector />
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center px-4 sm:px-6 py-6 sm:py-12">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="flex justify-center mb-6 sm:mb-8">
            <Image
              src="/logos/aesthetics-logo.svg"
              alt="Aesthetics Clinic"
              width={280}
              height={80}
              className="h-16 sm:h-20 w-auto"
              priority
            />
          </div>

          {/* Hero Section */}
          <div className="text-center mb-8 sm:mb-10">
            <h1 className="text-2xl sm:text-3xl font-light text-slate-900 mb-4">
              {t.heroTitle}<br />
              <span className="text-black font-medium">{t.heroTitleHighlight}</span>
            </h1>
            <p className="text-slate-600 text-sm">
              {t.heroDescription}
            </p>
          </div>

          {view === "search" ? (
            /* Email Search Form */
            <form onSubmit={handleEmailSearch} className="space-y-4">
              <div>
                <h2 className="text-lg font-medium text-black mb-3">{t.search}</h2>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t.enterEmail}
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 bg-white text-black placeholder:text-slate-400 focus:border-black focus:outline-none focus:ring-2 focus:ring-slate-200"
                  disabled={loading}
                />
              </div>

              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-full bg-black text-white font-medium hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                {loading ? t.searching : t.continue}
              </button>

              <p className="text-center text-sm text-slate-500">
                {t.noAccount}{" "}
                <button
                  type="button"
                  onClick={() => {
                    setView("register");
                    setRegEmail(email);
                  }}
                  className="text-black font-medium hover:underline"
                >
                  {t.register}
                </button>
              </p>
            </form>
          ) : (
            /* Registration Form */
            <form onSubmit={handleRegister} className="space-y-4">
              <h2 className="text-lg font-medium text-black mb-3">{t.register}</h2>

              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder={t.firstName}
                className="w-full px-4 py-3 rounded-lg border border-slate-300 bg-white text-black placeholder:text-slate-400 focus:border-black focus:outline-none focus:ring-2 focus:ring-slate-200"
                disabled={loading}
              />

              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder={t.lastName}
                className="w-full px-4 py-3 rounded-lg border border-slate-300 bg-white text-black placeholder:text-slate-400 focus:border-black focus:outline-none focus:ring-2 focus:ring-slate-200"
                disabled={loading}
              />

              <div className="flex gap-2">
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="w-28 px-3 py-3 rounded-lg border border-slate-300 bg-white text-black focus:border-black focus:outline-none focus:ring-2 focus:ring-slate-200"
                  disabled={loading}
                >
                  {countryCodes.map((c) => (
                    <option key={c.code} value={c.code} className="text-black">
                      {c.flag} {c.code}
                    </option>
                  ))}
                </select>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t.mobile}
                  className="flex-1 px-4 py-3 rounded-lg border border-slate-300 bg-white text-black placeholder:text-slate-400 focus:border-black focus:outline-none focus:ring-2 focus:ring-slate-200"
                  disabled={loading}
                />
              </div>

              <input
                type="email"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                placeholder={t.email}
                className="w-full px-4 py-3 rounded-lg border border-slate-300 bg-white text-black placeholder:text-slate-400 focus:border-black focus:outline-none focus:ring-2 focus:ring-slate-200"
                disabled={loading}
              />

              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-full bg-black text-white font-medium hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                {loading ? t.registering : t.register}
              </button>

              <p className="text-center text-sm text-slate-500">
                {t.alreadyHaveAccount}{" "}
                <button
                  type="button"
                  onClick={() => setView("search")}
                  className="text-black font-medium hover:underline"
                >
                  {t.login}
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
