/**
 * Sumex1 ACF Validator API Client
 *
 * Connects to the Sumex1 acfValidatorServer100 to provide live ACF
 * (Ambulatory Case Flatrate) catalog browsing, searching, and validation.
 *
 * Tariffs:
 * - 005 (ACF) — Ambulatory Case Flatrates (surgery flat rates)
 * - TMA (LKAAT) — Leistungskatalog Ambulante Akutversorgung Tarifierung
 *
 * API Pattern (same as tardocValidatorServer100):
 * - Properties (read): GET  Interface/Get{PropertyName}?p{Interface}=handle
 * - Methods:           POST Interface/{MethodName} with JSON body
 * - Factory:           GET  IAcfValidator/GetCreateAcfValidator (no params)
 * - Sub-interfaces:    GET  IAcfValidator/GetCreate{SubInterface}?pIAcfValidator=handle
 *
 * Interfaces: IAcfValidator, ISearch005, ISearchTMA, IValidate005, IValidateTMA
 */

const SUMEX_ACF_BASE_URL =
  process.env.SUMEX_ACF_URL ||
  "http://34.100.230.253:8080/acfValidatorServer100";

// Language enum matching Sumex1 API
export type AcfLanguage = 1 | 2 | 3; // 1=DE, 2=FR, 3=IT

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export type AcfServiceRecord = {
  code: string;
  name: string;
  interpretation: string;
  chapterCode: string;
  chapterName: string;
  referenceCode: string;
  tariffType: string; // "005"
  tp: number; // flat rate CHF amount
  validFrom: string;
  validTo: string;
  serviceProperties: number;
};

export type AcfTariffInfo = {
  dbVersion: string;
  name: string;
  tariffType: string;
  dbDate: string;
  validFrom: number;
  validTo: number;
};

export type AcfSession = {
  validatorHandle: number;
  language: AcfLanguage;
  moduleVersion: string;
  tariff005: AcfTariffInfo | null;
  tariffTMA: AcfTariffInfo | null;
  createdAt: number;
};

// --------------------------------------------------------------------------
// Low-level API helpers
// --------------------------------------------------------------------------

async function acfGet<T = Record<string, unknown>>(
  path: string,
): Promise<T> {
  const url = `${SUMEX_ACF_BASE_URL}/${path}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Sumex ACF GET ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

async function acfPost<T = Record<string, unknown>>(
  iface: string,
  method: string,
  body: Record<string, unknown>,
): Promise<T> {
  const url = `${SUMEX_ACF_BASE_URL}/${iface}/${method}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Sumex ACF POST ${iface}/${method} failed: ${res.status} ${errBody}`);
  }
  return res.json() as Promise<T>;
}

// --------------------------------------------------------------------------
// Session Management
// --------------------------------------------------------------------------

let cachedAcfSession: AcfSession | null = null;
const ACF_SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

function isAcfSessionValid(session: AcfSession | null): session is AcfSession {
  if (!session) return false;
  return Date.now() - session.createdAt < ACF_SESSION_TTL_MS;
}

export async function getOrCreateAcfSession(
  language: AcfLanguage = 2,
): Promise<AcfSession> {
  if (isAcfSessionValid(cachedAcfSession) && cachedAcfSession.language === language) {
    return cachedAcfSession;
  }

  // Create validator via factory endpoint
  const factoryData = await acfGet<{ pIAcfValidator: number }>(
    "IAcfValidator/GetCreateAcfValidator",
  );
  const handle = factoryData.pIAcfValidator;

  // Open with language
  const openRes = await acfPost<{ pbStatus: boolean }>(
    "IAcfValidator",
    "Open",
    { pIAcfValidator: handle, eLanguage: language },
  );
  if (!openRes.pbStatus) throw new Error("Failed to open AcfValidator");

  // Get module version
  const moduleVersion = await acfGet<{ pbstrModuleVersion: string }>(
    `IAcfValidator/GetModuleVersion?pIAcfValidator=${handle}`,
  ).then((r) => r.pbstrModuleVersion).catch(() => "unknown");

  // Get tariff info for 005 and TMA
  const [tariff005, tariffTMA] = await Promise.all([
    acfPost<{
      pbStatus: boolean;
      pbstrDBVersion: string;
      pbstrName: string;
      pbstrTariffType: string;
      pdDBDate: string;
      plValidFrom: number;
      plValidTo: number;
    }>("IAcfValidator", "GetTariff005", { pIAcfValidator: handle })
      .then((r) => r.pbStatus ? {
        dbVersion: r.pbstrDBVersion,
        name: r.pbstrName,
        tariffType: r.pbstrTariffType,
        dbDate: r.pdDBDate,
        validFrom: r.plValidFrom,
        validTo: r.plValidTo,
      } : null)
      .catch(() => null),
    acfPost<{
      pbStatus: boolean;
      pbstrDBVersion: string;
      pbstrName: string;
      pbstrTariffType: string;
      pdDBDate: string;
      plValidFrom: number;
      plValidTo: number;
    }>("IAcfValidator", "GetTariffTMA", { pIAcfValidator: handle })
      .then((r) => r.pbStatus ? {
        dbVersion: r.pbstrDBVersion,
        name: r.pbstrName,
        tariffType: r.pbstrTariffType,
        dbDate: r.pdDBDate,
        validFrom: r.plValidFrom,
        validTo: r.plValidTo,
      } : null)
      .catch(() => null),
  ]);

  const session: AcfSession = {
    validatorHandle: handle,
    language,
    moduleVersion,
    tariff005,
    tariffTMA,
    createdAt: Date.now(),
  };

  cachedAcfSession = session;
  return session;
}

export function invalidateAcfSession(): void {
  cachedAcfSession = null;
}

// --------------------------------------------------------------------------
// ISearch005 — Browse & Search ACF Flat Rate Codes
// --------------------------------------------------------------------------

function mapAcfServiceRecord(raw: Record<string, unknown>): AcfServiceRecord {
  return {
    code: (raw.pbstrCode as string) ?? "",
    name: (raw.pbstrName as string) ?? "",
    interpretation: (raw.pbstrInterpretation as string) ?? "",
    chapterCode: (raw.pbstrChapterCode as string) ?? "",
    chapterName: (raw.pbstrChapterName as string) ?? "",
    referenceCode: (raw.pbstrReferenceCode as string) ?? "",
    tariffType: (raw.pbstrTariffType as string) ?? "005",
    tp: (raw.pdTP as number) ?? 0,
    validFrom: (raw.pdValidFrom as string) ?? "",
    validTo: (raw.pdValidTo as string) ?? "",
    serviceProperties: (raw.plServiceProperties as number) ?? 0,
  };
}

/**
 * Create a fresh ISearch005 handle for searching ACF codes.
 */
async function createSearch005(session: AcfSession): Promise<number> {
  const data = await acfGet<{ pISearch005: number }>(
    `IAcfValidator/GetCreateSearch005?pIAcfValidator=${session.validatorHandle}`,
  );
  return data.pISearch005;
}

/**
 * Search ACF flat rate codes.
 *
 * @param code - ACF code pattern (e.g. "C01*", "*" for all). Uses wildcard *.
 * @param chapterCode - Filter by chapter (e.g. "Cap01"). Empty = all chapters.
 * @param name - Filter by name substring. Empty = no name filter.
 * @param onlyValid - Only return currently valid services.
 * @param date - Reference date for validity check (ISO string).
 */
export async function searchAcf005(
  code: string = "*",
  chapterCode: string = "",
  name: string = "",
  onlyValid: boolean = true,
  date?: string,
  language: AcfLanguage = 2,
): Promise<{ count: number; services: AcfServiceRecord[] }> {
  const session = await getOrCreateAcfSession(language);
  const searchHandle = await createSearch005(session);

  const searchDate = date || new Date().toISOString().split("T")[0] + "T00:00:00";

  await acfPost("ISearch005", "SearchGeneral", {
    pISearch005: searchHandle,
    bstrCode: code,
    bstrChapterCode: chapterCode,
    bstrName: name,
    bOnlyValidServices: onlyValid,
    dDate: searchDate,
  });

  const countRes = await acfPost<{ pbStatus: boolean; plSize: number }>(
    "ISearch005",
    "GetRecordCount",
    { pISearch005: searchHandle },
  );

  const count = countRes.plSize ?? 0;
  if (count === 0) return { count: 0, services: [] };

  // Fetch in batches of 100 to avoid overloading
  const allServices: AcfServiceRecord[] = [];
  let offset = 0;
  while (offset < count) {
    const batchSize = Math.min(100, count - offset);
    const rawServices = await acfPost<Array<Record<string, unknown>>>(
      "ISearch005",
      "GetServices",
      { pISearch005: searchHandle, lStartRecordID: offset, lNumberOfRecords: batchSize },
    );

    if (Array.isArray(rawServices)) {
      const batch = rawServices
        .filter((r) => r.pbStatus)
        .map(mapAcfServiceRecord);
      allServices.push(...batch);
    }
    offset += batchSize;
  }

  return { count, services: allServices };
}

/**
 * Get all unique chapters from the ACF catalog.
 * Searches all services and extracts unique chapter codes/names.
 */
export async function getAcfChapters(
  language: AcfLanguage = 2,
): Promise<Array<{ code: string; name: string; count: number }>> {
  const { services } = await searchAcf005("*", "", "", true, undefined, language);

  const chapterMap = new Map<string, { name: string; count: number }>();
  for (const svc of services) {
    const existing = chapterMap.get(svc.chapterCode);
    if (existing) {
      existing.count++;
    } else {
      chapterMap.set(svc.chapterCode, { name: svc.chapterName, count: 1 });
    }
  }

  return Array.from(chapterMap.entries())
    .map(([code, info]) => ({ code, name: info.name, count: info.count }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

// --------------------------------------------------------------------------
// IValidate005 — Validate & Calculate ACF Service Pricing
// --------------------------------------------------------------------------
//
// Workflow (from Sumex1 API docs):
// 1. Initialize() — reset the validator
// 2. AddService() — add each service with parameters (code, date, side, etc.)
//    - Returns 0 on success, >0 if validation rule failed (service rejected)
//    - After adding, read back properties for calculated amount/TP
// 3. Finalize() — run final rule checks, returns count of ACF flat rates and total
// 4. GetFirstService/GetNextService/GetServices — iterate validated services
//
// Key parameters that affect pricing:
// - SideType: 0=none, 1=left, 2=right, 3=both (bilateral may double price)
// - ExternalFactor: multiplier applied to the amount
// - TPValue: tax point value (for ACF this is typically 1.0 since TP = CHF)
// - SessionNumber: groups related services together across days
// - ReferenceCode: can be used as ICD-10 container
// - Date: affects validity and pricing period

export type AcfSideType = 0 | 1 | 2 | 3; // 0=none, 1=left, 2=right, 3=both

export type AcfValidateServiceInput = {
  code: string;
  referenceCode?: string; // ICD-10 code
  quantity?: number;
  sessionNumber?: number;
  date?: string; // ISO date string
  side?: AcfSideType;
  externalFactor?: number;
  tp?: number; // The flat rate CHF amount (tax points = CHF for ACF)
  tpValue?: number; // Tax point multiplier (typically 1.0 for ACF since TP = CHF)
  amount?: number; // Pre-calculated amount (0 = let validator calculate)
  ignoreValidate?: boolean;
  hook?: number;
};

export type AcfValidatedService = {
  code: string;
  name: string;
  referenceCode: string;
  tariffType: string;
  quantity: number;
  tp: number;
  amount: number;
  tpValue: number;
  externalFactor: number;
  side: AcfSideType;
  sessionNumber: number;
};

export type AcfFinalizeResult = {
  count: number;
  totalAmount: number;
  success: boolean;
  addedServiceCount?: number;
  modifiedServiceCount?: number;
  deletedServiceCount?: number;
};

/**
 * Create a fresh IValidate005 handle.
 */
async function createValidate005(session: AcfSession): Promise<number> {
  const data = await acfGet<{ pIValidate005: number }>(
    `IAcfValidator/GetCreateValidate005?pIAcfValidator=${session.validatorHandle}`,
  );
  return data.pIValidate005;
}

/**
 * Initialize the IValidate005 validator (reset state for a new validation).
 */
export async function initializeValidate005(
  language: AcfLanguage = 2,
): Promise<{ validateHandle: number }> {
  const session = await getOrCreateAcfSession(language);
  const handle = await createValidate005(session);

  await acfPost("IValidate005", "Initialize", {
    pIValidate005: handle,
  });

  return { validateHandle: handle };
}

/**
 * Add a service to the IValidate005 validator.
 *
 * Returns the validation result code (0 = success, >0 = rejected).
 * After adding, reads back the calculated Amount and TP from properties.
 */
export async function addServiceToValidate005(
  validateHandle: number,
  input: AcfValidateServiceInput,
): Promise<{
  resultCode: number;
  success: boolean;
  abortInfo: string | null;
  calculatedAmount: number;
  calculatedTP: number;
}> {
  const dateStr = input.date || new Date().toISOString().split("T")[0] + "T00:00:00";

  // Use raw fetch to handle 400 validation rejections without throwing
  const addUrl = `${SUMEX_ACF_BASE_URL}/IValidate005/AddService`;
  const addBody = {
    pIValidate005: validateHandle,
    bstrCode: input.code,
    bstrReferenceCode: input.referenceCode || "",
    dQuantity: input.quantity ?? 1,
    lSessionNumber: input.sessionNumber ?? 1,
    dDate: dateStr,
    eSide: input.side ?? 0,
    dExternalFactor: input.externalFactor ?? 1.0,
    dTP: input.tp ?? 0,
    dTPValue: input.tpValue ?? 1.0,
    dAmount: input.amount ?? 0,
    eIgnoreValidate: input.ignoreValidate ? 1 : 0,
    lHook: input.hook ?? 0,
  };
  const addRes = await fetch(addUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(addBody),
    cache: "no-store",
  });

  // Handle 400 as a validation rejection (not a server error)
  if (!addRes.ok) {
    const errBody = await addRes.json().catch(() => ({})) as Record<string, unknown>;
    const abortText = (errBody.pbstrAbortText as string) || null;
    const abortCode = (errBody.plAbortCode as number) || 0;
    return {
      resultCode: abortCode || 1,
      success: false,
      abortInfo: abortText,
      calculatedAmount: 0,
      calculatedTP: 0,
    };
  }

  const result = await addRes.json() as { pbStatus: boolean; plResult?: number };
  const resultCode = result.plResult ?? (result.pbStatus ? 0 : 1);

  // If validation failed, get abort info
  let abortInfo: string | null = null;
  if (resultCode !== 0) {
    try {
      const info = await acfPost<{ pbstrAbortInfo: string }>(
        "IValidate005",
        "GetAbortInfo",
        { pIValidate005: validateHandle },
      );
      abortInfo = info.pbstrAbortInfo || null;
    } catch { /* ignore */ }
  }

  // Read back calculated values
  let calculatedAmount = 0;
  let calculatedTP = 0;
  try {
    const amountRes = await acfGet<{ pdAmount: number }>(
      `IValidate005/GetAmount?pIValidate005=${validateHandle}`,
    );
    calculatedAmount = amountRes.pdAmount ?? 0;
  } catch { /* ignore */ }
  try {
    const tpRes = await acfGet<{ pdTP: number }>(
      `IValidate005/GetTP?pIValidate005=${validateHandle}`,
    );
    calculatedTP = tpRes.pdTP ?? 0;
  } catch { /* ignore */ }

  return {
    resultCode,
    success: resultCode === 0,
    abortInfo,
    calculatedAmount,
    calculatedTP,
  };
}

/**
 * Finalize the validation. Call after all services have been added.
 * Returns the number of ACF flat rate codes and total summed amount.
 * Also retrieves counts of services added/modified/deleted by the validator.
 */
export async function finalizeValidate005(
  validateHandle: number,
): Promise<AcfFinalizeResult> {
  const result = await acfPost<{
    pbStatus: boolean;
    plNumberOfACFs?: number;
    pdSumAmount?: number;
  }>(
    "IValidate005",
    "Finalize",
    { pIValidate005: validateHandle },
  );

  // Try to get service change counts (validator may add/modify/delete services)
  let addedCount = 0;
  let modifiedCount = 0;
  let deletedCount = 0;

  try {
    const addedRes = await acfGet<{ plAddedServiceCount?: number }>(
      `IValidate005/GetAddedServiceCount?pIValidate005=${validateHandle}`,
    );
    addedCount = addedRes.plAddedServiceCount ?? 0;
  } catch { /* Property may not exist */ }

  try {
    const modifiedRes = await acfGet<{ plModifiedServiceCount?: number }>(
      `IValidate005/GetModifiedServiceCount?pIValidate005=${validateHandle}`,
    );
    modifiedCount = modifiedRes.plModifiedServiceCount ?? 0;
  } catch { /* Property may not exist */ }

  try {
    const deletedRes = await acfGet<{ plDeletedServiceCount?: number }>(
      `IValidate005/GetDeletedServiceCount?pIValidate005=${validateHandle}`,
    );
    deletedCount = deletedRes.plDeletedServiceCount ?? 0;
  } catch { /* Property may not exist */ }

  return {
    count: result.plNumberOfACFs ?? 0,
    totalAmount: result.pdSumAmount ?? 0,
    success: result.pbStatus ?? false,
    addedServiceCount: addedCount,
    modifiedServiceCount: modifiedCount,
    deletedServiceCount: deletedCount,
  };
}

/**
 * Get all validated services after Finalize.
 * Returns the list of services as modified/grouped by the validator.
 */
export async function getValidatedServices005(
  validateHandle: number,
): Promise<AcfValidatedService[]> {
  const services: AcfValidatedService[] = [];

  // Try GetFirstService / GetNextService iteration
  try {
    const first = await acfPost<Record<string, unknown>>(
      "IValidate005",
      "GetFirstService",
      { pIValidate005: validateHandle },
    );

    if (first.pbStatus) {
      services.push(mapValidatedService(first));

      // Iterate remaining
      let hasMore = true;
      while (hasMore) {
        try {
          const next = await acfPost<Record<string, unknown>>(
            "IValidate005",
            "GetNextService",
            { pIValidate005: validateHandle },
          );
          if (next.pbStatus) {
            services.push(mapValidatedService(next));
          } else {
            hasMore = false;
          }
        } catch {
          hasMore = false;
        }
      }
    }
  } catch { /* GetFirstService may not exist or return empty */ }

  return services;
}

function mapValidatedService(raw: Record<string, unknown>): AcfValidatedService {
  return {
    code: (raw.pbstrCode as string) ?? "",
    name: (raw.pbstrName as string) ?? "",
    referenceCode: (raw.pbstrReferenceCode as string) ?? "",
    tariffType: (raw.pbstrTariffType as string) ?? "005",
    quantity: (raw.pdQuantity as number) ?? 1,
    tp: (raw.pdTP as number) ?? 0,
    amount: (raw.pdAmount as number) ?? 0,
    tpValue: (raw.pdTPValue as number) ?? 1.0,
    externalFactor: (raw.pdExternalFactor as number) ?? 1.0,
    side: ((raw.peSide ?? raw.eSide ?? 0) as AcfSideType),
    sessionNumber: (raw.plSessionNumber as number) ?? 1,
  };
}

/**
 * Get ACF session/tariff info for display purposes.
 */
export async function getAcfSessionInfo(
  language: AcfLanguage = 2,
): Promise<{
  moduleVersion: string;
  language: AcfLanguage;
  tariff005: AcfTariffInfo | null;
  tariffTMA: AcfTariffInfo | null;
}> {
  const session = await getOrCreateAcfSession(language);
  return {
    moduleVersion: session.moduleVersion,
    language: session.language,
    tariff005: session.tariff005,
    tariffTMA: session.tariffTMA,
  };
}
