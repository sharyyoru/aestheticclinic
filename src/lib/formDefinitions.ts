// Form definitions for patient forms
// Each form corresponds to a PDF/DOCX in public/forms/

export type FormFieldType = 
  | "text" 
  | "textarea" 
  | "email" 
  | "phone" 
  | "date" 
  | "checkbox" 
  | "radio" 
  | "select" 
  | "number"
  | "signature"
  | "section";

export type FormField = {
  id: string;
  type: FormFieldType;
  label: string;
  labelFr?: string;
  required?: boolean;
  options?: { value: string; label: string; labelFr?: string }[];
  placeholder?: string;
  placeholderFr?: string;
  helpText?: string;
  helpTextFr?: string;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
};

export type FormContentBlock =
  | {
      type: "paragraph";
      text: string;
      textFr?: string;
    }
  | {
      type: "ordered-list" | "unordered-list";
      items: string[];
      itemsFr?: string[];
    };

export type FormSection = {
  id: string;
  title: string;
  titleFr?: string;
  description?: string;
  descriptionFr?: string;
  content?: FormContentBlock[];
  fields: FormField[];
};

export type FormDefinition = {
  id: string;
  name: string;
  nameFr?: string;
  description: string;
  descriptionFr?: string;
  language: "en" | "fr";
  category: "consent" | "questionnaire" | "instructions";
  originalFile: string;
  sections: FormSection[];
};

const paragraph = (text: string): FormContentBlock => ({ type: "paragraph", text });
const orderedList = (items: string[]): FormContentBlock => ({ type: "ordered-list", items });
const unorderedList = (items: string[]): FormContentBlock => ({ type: "unordered-list", items });

const ANESTHESIA_QUESTIONNAIRE_FR_CONTENT: FormContentBlock[] = [
  paragraph("Questionnaire d’Anesthésie"),
  paragraph("Nom : ……………………….. Prénom : ……………………………… Né(e) le : ……………………………………."),
  paragraph("Taille : ……………….. Poids : ……………….. Médecin traitant :………………………………"),
  paragraph("Date de votre opération : …………………………………………… Chirurgien : ……………………………………….."),
  paragraph("N°CADA assurance : …80756…………………………………………………. Tél privé : …………………………………………"),
  orderedList([
    "Avez-vous eu un traitement médical ces derniers mois ? Oui, lequel ? / Non",
    "Prenez-vous des médicaments tous les jours (y compris somnifères, laxatifs, aspirine et médicaments homéopathiques) ? Oui, lequel ? / Non",
    "Avez-vous eu de la fièvre ces derniers jours ? Oui / Non",
    "Avez-vous des allergies (médicaments, pansements, aliments, désinfectants) ? Oui (spécifier si : éruption cutanée, œdème de Quincke, difficultés respiratoires, choc anaphylactique) / Non. Lesquelles ?",
    "Opérations précédentes et type d’anesthésie : a=complète, b=péridurale ou rachidienne, c=locale. Si plus d’opérations veuillez préciser l’opération, l’année et le type d’anesthésie (a,b ou c).",
    "Avez-vous eu des problèmes particuliers en rapport avec l’anesthésie (nausées, vomissements, difficultés de réveil, etc.) ? Oui, lesquels ? / Non",
    "Un de vos proches parents a-t-il eu des problèmes lors d’une anesthésie ? Oui, lesquels ? / Non",
    "Avez-vous eu ou avez-vous des problèmes : cardiaques, vasculaires, respiratoires, nerveux, urinaires, métaboliques, infectieux, digestifs ou oculaires ?",
    "Avez-vous une maladie qui n’est pas mentionnée dans la liste précédente ? Oui, laquelle ? / Non",
    "Êtes-vous sujet aux saignements prolongés ? Oui / Non",
    "Avez-vous : bridge, dents branlantes, dent à pivot, facettes, prothèse dentaire, prothèse auditive, pace maker, lentilles de contact ?",
    "Fumez-vous ou avez-vous fumé ? Oui, combien de cigarettes par jour ? / Non. Depuis combien de temps/pendant combien de temps ?",
    "Consommez-vous des drogues ? Oui, laquelle ? / Non",
    "Buvez-vous de l’alcool ? Jamais / À l’occasion / Régulièrement",
    "Êtes-vous plutôt ? Sportif / Actif / Sédentaire",
    "Autre particularité non mentionnée précédemment ?",
    "En cas d’urgence, veuillez indiquer les coordonnées d’un de vos proches et votre lien avec cette personne.",
  ]),
  paragraph("Pour les femmes : Prenez-vous la pilule ? Oui / Non. Êtes-vous enceinte ou susceptible de l’être ? Oui / Non. Allaitez-vous ? Oui / Non"),
];

const ANESTHESIA_QUESTIONNAIRE_EN_CONTENT: FormContentBlock[] = [
  paragraph("Anesthesia questionnaire"),
  paragraph("Surname: ……………………….. Name: ……………………………… Date of birth: ……………………………………….."),
  paragraph("Height: ……………….. Weight: ……………….. Attending physician: ………………………………"),
  paragraph("Planned operation: ………………………………………………………………… Date of operation: …………………………………"),
  paragraph("N°CADA insurance: …80756…………………………………………………. Telephone number: ………………………………"),
  orderedList([
    "Have you had any medical treatment in recent months ? Yes, which one ? / No",
    "Do you take medication every day ? Yes, which one ? / No",
    "Have you had a fever in the past few days ? Yes / No",
    "Do you have allergies (drugs, dressings, food, disinfectants) ? Yes (specify the type of reaction: rashes, angioedema, anaphylactic shock) / No. Which one ?",
    "Previous surgical operations and type of anesthesia : a=general, b=spinal block or epidural anesthesia, c=local anesthesia. If more surgical operations, please specify the operation, the year and type of anesthesia (a,b, ou c).",
    "Have you had any particular problems with the anesthesia (nausea, vomiting, difficulties waking up, etc.) ? Yes, which one ? / No",
    "Did you have or do you have: heart, circulation, lungs, nervous system, urinary system, metabolic, infectious diseases, digestive system/liver or ophtalmology problems ?",
    "Do you have a disease that is not mentioned in the previous list ? Yes, which one ? / No",
    "Are you prone to prolonged bleeding ? Yes / No",
    "Do you have: bridge, loose teeth, pivot tooth, veneers, dental prothesis, hearing aid, pace maker, contact lenses ?",
    "Do you smoke or have you smoked ? Yes, how many cigarettes per day ? / No. For how long time ?",
    "Do you use drugs ? Yes, which one ? / No",
    "Do you drink alcohol ? Never / Occasionally / Regularly",
    "Are you rather ? Athletic / Active / Sedentary",
    "Another feature not mentioned previously ?",
    "In case of emergency, please provide the contact details of one of your relatives and your relationship to this person.",
  ]),
  paragraph("For women : Are you taking contraceptive pill ? Yes / No. Are you pregnant or likely to be ? Yes / No. Are you breastfeeding ? Yes / No"),
];

const ANESTHESIA_CONSENT_FR_CONTENT: FormContentBlock[] = [
  paragraph("Informations concernant l’anesthésie"),
  paragraph("Cette brochure est un document destiné à vous informer et à vous préparer à l’anesthésie nécessaire à votre prochaine intervention. Elle vous renseigne sur son déroulement, ses procédés et les complications liées aux différentes techniques. Ceci dans le but de vous permettre de donner un consentement libre et éclairé à votre prise en charge."),
  paragraph("Qu’est-ce que l’anesthésie et qui la pratique ?"),
  paragraph("L’anesthésie est un acte médical pratiqué dans le but d’effectuer une intervention chirurgicale ou un examen invasif dans les meilleures conditions de sécurité et de confort. L’anesthésiste est un médecin spécialiste (FMH) qui s’occupe non seulement de rendre le patient insensible à la douleur (anesthésie) mais aussi de contrôler les fonctions vitales telles que la respiration, la circulation, le métabolisme, la fonction rénale, et de les maintenir dans les limites appropriées avant, pendant et après l’opération."),
  paragraph("L’Anesthésie Générale et la Sédation"),
  paragraph("Lors d’une anesthésie générale, la perception de la douleur est neutralisée à l’aide de différents médicaments et le patient est inconscient. Cet état de « sommeil artificiel » se prolonge jusqu’à la fin de l’intervention. Dans la plupart des cas, la respiration doit être assistée au moyen de dispositifs médicaux implantés temporairement dans votre cavité buccale et vos voies respiratoires. Certains actes chirurgicaux peuvent se faire sous sédation qui est une forme d’anesthésie générale peu profonde."),
  paragraph("Consultation préopératoire avec votre anesthésiste"),
  paragraph("Avant votre intervention, un entretien avec votre futur anesthésiste est organisé en présentiel si celui-ci trouve que cela est nécessaire ou par consultation téléphonique. Il permet au médecin d’évaluer vos risques opératoires, de choisir avec vous la technique d’anesthésie la mieux adaptée à votre état de santé et à l’intervention chirurgicale prévue. Le médecin vous explique en outre le déroulement de votre anesthésie et vous expose les risques et complications éventuelles liés à celle-ci."),
  paragraph("Nous vous remettrons un questionnaire d’anesthésie à remplir et à retourner au plus vite et au minimum 2 jours ouvrables avant votre intervention."),
  paragraph("Documents à apporter avec vous"),
  paragraph("Si un rapport préopératoire a été requis par votre chirurgien, nous vous prions de l’apporter lors de votre admission. Il est important de prendre avec vous tous les documents récents concernant votre santé, notamment : médicaments habituels et posologie, résultats d’analyses laboratoires, radiographies, électrocardiogramme."),
  paragraph("Anesthésie, sécurité et effets secondaires"),
  paragraph("Les méthodes utilisées actuellement en anesthésie sont fiables et le risque de complications qui pourraient mettre la vie du patient en danger, même dans les cas les plus lourds, demeure extrêmement faible. Lors de l’intervention, toutes les fonctions vitales de l’organisme sont sous surveillance."),
  paragraph("Les nausées et les vomissements au réveil sont devenus moins fréquents actuellement. L’introduction d’un tube dans la trachée ou dans la gorge peut provoquer des maux de gorge, des enrouements passagers et des traumatismes dentaires. La position prolongée sur la table d’opération peut entraîner la compression de certains nerfs. Des complications imprévisibles comportant un risque vital comme une allergie sévère, un arrêt cardiaque ou l’asphyxie, sont extrêmement rares."),
  paragraph("Pour votre sécurité"),
  paragraph("Le patient doit rester à jeun à minuit la veille de l’anesthésie ou 6 heures minimum avant l’intervention (sans manger, ni fumer). Vous pouvez boire de l’eau, du thé ou du café noir sans lait uniquement jusqu'à 2 heures avant votre intervention. Le respect de ce jeûne est très IMPORTANT, son non-respect peut entraîner de graves complications respiratoires."),
  paragraph("Accord pour la procédure anesthésique"),
  unorderedList([
    "Au cours de la consultation d’anesthésie, j’ai été informé des avantages et risques de l’anesthésie dans mon cas.",
    "J’accepte que l’anesthésie puisse être prise en charge par un autre médecin-anesthésiste du service.",
    "J’ai pu poser toutes les questions que j’ai jugées utiles et j’ai compris les réponses fournies.",
    "J’accepte les modifications des méthodes qui pourraient s’avérer nécessaires pendant mon intervention.",
  ]),
];

const ANESTHESIA_CONSENT_EN_CONTENT: FormContentBlock[] = [
  paragraph("Anesthesia’s informations"),
  paragraph("What is general anesthesia?"),
  paragraph("This is a technique used to eliminate pain during a surgical, obstetrical or medical procedure (endoscopy, radiology, etc.). It is induced by injecting medication or inhaling anesthetic vapors. These substances put you into a state comparable to very deep sleep."),
  paragraph("What will the procedure involve?"),
  paragraph("You will be given custom-tailored anesthesia by specialized doctors and nurses. Your care will start by fitting devices to monitor your vital functions: heart, blood pressure and breathing. Medication to induce general anesthesia is administered intravenously. During the operation, most people are given artificial breathing assistance. While you are under the anesthetic, an anesthesia professional will monitor your vital functions, including your heart and lungs. Once the surgical procedure has ended, medication will no longer be administered, which will lead to your awakening. You will be monitored continuously in the recovery room."),
  paragraph("What are the risks of general anesthesia?"),
  paragraph("All medical procedures involve risks, even when they are performed by experts. The rate and severity of these risks depend on your state of health, age or general lifestyle. The anesthesia techniques used are safe. The risks of unexpected and potentially life-threatening complications such as an allergy or severe heart or lung problem are extremely small."),
  unorderedList([
    "Nausea and vomiting: this occurs after your awakening.",
    "Sore throat, hoarseness, swallowing difficulties: these effects sometimes appear when a device has been inserted into the throat or trachea to help you breathe during anesthesia.",
    "Dental damage: this can be caused by the procedures required to fit the breathing assistance device.",
    "Nerve, muscle and skin damage: this is caused by extended periods spent lying on the operating table, which leads to compression.",
    "Memory problems, decreased concentration: this sometimes occurs in the days following the operation and disappears spontaneously.",
    "Awakening during the operation: this is very rare, but can remain in your memory and should be reported to the anesthesia team.",
  ]),
  paragraph("What are the necessary safety precautions?"),
  unorderedList([
    "Medication: only take medication authorized by the anesthesiologist during the consultation appointment and report any medication taken, including aspirin, anti-inflammatory drugs or blood thinners.",
    "Dentures, jewelry, contact lenses, piercings or other devices should be removed before your arrival in the operating room.",
    "Food: do not eat, suck on candy or chewing gum less than six hours before the procedure.",
    "Beverages: stop drinking fluids six hours prior to the procedure; only clear liquids are permitted up to two hours before the procedure; after that time, all beverages are prohibited.",
    "Smoking: it is advisable to stop smoking at least 12 hours before the procedure.",
  ]),
  paragraph("Agreement for the anesthetic procedure."),
  unorderedList([
    "During the anesthesia consultation, I was informed of the benefits and risks of anesthesia in my case.",
    "I agree that the anesthesia may be taken care of another anesthetist to the anesthesia team.",
    "I was able to ask all the questions I found useful and I understood the answers provided.",
    "I accept any changes in methods that may be necessary during my intervention.",
  ]),
];

const BREAST_AUGMENTATION_FR_CONTENT: FormContentBlock[] = [
  paragraph("Chères patientes,"),
  paragraph("Vous allez bénéficier d’une opération par la mise en place d’implants mammaires. Ce type d’intervention a un pourcentage de satisfaction très élevé. Néanmoins, il existe quelques risques post-opératoires qui varient autour de 6% dans le langage scientifique."),
  paragraph("Parmi ces risques, il y a :"),
  orderedList([
    "Hématome post-opératoire immédiat, dans les premières 24 heures.",
    "Infection de la capsule prothétique.",
    "Infection de la cicatrice.",
    "Asymétrie.",
    "Changement de la sensibilité dans l’ensemble des seins.",
    "Contraction prématurée de la capsule péri-prothétique.",
    "Sérome.",
  ]),
  paragraph("Bien que ces complications soient rares, et malgré une technique chirurgicale adéquate et très performante, nous ne sommes pas à l’abri de les éviter."),
  paragraph("Pour toutes ces raisons, nous conseillons à nos patientes de suivre toutes les indications concernant une augmentation mammaire par la mise en place de prothèses."),
  paragraph("Parmi ces recommandations, les plus importantes sont les suivantes :"),
  orderedList([
    "Porter un soutien de gorge de sport sans armatures que vous devez vous procurer, pendant 4 semaines jour et nuit.",
    "Ne pas porter des objets lourds de plus de 15kg.",
    "Éviter les activités physiques (sport de choc) pendant 4 semaines.",
    "Éviter les massages de la poitrine.",
    "Assister à tous les contrôles post-opératoires prévus par le chirurgien.",
    "Notifier tous changements importants qui attirent votre attention durant la période post-opératoire.",
  ]),
  paragraph("Nous vous rappelons que les frais de prise en charge d’une éventuelle complication ne sont pas inclus dans le prix forfaitaire fixé dans le devis initial pour cet acte esthétique, et que les assurances maladies sont susceptible d’accepter ou de refuser cette prise en charge."),
];

const BREAST_AUGMENTATION_EN_CONTENT: FormContentBlock[] = [
  paragraph("Dear patients,"),
  paragraph("You will soon have an breast augmentation surgery. This type of operation have a high rate of satisfaction. But there’s post operation risks which vary around 6%."),
  paragraph("Among these risks :"),
  orderedList([
    "Post operation bruise in the few hours following the operation.",
    "Infection of the prosthetics capsules.",
    "Infection of the scar.",
    "Asymmetry.",
    "Sensibility changes in the breast.",
    "Contraction of the prosthetics capsule.",
    "Seroma.",
  ]),
  paragraph("These complication are very rare but we cannot guarantee 0 risks."),
  paragraph("For all these reasons, we advise you to follow all the indications for a breast augmentation:"),
  orderedList([
    "Wear a soft bra for 4 weeks night and day (nonstop).",
    "Avoid physicals activities for at least 4 weeks.",
    "Do not carry heavy things.",
    "Avoid breast massages.",
    "Be present at all your appointment after the operation.",
    "Inform your surgeon about every changes important about your breast.",
  ]),
  paragraph("We remind you that every complications are not include in the initial price of the operation."),
  paragraph("In this case health insurance are free to accept or not."),
];

const BREAST_LIFT_REDUCTION_FR_CONTENT: FormContentBlock[] = [
  paragraph("Chères patientes,"),
  paragraph("Vous allez bénéficier d’une opération au niveau de votre poitrine. Ce type d’intervention a un pourcentage de satisfaction très élevé. Néanmoins, il existe quelques risques post-opératoires qui varient autour de 6% dans le langage scientifique."),
  paragraph("Parmi ces risques, il y a :"),
  orderedList([
    "Hématome post-opératoire immédiat, dans les premières 24 heures.",
    "Infection de la cicatrice.",
    "Asymétrie.",
    "Changement de la sensibilité dans l’ensemble des seins.",
  ]),
  paragraph("Bien que ces complications soient rares, et malgré une technique chirurgicale adéquate et très performante, nous ne sommes pas à l’abri de les éviter."),
  paragraph("Pour toutes ces raisons, nous conseillons à nos patientes de suivre toutes les indications concernant une augmentation mammaire par la mise en place de prothèses."),
  paragraph("Parmi ces recommandations, les plus importantes sont les suivantes :"),
  orderedList([
    "Porter un soutien de gorge de sport sans armatures que vous devez vous procurer, pendant 4 semaines jour et nuit.",
    "Ne pas porter des objets lourds de plus de 15kg.",
    "Éviter les activités physiques (sport de choc) pendant 4 semaines.",
    "Éviter les massages de la poitrine.",
    "Assister à tous les contrôles post-opératoires prévus par le chirurgien.",
    "Notifier tous changements importants qui attirent votre attention durant la période post-opératoire.",
  ]),
  paragraph("Nous vous rappelons que les frais de prise en charge d’une éventuelle complication ne sont pas inclus dans le prix forfaitaire fixé dans le devis initial pour cet acte esthétique, et que les assurances maladies sont susceptible d’accepter ou de refuser cette prise en charge."),
];

const BREAST_LIFT_REDUCTION_EN_CONTENT: FormContentBlock[] = [
  paragraph("Dear patients,"),
  paragraph("You will undergo an operation on your chest. This type of intervention has a very high satisfaction rate. Nevertheless, there are some post-operative risks that vary around 6% in scientific language."),
  paragraph("Among these risks are:"),
  orderedList([
    "Immediate post-operative hematoma, within the first 24 hours.",
    "Infection of the scar.",
    "Asymmetry.",
    "Change in sensitivity throughout the breasts.",
  ]),
  paragraph("Although these complications are rare, and despite an adequate and very effective surgical technique, we are not immune from them."),
  paragraph("For all these reasons, we advise our patients to follow all the instructions concerning breast surgery."),
  paragraph("Among these recommendations, the most important are the following:"),
  orderedList([
    "Wear a wire-free sports bra that you must obtain, for 4 weeks day and night.",
    "Do not carry heavy objects over 15kg.",
    "Avoid physical activities (impact sports) for 4 weeks.",
    "Avoid breast massages.",
    "Attend all post-operative check-ups scheduled by the surgeon.",
    "Report any important changes that attract your attention during the post-operative period.",
  ]),
  paragraph("We remind you that the costs of treating a possible complication are not included in the fixed price set in the initial estimate for this aesthetic procedure, and that health insurance companies may accept or refuse this coverage."),
];

const GENERAL_INFORMED_CONSENT_FR_CONTENT: FormContentBlock[] = [
  paragraph("CONSENTEMENT ÉCLAIRÉ"),
  paragraph("Le/la soussignée confirme avoir été dûment informé/e par son médecin traitant du traitement, ainsi que des effets indésirables et complications éventuelles. De plus, il a été répondu de manière complète et compréhensible à ses questions."),
  paragraph("Il/elle a connaissance que si la caisse maladie ne prends pas en charge les frais de ce traitement et que la clinique (en cas d’anesthésie générale) peut facturer directement le temps de dépassement chirurgicale si l’opération prends plus de temps que prévue."),
  paragraph("Par la signature du présent formulaire, le/la soussigné/e déclare accepter le traitement."),
  paragraph("En cas d’annulation, le/la soussigné/e déclare prendre connaissance que des frais d’annulation d’un montant de 800 CHF lui seront facturés."),
  paragraph("Nous ne pouvons pas garantir les résultats, mais nous pouvons vous garantir que vous serez conseillé/e, évalué/e et traité/e en toute bonne foi et au mieux de nos connaissances."),
  paragraph("Le/la soussigné/e confirme, avoir connaissance que le matériel photographique et vidéo pris pendant la consultation, appartient exclusivement à son dossier médical, néanmoins :"),
  unorderedList([
    "Le/la patient/e autorise l’utilisation du matériel photographique et vidéo dans le but de la recherche médicale, des présentations scientifiques et comme matériel d’illustration, à condition que son identité ne soit pas dévoilée.",
    "Le/la patient/e n’autorise en aucun cas l’utilisation de son matériel photographique et vidéo.",
  ]),
];

const GENERAL_INFORMED_CONSENT_EN_CONTENT: FormContentBlock[] = [
  paragraph("INFORMED CONSENT"),
  paragraph("The undersigned confirms that he/she has been duly informed by his/her treating physician of the treatment, as well as of the possible adverse effects and complications. In addition, his/her questions have been answered completely and understandably."),
  paragraph("He/she is aware that if the health insurance does not cover the costs of this treatment, and that the clinic (in case of general anesthesia) may directly invoice the surgical overtime if the operation takes longer than planned."),
  paragraph("By signing this form, the undersigned declares that he/she accepts the treatment."),
  paragraph("In case of cancellation, the undersigned declares that he/she is aware that cancellation fees in the amount of CHF 800 will be charged to him/her."),
  paragraph("We cannot guarantee results, but we can guarantee that you will be advised, evaluated and treated in good faith and to the best of our knowledge."),
  paragraph("The undersigned confirms that he/she is aware that the photographic and video material taken during the consultation belongs exclusively to his/her medical file, nevertheless:"),
  unorderedList([
    "The patient authorizes the use of photographic and video material for medical research, scientific presentations and as illustrative material, provided that his/her identity is not disclosed.",
    "The patient does not authorize the use of his/her photographic and video material under any circumstances.",
  ]),
];

const PREOPERATIVE_INSTRUCTIONS_EN_CONTENT: FormContentBlock[] = [
  paragraph("PREOPERATIVE INSTRUCTIONS"),
  paragraph("A consultation with the surgeon is necessary to establish the following linkages:"),
  unorderedList([
    "Place of the operation (Aesthetics Clinic / Private Clinic)",
    "Type of the operation according to the patient’s wishes.",
    "The price",
    "Type of anesthesia",
    "Insurance support",
    "Duration of the operation",
    "Medical Devices (belt, panty, bras)",
  ]),
  paragraph("For the organization of the operation you have to fix a preoperative appointment with the anaesthetist. During this appointement the doctor will:"),
  unorderedList([
    "Establish a blood test",
    "If necessary, others exams (depends on your age, type of the operation)",
    "US Breast if the operation is in relation with the breast",
    "Anesthetic survey must be filled",
  ]),
  paragraph("You will also have an appointment with the nurses. The purpose of this appointment is to:"),
  unorderedList([
    "Try medical devices (panty in case of liposuction).",
    "Inform patients of the necessary materials (bras after a breast operation).",
    "Inform patients of the preoperative instruction.",
    "The day before the operation take a shower.",
    "Do not wear wake-up, remove piercings/jewelry, no nail polish.",
    "Must be fasting at least 6 hours before the operation (no water, no food, no smoke).",
    "Come with a sport bra in case of a mammary augmentation.",
    "Sign up the informed consent.",
    "In case of anesthetic planning someone to go home.",
  ]),
];

const POSTOPERATIVE_INSTRUCTIONS_EN_CONTENT: FormContentBlock[] = [
  paragraph("POSTOPERATIVE INSTRUCTIONS"),
  paragraph("After the operation, a prescription of pain medication will be given in order to prevent the and also anti-inflammatory and antibiotocs."),
  unorderedList([
    "You need someone with you for your first night at home after the surgery.",
    "You must fix an appointment with the nurses to control and remove stitches (max 7 days after).",
    "Fix an appointment with the surgeon one month after the operation.",
    "Take showers after the day of the operation.",
  ]),
  paragraph("In case of an emergency:"),
  unorderedList([
    "Bad smells",
    "Redness",
    "Heat",
    "Edema",
    "Flowing",
  ]),
  paragraph("Phone the clinic directly 022 732 22 23 or the Dr Tenorio 076 378 11 73, if the clinic is closed."),
  paragraph("Always keep your medical devices."),
  unorderedList([
    "After the operation, you have to stop sports for at least one month (depends of the type of sports and the intervention).",
    "Protect yours scars from the sun for at least a year, then protect them with a sunscreen (high protection).",
    "Do not carry heavy things.",
    "After a liposuccion and/or breast augmentation, the patient should not take bath, sauna or hammam for at least a month.",
  ]),
];

const PREOPERATIVE_INSTRUCTIONS_FR_CONTENT: FormContentBlock[] = [
  paragraph("CONSIGNES PRÉ-OPÉRATOIRES"),
  paragraph("Une consultation est prévue avec le chirurgien afin d’établir les points suivants :"),
  unorderedList([
    "Lieu d’opération (ex : Aesthetics Clinic ou clinique privé)",
    "Quel type d’opération, en fonction du souhait de patient, des possibilités…",
    "Information concernant le prix",
    "Du type d’anesthésie",
    "Des prises en charges éventuelles (assurance, MedCapital)",
    "De la durée de l’intervention",
    "Des dispositifs médicaux post opératoires (soutien-gorge, panty, ceinture)",
  ]),
  paragraph("En vue de l’organisation de l’intervention, seront effectués :"),
  unorderedList([
    "Un bilan sanguin",
    "D’éventuels autres examens en fonction de l’âge du patient et du type d’intervention",
    "Un US mammaire si l’opération est en rapport avec la poitrine (augmentation mammaire, cure de gynécomastie)",
    "Un questionnaire anesthésiste sera également à remplir",
    "Vous aurez, également, un rendez-vous téléphonique avec un Anesthésiste.",
  ]),
  paragraph("Parallèlement à cela un échange avec l’infirmière est également prévu afin :"),
  unorderedList([
    "De discuter des consignes post opératoires.",
    "La veille et le matin de l’opération, prendre une douche de la tête aux pieds et dormir dans les draps propres.",
    "Ne pas se maquiller, enlever les bijoux et piercings.",
    "Être à jeun (ni manger, ni fumer) au moins 6 heures avant l’intervention.",
    "Venir avec le soutien-gorge de sport en cas d’augmentation mammaire, si vous en avez un.",
    "Signer le consentement éclairé.",
    "En cas de sédation, prévoir un accompagnement pour le retour à domicile.",
  ]),
];

const POSTOPERATIVE_INSTRUCTIONS_FR_CONTENT: FormContentBlock[] = [
  paragraph("CONSIGNES POST-OPÉRATOIRES"),
  paragraph("Après l’intervention, une ordonnance d’antalgique vous sera envoyée par mail afin de prévenir le risque de douleur mais également des anti-inflammatoires et des antibiotiques dépendant du type d’intervention."),
  unorderedList([
    "Il faut être accompagné en cas de sédation pour le retour à domicile.",
    "Ne pas être seul lors de la première nuit qui suit l’intervention.",
    "Prévoir un rendez-vous postopératoire avec les infirmières afin de réaliser un contrôle et un retrait des points à J+7.",
    "Prévoir un rendez-vous de contrôle avec le chirurgien 1 Mois après l’intervention.",
    "Se doucher tous les jours dès J+1 postopératoire.",
  ]),
  paragraph("Si problèmes :"),
  unorderedList([
    "Une odeur",
    "Rougeurs",
    "Chaleurs",
    "Œdème",
    "Écoulement",
  ]),
  paragraph("Téléphoner immédiatement à la clinque au 022 732 22 23 ou directement au Dr Tenorio au 076 378 11 73, si la clinique est fermée."),
  paragraph("Garder les dispositifs médicaux (panty, soutien-gorge de sport)."),
  unorderedList([
    "Après l’intervention l’arrêt du sport est nécessaire, pendant 1 mois (cela dépend du type de sport pratiquer et de l’intervention).",
    "Protéger les cicatrices contre l’exposition au soleil durant une année et les protéger avec une crème solaire avec un indice de 50.",
    "Ne pas porter de charges lourdes.",
    "Après une liposuccion et/ou une augmentation mammaire, le patient ne doit pas prendre de bain, de sauna, hammam durant une période de 1 mois.",
  ]),
];

const yesNoOptions = [
  { value: "yes", label: "Yes", labelFr: "Oui" },
  { value: "no", label: "No", labelFr: "Non" },
];

const alcoholOptions = [
  { value: "never", label: "Never", labelFr: "Jamais" },
  { value: "occasionally", label: "Occasionally", labelFr: "À l’occasion" },
  { value: "regularly", label: "Regularly", labelFr: "Régulièrement" },
];

const activityOptions = [
  { value: "athletic", label: "Athletic", labelFr: "Sportif" },
  { value: "active", label: "Active", labelFr: "Actif" },
  { value: "sedentary", label: "Sedentary", labelFr: "Sédentaire" },
];

const anesthesiaTypeOptions = [
  { value: "general", label: "General anesthesia", labelFr: "Complète" },
  { value: "spinal_epidural", label: "Spinal block or epidural anesthesia", labelFr: "Péridurale ou rachidienne" },
  { value: "local", label: "Local anesthesia", labelFr: "Locale" },
];

const ANESTHESIA_QUESTIONNAIRE_FR_SECTIONS: FormSection[] = [
  {
    id: "personal-info",
    title: "Personal Information",
    titleFr: "Informations personnelles",
    fields: [
      { id: "last_name", type: "text", label: "Surname", labelFr: "Nom", required: true },
      { id: "first_name", type: "text", label: "Name", labelFr: "Prénom", required: true },
      { id: "date_of_birth", type: "date", label: "Date of Birth", labelFr: "Né(e) le", required: true },
      { id: "height", type: "number", label: "Height (cm)", labelFr: "Taille (cm)", required: true },
      { id: "weight", type: "number", label: "Weight (kg)", labelFr: "Poids (kg)", required: true },
      { id: "attending_physician", type: "text", label: "Attending physician", labelFr: "Médecin traitant" },
      { id: "operation_date", type: "date", label: "Date of your operation", labelFr: "Date de votre opération" },
      { id: "surgeon", type: "text", label: "Surgeon", labelFr: "Chirurgien" },
      { id: "insurance_number", type: "text", label: "N°CADA insurance", labelFr: "N°CADA assurance", placeholder: "80756..." },
      { id: "private_phone", type: "phone", label: "Private phone", labelFr: "Tél privé" },
    ],
  },
  {
    id: "treatment-medication",
    title: "Treatment and Medication",
    titleFr: "Traitements et médicaments",
    fields: [
      { id: "recent_medical_treatment", type: "radio", label: "Have you had any medical treatment in recent months?", labelFr: "Avez-vous eu un traitement médical ces derniers mois ?", options: yesNoOptions },
      { id: "recent_medical_treatment_details", type: "textarea", label: "If yes, which one?", labelFr: "Si oui, lequel ?" },
      { id: "daily_medication", type: "radio", label: "Do you take medication every day, including sleeping pills, laxatives, aspirin and homeopathic medicines?", labelFr: "Prenez-vous des médicaments tous les jours, y compris somnifères, laxatifs, aspirine et médicaments homéopathiques ?", options: yesNoOptions },
      { id: "daily_medication_details", type: "textarea", label: "If yes, which one?", labelFr: "Si oui, lequel ?" },
      { id: "recent_fever", type: "radio", label: "Have you had a fever in the past few days?", labelFr: "Avez-vous eu de la fièvre ces derniers jours ?", options: yesNoOptions },
    ],
  },
  {
    id: "allergies-anesthesia-history",
    title: "Allergies and Anesthesia History",
    titleFr: "Allergies et antécédents d’anesthésie",
    fields: [
      { id: "allergies", type: "radio", label: "Do you have allergies to drugs, dressings, food or disinfectants?", labelFr: "Avez-vous des allergies aux médicaments, pansements, aliments ou désinfectants ?", options: yesNoOptions },
      { id: "allergy_skin_rash", type: "checkbox", label: "Rashes", labelFr: "Éruption cutanée" },
      { id: "allergy_angioedema", type: "checkbox", label: "Angioedema", labelFr: "Œdème de Quincke" },
      { id: "allergy_breathing_difficulty", type: "checkbox", label: "Breathing difficulties", labelFr: "Difficultés respiratoires" },
      { id: "allergy_anaphylactic_shock", type: "checkbox", label: "Anaphylactic shock", labelFr: "Choc anaphylactique" },
      { id: "allergy_details", type: "textarea", label: "Which allergies?", labelFr: "Lesquelles ?" },
      { id: "previous_operation_1", type: "text", label: "Previous operation 1", labelFr: "Opération précédente 1" },
      { id: "previous_operation_1_year", type: "number", label: "Year", labelFr: "Année" },
      { id: "previous_operation_1_anesthesia", type: "select", label: "Type of anesthesia", labelFr: "Type d’anesthésie", options: anesthesiaTypeOptions },
      { id: "previous_operation_2", type: "text", label: "Previous operation 2", labelFr: "Opération précédente 2" },
      { id: "previous_operation_2_year", type: "number", label: "Year", labelFr: "Année" },
      { id: "previous_operation_2_anesthesia", type: "select", label: "Type of anesthesia", labelFr: "Type d’anesthésie", options: anesthesiaTypeOptions },
      { id: "additional_previous_operations", type: "textarea", label: "If more operations, please specify the operation, year and type of anesthesia", labelFr: "Si plus d’opérations, veuillez préciser l’opération, l’année et le type d’anesthésie" },
      { id: "anesthesia_problems", type: "radio", label: "Have you had any particular problems with anesthesia, such as nausea, vomiting or difficulties waking up?", labelFr: "Avez-vous eu des problèmes particuliers en rapport avec l’anesthésie, tels que nausées, vomissements ou difficultés de réveil ?", options: yesNoOptions },
      { id: "anesthesia_problems_details", type: "textarea", label: "If yes, which ones?", labelFr: "Si oui, lesquels ?" },
      { id: "family_anesthesia_problems", type: "radio", label: "Did one of your close relatives have problems during anesthesia?", labelFr: "Un de vos proches parents a-t-il eu des problèmes lors d’une anesthésie ?", options: yesNoOptions },
      { id: "family_anesthesia_problems_details", type: "textarea", label: "If yes, which ones?", labelFr: "Si oui, lesquels ?" },
    ],
  },
  {
    id: "medical-problems",
    title: "Medical Problems",
    titleFr: "Problèmes médicaux",
    description: "Did you have or do you have the following problems?",
    descriptionFr: "Avez-vous eu ou avez-vous les problèmes suivants ?",
    fields: [
      { id: "heart_problems", type: "checkbox", label: "Heart problems", labelFr: "Problèmes cardiaques" },
      { id: "vascular_problems", type: "checkbox", label: "Circulation / vascular problems", labelFr: "Problèmes vasculaires" },
      { id: "respiratory_problems", type: "checkbox", label: "Lung / respiratory problems", labelFr: "Problèmes respiratoires" },
      { id: "nervous_system_problems", type: "checkbox", label: "Nervous system problems", labelFr: "Problèmes nerveux" },
      { id: "urinary_problems", type: "checkbox", label: "Urinary system problems", labelFr: "Problèmes urinaires" },
      { id: "metabolic_problems", type: "checkbox", label: "Metabolic problems", labelFr: "Problèmes métaboliques" },
      { id: "infectious_diseases", type: "checkbox", label: "Infectious diseases", labelFr: "Problèmes infectieux" },
      { id: "digestive_liver_problems", type: "checkbox", label: "Digestive system / liver problems", labelFr: "Problèmes digestifs ou hépatiques" },
      { id: "eye_problems", type: "checkbox", label: "Ophthalmology problems", labelFr: "Problèmes oculaires" },
      { id: "medical_problems_details", type: "textarea", label: "Details", labelFr: "Précisions" },
      { id: "other_disease", type: "radio", label: "Do you have a disease that is not mentioned in the previous list?", labelFr: "Avez-vous une maladie qui n’est pas mentionnée dans la liste précédente ?", options: yesNoOptions },
      { id: "other_disease_details", type: "textarea", label: "If yes, which one?", labelFr: "Si oui, laquelle ?" },
      { id: "prolonged_bleeding", type: "radio", label: "Are you prone to prolonged bleeding?", labelFr: "Êtes-vous sujet aux saignements prolongés ?", options: yesNoOptions },
    ],
  },
  {
    id: "dental-devices",
    title: "Dental, Prosthetic and Medical Devices",
    titleFr: "Dents, prothèses et dispositifs médicaux",
    description: "Do you have any of the following?",
    descriptionFr: "Avez-vous un des éléments suivants ?",
    fields: [
      { id: "bridge", type: "checkbox", label: "Bridge", labelFr: "Bridge" },
      { id: "loose_teeth", type: "checkbox", label: "Loose teeth", labelFr: "Dents branlantes" },
      { id: "pivot_tooth", type: "checkbox", label: "Pivot tooth", labelFr: "Dent à pivot" },
      { id: "veneers", type: "checkbox", label: "Veneers", labelFr: "Facettes" },
      { id: "dental_prosthesis", type: "checkbox", label: "Dental prosthesis", labelFr: "Prothèse dentaire" },
      { id: "hearing_aid", type: "checkbox", label: "Hearing aid", labelFr: "Prothèse auditive" },
      { id: "pacemaker", type: "checkbox", label: "Pacemaker", labelFr: "Pace maker" },
      { id: "contact_lenses", type: "checkbox", label: "Contact lenses", labelFr: "Lentilles de contact" },
    ],
  },
  {
    id: "lifestyle",
    title: "Lifestyle",
    titleFr: "Mode de vie",
    fields: [
      { id: "smoker", type: "radio", label: "Do you smoke or have you smoked?", labelFr: "Fumez-vous ou avez-vous fumé ?", options: yesNoOptions },
      { id: "cigarettes_per_day", type: "number", label: "How many cigarettes per day?", labelFr: "Combien de cigarettes par jour ?" },
      { id: "smoking_duration", type: "text", label: "For how long?", labelFr: "Depuis combien de temps / pendant combien de temps ?" },
      { id: "drug_use", type: "radio", label: "Do you use drugs?", labelFr: "Consommez-vous des drogues ?", options: yesNoOptions },
      { id: "drug_use_details", type: "textarea", label: "If yes, which one?", labelFr: "Si oui, laquelle ?" },
      { id: "alcohol", type: "radio", label: "Do you drink alcohol?", labelFr: "Buvez-vous de l’alcool ?", options: alcoholOptions },
      { id: "activity_level", type: "radio", label: "Are you rather?", labelFr: "Êtes-vous plutôt ?", options: activityOptions },
    ],
  },
  {
    id: "other-emergency",
    title: "Other Information and Emergency Contact",
    titleFr: "Autres informations et contact d’urgence",
    fields: [
      { id: "other_particularity", type: "textarea", label: "Another feature not mentioned previously?", labelFr: "Autre particularité non mentionnée précédemment ?" },
      { id: "emergency_contact_name", type: "text", label: "Emergency contact name", labelFr: "Nom du proche à contacter en cas d’urgence" },
      { id: "emergency_contact_phone", type: "phone", label: "Emergency contact phone", labelFr: "Téléphone du proche" },
      { id: "emergency_contact_relationship", type: "text", label: "Relationship to this person", labelFr: "Lien avec cette personne" },
    ],
  },
  {
    id: "women",
    title: "For Women",
    titleFr: "Pour les femmes",
    fields: [
      { id: "contraceptive_pill", type: "radio", label: "Are you taking the contraceptive pill?", labelFr: "Prenez-vous la pilule ?", options: yesNoOptions },
      { id: "pregnant_or_likely", type: "radio", label: "Are you pregnant or likely to be?", labelFr: "Êtes-vous enceinte ou susceptible de l’être ?", options: yesNoOptions },
      { id: "breastfeeding", type: "radio", label: "Are you breastfeeding?", labelFr: "Allaitez-vous ?", options: yesNoOptions },
    ],
  },
  {
    id: "acknowledgment",
    title: "Acknowledgment",
    titleFr: "Reconnaissance",
    fields: [
      { id: "information_accurate", type: "checkbox", label: "I confirm that all information provided is accurate", labelFr: "Je confirme que toutes les informations fournies sont exactes", required: true },
      { id: "signature", type: "signature", label: "Signature", labelFr: "Signature", required: true },
      { id: "signature_date", type: "date", label: "Date", labelFr: "Date", required: true },
    ],
  },
];

const ANESTHESIA_QUESTIONNAIRE_EN_SECTIONS: FormSection[] = ANESTHESIA_QUESTIONNAIRE_FR_SECTIONS.map((section) => ({
  ...section,
  title: section.id === "women" ? "For Women" : section.title,
  titleFr: undefined,
  descriptionFr: undefined,
  fields: section.fields.map((field) => ({
    ...field,
    labelFr: undefined,
    placeholderFr: undefined,
    helpTextFr: undefined,
    options: field.options?.map((option) => ({
      value: option.value,
      label: option.label,
    })),
  })),
}));

export const FORM_DEFINITIONS: FormDefinition[] = [
  // ===== ANESTHESIA QUESTIONNAIRE - FRENCH =====
  {
    id: "questionnaire-anesthesie-fr",
    name: "Anesthesia Questionnaire",
    nameFr: "Questionnaire d'anesthésie",
    description: "Pre-anesthesia medical questionnaire",
    descriptionFr: "Questionnaire médical pré-anesthésie",
    language: "fr",
    category: "questionnaire",
    originalFile: "FR - Questionnaire d'anesthésie.pdf",
    sections: [
      {
        id: "personal-info",
        title: "Personal Information",
        titleFr: "Informations personnelles",
        content: ANESTHESIA_QUESTIONNAIRE_FR_CONTENT,
        fields: [
          { id: "full_name", type: "text", label: "Full Name", labelFr: "Nom complet", required: true },
          { id: "date_of_birth", type: "date", label: "Date of Birth", labelFr: "Date de naissance", required: true },
          { id: "weight", type: "number", label: "Weight (kg)", labelFr: "Poids (kg)", required: true },
          { id: "height", type: "number", label: "Height (cm)", labelFr: "Taille (cm)", required: true },
        ],
      },
      {
        id: "medical-history",
        title: "Medical History",
        titleFr: "Antécédents médicaux",
        fields: [
          { id: "heart_disease", type: "checkbox", label: "Heart disease", labelFr: "Maladie cardiaque" },
          { id: "hypertension", type: "checkbox", label: "High blood pressure", labelFr: "Hypertension artérielle" },
          { id: "diabetes", type: "checkbox", label: "Diabetes", labelFr: "Diabète" },
          { id: "asthma", type: "checkbox", label: "Asthma / Respiratory problems", labelFr: "Asthme / Problèmes respiratoires" },
          { id: "allergies", type: "checkbox", label: "Known allergies", labelFr: "Allergies connues" },
          { id: "allergies_details", type: "textarea", label: "If yes, please specify", labelFr: "Si oui, veuillez préciser", placeholder: "List any allergies..." },
          { id: "bleeding_disorders", type: "checkbox", label: "Bleeding disorders", labelFr: "Troubles de la coagulation" },
          { id: "thyroid_problems", type: "checkbox", label: "Thyroid problems", labelFr: "Problèmes de thyroïde" },
          { id: "kidney_disease", type: "checkbox", label: "Kidney disease", labelFr: "Maladie rénale" },
          { id: "liver_disease", type: "checkbox", label: "Liver disease", labelFr: "Maladie hépatique" },
          { id: "neurological_disorders", type: "checkbox", label: "Neurological disorders", labelFr: "Troubles neurologiques" },
          { id: "previous_surgeries", type: "textarea", label: "Previous surgeries", labelFr: "Chirurgies antérieures", placeholder: "List previous surgeries with dates..." },
        ],
      },
      {
        id: "medications",
        title: "Current Medications",
        titleFr: "Médicaments actuels",
        fields: [
          { id: "taking_medications", type: "radio", label: "Are you currently taking any medications?", labelFr: "Prenez-vous actuellement des médicaments?", options: [{ value: "yes", label: "Yes", labelFr: "Oui" }, { value: "no", label: "No", labelFr: "Non" }] },
          { id: "medications_list", type: "textarea", label: "List all medications", labelFr: "Liste des médicaments", placeholder: "Include name, dosage, and frequency..." },
          { id: "blood_thinners", type: "checkbox", label: "Blood thinners (Aspirin, Warfarin, etc.)", labelFr: "Anticoagulants (Aspirine, Warfarine, etc.)" },
          { id: "supplements", type: "textarea", label: "Vitamins/Supplements", labelFr: "Vitamines/Compléments", placeholder: "List any supplements..." },
        ],
      },
      {
        id: "lifestyle",
        title: "Lifestyle",
        titleFr: "Mode de vie",
        fields: [
          { id: "smoker", type: "radio", label: "Do you smoke?", labelFr: "Fumez-vous?", options: [{ value: "yes", label: "Yes", labelFr: "Oui" }, { value: "no", label: "No", labelFr: "Non" }, { value: "former", label: "Former smoker", labelFr: "Ancien fumeur" }] },
          { id: "smoking_details", type: "text", label: "If yes, how many per day?", labelFr: "Si oui, combien par jour?" },
          { id: "alcohol", type: "radio", label: "Do you consume alcohol?", labelFr: "Consommez-vous de l'alcool?", options: [{ value: "no", label: "No", labelFr: "Non" }, { value: "occasionally", label: "Occasionally", labelFr: "Occasionnellement" }, { value: "regularly", label: "Regularly", labelFr: "Régulièrement" }] },
          { id: "recreational_drugs", type: "radio", label: "Do you use recreational drugs?", labelFr: "Utilisez-vous des drogues récréatives?", options: [{ value: "yes", label: "Yes", labelFr: "Oui" }, { value: "no", label: "No", labelFr: "Non" }] },
        ],
      },
      {
        id: "anesthesia-history",
        title: "Anesthesia History",
        titleFr: "Antécédents d'anesthésie",
        fields: [
          { id: "previous_anesthesia", type: "radio", label: "Have you had anesthesia before?", labelFr: "Avez-vous déjà eu une anesthésie?", options: [{ value: "yes", label: "Yes", labelFr: "Oui" }, { value: "no", label: "No", labelFr: "Non" }] },
          { id: "anesthesia_complications", type: "checkbox", label: "Any complications with previous anesthesia?", labelFr: "Complications lors d'anesthésies précédentes?" },
          { id: "anesthesia_complications_details", type: "textarea", label: "If yes, please describe", labelFr: "Si oui, veuillez décrire" },
          { id: "family_anesthesia_problems", type: "checkbox", label: "Family history of anesthesia problems", labelFr: "Antécédents familiaux de problèmes d'anesthésie" },
          { id: "malignant_hyperthermia", type: "checkbox", label: "Personal or family history of malignant hyperthermia", labelFr: "Antécédents personnels ou familiaux d'hyperthermie maligne" },
        ],
      },
      {
        id: "consent",
        title: "Acknowledgment",
        titleFr: "Reconnaissance",
        fields: [
          { id: "information_accurate", type: "checkbox", label: "I confirm that all information provided is accurate", labelFr: "Je confirme que toutes les informations fournies sont exactes", required: true },
          { id: "signature", type: "signature", label: "Signature", labelFr: "Signature", required: true },
          { id: "signature_date", type: "date", label: "Date", labelFr: "Date", required: true },
        ],
      },
    ],
  },

  // ===== ANESTHESIA QUESTIONNAIRE - ENGLISH =====
  {
    id: "questionnaire-anesthesie-en",
    name: "Anesthesia Questionnaire",
    nameFr: "Questionnaire d'anesthésie",
    description: "Pre-anesthesia medical questionnaire",
    descriptionFr: "Questionnaire médical pré-anesthésie",
    language: "en",
    category: "questionnaire",
    originalFile: "EN - Questionnaire d'anesthésie  (1).pdf",
    sections: [
      {
        id: "personal-info",
        title: "Personal Information",
        content: ANESTHESIA_QUESTIONNAIRE_EN_CONTENT,
        fields: [
          { id: "full_name", type: "text", label: "Full Name", required: true },
          { id: "date_of_birth", type: "date", label: "Date of Birth", required: true },
          { id: "weight", type: "number", label: "Weight (kg)", required: true },
          { id: "height", type: "number", label: "Height (cm)", required: true },
        ],
      },
      {
        id: "medical-history",
        title: "Medical History",
        fields: [
          { id: "heart_disease", type: "checkbox", label: "Heart disease" },
          { id: "hypertension", type: "checkbox", label: "High blood pressure" },
          { id: "diabetes", type: "checkbox", label: "Diabetes" },
          { id: "asthma", type: "checkbox", label: "Asthma / Respiratory problems" },
          { id: "allergies", type: "checkbox", label: "Known allergies" },
          { id: "allergies_details", type: "textarea", label: "If yes, please specify", placeholder: "List any allergies..." },
          { id: "bleeding_disorders", type: "checkbox", label: "Bleeding disorders" },
          { id: "thyroid_problems", type: "checkbox", label: "Thyroid problems" },
          { id: "kidney_disease", type: "checkbox", label: "Kidney disease" },
          { id: "liver_disease", type: "checkbox", label: "Liver disease" },
          { id: "neurological_disorders", type: "checkbox", label: "Neurological disorders" },
          { id: "previous_surgeries", type: "textarea", label: "Previous surgeries", placeholder: "List previous surgeries with dates..." },
        ],
      },
      {
        id: "medications",
        title: "Current Medications",
        fields: [
          { id: "taking_medications", type: "radio", label: "Are you currently taking any medications?", options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
          { id: "medications_list", type: "textarea", label: "List all medications", placeholder: "Include name, dosage, and frequency..." },
          { id: "blood_thinners", type: "checkbox", label: "Blood thinners (Aspirin, Warfarin, etc.)" },
          { id: "supplements", type: "textarea", label: "Vitamins/Supplements", placeholder: "List any supplements..." },
        ],
      },
      {
        id: "lifestyle",
        title: "Lifestyle",
        fields: [
          { id: "smoker", type: "radio", label: "Do you smoke?", options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }, { value: "former", label: "Former smoker" }] },
          { id: "smoking_details", type: "text", label: "If yes, how many per day?" },
          { id: "alcohol", type: "radio", label: "Do you consume alcohol?", options: [{ value: "no", label: "No" }, { value: "occasionally", label: "Occasionally" }, { value: "regularly", label: "Regularly" }] },
          { id: "recreational_drugs", type: "radio", label: "Do you use recreational drugs?", options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
        ],
      },
      {
        id: "anesthesia-history",
        title: "Anesthesia History",
        fields: [
          { id: "previous_anesthesia", type: "radio", label: "Have you had anesthesia before?", options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
          { id: "anesthesia_complications", type: "checkbox", label: "Any complications with previous anesthesia?" },
          { id: "anesthesia_complications_details", type: "textarea", label: "If yes, please describe" },
          { id: "family_anesthesia_problems", type: "checkbox", label: "Family history of anesthesia problems" },
          { id: "malignant_hyperthermia", type: "checkbox", label: "Personal or family history of malignant hyperthermia" },
        ],
      },
      {
        id: "consent",
        title: "Acknowledgment",
        fields: [
          { id: "information_accurate", type: "checkbox", label: "I confirm that all information provided is accurate", required: true },
          { id: "signature", type: "signature", label: "Signature", required: true },
          { id: "signature_date", type: "date", label: "Date", required: true },
        ],
      },
    ],
  },

  // ===== ANESTHESIA CONSENT - FRENCH =====
  {
    id: "consentement-anesthesie-fr",
    name: "Anesthesia Consent",
    nameFr: "Consentement anesthésie",
    description: "Consent form for anesthesia procedures",
    descriptionFr: "Formulaire de consentement pour les procédures d'anesthésie",
    language: "fr",
    category: "consent",
    originalFile: "Consentement anesthésie - Aesthetics (2).pdf",
    sections: [
      {
        id: "patient-info",
        title: "Patient Information",
        titleFr: "Informations du patient",
        fields: [
          { id: "full_name", type: "text", label: "Full Name", labelFr: "Nom complet", required: true },
          { id: "date_of_birth", type: "date", label: "Date of Birth", labelFr: "Date de naissance", required: true },
          { id: "procedure_date", type: "date", label: "Planned Procedure Date", labelFr: "Date de l'intervention prévue", required: true },
        ],
      },
      {
        id: "anesthesia-type",
        title: "Type of Anesthesia",
        titleFr: "Type d'anesthésie",
        fields: [
          { id: "anesthesia_type", type: "select", label: "Type of anesthesia planned", labelFr: "Type d'anesthésie prévue", required: true, options: [
            { value: "general", label: "General anesthesia", labelFr: "Anesthésie générale" },
            { value: "local", label: "Local anesthesia", labelFr: "Anesthésie locale" },
            { value: "sedation", label: "Sedation", labelFr: "Sédation" },
            { value: "regional", label: "Regional anesthesia", labelFr: "Anesthésie régionale" },
          ]},
        ],
      },
      {
        id: "risks-acknowledgment",
        title: "Risk Acknowledgment",
        titleFr: "Reconnaissance des risques",
        description: "I acknowledge that I have been informed about the risks associated with anesthesia.",
        descriptionFr: "Je reconnais avoir été informé(e) des risques associés à l'anesthésie.",
        content: ANESTHESIA_CONSENT_FR_CONTENT,
        fields: [
          { id: "understood_risks", type: "checkbox", label: "I understand that anesthesia carries certain risks including but not limited to: allergic reactions, breathing difficulties, cardiovascular complications, and in rare cases, death.", labelFr: "Je comprends que l'anesthésie comporte certains risques, notamment: réactions allergiques, difficultés respiratoires, complications cardiovasculaires et, dans de rares cas, décès.", required: true },
          { id: "questions_answered", type: "checkbox", label: "I have had the opportunity to ask questions and they have been answered to my satisfaction", labelFr: "J'ai eu l'occasion de poser des questions et elles ont été répondues à ma satisfaction", required: true },
          { id: "fasting_instructions", type: "checkbox", label: "I understand and will follow the fasting instructions (no food or drink for the specified time before surgery)", labelFr: "Je comprends et suivrai les instructions de jeûne (pas de nourriture ni de boisson pendant le temps spécifié avant la chirurgie)", required: true },
        ],
      },
      {
        id: "consent",
        title: "Consent",
        titleFr: "Consentement",
        fields: [
          { id: "consent_given", type: "checkbox", label: "I consent to receive anesthesia as described above", labelFr: "Je consens à recevoir l'anesthésie telle que décrite ci-dessus", required: true },
          { id: "signature", type: "signature", label: "Patient Signature", labelFr: "Signature du patient", required: true },
          { id: "signature_date", type: "date", label: "Date", labelFr: "Date", required: true },
        ],
      },
    ],
  },

  // ===== ANESTHESIA CONSENT - ENGLISH =====
  {
    id: "consentement-anesthesie-en",
    name: "Anesthesia Consent",
    nameFr: "Consentement anesthésie",
    description: "Consent form for anesthesia procedures",
    descriptionFr: "Formulaire de consentement pour les procédures d'anesthésie",
    language: "en",
    category: "consent",
    originalFile: "EN - Consentement anesthésie (1).pdf",
    sections: [
      {
        id: "patient-info",
        title: "Patient Information",
        fields: [
          { id: "full_name", type: "text", label: "Full Name", required: true },
          { id: "date_of_birth", type: "date", label: "Date of Birth", required: true },
          { id: "procedure_date", type: "date", label: "Planned Procedure Date", required: true },
        ],
      },
      {
        id: "anesthesia-type",
        title: "Type of Anesthesia",
        fields: [
          { id: "anesthesia_type", type: "select", label: "Type of anesthesia planned", required: true, options: [
            { value: "general", label: "General anesthesia" },
            { value: "local", label: "Local anesthesia" },
            { value: "sedation", label: "Sedation" },
            { value: "regional", label: "Regional anesthesia" },
          ]},
        ],
      },
      {
        id: "risks-acknowledgment",
        title: "Risk Acknowledgment",
        description: "I acknowledge that I have been informed about the risks associated with anesthesia.",
        content: ANESTHESIA_CONSENT_EN_CONTENT,
        fields: [
          { id: "understood_risks", type: "checkbox", label: "I understand that anesthesia carries certain risks including but not limited to: allergic reactions, breathing difficulties, cardiovascular complications, and in rare cases, death.", required: true },
          { id: "questions_answered", type: "checkbox", label: "I have had the opportunity to ask questions and they have been answered to my satisfaction", required: true },
          { id: "fasting_instructions", type: "checkbox", label: "I understand and will follow the fasting instructions (no food or drink for the specified time before surgery)", required: true },
        ],
      },
      {
        id: "consent",
        title: "Consent",
        fields: [
          { id: "consent_given", type: "checkbox", label: "I consent to receive anesthesia as described above", required: true },
          { id: "signature", type: "signature", label: "Patient Signature", required: true },
          { id: "signature_date", type: "date", label: "Date", required: true },
        ],
      },
    ],
  },

  // ===== INFORMED CONSENT - BREAST AUGMENTATION (FRENCH) =====
  {
    id: "consentement-augmentation-mammaire-fr",
    name: "Informed Consent - Breast Augmentation",
    nameFr: "Consentement éclairé - Augmentation mammaire",
    description: "Informed consent form for breast augmentation surgery",
    descriptionFr: "Formulaire de consentement éclairé pour chirurgie d'augmentation mammaire",
    language: "fr",
    category: "consent",
    originalFile: "Annexe AM FR.docx",
    sections: [
      {
        id: "patient-info",
        title: "Patient Information",
        titleFr: "Informations du patient",
        fields: [
          { id: "full_name", type: "text", label: "Full Name", labelFr: "Nom complet", required: true },
          { id: "date_of_birth", type: "date", label: "Date of Birth", labelFr: "Date de naissance", required: true },
          { id: "procedure_date", type: "date", label: "Planned Surgery Date", labelFr: "Date de chirurgie prévue", required: true },
        ],
      },
      {
        id: "procedure-details",
        title: "Procedure Details",
        titleFr: "Détails de l'intervention",
        fields: [
          { id: "implant_type", type: "select", label: "Implant Type", labelFr: "Type d'implant", options: [
            { value: "silicone", label: "Silicone", labelFr: "Silicone" },
            { value: "saline", label: "Saline", labelFr: "Sérum physiologique" },
          ]},
          { id: "implant_placement", type: "select", label: "Implant Placement", labelFr: "Placement de l'implant", options: [
            { value: "submuscular", label: "Under the muscle", labelFr: "Sous le muscle" },
            { value: "subglandular", label: "Over the muscle", labelFr: "Sur le muscle" },
            { value: "dual_plane", label: "Dual plane", labelFr: "Double plan" },
          ]},
          { id: "incision_location", type: "select", label: "Incision Location", labelFr: "Emplacement de l'incision", options: [
            { value: "inframammary", label: "Under the breast fold", labelFr: "Sous le pli mammaire" },
            { value: "periareolar", label: "Around the areola", labelFr: "Autour de l'aréole" },
            { value: "axillary", label: "Under the arm", labelFr: "Sous le bras" },
          ]},
        ],
      },
      {
        id: "risks",
        title: "Risks and Complications",
        titleFr: "Risques et complications",
        description: "I acknowledge understanding the following potential risks:",
        descriptionFr: "Je reconnais comprendre les risques potentiels suivants:",
        content: BREAST_AUGMENTATION_FR_CONTENT,
        fields: [
          { id: "risk_infection", type: "checkbox", label: "Infection", labelFr: "Infection", required: true },
          { id: "risk_bleeding", type: "checkbox", label: "Bleeding and hematoma", labelFr: "Saignement et hématome", required: true },
          { id: "risk_capsular", type: "checkbox", label: "Capsular contracture", labelFr: "Contracture capsulaire", required: true },
          { id: "risk_sensation", type: "checkbox", label: "Changes in nipple or breast sensation", labelFr: "Changements de sensation du mamelon ou du sein", required: true },
          { id: "risk_asymmetry", type: "checkbox", label: "Asymmetry", labelFr: "Asymétrie", required: true },
          { id: "risk_rupture", type: "checkbox", label: "Implant rupture or leak", labelFr: "Rupture ou fuite de l'implant", required: true },
          { id: "risk_revision", type: "checkbox", label: "Need for revision surgery", labelFr: "Nécessité d'une chirurgie de révision", required: true },
        ],
      },
      {
        id: "consent",
        title: "Consent",
        titleFr: "Consentement",
        fields: [
          { id: "procedure_explained", type: "checkbox", label: "The procedure has been explained to me in detail", labelFr: "L'intervention m'a été expliquée en détail", required: true },
          { id: "questions_answered", type: "checkbox", label: "I have had the opportunity to ask questions", labelFr: "J'ai eu l'occasion de poser des questions", required: true },
          { id: "consent_given", type: "checkbox", label: "I consent to undergo breast augmentation surgery", labelFr: "Je consens à subir une chirurgie d'augmentation mammaire", required: true },
          { id: "signature", type: "signature", label: "Patient Signature", labelFr: "Signature du patient", required: true },
          { id: "signature_date", type: "date", label: "Date", labelFr: "Date", required: true },
        ],
      },
    ],
  },

  // ===== INFORMED CONSENT - BREAST AUGMENTATION (ENGLISH) =====
  {
    id: "consentement-augmentation-mammaire-en",
    name: "Informed Consent - Breast Augmentation",
    nameFr: "Consentement éclairé - Augmentation mammaire",
    description: "Informed consent form for breast augmentation surgery",
    descriptionFr: "Formulaire de consentement éclairé pour chirurgie d'augmentation mammaire",
    language: "en",
    category: "consent",
    originalFile: "Informed breast augmentation ENG.docx",
    sections: [
      {
        id: "patient-info",
        title: "Patient Information",
        fields: [
          { id: "full_name", type: "text", label: "Full Name", required: true },
          { id: "date_of_birth", type: "date", label: "Date of Birth", required: true },
          { id: "procedure_date", type: "date", label: "Planned Surgery Date", required: true },
        ],
      },
      {
        id: "procedure-details",
        title: "Procedure Details",
        fields: [
          { id: "implant_type", type: "select", label: "Implant Type", options: [
            { value: "silicone", label: "Silicone" },
            { value: "saline", label: "Saline" },
          ]},
          { id: "implant_placement", type: "select", label: "Implant Placement", options: [
            { value: "submuscular", label: "Under the muscle" },
            { value: "subglandular", label: "Over the muscle" },
            { value: "dual_plane", label: "Dual plane" },
          ]},
          { id: "incision_location", type: "select", label: "Incision Location", options: [
            { value: "inframammary", label: "Under the breast fold" },
            { value: "periareolar", label: "Around the areola" },
            { value: "axillary", label: "Under the arm" },
          ]},
        ],
      },
      {
        id: "risks",
        title: "Risks and Complications",
        description: "I acknowledge understanding the following potential risks:",
        content: BREAST_AUGMENTATION_EN_CONTENT,
        fields: [
          { id: "risk_infection", type: "checkbox", label: "Infection", required: true },
          { id: "risk_bleeding", type: "checkbox", label: "Bleeding and hematoma", required: true },
          { id: "risk_capsular", type: "checkbox", label: "Capsular contracture", required: true },
          { id: "risk_sensation", type: "checkbox", label: "Changes in nipple or breast sensation", required: true },
          { id: "risk_asymmetry", type: "checkbox", label: "Asymmetry", required: true },
          { id: "risk_rupture", type: "checkbox", label: "Implant rupture or leak", required: true },
          { id: "risk_revision", type: "checkbox", label: "Need for revision surgery", required: true },
        ],
      },
      {
        id: "consent",
        title: "Consent",
        fields: [
          { id: "procedure_explained", type: "checkbox", label: "The procedure has been explained to me in detail", required: true },
          { id: "questions_answered", type: "checkbox", label: "I have had the opportunity to ask questions", required: true },
          { id: "consent_given", type: "checkbox", label: "I consent to undergo breast augmentation surgery", required: true },
          { id: "signature", type: "signature", label: "Patient Signature", required: true },
          { id: "signature_date", type: "date", label: "Date", required: true },
        ],
      },
    ],
  },

  // ===== INFORMED CONSENT - BREAST LIFT/REDUCTION (FRENCH) =====
  {
    id: "consentement-lift-reduction-fr",
    name: "Informed Consent - Breast Lift & Reduction",
    nameFr: "Consentement éclairé - Lifting et réduction mammaire",
    description: "Informed consent form for breast lift and reduction surgery",
    descriptionFr: "Formulaire de consentement éclairé pour chirurgie de lifting et réduction mammaire",
    language: "fr",
    category: "consent",
    originalFile: "Annexe Lift et Reduction FR copie.docx",
    sections: [
      {
        id: "patient-info",
        title: "Patient Information",
        titleFr: "Informations du patient",
        fields: [
          { id: "full_name", type: "text", label: "Full Name", labelFr: "Nom complet", required: true },
          { id: "date_of_birth", type: "date", label: "Date of Birth", labelFr: "Date de naissance", required: true },
          { id: "procedure_date", type: "date", label: "Planned Surgery Date", labelFr: "Date de chirurgie prévue", required: true },
        ],
      },
      {
        id: "procedure-type",
        title: "Procedure Type",
        titleFr: "Type d'intervention",
        fields: [
          { id: "procedure_type", type: "select", label: "Type of procedure", labelFr: "Type d'intervention", required: true, options: [
            { value: "lift", label: "Breast lift (mastopexy)", labelFr: "Lifting mammaire (mastopexie)" },
            { value: "reduction", label: "Breast reduction", labelFr: "Réduction mammaire" },
            { value: "both", label: "Lift with reduction", labelFr: "Lifting avec réduction" },
          ]},
        ],
      },
      {
        id: "risks",
        title: "Risks and Complications",
        titleFr: "Risques et complications",
        content: BREAST_LIFT_REDUCTION_FR_CONTENT,
        fields: [
          { id: "risk_scarring", type: "checkbox", label: "Permanent scarring", labelFr: "Cicatrices permanentes", required: true },
          { id: "risk_sensation", type: "checkbox", label: "Changes in nipple sensation", labelFr: "Changements de sensation du mamelon", required: true },
          { id: "risk_breastfeeding", type: "checkbox", label: "Potential impact on breastfeeding ability", labelFr: "Impact potentiel sur la capacité d'allaitement", required: true },
          { id: "risk_asymmetry", type: "checkbox", label: "Asymmetry", labelFr: "Asymétrie", required: true },
          { id: "risk_necrosis", type: "checkbox", label: "Tissue necrosis (rare)", labelFr: "Nécrose tissulaire (rare)", required: true },
        ],
      },
      {
        id: "consent",
        title: "Consent",
        titleFr: "Consentement",
        fields: [
          { id: "procedure_explained", type: "checkbox", label: "The procedure has been explained to me in detail", labelFr: "L'intervention m'a été expliquée en détail", required: true },
          { id: "consent_given", type: "checkbox", label: "I consent to undergo this surgery", labelFr: "Je consens à subir cette chirurgie", required: true },
          { id: "signature", type: "signature", label: "Patient Signature", labelFr: "Signature du patient", required: true },
          { id: "signature_date", type: "date", label: "Date", labelFr: "Date", required: true },
        ],
      },
    ],
  },
  {
    id: "consentement-lift-reduction-en",
    name: "Informed Consent - Breast Lift & Reduction",
    nameFr: "Consentement éclairé - Lifting et réduction mammaire",
    description: "Informed consent form for breast lift and reduction surgery",
    descriptionFr: "Formulaire de consentement éclairé pour chirurgie de lifting et réduction mammaire",
    language: "en",
    category: "consent",
    originalFile: "Annexe Lift et Reduction FR copie.docx",
    sections: [
      {
        id: "patient-info",
        title: "Patient Information",
        fields: [
          { id: "full_name", type: "text", label: "Full Name", required: true },
          { id: "date_of_birth", type: "date", label: "Date of Birth", required: true },
          { id: "procedure_date", type: "date", label: "Planned Surgery Date", required: true },
        ],
      },
      {
        id: "procedure-type",
        title: "Procedure Type",
        fields: [
          { id: "procedure_type", type: "select", label: "Type of procedure", required: true, options: [
            { value: "lift", label: "Breast lift (mastopexy)" },
            { value: "reduction", label: "Breast reduction" },
            { value: "both", label: "Lift with reduction" },
          ]},
        ],
      },
      {
        id: "risks",
        title: "Risks and Complications",
        content: BREAST_LIFT_REDUCTION_EN_CONTENT,
        fields: [
          { id: "risk_scarring", type: "checkbox", label: "Permanent scarring", required: true },
          { id: "risk_sensation", type: "checkbox", label: "Changes in nipple sensation", required: true },
          { id: "risk_breastfeeding", type: "checkbox", label: "Potential impact on breastfeeding ability", required: true },
          { id: "risk_asymmetry", type: "checkbox", label: "Asymmetry", required: true },
          { id: "risk_necrosis", type: "checkbox", label: "Tissue necrosis (rare)", required: true },
        ],
      },
      {
        id: "consent",
        title: "Consent",
        fields: [
          { id: "procedure_explained", type: "checkbox", label: "The procedure has been explained to me in detail", required: true },
          { id: "consent_given", type: "checkbox", label: "I consent to undergo this surgery", required: true },
          { id: "signature", type: "signature", label: "Patient Signature", required: true },
          { id: "signature_date", type: "date", label: "Date", required: true },
        ],
      },
    ],
  },

  // ===== GENERAL INFORMED CONSENT (FRENCH) =====
  {
    id: "consentement-eclaire-fr",
    name: "General Informed Consent",
    nameFr: "Consentement éclairé général",
    description: "General informed consent form for surgical procedures",
    descriptionFr: "Formulaire de consentement éclairé général pour interventions chirurgicales",
    language: "fr",
    category: "consent",
    originalFile: "CONSENTEMENT ÉCLAIRÉ.docx",
    sections: [
      {
        id: "patient-info",
        title: "Patient Information",
        titleFr: "Informations du patient",
        fields: [
          { id: "full_name", type: "text", label: "Full Name", labelFr: "Nom complet", required: true },
          { id: "date_of_birth", type: "date", label: "Date of Birth", labelFr: "Date de naissance", required: true },
          { id: "procedure_name", type: "text", label: "Planned Procedure", labelFr: "Intervention prévue", required: true },
          { id: "procedure_date", type: "date", label: "Planned Date", labelFr: "Date prévue", required: true },
        ],
      },
      {
        id: "acknowledgments",
        title: "Acknowledgments",
        titleFr: "Reconnaissances",
        content: GENERAL_INFORMED_CONSENT_FR_CONTENT,
        fields: [
          { id: "procedure_explained", type: "checkbox", label: "The nature and purpose of the procedure has been explained to me", labelFr: "La nature et le but de l'intervention m'ont été expliqués", required: true },
          { id: "risks_explained", type: "checkbox", label: "The risks, benefits, and alternatives have been explained to me", labelFr: "Les risques, avantages et alternatives m'ont été expliqués", required: true },
          { id: "questions_answered", type: "checkbox", label: "I have had the opportunity to ask questions and they have been answered satisfactorily", labelFr: "J'ai eu l'occasion de poser des questions et elles ont été répondues de manière satisfaisante", required: true },
          { id: "voluntary_consent", type: "checkbox", label: "I give my consent voluntarily", labelFr: "Je donne mon consentement volontairement", required: true },
        ],
      },
      {
        id: "consent",
        title: "Consent",
        titleFr: "Consentement",
        fields: [
          { id: "consent_given", type: "checkbox", label: "I consent to undergo the proposed procedure", labelFr: "Je consens à subir l'intervention proposée", required: true },
          { id: "signature", type: "signature", label: "Patient Signature", labelFr: "Signature du patient", required: true },
          { id: "signature_date", type: "date", label: "Date", labelFr: "Date", required: true },
        ],
      },
    ],
  },
  {
    id: "consentement-eclaire-en",
    name: "General Informed Consent",
    nameFr: "Consentement éclairé général",
    description: "General informed consent form for surgical procedures",
    descriptionFr: "Formulaire de consentement éclairé général pour interventions chirurgicales",
    language: "en",
    category: "consent",
    originalFile: "CONSENTEMENT ÉCLAIRÉ.docx",
    sections: [
      {
        id: "patient-info",
        title: "Patient Information",
        fields: [
          { id: "full_name", type: "text", label: "Full Name", required: true },
          { id: "date_of_birth", type: "date", label: "Date of Birth", required: true },
          { id: "procedure_name", type: "text", label: "Planned Procedure", required: true },
          { id: "procedure_date", type: "date", label: "Planned Date", required: true },
        ],
      },
      {
        id: "acknowledgments",
        title: "Acknowledgments",
        content: GENERAL_INFORMED_CONSENT_EN_CONTENT,
        fields: [
          { id: "procedure_explained", type: "checkbox", label: "The nature and purpose of the procedure has been explained to me", required: true },
          { id: "risks_explained", type: "checkbox", label: "The risks, benefits, and alternatives have been explained to me", required: true },
          { id: "questions_answered", type: "checkbox", label: "I have had the opportunity to ask questions and they have been answered satisfactorily", required: true },
          { id: "voluntary_consent", type: "checkbox", label: "I give my consent voluntarily", required: true },
        ],
      },
      {
        id: "consent",
        title: "Consent",
        fields: [
          { id: "consent_given", type: "checkbox", label: "I consent to undergo the proposed procedure", required: true },
          { id: "signature", type: "signature", label: "Patient Signature", required: true },
          { id: "signature_date", type: "date", label: "Date", required: true },
        ],
      },
    ],
  },

  // ===== PRE-OPERATIVE INSTRUCTIONS (ENGLISH) =====
  {
    id: "preoperative-instructions-en",
    name: "Pre and Post-operative Instructions",
    nameFr: "Consignes pré et post-opératoires",
    description: "Pre and post-operative instructions acknowledgment form",
    descriptionFr: "Formulaire de reconnaissance des consignes pré et post-opératoires",
    language: "en",
    category: "instructions",
    originalFile: "Preoperative instruction OP ENG.docx",
    sections: [
      {
        id: "patient-info",
        title: "Patient Information",
        fields: [
          { id: "full_name", type: "text", label: "Full Name", required: true },
          { id: "procedure_date", type: "date", label: "Surgery Date", required: true },
        ],
      },
      {
        id: "pre-op-checklist",
        title: "Pre-operative Checklist",
        description: "Please confirm you have been informed of and will follow these instructions:",
        content: PREOPERATIVE_INSTRUCTIONS_EN_CONTENT,
        fields: [
          { id: "fasting", type: "checkbox", label: "No food or drink after midnight before surgery", required: true },
          { id: "medications", type: "checkbox", label: "Stop blood thinners as instructed (Aspirin, Ibuprofen, Vitamin E, etc.)", required: true },
          { id: "smoking", type: "checkbox", label: "Stop smoking at least 2 weeks before surgery", required: true },
          { id: "alcohol", type: "checkbox", label: "Avoid alcohol 48 hours before surgery", required: true },
          { id: "makeup", type: "checkbox", label: "Remove all makeup, nail polish, and jewelry before surgery", required: true },
          { id: "clothing", type: "checkbox", label: "Wear loose, comfortable clothing on the day of surgery", required: true },
          { id: "transportation", type: "checkbox", label: "Arrange for someone to drive you home after surgery", required: true },
          { id: "caregiver", type: "checkbox", label: "Arrange for someone to stay with you for 24 hours after surgery", required: true },
        ],
      },
      {
        id: "contact-info",
        title: "Emergency Contact",
        fields: [
          { id: "emergency_contact_name", type: "text", label: "Emergency Contact Name", required: true },
          { id: "emergency_contact_phone", type: "phone", label: "Emergency Contact Phone", required: true },
          { id: "emergency_contact_relation", type: "text", label: "Relationship", required: true },
        ],
      },
      {
        id: "post-op-instructions",
        title: "Post-operative Instructions",
        content: POSTOPERATIVE_INSTRUCTIONS_EN_CONTENT,
        fields: [],
      },
      {
        id: "acknowledgment",
        title: "Acknowledgment",
        fields: [
          { id: "instructions_understood", type: "checkbox", label: "I have read and understood all instructions", required: true },
          { id: "signature", type: "signature", label: "Patient Signature", required: true },
          { id: "signature_date", type: "date", label: "Date", required: true },
        ],
      },
    ],
  },

  // ===== PRE AND POST-OPERATIVE INSTRUCTIONS (FRENCH) =====
  {
    id: "consignes-pre-post-op-fr",
    name: "Pre and Post-operative Instructions",
    nameFr: "Consignes pré et post-opératoires",
    description: "Pre and post-operative instructions acknowledgment form",
    descriptionFr: "Formulaire de reconnaissance des consignes pré et post-opératoires",
    language: "fr",
    category: "instructions",
    originalFile: "consignes pre et post op FR.docx",
    sections: [
      {
        id: "patient-info",
        title: "Patient Information",
        titleFr: "Informations du patient",
        fields: [
          { id: "full_name", type: "text", label: "Full Name", labelFr: "Nom complet", required: true },
          { id: "procedure_date", type: "date", label: "Surgery Date", labelFr: "Date de chirurgie", required: true },
        ],
      },
      {
        id: "pre-op-checklist",
        title: "Pre-operative Instructions",
        titleFr: "Consignes préopératoires",
        content: PREOPERATIVE_INSTRUCTIONS_FR_CONTENT,
        fields: [
          { id: "fasting", type: "checkbox", label: "No food or drink after midnight", labelFr: "Pas de nourriture ni de boisson après minuit", required: true },
          { id: "medications", type: "checkbox", label: "Stop blood thinners as instructed", labelFr: "Arrêter les anticoagulants comme indiqué", required: true },
          { id: "smoking", type: "checkbox", label: "Stop smoking 2 weeks before surgery", labelFr: "Arrêter de fumer 2 semaines avant la chirurgie", required: true },
          { id: "alcohol", type: "checkbox", label: "No alcohol 48 hours before surgery", labelFr: "Pas d'alcool 48 heures avant la chirurgie", required: true },
        ],
      },
      {
        id: "post-op-checklist",
        title: "Post-operative Instructions",
        titleFr: "Consignes postopératoires",
        content: POSTOPERATIVE_INSTRUCTIONS_FR_CONTENT,
        fields: [
          { id: "rest", type: "checkbox", label: "Rest for the first 48 hours", labelFr: "Repos pendant les premières 48 heures", required: true },
          { id: "medication_compliance", type: "checkbox", label: "Take prescribed medications as directed", labelFr: "Prendre les médicaments prescrits comme indiqué", required: true },
          { id: "compression_garment", type: "checkbox", label: "Wear compression garment as instructed", labelFr: "Porter le vêtement de compression comme indiqué", required: true },
          { id: "follow_up", type: "checkbox", label: "Attend all follow-up appointments", labelFr: "Assister à tous les rendez-vous de suivi", required: true },
          { id: "activity_restrictions", type: "checkbox", label: "No strenuous activity for 4-6 weeks", labelFr: "Pas d'activité intense pendant 4-6 semaines", required: true },
        ],
      },
      {
        id: "acknowledgment",
        title: "Acknowledgment",
        titleFr: "Reconnaissance",
        fields: [
          { id: "instructions_understood", type: "checkbox", label: "I have read and understood all instructions", labelFr: "J'ai lu et compris toutes les consignes", required: true },
          { id: "signature", type: "signature", label: "Patient Signature", labelFr: "Signature du patient", required: true },
          { id: "signature_date", type: "date", label: "Date", labelFr: "Date", required: true },
        ],
      },
    ],
  },
];

const exactDocumentContent = (text: string): FormContentBlock[] => [paragraph(text.trim())];

const signatureFields = (language: "en" | "fr"): FormField[] => {
  if (language === "fr") {
    return [
      { id: "full_name", type: "text", label: "Full Name", labelFr: "Nom", required: true },
      { id: "date_of_birth", type: "date", label: "Date of Birth", labelFr: "Date de naissance", required: true },
      { id: "signature", type: "signature", label: "Patient Signature", labelFr: "Signature patient", required: true },
      { id: "signature_date", type: "date", label: "Date", labelFr: "Date", required: true },
    ];
  }

  return [
    { id: "full_name", type: "text", label: "Name", required: true },
    { id: "date_of_birth", type: "date", label: "Date of Birth", required: true },
    { id: "signature", type: "signature", label: "Patient signature", required: true },
    { id: "signature_date", type: "date", label: "Date", required: true },
  ];
};

const acknowledgmentField = (language: "en" | "fr"): FormField => (
  language === "fr"
    ? { id: "document_acknowledged", type: "checkbox", label: "I have read and understood this document", labelFr: "J'ai lu et compris ce document", required: true }
    : { id: "document_acknowledged", type: "checkbox", label: "I have read and understood this document", required: true }
);

const exactDocumentSections = (
  language: "en" | "fr",
  title: string,
  titleFr: string | undefined,
  text: string,
  fields: FormField[] = signatureFields(language)
): FormSection[] => [
  {
    id: "source-document",
    title,
    titleFr,
    content: exactDocumentContent(text),
    fields: [],
  },
  {
    id: "acknowledgment",
    title: "Acknowledgment",
    titleFr: language === "fr" ? "Reconnaissance" : undefined,
    fields: [acknowledgmentField(language), ...fields],
  },
];

const BREAST_AUGMENTATION_FR_SOURCE = `
NOM : ______________________________________

DATE DE NAISSANCE : _________________________

DATE : ______________________________________

AESTHETICS CLINIC
Chemin Rieu 18
1208 Genève
Suisse

Tel: +41(0)227322223
info@aesthetics-ge.ch
www.aesthetics-ge.ch

ANNEXE CONSENTEMENT ÉCLAIRÉ
POUR AUGMENTATION MAMMAIRE

Chères patientes,

Vous allez bénéficier d’une opération par la mise en place d’implants mammaires. Ce type d’intervention a un pourcentage de satisfaction très élevé. Néanmoins, il existe quelques risques post-opératoires qui varient autour de 6% dans le langage scientifique.

Parmi ces risques, il y a :

Hématome post-opératoire immédiat, dans les premières 24 heures.
Infection de la capsule prothétique.
Infection de la cicatrice.
Asymétrie.
Changement de la sensibilité dans l’ensemble des seins.
Contraction prématurée de la capsule péri-prothétique.
Sérome.

Bien que ces complications soient rares, et malgré une technique chirurgicale adéquate et très performante, nous ne sommes pas à l’abri de les éviter.

Pour toutes ces raisons, nous conseillons à nos patientes de suivre toutes les indications concernant une augmentation mammaire par la mise en place de prothèses.

Parmi ces recommandations, les plus importantes sont les suivantes :

Porter un soutien de gorge de sport sans armatures que vous devez vous procurer, pendant 4 semaines jour et nuit.
Ne pas porter des objets lourds de plus de 15kg.
Éviter les activités physiques (sport de choc) pendant 4 semaines.
Éviter les massages de la poitrine.
Assister à tous les contrôles post-opératoires prévus par le chirurgien.
Notifier tous changements importants qui attirent votre attention durant la période post-opératoire.

Nous vous rappelons que les frais de prise en charge d’une éventuelle complication ne sont pas inclus dans le prix forfaitaire fixé dans le devis initial pour cet acte esthétique, et que les assurances maladies sont susceptible d’accepter ou de refuser cette prise en charge.

Signature patient :
`;

const BREAST_AUGMENTATION_EN_SOURCE = `
NAME : ______________________________________

DATE OF BIRTH : _________________________

DATE : ______________________________________

AESTHETICS CLINIC
Chemin Rieu 18
1208 Genève
Suisse

Tel : +41(0)227322223
info@aesthetics-ge.ch
www.aesthetics-ge.ch

INFORMED CONSENT FOR
BREAST AUGMENTATION

Dear patients,

You will soon have an breast augmentation surgery. This type of operation have a high rate of satisfaction. But there’s post operation risks which vary around 6%.

Among these risks :

Post operation bruise in the few hours following the operation.
Infection of the prosthetics capsules.
Infection of the scar.
Asymmetry.
Sensibility changes in the breast.
Contraction of the prosthetics capsule.
Seroma.

These complication are very rare but we cannot guarantee 0 risks.

For all these reasons, we advise you to follow all the indications for a breast augmentation:

Wear a soft bra for 4 weeks night and day (nonstop).
Avoid physicals activities for at least 4 weeks.
Do not carry heavy things.
Avoid breast massages.
Be present at all your appointment after the operation.
Inform your surgeon about every changes important about your breast.

We remind you that every complications are not include in the initial price of the operation.

In this case health insurance are free to accept or not.

Patient signature :
`;

const BREAST_LIFT_REDUCTION_FR_SOURCE = `
NOM : ______________________________________

DATE DE NAISSANCE : _________________________

DATE : ______________________________________

AESTHETICS CLINIC
Chemin Rieu 18
1208 Genève
Suisse

Tel: +41(0)227322223
info@aesthetics-ge.ch
www.aesthetics-ge.ch

ANNEXE CONSENTEMENT ÉCLAIRÉ
POUR LIFTING ET REDUCTION MAMMAIRE

Chères patientes,

Vous allez bénéficier d’une opération au niveau de votre poitrine. Ce type d’intervention a un pourcentage de satisfaction très élevé. Néanmoins, il existe quelques risques post-opératoires qui varient autour de 6% dans le langage scientifique.

Parmi ces risques, il y a :

Hématome post-opératoire immédiat, dans les premières 24 heures.
Infection de la cicatrice.
Asymétrie.
Changement de la sensibilité dans l’ensemble des seins.

Bien que ces complications soient rares, et malgré une technique chirurgicale adéquate et très performante, nous ne sommes pas à l’abri de les éviter.

Pour toutes ces raisons, nous conseillons à nos patientes de suivre toutes les indications concernant une augmentation mammaire par la mise en place de prothèses.

Parmi ces recommandations, les plus importantes sont les suivantes :

Porter un soutien de gorge de sport sans armatures que vous devez vous procurer, pendant 4 semaines jour et nuit.
Ne pas porter des objets lourds de plus de 15kg.
Éviter les activités physiques (sport de choc) pendant 4 semaines.
Éviter les massages de la poitrine.
Assister à tous les contrôles post-opératoires prévus par le chirurgien.
Notifier tous changements importants qui attirent votre attention durant la période post-opératoire.

Nous vous rappelons que les frais de prise en charge d’une éventuelle complication ne sont pas inclus dans le prix forfaitaire fixé dans le devis initial pour cet acte esthétique, et que les assurances maladies sont susceptible d’accepter ou de refuser cette prise en charge.

Signature patient :
`;

const GENERAL_INFORMED_CONSENT_FR_SOURCE = `
CONSENTEMENT ÉCLAIRÉ

NOM : ____________________________       PRENOM : ____________________________

DATE NAISSANCE : __________________

Le/la soussignée confirme avoir été dûment informé/e par son médecin traitant du traitement :

…………………………………………………………………………………………………………………………………………………….

Ainsi que des effets indésirables et complications éventuelles. De plus, il a été répondu de manière complète et compréhensible à ses questions.

Il/elle a connaissance que si la caisse maladie ne prends pas en charge les frais de ce traitement et que la clinique (en cas d’anesthésie générale) peut facturer directement le temps de dépassement chirurgicale si l’opération prends plus de temps que prévue.

Par la signature du présent formulaire, le/la soussigné/e déclare accepter le traitement.

En cas d’annulation, le/la soussigné/e déclare prendre connaissance que des frais d’annulation d’un montant de 800 CHF lui seront facturés.

Nous ne pouvons pas garantir les résultats, mais nous pouvons vous garantir que vous serez conseillé/e, évalué/e et traité/e en toute bonne foi et au mieux de nos connaissances.

Le/la soussigné/e confirme, avoir connaissance que le matériel photographique et vidéo pris pendant la consultation, appartient exclusivement à son dossier médical, néanmoins :

__ Le/la patient/e autorise l’utilisation du matériel photographique et vidéo dans le but de la recherche médicale, des présentations scientifiques et comme matériel d’illustration, à condition que son identité ne soit pas dévoilée.

__ Le/la patient/e n’autorise en aucun cas l’utilisation de son matériel photographique et vidéo.

Lieu/Date : __________________________   Lieu/Date : _________________________________

Signature patient/e                                               Dr. Xavier Tenorio

__________________________________       ___________________________________________

Dr. Xavier Tenorio – FMH en Chirurgie Plastique Reconstructive et Esthétique – Chemin Rieu 18, Genève, +41(0)22 7322223, info@aesthetics-ge.ch
`;

const GENERAL_INFORMED_CONSENT_EN_SOURCE = `
INFORMED CONSENT

FIRST NAME : ____________________________       NAME : ____________________________

DATE OF BIRTH : __________________

The undersigned confirms to have been duly informed by his/her attending physician of the treatment for :

…………………………………………………………………………………………………………………………………………………….

As well as the possible undesirable side effects and potential

complications. The undersigned also confirms that the/she has had all of his/her questions answered in a clear and comprehensible manner.

He/she has been made aware that the health insurances do not cover

The costs of the treatment and that the clinic (in the case of a general anesthesic) can bill any additional unexpected surgery time.

With this signed document the undersigned declares to accept the aforementioned treatment.

In the case of a cancelation within 7 days prior to the procedure the undersigned declares to have been made aware of 800 CHF cancelation fee.

We cannot guarantee the results but we can guarantee that you will be advised. Evaluated and treated in complete confidence and tot the very best of our abilities.

The undersigned confirms to have taken notice that the photographic and video material taken during the consultation belongs exlusively to his/her private medical file but :

__ The undersigned authorizes the use of the photography and video material for medical research. Scientific presentations and illustrative as long as his /her identity is not revealed.

__ The patient does not authorize in any case the use of photographic or video material.

Date : __________________________

Patient signature :                                                 Dr. Xavier Tenorio :

__________________________________       ___________________________________________

Dr. Xavier Tenorio – FMH en Chirurgie Plastique Reconstructive et Esthétique – Chemin Rieu 18, Genève, +41(0)22 7322223, info@aesthetics-ge.ch
`;

const PRE_POST_INSTRUCTIONS_FR_SOURCE = `
CONSIGNES PRÉ-OPÉRATOIRES

--Une consultation est prévue avec le chirurgien afin d’établir les points suivants :

Lieu d’opération (ex : Aesthetics Clinic ou clinique privé)
Quel type d’opération, en fonction du souhait de patient, des possibilités…
Information concernant le prix
Du type d’anesthésie
Des prises en charges éventuelles (assurance, MedCapital)
De la durée de l’intervention
Des dispositifs médicaux post opératoires (soutien-gorge, panty, ceinture)

--En vue de l’organisation de l’intervention, seront effectués :

Un bilan sanguin
D’éventuels autres examens en fonction de l’âge du patient et du type d’intervention
Un US mammaire si l’opération est en rapport avec la poitrine (augmentation mammaire, cure de gynécomastie)
Un questionnaire anesthésiste sera également à remplir
Vous aurez, également, un rendez-vous téléphonique avec un Anesthésiste.

--Parallèlement à cela un échange avec l’infirmière est également prévu afin :

De discuter des consignes post opératoires :
La veille et le matin de l’opération, prendre une douche de la tête aux pieds et dormir dans les draps propres.
Ne pas se maquiller, enlever les bijoux et piercings.
Être à jeun (ni manger, ni fumer) au moins 6 heures avant l’intervention.
Venir avec le soutien-gorge de sport en cas d’augmentation mammaire, si vous en avez un.

--Signer le consentement éclairé.

--En cas de sédation, prévoir un accompagnement pour le retour à domicile.

CONSIGNES POST-OPÉRATOIRES

Après l’intervention, une ordonnance d’antalgique vous sera envoyée par mail afin de prévenir le risque de douleur mais également des anti-inflammatoires et des antibiotiques dépendant du type d’intervention.

Il faut être accompagné en cas de sédation pour le retour à domicile.
Ne pas être seul lors de la première nuit qui suit l’intervention.
Prévoir un rendez-vous postopératoire avec les infirmières afin de réaliser un contrôle et un retrait des points à J+7.
Prévoir un rendez-vous de contrôle avec le chirurgien 1 Mois après l’intervention.
Se doucher tous les jours dès J+1 postopératoire.

Si problèmes :

Une odeur
Rougeurs
Chaleurs
Œdème
Écoulement

Téléphoner immédiatement à la clinque au 022 732 22 23 ou directement au Dr Tenorio au 076 378 11 73,
si la clinique est fermée.

Garder les dispositifs médicaux (panty, soutien-gorge de sport).

Après l’intervention l’arrêt du sport est nécessaire, pendant 1 mois (cela dépend du type de sport pratiquer et de l’intervention)
Protéger les cicatrices contre l’exposition au soleil durant une année et les protéger avec une crème solaire avec un indice de 50.
Ne pas porter de charges lourdes
Après une liposuccion et/ou une augmentation mammaire, le patient ne doit pas prendre de bain, de sauna, hammam durant une période de 1 mois.

Nom du Patient : _________________________________
Signature du Patient : _____________________________
Date : _______________________
`;

const PRE_POST_INSTRUCTIONS_EN_SOURCE = `
Dr Xavier Tenorio

FMH en Chirurgie Plastique
Reconstructive et Esthétique
Chemin Rieu 18
1208 Genève
Suisse
Tél : +41(0)227322223
info@aesthetics-ge.ch
www.aesthetics-ge.ch

PREOPERATIVE INSTRUCTIONS

--A consultation with the surgeon is necessary to establish the following linkages:

Place of the operation (Aesthetics Clinic / Private Clinic)
Type of the operation according to the patient’s wishes.
The price
Type of anesthesia
Insurance support
Duration of the operation
Medical Devices (belt, panty, bras)

--For the organization of the operation you have to fix a preoperative appointment
with the anaesthetist. During this appointement the doctor will:

Establish a blood test
If necessary, others exams (depends on your age, type of the operation)
US Breast if the operation is in relation with the breast
Anesthetic survey must be filled

--You will also have an appointment with the nurses. The purpose of this
appointment is to:

Try medical devices (panty in case of liposuction).
Inform patients of the necessary materials (bras after a breast operation).
Inform patients of the preoperative instruction:
The day before the operation take a shower.
Do not wear wake-up, remove piercings/jewelry, no nail polish.
Must be fasting at least 6 hours before the operation (no water, no food, no smoke).
Come with a sport bra in case of a mammary augmentation.

--Sign up the informed consent.

--In case of anesthetic planning someone to go home.

POSTOPERATIVE INSTRUCTIONS

After the operation, a prescription of pain medication will be given in order to prevent the and also anti-inflammatory and antibiotocs.

You need someone with you for your first night at home after the surgery.
You must fix an appointment with the nurses to control and remove stitches (max 7 days after).
Fix an appointment with the surgeon one month after the operation
Take showers after the day of the operation.

In case of an emergency:

Bad smells
Redness
Heat
Edema
Flowing

Phone the clinic directly 022 732 22 23 or the Dr Tenorio 076 378 11 73, if the clinic is closed.

Always keep your medical devices.

After the operation, you have to stop sports for at least one month (depends of the type of sports and the intervention)
Protect yours scars from the sun for at least a year, then protect them with a sunscreen (high protection)
Do not carry heavy things
After a liposuccion and/or breast augmentation, the patient should not take bath, sauna or hammam for at least a month

Patient Name : _________________________________
Patient signature : _____________________________
Date : _______________________
`;

const ANESTHESIA_CONSENT_FR_SOURCE = `
Informations concernant l’anesthésie
Cette brochure est un document destiné à vous informer et à vous préparer à l’anesthésie nécessaire à votre prochaine intervention. Elle vous renseigne sur son déroulement, ses procédés et les complications liées aux différentes techniques. Ceci dans le but de vous permettre de donner un consentement libre et éclairé à votre prise en charge.

Qu’est-ce que l’anesthésie et qui la pratique ?
L’anesthésie est un acte médical pratiqué dans le but d’effectuer une intervention chirurgicale ou un examen invasif dans les meilleures conditions de sécurité et de confort. L’anesthésiste est un médecin spécialiste (FMH) qui s’occupe non seulement de rendre le patient insensible à la douleur (anesthésie) mais aussi de contrôler les fonctions vitales telles que la respiration, la circulation, le métabolisme, la fonction rénale, et de les maintenir dans les limites appropriées avant, pendant et après l’opération. Le médecin anesthésiste sera avec vous de façon continue pendant toute la durée de l’opération et sera assisté d’un ou d’une infirmière anesthésiste pour garantir une prise en charge optimale. Durant votre séjour en salle de réveil, il prescrira les médicaments analgésiques (contre la douleur) et veillera à votre confort.

L’Anesthésie Générale et la Sédation
Lors d’une anesthésie générale, la perception de la douleur est neutralisée à l’aide de différents médicaments et le patient est inconscient. Cet état de « sommeil artificiel » se prolonge jusqu’à la fin de l’intervention. Dans la plupart des cas, la respiration doit être assistée au moyen de dispositifs médicaux implantés temporairement dans votre cavité buccale et vos voies respiratoires. Certains actes chirurgicaux peuvent se faire sous sédation qui est une forme d’anesthésie générale peu profonde.

Consultation préopératoire avec votre anesthésiste
Avant votre intervention, un entretien avec votre futur anesthésiste est organisé en présentiel si celui-ci trouve que cela est nécessaire ou par consultation téléphonique. Il permet au médecin d’évaluer vos risques opératoires, de choisir avec vous la technique d’anesthésie la mieux adaptée à votre état de santé et à l’intervention chirurgicale prévue. Le médecin vous explique en outre le déroulement de votre anesthésie et vous expose les risques et complications éventuelles liés à celle-ci. Cet entretien est également l’occasion de poser vos questions et de faire part de vos doutes et inquiétudes. Si nécessaire, l’anesthésiste peut également vous prescrire des examens complémentaires ou adapter votre traitement médicamenteux.

Votre admission se fera le jour de l’intervention, vous serez convoqué environ une heure avant de début de votre intervention. Votre prise en charge se fera de manière ambulatoire (sortie le jour même de l’intervention) ou vous resterez en surveillance une nuit à la clinique. Dans la plupart des cas, nous vous offrons la possibilité d’effectuer une consultation téléphonique.

Votre médecin anesthésiste vous appellera s’il le juge nécessaire dans les 48 heures précédant votre admission. Il vous verra obligatoirement avant votre intervention. Nous vous demandons dès lors d’être atteignable dans ce délai, au numéro de téléphone que vous aurez communiqué à la secrétaire lors de la programmation de votre intervention.

Nous vous remettrons un questionnaire d’anesthésie à remplir et à retourner au plus vite et au minimum 2 jours ouvrables avant votre intervention.

Documents à apporter avec vous
Si un rapport préopératoire a été requis par votre chirurgien, nous vous prions de l’apporter lors de votre admission. Ce document doit vous être fourni par votre médecin traitant ou un autre spécialiste. Par ailleurs, il est important de prendre avec vous tous les documents récents concernant votre santé, notamment : médicaments habituels et posologie, résultats d’analyses laboratoires, radiographies, électrocardiogramme.

Anesthésie, sécurité et effets secondaires
Les méthodes utilisées actuellement en anesthésie sont fiables et le risque de complications qui pourraient mettre la vie du patient en danger, même dans les cas les plus lourds, demeure extrêmement faible. Lors de l’intervention, toutes les fonctions vitales de l’organisme sont sous surveillance (coeur, tension artérielle, respiration). Les nausées et les vomissements au réveil sont devenus moins fréquents actuellement, grâce aux nouvelles techniques et nouveaux médicaments. Les accidents liés au passage de liquide gastrique dans les poumons sont rares, pour autant que les consignes de jeûne soient respectées. L’introduction d’un tube dans la trachée (intubation) ou dans la gorge (masque laryngé) pour assurer la ventilation pendant l’anesthésie générale peut provoquer des maux de gorge, des enrouements passagers et des traumatismes dentaires. Il est important que vous signaliez tout appareil ou toute fragilité dentaire particulière. L’injection intraveineuse de médicaments peut provoquer une sensation de brûlure dans le membre et une rougeur au niveau de la veine. Elle disparaît en quelques jours.

La position prolongée sur la table d’opération peut entraîner la compression de certains nerfs, ce qui peut provoquer un engourdissement ou, exceptionnellement,une atteinte neurologique. Dans la majorité des cas, ces atteintes guérissent complètement en quelques jours ou quelques semaines.

Des complications imprévisibles comportant un risque vital comme une allergie sévère, un arrêt cardiaque ou l’asphyxie, sont extrêmement rares

Pour votre sécurité
Le patient doit rester à jeun à minuit la veille de l’anesthésie ou 6 heures minimum avant l’intervention (sans manger, ni fumer) vous pouvez boire de l’eau, du thé ou du café noir sans lait uniquement jusqu'à 2 heures avant votre intervention.

Le respect de ce jeûne est très IMPORTANT, son non-respect peut entraîner de graves complications respiratoires. Il est nécessaire de s’en tenir aux prescriptions données par le médecin anesthésiste. Le jour de l’opération, le patient ne prend ses médicaments que sur ordre médical. Les lentilles oculaires, les prothèses dentaires, les bagues et bijoux sont à laisser dans les vestiaires.

Accord pour la procédure anesthésique
Au cours de la consultation d’anesthésie, j’ai été informé des avantages et risques de l’anesthésie dans mon cas.
- J’accepte que l’anesthésie puisse être prise en charge par un autre médecin-anesthésiste du service.
- J’ai pu poser toutes les questions que j’ai jugées utiles et j’ai compris les réponses fournies.
- J’accepte les modifications des méthodes qui pourraient s’avérer nécessaires pendant mon intervention.

Nom : ………………………………………..
Prénom : …………………………………………..
Date de naissance : …………………………………….
À (lieu) ………………………………………………………………. Le ……………………………………………..
Signature du patient ou du représentant légal : …………………………………….
Signature du médecin : …………………………………….
`;

const ANESTHESIA_CONSENT_EN_SOURCE = `
Anesthesia’s informations

What is general anesthesia?
This is a technique used to eliminate pain during a surgical, obstetrical or medical procedure (endoscopy, radiology, etc.). It is induced by injecting medication or inhaling anesthetic vapors. These substances put you into a state comparable to very deep sleep.

What will the procedure involve?
You will be given custom-tailored anesthesia by specialized doctors and nurses. Your care will start by fitting devices to monitor your vital functions:
• Heart: patches connected to a screen will be attached to your chest.
• Blood pressure: a cuff will be wrapped around one of your arms.
• Breathing: a sensor will be placed on the tip of one of your fingers.
Medication to induce general anesthesia is administered intravenously. To ensure a good oxygen supply to your lungs, the anesthesiologist will ask you to breathe through a mask. During the operation, most people are given artificial breathing assistance. There are two types of assistance: an oxygen mask placed over the mouth and nose and a device inserted into your mouth and respiratory tract (laryngeal mask or endotracheal tube). These devices will be placed during anesthesia. While you are under the anesthetic, an anesthesia professional will monitor your vital functions, including your heart and lungs. The anesthesia will be adapted to your needs.
Once the surgical procedure has ended, medication will no longer be administered, which will lead to your awakening. You will be monitored continuously in the recovery room.

What are the risks of general anesthesia?
All medical procedures involve risks, even when they are performed by experts. The rate and severity of these risks depend on your state of health, age or general lifestyle. The anesthesia techniques used are safe.
The risks of unexpected and potentially life- threatening complications such as an allergy or severe heart or lung problem are extremely small. All necessary measures will be taken to prevent and treat any complications in the best possible way.
However, the following complications could occur:
• Nausea and vomiting: this occurs after your awakening. Despite the use of new anesthetic drugs, these effects are still common, but are now easier to treat.
• Sore throat, hoarseness, swallowing difficulties: these effects sometimes appear when a device has been inserted into the throat or trachea to help you breathe during anesthesia. They usually disappear within a few days. On very rare occasions, they require further attention due to damage to the vocal cords.
• Dental damage: this can be caused by the procedures required to fit the breathing assistance device.
• Nerve, muscle and skin damage: this is caused by extended periods spent lying on the operating table, which leads to compression. These effects cause temporary numbness or paralysis that is reversible in nearly all cases.
• Memory problems, decreased concentration: this sometimes occurs in the days following the operation and disappears spontaneously.
• Awakening during the operation: this is very rare, but can remain in your memory and should be reported to the anesthesia team.

What are the necessary safety precautions?
Your cooperation is crucial for the success of the procedure. Please follow the recommendations below:
• Medication: only take medication authorized by the anesthesiologist during the consultation appointment and report any medication taken, including aspirin, anti-inflammatory drugs or blood thinners.
• Dentures, jewelry, contact lenses, piercings or other devices (except hearing aids and glasses if worn) should be removed before your arrival in the operating room.

To reduce the risks of accident or infection caused by gastric fluid entering your lungs, follow the recommendations below:
• Food: do not eat, suck on candy or chewing gum less than six hours before the procedure.
• Beverages: stop drinking fluids six hours prior to the procedure; only clear liquids (water, coffee or tea without milk) are permitted up to two hours before the procedure; after that time, all beverages are prohibited.
• Smoking: it is advisable to stop smoking at least 12 hours before the procedure.

Note: to limit the risks of theft or loss, only bring in items that are absolutely necessary.

Agreement for the anesthetic procedure.
During the anesthesia consultation, I was informed of the benefits and risks of anesthesia in my case.
- I agree that the anesthesia may be taken care of another anesthetist to the anesthesia team.
- I was able to ask all the questions I found useful and I understood the answers provided.
- I accept any changes in methods that may be necessary during my intervention.

Name: …………………………………………..
Surname: ………………………………………..
Date of birth: …………………………………….
Geneva, the ……………………………………………..
Patient signature or legal representative : …………………………………….
Anesthetist signature : …………………………………………………….
`;

const QUESTIONNAIRE_EN_SOURCE = `
Anesthesia questionnaire
Surname: ………………………..  Name: ………………………………  Date of birth: ………………………………………..
Height: ………………..  Weight: ………………..  Attending physician: ………………………………
Planned operation: …………………………………………………………………  Date of operation: …………………………………
N°CADA insurance: …80756………………………………………………….  Telephone number: ………………………………

1- Have you had any medical treatment in recent months ?
☐ Yes, Which one ?  ☐ No
………………………………………………………………………………………………………………………………………………………………………
………………………………………………………………………………………………………………………………………………………………………

2- Do you take medication every day ?
☐ Yes, Which one ?  ☐ No
………………………………………………………………………………………………………………………………………………………………………
………………………………………………………………………………………………………………………………………………………………………
………………………………………………………………………………………………………………………………………………………………………

3- Have you had a fever in the past few days ?
☐ Yes  ☐ No

4- Do you have allergies (drugs, dressings, food, disinfectants) ?
☐ Yes (Specify the type of reaction: rashes, angioedema, anaphylactic shock)  ☐ No
Which one ??….……………………………………………………………………………………………………………………………………………

5- Previous surgical operations and type of anesthesia : a=general, b=spinal block or epidural anesthesia, c=local anesthesia
Surgical operation  Year  Anesthesia
If more surgical operations, please specify the operation, the year and type of anesthesia (a,b, ou c).

6- Have you had any particular problems with the anesthesia (nausea, vomiting, difficulties waking up, etc.) ?
☐ Yes, Which one ?  ☐ No
…………….………………………………………………………………………………………………………………………………………………………..
………………………………………………………………………………………………………………………………………………………………………

7- Did you have or do you have:
®Heart:
☐ Palpitations  ☐ Arrhythmia  ☐ Angina pectoris
☐ Infarct  ☐ Heart failure  ☐ Heart murmur
® Circulation:
☐ High blood pressure  ☐ Arteritis  ☐ Phlebitis
☐ Pulmonary embolism  ☐ Coagulation problems  ☐ Varicose veins
® Lungs:
☐ Asthma  ☐ SLEEP APNEA  ☐ Chronic bronchitis
☐ Snoring  ☐ Emphysema
® Nervous system:
☐ Stroke  ☐ Epilepsy  ☐ Depression
☐ Anxiety attack
® Urinary system:
☐ Renal failure  ☐ Infections, kidney stones
® Metabolic:
☐ Diabete ® with insulin ?  ☐ Yes  ☐ No
☐ Cholesterol - Triglycerides  ☐ Thyroid disease
® Infectious diseases:
☐ Hepatitis :  ☐ B  ☐ C  ☐ HIV – SIDA
® Digestive system, liver:
☐ Stomach or duodenum ulcer  ☐ Cirrhosis  ☐ Gastro oesophageal hernia
☐ Acid reflux  ☐ Jaundice
® Ophtalmology:
☐ Glaucoma  ☐ Single eye

8- Do you have a disease that is not mentioned in the previous list?
☐ Yes, Which one ?  ☐ No
…………….………………………………………………………………………………………………………………………………………………………..

9- Are you prone to prolonged bleeding?  ☐ Yes  ☐ No

10- Do you have?
☐ Bridge  ☐ Loose teeth  ☐ Pivot tooth, veneers  ☐ Dental prothesis
☐ Hearing aid  ☐ Pace maker  ☐ Contact lenses

11- Do you smoke or have you smoked?
☐ Yes, how many cigarettes per day? …………………………………………  ☐ No
For how long time? …………………………………………………………………………….

12- Do you use drugs?
☐ Yes, Which one ?  ☐ No
…………….………………………………………………………………………………………………………………………………………………………..

13- Do you drink alcohol?  ☐ Never  ☐ Occasionally  ☐ Regularly ……………………………………

14- Are you rather?  ☐ Athletic  ☐ Active  ☐ Sedentary

15- Another feature not mentioned previously?

16- In case of emergency, please provide the contact details of one of your relatives and your relationship to this person:
…………….………………………………………………………………………………………………………………………………………………………..
…………….………………………………………………………………………………………………………………………………………………………..

For women : Are you taking contraceptive pill ?  ☐ Yes  ☐ No
Are you pregnant or likely to be ?  ☐ Yes  ☐ No
Are you breastfeeding ?  ☐ Yes  ☐ No
`;

const QUESTIONNAIRE_FR_SOURCE = `
Questionnaire d’Anesthésie
Nom : ………………………..  Prénom : ………………………………  Né(e) le : …………………………………….
Taille : ………………..  Poids : ………………..  Médecin traitant :………………………………
Date de votre opération : ……………………………………………  Chirurgien : ………………………………………..
N°CADA assurance : …80756………………………………………………….  Tél privé : …………………………………………

1- Avez-vous eu un traitement médical ces derniers mois ?
☐ Oui, Lequel ?  ☐ Non
………………………………………………………………………………………………………………………………………………………………………
………………………………………………………………………………………………………………………………………………………………………

2- Prenez-vous des médicaments tous les jours (y compris somnifères, laxatifs, aspirine et médicaments homéopathiques) ?
☐ Oui, Lequel ?  ☐ Non
………………………………………………………………………………………………………………………………………………………………………
………………………………………………………………………………………………………………………………………………………………………
………………………………………………………………………………………………………………………………………………………………………

3- Avez-vous eu de la fièvre ces derniers jours ?
☐ Oui  ☐ Non

4- Avez-vous des allergies (médicaments, pansements, aliments, désinfectants) ?
☐ Oui (Spécifier si : éruption cutanée, œdème de Quincke, difficultés respiratoires, choc anaphylactique)  ☐ Non
Lesquelles ?….……………………………………………………………………………………………………………………………………………….

5- Opérations précédentes et type d’anesthésie : a=complète, b=péridurale ou rachidienne, c=locale
Opération  Année  Anesthésie
Si plus d’opérations veuillez préciser l’opération, l’année et le type d’anesthésie (a,b ou c).

6- Avez-vous eu des problèmes particuliers en rapport avec l’anesthésie (nausées, vomissements, difficultés de réveil, etc.) ?
☐ Oui, Lesquels ?  ☐ Non
…………….………………………………………………………………………………………………………………………………………………………..
………………………………………………………………………………………………………………………………………………………………………

7- Un de vos proches parents a-t-il eu des problèmes lors d’une anesthésie ?
☐ Oui, Lesquels ?  ☐ Non
…………….………………………………………………………………………………………………………………………………………………………..

8- Avez-vous eu ou avez-vous des problèmes :
® Cardiaques :
☐ Palpitations  ☐ Troubles du rythme  ☐ Angine de poitrine
☐ Infarctus  ☐ Insuffisance cardiaque  ☐ Souffle au cœur
® Vasculaires :
☐ Hypertension artérielle  ☐ Artérite  ☐ Phlébite
☐ Embolie pulmonaire  ☐ Problèmes de coagulation  ☐ Varices
® Respiratoires :
☐ Asthme  ☐ APNEE DU SOMMEIL  ☐ Bronchite chronique
☐ Ronflement  ☐ Emphysème
® Nerveux :
☐ Accident vasculaire cérébral  ☐ Épilepsie  ☐ Dépression
☐ Crise d’angoisse
® Urinaires :
☐ Insuffisance rénale  ☐ Infections, calculs
® Métaboliques :
☐ Diabète ® avec insuline ?  ☐ Oui  ☐ Non
☐ Cholestérol - Triglycérides  ☐ Maladies de la thyroïde
® Infectieux :
☐ Hépatite :  ☐ B  ☐ C  ☐ HIV – SIDA
® Digestifs :
☐ Ulcère  ☐ Cirrhose  ☐ Hernie hiatale
☐ Reflux gastriques  ☐ Jaunisse
® Oculaires :
☐ Glaucome  ☐ Œil unique

9- Avez-vous une maladie qui n’est pas mentionnée dans la liste précédente?
☐ Oui, laquelle?  ☐ Non
…………….………………………………………………………………………………………………………………………………………………………..

10- Êtes-vous sujet aux saignements prolongés ?  ☐ Oui  ☐ Non

11- Avez-vous?
☐ Bridge  ☐ Dents branlantes  ☐ Dent à pivot, facettes  ☐ Prothèse dentaire
☐ Prothèse auditive  ☐ Pace maker  ☐ lentilles de contact

12- Fumez-vous ou avez-vous fumé?
☐ Oui, Combien de cigarettes par jour? …………………………………………  ☐ Non
Depuis combien de temps/pendant combien de temps? …………………………………………………………………………….

13- Consommez-vous des drogues?
☐ Oui, laquelle?  ☐ Non
…………….………………………………………………………………………………………………………………………………………………………..

14- Buvez-vous de l’alcool? ☐ Jamais  ☐ A l’occasion  ☐ Régulièrement ……………………………………

15- Êtes-vous plutôt ? ☐ Sportif  ☐ Actif  ☐ Sédentaire

16- Autre particularité non mentionnée précédemment?

17- En cas d’urgence, veuillez indiquer les coordonnées d’un de vos proches et votre lien avec cette personne :
…………….………………………………………………………………………………………………………………………………………………………..
…………….………………………………………………………………………………………………………………………………………………………..

Pour les femmes : Prenez-vous la pilule ?  ☐ Oui  ☐ Non
Êtes-vous enceinte ou susceptible de l’être ?  ☐ Oui  ☐ Non
Allaitez-vous ?  ☐ Oui  ☐ Non
`;

function overrideForm(formId: string, originalFile: string, sections: FormSection[]) {
  const form = FORM_DEFINITIONS.find((definition) => definition.id === formId);
  if (!form) return;

  form.originalFile = `breast surgery/${originalFile}`;
  form.sections = sections;
}

function cloneFormForFolder(formId: string, clonedFormId: string, folder: string, originalFile: string) {
  const form = FORM_DEFINITIONS.find((definition) => definition.id === formId);
  if (!form) return;

  FORM_DEFINITIONS.push({
    ...form,
    id: clonedFormId,
    originalFile: `${folder}/${originalFile}`,
    sections: form.sections.map((section) => ({
      ...section,
      fields: section.fields.map((field) => ({ ...field })),
      content: section.content?.map((block) => ({ ...block })),
    })),
  });
}

const anesthesiaQuestionnaireFr = FORM_DEFINITIONS.find((form) => form.id === "questionnaire-anesthesie-fr");
if (anesthesiaQuestionnaireFr) {
  anesthesiaQuestionnaireFr.sections = ANESTHESIA_QUESTIONNAIRE_FR_SECTIONS;
}

const anesthesiaQuestionnaireEn = FORM_DEFINITIONS.find((form) => form.id === "questionnaire-anesthesie-en");
if (anesthesiaQuestionnaireEn) {
  anesthesiaQuestionnaireEn.sections = ANESTHESIA_QUESTIONNAIRE_EN_SECTIONS;
}

overrideForm(
  "questionnaire-anesthesie-fr",
  "FR - Questionnaire d'anesthésie (1).pdf",
  [
    {
      id: "source-document",
      title: "Anesthesia Questionnaire",
      titleFr: "Questionnaire d’Anesthésie",
      content: exactDocumentContent(QUESTIONNAIRE_FR_SOURCE),
      fields: [],
    },
    ...ANESTHESIA_QUESTIONNAIRE_FR_SECTIONS,
  ]
);

overrideForm(
  "questionnaire-anesthesie-en",
  "EN - Questionnaire d'anesthésie .pdf",
  [
    {
      id: "source-document",
      title: "Anesthesia questionnaire",
      content: exactDocumentContent(QUESTIONNAIRE_EN_SOURCE),
      fields: [],
    },
    ...ANESTHESIA_QUESTIONNAIRE_EN_SECTIONS,
  ]
);

overrideForm("consentement-anesthesie-fr", "Consentement anesthésie - Aesthetics.pdf", exactDocumentSections("fr", "Anesthesia Consent", "Consentement anesthésie", ANESTHESIA_CONSENT_FR_SOURCE));
overrideForm("consentement-anesthesie-en", "EN - Consentement anesthésie.pdf", exactDocumentSections("en", "Anesthesia Consent", undefined, ANESTHESIA_CONSENT_EN_SOURCE));
overrideForm("consentement-augmentation-mammaire-fr", "Annexe AM FR (1).docx", exactDocumentSections("fr", "Informed Consent - Breast Augmentation", "Annexe consentement éclairé pour augmentation mammaire", BREAST_AUGMENTATION_FR_SOURCE));
overrideForm("consentement-augmentation-mammaire-en", "Informed breast augmentation ENG (1).docx", exactDocumentSections("en", "Informed Consent - Breast Augmentation", undefined, BREAST_AUGMENTATION_EN_SOURCE));
overrideForm("consentement-lift-reduction-fr", "Annexe Lift et Reduction FR copie (1).docx", exactDocumentSections("fr", "Informed Consent - Breast Lift & Reduction", "Annexe consentement éclairé pour lifting et reduction mammaire", BREAST_LIFT_REDUCTION_FR_SOURCE));
overrideForm("consentement-eclaire-fr", "CONSENTEMENT ÉCLAIRÉ (1).docx", exactDocumentSections("fr", "General Informed Consent", "Consentement éclairé", GENERAL_INFORMED_CONSENT_FR_SOURCE, [
  { id: "first_name", type: "text", label: "First Name", labelFr: "Prénom", required: true },
  { id: "last_name", type: "text", label: "Name", labelFr: "Nom", required: true },
  { id: "date_of_birth", type: "date", label: "Date of Birth", labelFr: "Date de naissance", required: true },
  { id: "treatment", type: "textarea", label: "Treatment", labelFr: "Traitement", required: true },
  { id: "photo_video_authorization", type: "radio", label: "Photo/video authorization", labelFr: "Autorisation photo/vidéo", required: true, options: [
    { value: "authorized", label: "Authorized", labelFr: "Autorise" },
    { value: "not_authorized", label: "Not authorized", labelFr: "N'autorise pas" },
  ] },
  { id: "signature", type: "signature", label: "Patient Signature", labelFr: "Signature patient/e", required: true },
  { id: "signature_date", type: "date", label: "Date", labelFr: "Date", required: true },
]));
overrideForm("consentement-eclaire-en", "INFORMED CONSENT.docx", exactDocumentSections("en", "General Informed Consent", undefined, GENERAL_INFORMED_CONSENT_EN_SOURCE, [
  { id: "first_name", type: "text", label: "First Name", required: true },
  { id: "last_name", type: "text", label: "Name", required: true },
  { id: "date_of_birth", type: "date", label: "Date of Birth", required: true },
  { id: "treatment", type: "textarea", label: "Treatment", required: true },
  { id: "photo_video_authorization", type: "radio", label: "Photo/video authorization", required: true, options: [
    { value: "authorized", label: "Authorized" },
    { value: "not_authorized", label: "Not authorized" },
  ] },
  { id: "signature", type: "signature", label: "Patient signature", required: true },
  { id: "signature_date", type: "date", label: "Date", required: true },
]));
overrideForm("preoperative-instructions-en", "Preoperative instruction OP ENG (1).docx", exactDocumentSections("en", "Pre and Post-operative Instructions", undefined, PRE_POST_INSTRUCTIONS_EN_SOURCE));
overrideForm("consignes-pre-post-op-fr", "consignes pre et post op FR (1).docx", exactDocumentSections("fr", "Pre and Post-operative Instructions", "Consignes pré et post-opératoires", PRE_POST_INSTRUCTIONS_FR_SOURCE));

cloneFormForFolder("questionnaire-anesthesie-fr", "surgery-questionnaire-anesthesie-fr", "surgery", "FR - Questionnaire d'anesthésie (1).pdf");
cloneFormForFolder("questionnaire-anesthesie-en", "surgery-questionnaire-anesthesie-en", "surgery", "EN - Questionnaire d'anesthésie .pdf");
cloneFormForFolder("consentement-anesthesie-fr", "surgery-consentement-anesthesie-fr", "surgery", "Consentement anesthésie - Aesthetics.pdf");
cloneFormForFolder("consentement-anesthesie-en", "surgery-consentement-anesthesie-en", "surgery", "EN - Consentement anesthésie.pdf");
cloneFormForFolder("consentement-eclaire-fr", "surgery-consentement-eclaire-fr", "surgery", "CONSENTEMENT ÉCLAIRÉ (1).docx");
cloneFormForFolder("consentement-eclaire-en", "surgery-consentement-eclaire-en", "surgery", "INFORMED CONSENT.docx");
cloneFormForFolder("preoperative-instructions-en", "surgery-preoperative-instructions-en", "surgery", "Preoperative instruction OP ENG (1).docx");

const ALTERNATE_LANGUAGE_FORM_IDS: Record<string, string> = {
  "questionnaire-anesthesie-fr": "questionnaire-anesthesie-en",
  "questionnaire-anesthesie-en": "questionnaire-anesthesie-fr",
  "consentement-anesthesie-fr": "consentement-anesthesie-en",
  "consentement-anesthesie-en": "consentement-anesthesie-fr",
  "consentement-augmentation-mammaire-fr": "consentement-augmentation-mammaire-en",
  "consentement-augmentation-mammaire-en": "consentement-augmentation-mammaire-fr",
  "consentement-lift-reduction-fr": "consentement-lift-reduction-en",
  "consentement-lift-reduction-en": "consentement-lift-reduction-fr",
  "consentement-eclaire-fr": "consentement-eclaire-en",
  "consentement-eclaire-en": "consentement-eclaire-fr",
  "preoperative-instructions-en": "consignes-pre-post-op-fr",
  "consignes-pre-post-op-fr": "preoperative-instructions-en",
  "surgery-questionnaire-anesthesie-fr": "surgery-questionnaire-anesthesie-en",
  "surgery-questionnaire-anesthesie-en": "surgery-questionnaire-anesthesie-fr",
  "surgery-consentement-anesthesie-fr": "surgery-consentement-anesthesie-en",
  "surgery-consentement-anesthesie-en": "surgery-consentement-anesthesie-fr",
  "surgery-consentement-eclaire-fr": "surgery-consentement-eclaire-en",
  "surgery-consentement-eclaire-en": "surgery-consentement-eclaire-fr",
};

export function getAlternateLanguageFormId(formId: string): string | undefined {
  return ALTERNATE_LANGUAGE_FORM_IDS[formId];
}

export function getFormById(formId: string): FormDefinition | undefined {
  return FORM_DEFINITIONS.find((form) => form.id === formId);
}

export function getFormsByLanguage(language: "en" | "fr"): FormDefinition[] {
  return FORM_DEFINITIONS.filter((form) => form.language === language);
}

export function getFormsByCategory(category: "consent" | "questionnaire" | "instructions"): FormDefinition[] {
  return FORM_DEFINITIONS.filter((form) => form.category === category);
}

export function getAllForms(): FormDefinition[] {
  return FORM_DEFINITIONS;
}
