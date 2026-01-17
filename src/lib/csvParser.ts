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
    'data', 'date', 'datum', 'fecha', 'дата', 'date created'
  ],
  'Name': [
    'name', 'ім\'я', 'nom', 'nombre', 'nome', 'имя',
    'full name', 'fullname', 'contact name', 'lead name'
  ],
  'Email': [
    'email', 'електронна пошта', 'e-mail', 'correo', 'correio',
    'електронна адреса', 'эл. почта', 'email address'
  ],
  'Phone': [
    'phone', 'телефон', 'téléphone', 'telefon', 'teléfono',
    'phone number', 'mobile', 'cell', 'mobile number'
  ],
  'Source': [
    'source', 'джерело', 'источник', 'source', 'origen', 'fonte',
    'lead source', 'campaign source'
  ],
  'Form': [
    'form', 'форма', 'formulaire', 'formular', 'formulario',
    'form name', 'landing page'
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
    'secondary phone', 'другий номер', 'второй телефон',
    'alternate phone', 'phone 2'
  ],
  'WhatsApp number': [
    'whatsapp', 'номер whatsapp', 'whatsapp number',
    'wa number', 'whatsapp phone'
  ],
};

/**
 * Map CSV header to standard column name
 */
function mapColumnName(header: string): string | null {
  const normalized = header.trim().toLowerCase();
  
  for (const [standardName, variations] of Object.entries(COLUMN_MAPPINGS)) {
    if (variations.some(v => normalized === v || normalized.includes(v))) {
      return standardName;
    }
  }
  
  return null;
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
  validationIssues: string[];
};

/**
 * Detect service type from filename
 * Examples:
 * - "leads BREAST AUGMENT 2 January.csv" -> "Breast Augmentation"
 * - "Lead  FACE FILLERS Geneva 2 January.csv" -> "Face Fillers"
 * - "IV therapy 2 January.csv" -> "IV Therapy"
 */
export function detectServiceFromFilename(filename: string): string | null {
  const lower = filename.toLowerCase();
  
  // Service mapping
  const servicePatterns: { pattern: RegExp; service: string }[] = [
    { pattern: /breast\s+augment/i, service: 'Breast Augmentation' },
    { pattern: /face\s+fillers/i, service: 'Face Fillers' },
    { pattern: /wrinkles?\s+treatment/i, service: 'Wrinkle Treatment' },
    { pattern: /blepharoplast/i, service: 'Blepharoplasty' },
    { pattern: /liposuc/i, service: 'Liposuction' },
    { pattern: /iv\s+therapy/i, service: 'IV Therapy' },
    { pattern: /rhinoplast/i, service: 'Rhinoplasty' },
    { pattern: /facelift/i, service: 'Facelift' },
    { pattern: /botox/i, service: 'Botox' },
    { pattern: /lip\s+filler/i, service: 'Lip Fillers' },
    { pattern: /tummy\s+tuck/i, service: 'Tummy Tuck' },
    { pattern: /breast\s+lift/i, service: 'Breast Lift' },
  ];

  for (const { pattern, service } of servicePatterns) {
    if (pattern.test(filename)) {
      return service;
    }
  }

  return null;
}

/**
 * Parse date string from CSV
 * Format: "01/01/2026 2:42pm"
 */
function parseLeadDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  try {
    // Format: "01/01/2026 2:42pm"
    const parts = dateStr.split(' ');
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

  // Parse header and map to standard names
  const rawHeaders = lines[0].split(',').map(h => h.trim());
  const mappedHeaders = rawHeaders.map(h => mapColumnName(h) || h);
  
  // Create a mapping of standard name to original header index
  const columnMap = new Map<string, number>();
  mappedHeaders.forEach((mapped, idx) => {
    if (mapped) {
      columnMap.set(mapped, idx);
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

  const detectedService = detectServiceFromFilename(filename);
  const leads: ParsedLead[] = [];

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    try {
      const values = parseCSVLine(line);
      const rowData: { [key: string]: string } = {};
      
      // Map values using the column mapping
      mappedHeaders.forEach((mappedCol, idx) => {
        if (mappedCol) {
          rowData[mappedCol] = values[idx] || '';
        }
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
        detectedService,
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
        detectedService,
        validationIssues: [`Failed to parse row: ${error}`],
      });
    }
  }

  return leads;
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

  return {
    total,
    valid: total - withIssues,
    withIssues,
    withoutPhone,
    withoutEmail,
    detectedService,
  };
}
