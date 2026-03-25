export type EmbedLanguage = "fr" | "en";

export const embedTranslations = {
  contact: {
    fr: {
      firstName: "Prénom",
      lastName: "Nom",
      email: "Email",
      phone: "Numéro de téléphone",
      phonePlaceholder: "79 123 45 67",
      service: "Je suis intéressé par le service suivant:",
      location: "Mon lieu préféré est:",
      pleaseSelect: "Veuillez sélectionner",
      existingPatient: "Êtes-vous déjà patient?",
      messagePlaceholder: "Si vous avez des questions supplémentaires, n'hésitez pas à les poser ici!",
      privacyNotice: "Aesthetics Clinic Geneva a besoin des coordonnées que vous nous fournissez pour nous contacter à propos de nos produits et services.",
      privacyAccept: "En cliquant sur \"Soumettre\", vous acceptez les termes listés dans notre",
      privacyPolicy: "politique de confidentialité",
      submit: "SOUMETTRE",
      submitting: "Envoi...",
      required: "*",
      errorRequired: "Veuillez remplir tous les champs obligatoires",
      errorEmail: "Veuillez entrer une adresse email valide",
      errorSubmit: "Échec de l'envoi",
      errorGeneric: "Une erreur est survenue",
      successTitle: "Merci!",
      successMessage: "Votre demande a été envoyée avec succès. Notre équipe vous contactera très prochainement.",
      sendAnother: "Envoyer une autre demande",
      services: [
        "Augmentation Mammaire",
        "Liposuccion",
        "Rhinoplastie",
        "Lifting du Visage",
        "Blépharoplastie",
        "Injections (Botox/Fillers)",
        "Soins de la Peau",
        "Consultation Générale",
        "Autre",
      ],
      locations: [
        { id: "rhone", label: "Genève - Rue du Rhône" },
        { id: "champel", label: "Genève - Champel" },
        { id: "gstaad", label: "Gstaad" },
        { id: "montreux", label: "Montreux" },
      ],
    },
    en: {
      firstName: "First Name",
      lastName: "Last Name",
      email: "Email",
      phone: "Phone Number",
      phonePlaceholder: "79 123 45 67",
      service: "I am interested in the following service:",
      location: "My preferred location is:",
      pleaseSelect: "Please Select",
      existingPatient: "Are you an existing patient?",
      messagePlaceholder: "If you have any additional questions, feel free to ask here!",
      privacyNotice: "Aesthetics Clinic Geneva needs the contact information you provide to contact you about our products and services.",
      privacyAccept: "By clicking \"Submit\", you agree to the terms listed in our",
      privacyPolicy: "privacy policy",
      submit: "SUBMIT",
      submitting: "Sending...",
      required: "*",
      errorRequired: "Please fill in all required fields",
      errorEmail: "Please enter a valid email address",
      errorSubmit: "Failed to submit",
      errorGeneric: "An error occurred",
      successTitle: "Thank you!",
      successMessage: "Your request has been sent successfully. Our team will contact you shortly.",
      sendAnother: "Send another request",
      services: [
        "Breast Augmentation",
        "Liposuction",
        "Rhinoplasty",
        "Facelift",
        "Blepharoplasty",
        "Injections (Botox/Fillers)",
        "Skin Care",
        "General Consultation",
        "Other",
      ],
      locations: [
        { id: "rhone", label: "Geneva - Rue du Rhône" },
        { id: "champel", label: "Geneva - Champel" },
        { id: "gstaad", label: "Gstaad" },
        { id: "montreux", label: "Montreux" },
      ],
    },
  },
  book: {
    fr: {
      // Step titles
      stepLocation: "Lieu",
      stepDoctor: "Médecin",
      stepInfo: "Informations",
      stepDateTime: "Date & Heure",
      stepConfirm: "Confirmation",
      
      // Location step
      chooseLocation: "Choisissez votre lieu",
      chooseLocationSubtitle: "Sélectionnez votre clinique préférée pour voir les spécialistes disponibles",
      allLocationsOffer: "Toutes nos cliniques offrent",
      allLocationsOfferDesc: "Consultations gratuites, simulations 3D et notre gamme complète de services esthétiques.",
      
      // Location descriptions
      locationDescRhone: "Notre clinique phare au cœur de Genève",
      locationDescChampel: "Services esthétiques premium à Champel",
      locationDescGstaad: "Clinique exclusive en montagne",
      locationDescMontreux: "Excellence esthétique au bord du lac",
      
      // Doctor step
      availableSpecialists: "Spécialistes disponibles",
      selectSpecialist: "Sélectionnez un spécialiste pour réserver votre consultation",
      
      // Info step
      personalInformation: "Informations personnelles",
      firstName: "Prénom",
      lastName: "Nom",
      email: "Adresse email",
      phone: "Numéro de téléphone",
      phonePlaceholder: "79 123 45 67",
      existingPatient: "Êtes-vous déjà patient?",
      
      // DateTime step
      selectDateTime: "Sélectionnez une date et heure",
      date: "Date",
      availableDatesCount: "dates disponibles dans les 3 prochains mois",
      allSlotsBooked: "Tous les créneaux sont complets pour ce jour. Veuillez sélectionner une autre date.",
      availableTimeSlots: "Créneaux horaires disponibles",
      noAvailabilityDate: "Aucune disponibilité pour cette date. Veuillez sélectionner une autre date.",
      additionalNotes: "Notes supplémentaires",
      notesPlaceholder: "Des préoccupations particulières...",
      continue: "Continuer",
      errorSelectDateTime: "Veuillez sélectionner une date et une heure",
      
      // Confirm step
      confirmAppointment: "Confirmez votre rendez-vous",
      name: "Nom",
      specialist: "Spécialiste",
      time: "Heure",
      location: "Lieu",
      
      // Common
      back: "Retour",
      next: "Suivant",
      confirmBooking: "Confirmer le rendez-vous",
      booking: "Réservation...",
      
      // Errors
      errorRequired: "Veuillez remplir tous les champs obligatoires",
      errorEmail: "Veuillez entrer une adresse email valide",
      errorNoSlots: "Aucun créneau disponible pour cette date",
      errorGeneric: "Une erreur est survenue",
      
      // Success
      successTitle: "Rendez-vous réservé!",
      successMessage: "Votre rendez-vous avec",
      successConfirmed: "a été confirmé.",
      confirmationSent: "Un email de confirmation a été envoyé à",
      service: "Service",
      bookAnother: "Réserver un autre rendez-vous",
      
      // Legacy (keep for compatibility)
      selectLocation: "Sélectionnez un lieu",
      selectDoctor: "Sélectionnez un médecin",
      yourInformation: "Vos informations",
      notes: "Notes (optionnel)",
      appointmentWith: "Rendez-vous avec",
      at: "à",
      on: "le",
      availableSlots: "Créneaux disponibles",
      noAvailability: "Aucune disponibilité pour ce jour",
      selectDate: "Sélectionnez une date",
      privacyNotice: "Aesthetics Clinic Geneva a besoin des coordonnées que vous nous fournissez pour nous contacter à propos de nos produits et services.",
      privacyAccept: "En cliquant sur \"Confirmer\", vous acceptez les termes listés dans notre",
      privacyPolicy: "politique de confidentialité",
    },
    en: {
      // Step titles
      stepLocation: "Location",
      stepDoctor: "Doctor",
      stepInfo: "Information",
      stepDateTime: "Date & Time",
      stepConfirm: "Confirm",
      
      // Location step
      chooseLocation: "Choose Your Location",
      chooseLocationSubtitle: "Select your preferred clinic location to see available specialists",
      allLocationsOffer: "All Locations Offer",
      allLocationsOfferDesc: "Free consultations, 3D simulations, and our full range of aesthetic services.",
      
      // Location descriptions
      locationDescRhone: "Our flagship clinic in the heart of Geneva",
      locationDescChampel: "Premium aesthetic services in Champel",
      locationDescGstaad: "Exclusive mountain retreat clinic",
      locationDescMontreux: "Lakeside aesthetic excellence",
      
      // Doctor step
      availableSpecialists: "Available Specialists",
      selectSpecialist: "Select a specialist to book your consultation",
      
      // Info step
      personalInformation: "Personal Information",
      firstName: "First Name",
      lastName: "Last Name",
      email: "Email Address",
      phone: "Phone Number",
      phonePlaceholder: "79 123 45 67",
      existingPatient: "Are you an existing patient?",
      
      // DateTime step
      selectDateTime: "Select Date & Time",
      date: "Date",
      availableDatesCount: "available dates in the next 3 months",
      allSlotsBooked: "All time slots are fully booked on this day. Please select another date.",
      availableTimeSlots: "Available Time Slots",
      noAvailabilityDate: "No availability on this date. Please select another date.",
      additionalNotes: "Additional Notes",
      notesPlaceholder: "Any specific concerns...",
      continue: "Continue",
      errorSelectDateTime: "Please select a date and time",
      
      // Confirm step
      confirmAppointment: "Confirm Your Appointment",
      name: "Name",
      specialist: "Specialist",
      time: "Time",
      location: "Location",
      
      // Common
      back: "Back",
      next: "Next",
      confirmBooking: "Confirm Booking",
      booking: "Booking...",
      
      // Errors
      errorRequired: "Please fill in all required fields",
      errorEmail: "Please enter a valid email address",
      errorNoSlots: "No slots available for this date",
      errorGeneric: "An error occurred",
      
      // Success
      successTitle: "Appointment Booked!",
      successMessage: "Your appointment with",
      successConfirmed: "has been confirmed.",
      confirmationSent: "A confirmation email has been sent to",
      service: "Service",
      bookAnother: "Book Another Appointment",
      
      // Legacy (keep for compatibility)
      selectLocation: "Select a location",
      selectDoctor: "Select a doctor",
      yourInformation: "Your information",
      notes: "Notes (optional)",
      appointmentWith: "Appointment with",
      at: "at",
      on: "on",
      availableSlots: "Available slots",
      noAvailability: "No availability for this day",
      selectDate: "Select a date",
      privacyNotice: "Aesthetics Clinic Geneva needs the contact information you provide to contact you about our products and services.",
      privacyAccept: "By clicking \"Confirm\", you agree to the terms listed in our",
      privacyPolicy: "privacy policy",
    },
  },
  countries: {
    fr: [
      { code: "+41", country: "Suisse", flag: "🇨🇭" },
      { code: "+33", country: "France", flag: "🇫🇷" },
      { code: "+49", country: "Allemagne", flag: "🇩🇪" },
      { code: "+39", country: "Italie", flag: "🇮🇹" },
      { code: "+44", country: "Royaume-Uni", flag: "🇬🇧" },
      { code: "+1", country: "USA/Canada", flag: "🇺🇸" },
      { code: "+7", country: "Russie", flag: "🇷🇺" },
      { code: "+34", country: "Espagne", flag: "🇪🇸" },
      { code: "+971", country: "EAU", flag: "🇦🇪" },
      { code: "+966", country: "Arabie Saoudite", flag: "🇸🇦" },
    ],
    en: [
      { code: "+41", country: "Switzerland", flag: "🇨🇭" },
      { code: "+33", country: "France", flag: "🇫🇷" },
      { code: "+49", country: "Germany", flag: "🇩🇪" },
      { code: "+39", country: "Italy", flag: "🇮🇹" },
      { code: "+44", country: "United Kingdom", flag: "🇬🇧" },
      { code: "+1", country: "USA/Canada", flag: "🇺🇸" },
      { code: "+7", country: "Russia", flag: "🇷🇺" },
      { code: "+34", country: "Spain", flag: "🇪🇸" },
      { code: "+971", country: "UAE", flag: "🇦🇪" },
      { code: "+966", country: "Saudi Arabia", flag: "🇸🇦" },
    ],
  },
};

export function getEmbedLanguage(searchParams: URLSearchParams): EmbedLanguage {
  const lang = searchParams.get("lang")?.toLowerCase();
  if (lang === "en" || lang === "english") return "en";
  return "fr"; // Default to French
}
