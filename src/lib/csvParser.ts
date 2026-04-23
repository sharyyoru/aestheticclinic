/**
 * CSV Parser for Lead Import
 * Parses CSV files and detects service types from filenames
 * Supports multilingual column headers with intelligent mapping
 */

export type LeadCSVRow = {
  Created: string;
  Name: string;
  Email: string;
  Source: string;
  Form: string;
  Channel: string;
  Stage: string;
  Owner: string;
  Labels: string;
  Phone: string;
  'Secondary phone number': string;
  'WhatsApp number': string;
};

/**
 * Column mapping for different languages
 * Maps various language column names to standard English names
 */
const COLUMN_MAPPINGS: { [key: string]: string[] } = {
  'Created': [
    'created', 'створено', 'créé', 'erstellt', 'creado', 'criado',
    'data', 'date', 'datum', 'fecha', 'дата', 'date created',
    'created_time', 'created time', 'submitted at' // TikTok / Meta
  ],
  'Name': [
    'name', 'ім\'я', 'nom', 'nombre', 'nome', 'имя',
    'full name', 'fullname', 'contact name', 'lead name'
  ],
  'Email': [
    'email', 'електронна пошта', 'e-mail', 'correo', 'correio',
    'електронна адреса', 'эл. почта', 'email address',
    'adresse e-mail', 'adresse email' // TikTok FR
  ],
  'Phone': [
    'phone', 'телефон', 'téléphone', 'telefon', 'teléfono',
    'phone number', 'mobile', 'cell', 'mobile number',
    'numéro de téléphone', 'numero de telephone' // TikTok FR
  ],
  'Source': [
    'source', 'джерело', 'источник', 'source', 'origen', 'fonte',
    'lead source', 'campaign source',
    'campaign_name', 'campaign name', 'ad_name', 'ad name' // TikTok
  ],
  'Form': [
    'form', 'форма', 'formulaire', 'formular', 'formulario',
    'form name', 'landing page',
    'form_name' // TikTok / Meta
  ],
  'Channel': [
    'channel', 'канал', 'canal', 'kanal',
    'marketing channel', 'source channel'
  ],
  'Stage': [
    'stage', 'етап', 'этап', 'étape', 'etapa', 'fase',
    'lead stage', 'status'
  ],
  'Owner': [
    'owner', 'власник', 'владелец', 'propriétaire', 'propietario',
    'assigned to', 'responsible'
  ],
  'Labels': [
    'labels', 'ярлики', 'мітки', 'étiquettes', 'etiquetas',
    'tags', 'categories'
  ],
  'Secondary phone number': [
    'secondary phone', 'другий номер', 'другий номер телефону', 'второй телефон',
    'alternate phone', 'phone 2'
  ],
  'WhatsApp number': [
    'whatsapp', 'номер whatsapp', 'whatsapp number',
    'wa number', 'whatsapp phone'
  ],
};

/**
 * Map a single CSV header to its standard column name, along with the match
 * quality: 2 = exact alias match, 1 = partial (substring) match, 0 = none.
 */
function mapColumnNameScored(header: string): { standard: string | null; score: 0 | 1 | 2 } {
  const normalized = header.trim().toLowerCase();

  // Exact match
  for (const [standardName, variations] of Object.entries(COLUMN_MAPPINGS)) {
    if (variations.some(v => normalized === v)) {
      return { standard: standardName, score: 2 };
    }
  }

  // Partial match
  for (const [standardName, variations] of Object.entries(COLUMN_MAPPINGS)) {
    if (variations.some(v => normalized.includes(v))) {
      return { standard: standardName, score: 1 };
    }
  }

  return { standard: null, score: 0 };
}

/** Backwards-compatible wrapper */
function mapColumnName(header: string): string | null {
  return mapColumnNameScored(header).standard;
}

export type ParsedLead = {
  rowNumber: number;
  created: Date | null;
  name: string;
  email: string | null;
  source: string;
  form: string;
  channel: string;
  stage: string;
  owner: string;
  labels: string[];
  phones: {
    primary: string | null;
    secondary: string | null;
    whatsapp: string | null;
  };
  detectedService: string | null;
  /** Detected ad-platform origin, e.g. 'tiktok'. null = unknown / generic CSV */
  platform: 'tiktok' | null;
  validationIssues: string[];
};

/**
 * Service detection patterns shared by filename and form detection
 */
const SERVICE_PATTERNS: { pattern: RegExp; service: string }[] = [
  // MIA must be checked BEFORE generic breast augmentation so that TikTok
  // MIA ads (e.g. "MIA Breast Augmentation") route to the MIA service.
  { pattern: /\bmia\b/i, service: 'MIA' },
  { pattern: /breast\s+augment/i, service: 'Breast Augmentation' },
  { pattern: /breast\s+implant/i, service: 'Breast Implants Replacement' },
  { pattern: /breast\s+reduc|breast\s+lift|mastopexy/i, service: 'Breast Reduction/Lifting' },
  { pattern: /full\s*face\s*fillers?/i, service: 'Face Fillers' },
  { pattern: /face\s*fillers?/i, service: 'Face Fillers' },
  { pattern: /ha\s*[&+]\s*filler|hyaluronic|ha\s+filler/i, service: 'HA & Fillers' },
  { pattern: /traitement\s+de\s+rides/i, service: 'Wrinkle Treatment' },
  { pattern: /wrinkles?\s+treatment/i, service: 'Wrinkle Treatment' },
  { pattern: /blefaro|blephar/i, service: 'Blepharoplasty' },
  { pattern: /micro\s*liposuc/i, service: 'Micro liposuction' },
  { pattern: /liposuc/i, service: 'Liposuction' },
  { pattern: /hyperbaric|hbot/i, service: 'Hyperbaric Oxygen Therapy' },
  { pattern: /longevity/i, service: 'Longevity' },
  { pattern: /iv\s+(vitamin|therapy|infusion)|vitamin\s+inject/i, service: 'IV vitamin injections' },
  { pattern: /rhinoplast/i, service: 'Rhinoplasty' },
  { pattern: /facelift|face\s+lift/i, service: 'Facelift' },
  { pattern: /botox|botulinum\s+toxin/i, service: 'Botulinum toxin' },
  { pattern: /lip\s+filler/i, service: 'Lip Fillers' },
  { pattern: /tummy\s+tuck|abdominoplast/i, service: 'Abdominoplasty' },
  { pattern: /breast\s+lift/i, service: 'Breast Lift' },
  { pattern: /hifu/i, service: 'HIFU' },
  { pattern: /morpheus/i, service: 'Morpheus 8' },
  { pattern: /skinbooster/i, service: 'Skinbooster' },
  { pattern: /emsculpt/i, service: 'Emsculpt' },
  { pattern: /prp/i, service: 'PRP' },
  { pattern: /peeling/i, service: 'Peeling' },
  { pattern: /dermapen/i, service: 'Dermapen' },
  { pattern: /mesotherap/i, service: 'Mesotherapy' },
  { pattern: /laser\s*co2/i, service: 'Laser Co2' },
  { pattern: /laser\s*hair/i, service: 'Laser hair removal' },
  { pattern: /vascular\s*laser/i, service: 'Vascular laser' },
  { pattern: /genesis/i, service: 'GENESIS' },
  { pattern: /cryolipolys|crypolipoly/i, service: 'Cryolipolysis' },
  { pattern: /otoplast/i, service: 'Otoplasty' },
  { pattern: /buttock\s*(inject|augment)/i, service: 'Buttock injections' },
  { pattern: /consultation/i, service: 'Consultation' },
];

/**
 * Detect service type from filename
 * Examples:
 * - "leads BREAST AUGMENT 2 January.csv" -> "Breast Augmentation"
 * - "Lead  FACE FILLERS Geneva 2 January.csv" -> "Face Fillers"
 * - "IV therapy 2 January.csv" -> "IV Therapy"
 */
export function detectServiceFromFilename(filename: string): string | null {
  for (const { pattern, service } of SERVICE_PATTERNS) {
    if (pattern.test(filename)) {
      return service;
    }
  }
  return null;
}

/**
 * Detect service type from the Form column value (per-lead)
 * Examples:
 * - "FACE FILLERS EN - cities Geneva|Montreux" -> "Face Fillers"
 * - "Liposuccion FR+cities!" -> "Liposuction"
 * - "TRAITEMENT DE RIDES FR" -> "Wrinkle Treatment"
 * - "Hyperbaric Oxygen Therapy (HBOT)" -> "Hyperbaric Oxygen Therapy"
 * - "longevity" -> "Longevity"
 */
// Form values that are NOT services (promos, junk, source column leaks)
const IGNORED_FORM_PATTERNS: RegExp[] = [
  /black\s*friday/i,
  /untitled\s*form/i,
  /^paid$/i,
  /^платный$/i,
  /^оплачено$/i,
];

export function detectServiceFromForm(form: string): string | null {
  if (!form || !form.trim()) return null;

  // Skip known junk / promo form values
  for (const ignore of IGNORED_FORM_PATTERNS) {
    if (ignore.test(form)) return null;
  }

  for (const { pattern, service } of SERVICE_PATTERNS) {
    if (pattern.test(form)) {
      return service;
    }
  }

  // No pattern matched — return the raw form value so per-lead service is preserved
  // The import route's resolveService() will try to fuzzy-match it against DB services
  return form.trim();
}

/**
 * Parse date string from CSV
 * Format: "01/01/2026 2:42pm"
 */
function parseLeadDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  try {
    const trimmed = dateStr.trim();

    // TikTok/Meta ISO format: "2026-04-12 06:35:39(UTC+01:00)" or "2026-04-12T06:35:39Z"
    const isoMatch = trimmed.match(
      /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?(?:\s*\(?UTC([+-]\d{2}):?(\d{2})\)?)?/i,
    );
    if (isoMatch) {
      const [, y, mo, d, h, mi, s, tzH, tzM] = isoMatch;
      if (tzH !== undefined) {
        // Build ISO string with explicit timezone offset
        const iso = `${y}-${mo}-${d}T${h}:${mi}:${s || "00"}${tzH}:${tzM || "00"}`;
        const dt = new Date(iso);
        if (!Number.isNaN(dt.getTime())) return dt;
      }
      return new Date(
        parseInt(y), parseInt(mo) - 1, parseInt(d),
        parseInt(h), parseInt(mi), s ? parseInt(s) : 0,
      );
    }

    // Legacy format: "01/01/2026 2:42pm"
    const parts = trimmed.split(' ');
    if (parts.length < 2) return null;

    const datePart = parts[0]; // "01/01/2026"
    const timePart = parts[1]; // "2:42pm"

    const [month, day, year] = datePart.split('/');
    
    // Parse time
    let hours = 0;
    let minutes = 0;
    if (timePart) {
      const timeMatch = timePart.match(/(\d+):(\d+)(am|pm)?/i);
      if (timeMatch) {
        hours = parseInt(timeMatch[1]);
        minutes = parseInt(timeMatch[2]);
        const meridiem = timeMatch[3]?.toLowerCase();
        
        if (meridiem === 'pm' && hours !== 12) {
          hours += 12;
        } else if (meridiem === 'am' && hours === 12) {
          hours = 0;
        }
      }
    }

    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), hours, minutes);
  } catch (error) {
    console.error('Error parsing date:', dateStr, error);
    return null;
  }
}

/**
 * Parse CSV content to array of lead objects
 */
export function parseLeadsCSV(csvContent: string, filename: string): ParsedLead[] {
  const lines = csvContent.split('\n').filter(line => line.trim());
  
  if (lines.length < 2) {
    throw new Error('CSV file is empty or has no data rows');
  }

  // Parse header and map to standard names with match scores.
  const rawHeaders = lines[0].split(',').map(h => h.trim());
  const scored = rawHeaders.map(h => mapColumnNameScored(h));
  const mappedHeaders = scored.map((r, i) => r.standard || rawHeaders[i]);

  console.log('[CSV Parser] Raw headers:', rawHeaders);
  console.log('[CSV Parser] Mapped headers:', mappedHeaders);

  // Build standard-name → index map. Two-pass: exact matches (score=2)
  // claim first, then partial matches (score=1) fill remaining slots.
  // Prevents TikTok's `campaign_name` / `ad_name` / `form_id` (partial
  // aliases) from overriding the actual `Source` / `form_name` columns.
  const columnMap = new Map<string, number>();
  scored.forEach((r, idx) => {
    if (r.standard && r.score === 2 && !columnMap.has(r.standard)) {
      columnMap.set(r.standard, idx);
    }
  });
  scored.forEach((r, idx) => {
    if (r.standard && r.score === 1 && !columnMap.has(r.standard)) {
      columnMap.set(r.standard, idx);
    }
  });
  
  // Validate required columns (at least one contact method)
  const hasName = columnMap.has('Name');
  const hasEmail = columnMap.has('Email');
  const hasPhone = columnMap.has('Phone');
  
  if (!hasName) {
    throw new Error('Missing required column: Name (or equivalent in your language)');
  }
  
  if (!hasEmail && !hasPhone) {
    throw new Error('Missing contact information: Need at least Email or Phone column');
  }

  // Detect ad-platform from raw column headers.
  // TikTok exports contain distinctive columns like created_time, ad_name,
  // campaign_name, form_name, form_id, is_organic, platform.
  const TIKTOK_HEADERS = ['created_time', 'ad_name', 'campaign_name', 'form_name', 'form_id', 'is_organic'];
  const lowerHeaders = rawHeaders.map(h => h.trim().toLowerCase());
  const tiktokHits = TIKTOK_HEADERS.filter(th => lowerHeaders.includes(th)).length;
  const detectedPlatform: ParsedLead['platform'] = tiktokHits >= 2 ? 'tiktok' : null;
  if (detectedPlatform) {
    console.log(`[CSV Parser] Detected platform: ${detectedPlatform} (${tiktokHits} header matches)`);
  }

  const filenameService = detectServiceFromFilename(filename);
  const leads: ParsedLead[] = [];

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    try {
      const values = parseCSVLine(line);
      const rowData: { [key: string]: string } = {};

      // Map values via the first-match-wins columnMap (built from mappedHeaders above)
      columnMap.forEach((idx, mappedCol) => {
        let value = values[idx] || '';

        // Smart phone number normalization: Excel strips leading zeros
        if ((mappedCol === 'Phone' || mappedCol === 'Secondary phone number' || mappedCol === 'WhatsApp number') && value) {
          value = normalizePhoneNumber(value);
        }

        rowData[mappedCol] = value;
      });

      const validationIssues: string[] = [];
      
      // Validate required fields
      if (!rowData['Name']) {
        validationIssues.push('Missing name');
      }
      if (!rowData['Email'] && !rowData['Phone'] && !rowData['WhatsApp number']) {
        validationIssues.push('Missing contact information (email or phone required)');
      }

      // Parse labels
      const labels = rowData['Labels'] 
        ? rowData['Labels'].split(',').map(l => l.trim()).filter(Boolean)
        : [];

      // Detect service per-lead from Form column, fallback to filename detection
      const formService = detectServiceFromForm(rowData['Form'] || '');
      const leadDetectedService = formService || filenameService;

      const lead: ParsedLead = {
        rowNumber: i,
        created: parseLeadDate(rowData['Created']),
        name: rowData['Name'] || '',
        email: rowData['Email'] || null,
        source: rowData['Source'] || '',
        form: rowData['Form'] || '',
        channel: rowData['Channel'] || '',
        stage: rowData['Stage'] || 'Intake',
        owner: rowData['Owner'] || 'Unassigned',
        labels,
        phones: {
          primary: rowData['Phone'] || null,
          secondary: rowData['Secondary phone number'] || null,
          whatsapp: rowData['WhatsApp number'] || null,
        },
        detectedService: leadDetectedService,
        platform: detectedPlatform,
        validationIssues,
      };

      leads.push(lead);
    } catch (error) {
      console.error(`Error parsing row ${i}:`, error);
      // Add error lead
      leads.push({
        rowNumber: i,
        created: null,
        name: `ERROR: Row ${i}`,
        email: null,
        source: '',
        form: '',
        channel: '',
        stage: 'Intake',
        owner: 'Unassigned',
        labels: [],
        phones: { primary: null, secondary: null, whatsapp: null },
        detectedService: filenameService,
        platform: detectedPlatform,
        validationIssues: [`Failed to parse row: ${error}`],
      });
    }
  }

  return leads;
}

/**
 * Normalize phone numbers that have been corrupted by Excel
 * Excel converts phone numbers to numbers, stripping leading zeros
 * e.g., "0793953137" becomes "793953137" or "7.93953137E+8"
 */
function normalizePhoneNumber(value: string): string {
  if (!value) return value;
  
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  
  // Handle scientific notation (Excel does this for large numbers)
  // e.g., "7.93953137E+8" or "4.1793953137E+10"
  if (trimmed.includes('E') || trimmed.includes('e')) {
    try {
      const num = parseFloat(trimmed);
      if (!isNaN(num)) {
        // Convert to string without scientific notation
        const normalized = num.toFixed(0);
        
        // Check if it looks like a Swiss number without leading 0
        // Swiss mobile: 9 digits starting with 7 or 8
        if (normalized.length === 9 && (normalized.startsWith('7') || normalized.startsWith('8'))) {
          return '0' + normalized;
        }
        
        return normalized;
      }
    } catch {
      return trimmed;
    }
  }
  
  // Check if value is purely numeric (no +, spaces, etc.)
  const digitsOnly = trimmed.replace(/\D/g, '');
  
  // If the original value was just digits and is 9 digits starting with 7 or 8
  // it's likely a Swiss mobile number missing the leading 0
  if (trimmed === digitsOnly && digitsOnly.length === 9 && (digitsOnly.startsWith('7') || digitsOnly.startsWith('8'))) {
    return '0' + digitsOnly;
  }
  
  // If it's 11 digits starting with 41 (e.g., 41793953137 = +41 79 395 31 37)
  if (trimmed === digitsOnly && digitsOnly.length === 11 && digitsOnly.startsWith('41')) {
    return '+' + digitsOnly;
  }
  
  // If it's 12 digits starting with 410 (e.g., 410794305878 = 41 + 079 + number, extra leading 0)
  if (trimmed === digitsOnly && digitsOnly.length === 12 && digitsOnly.startsWith('410')) {
    return '+41' + digitsOnly.substring(3);
  }

  // If it's 10 digits starting with 41 (e.g., 4179395313 = +41 79 395 31 3x, short but possible)
  if (trimmed === digitsOnly && digitsOnly.length === 10 && digitsOnly.startsWith('41')) {
    return '+' + digitsOnly;
  }

  // If it's 13-14 digits starting with 0041 (e.g., 0041793953137 or 00410793953137)
  if (trimmed === digitsOnly && (digitsOnly.length === 13 || digitsOnly.length === 14) && digitsOnly.startsWith('0041')) {
    return '+' + digitsOnly.substring(2);
  }

  return trimmed;
}

/**
 * Parse a single CSV line handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

/**
 * Validate email format
 */
export function isValidEmail(email: string | null): boolean {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Generate summary statistics for parsed leads
 */
export function generateLeadsSummary(leads: ParsedLead[]) {
  const total = leads.length;
  const withIssues = leads.filter(l => l.validationIssues.length > 0).length;
  const withoutPhone = leads.filter(l => !l.phones.primary && !l.phones.secondary && !l.phones.whatsapp).length;
  const withoutEmail = leads.filter(l => !l.email || !isValidEmail(l.email)).length;
  const detectedService = leads[0]?.detectedService;

  // Per-service breakdown
  const serviceBreakdown: Record<string, number> = {};
  for (const lead of leads) {
    const svc = lead.detectedService || 'Unknown';
    serviceBreakdown[svc] = (serviceBreakdown[svc] || 0) + 1;
  }

  return {
    total,
    valid: total - withIssues,
    withIssues,
    withoutPhone,
    withoutEmail,
    detectedService,
    serviceBreakdown,
  };
}

/**
 * Convert an XLSX (or XLS) file to the same CSV string that `parseLeadsCSV` expects.
 * Reads the first sheet, preserves empty cells, and properly quotes values
 * containing commas / newlines / quotes.
 *
 * Use this for Excel exports from Numbers, Google Sheets, Meta Ads, TikTok Ads, etc.
 */
export async function xlsxFileToCSV(file: File): Promise<string> {
  // Dynamic import so the 900KB SheetJS bundle is only loaded when needed
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: false });
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) throw new Error("Workbook has no sheets");
  const sheet = wb.Sheets[firstSheetName];
  // Use sheet_to_csv which already handles quoting + escaping correctly
  return XLSX.utils.sheet_to_csv(sheet, { blankrows: false, strip: false, forceQuotes: false });
}

/**
 * Parse leads from any supported spreadsheet File: .csv, .tsv, .xlsx, .xls.
 * Rejects .numbers (Apple Numbers binary format) with a friendly message
 * asking the user to export as CSV or Excel.
 */
export async function parseLeadsFile(file: File): Promise<ParsedLead[]> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".numbers")) {
    throw new Error(
      "Apple Numbers files (.numbers) cannot be imported directly. " +
      "In Numbers, open the file then choose File → Export To → CSV (or Excel) and upload that instead.",
    );
  }

  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const csv = await xlsxFileToCSV(file);
    return parseLeadsCSV(csv, file.name);
  }

  // Default: CSV / TSV (text-based)
  const text = await file.text();
  return parseLeadsCSV(text, file.name);
}
