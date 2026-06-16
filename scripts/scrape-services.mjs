// Scrapes the clinic's public service pages for descriptions + hero images,
// downloads the images into public/services/, and writes a typed data file at
// src/data/clinicServices.ts for the patient app's Services showcase.
//
// Run: node scripts/scrape-services.mjs
import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const IMG_DIR = join(ROOT, "public", "services");
const DATA_FILE = join(ROOT, "src", "data", "clinicServices.ts");

const BASE = "https://ads.aesthetics-ge.ch/en";

/** @type {{slug:string,name:string,categories:string[]}[]} */
const SERVICES = [
  { slug: "breast-augmentation", name: "Breast Augmentation", categories: ["Surgery"] },
  { slug: "liposuction", name: "Liposuction", categories: ["Surgery"] },
  { slug: "abdominoplasty", name: "Abdominoplasty", categories: ["Surgery"] },
  { slug: "blepharoplasty", name: "Blepharoplasty", categories: ["Surgery"] },
  { slug: "face-lifting", name: "Face Lifting", categories: ["Surgery"] },
  { slug: "soft-lift", name: "Soft Lift", categories: ["Injections"] },
  { slug: "wrinkles-treatment", name: "Wrinkles Treatment", categories: ["Injections", "Treatments"] },
  { slug: "fillers", name: "Fillers", categories: ["Injections"] },
  { slug: "skin-boosters-injections", name: "Skinboosters", categories: ["Injections"] },
  { slug: "exosomes", name: "Exosomes", categories: ["Longevity Medicine"] },
  { slug: "iv-drips", name: "IV Drips", categories: ["Longevity Medicine"] },
  { slug: "laser-hair-removal", name: "Laser Hair Removal", categories: ["Treatments"] },
  { slug: "co2-laser-treatment", name: "Fractional Laser CO2", categories: ["Treatments"] },
  { slug: "morpheus8", name: "Morpheus8", categories: ["Treatments"] },
  { slug: "cryolipolysis-treatment", name: "Cryolipolysis", categories: ["Treatments"] },
  { slug: "ems-culpt", name: "EMSculpt", categories: ["Treatments"] },
];

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function meta(html, prop) {
  // matches <meta property="og:image" content="..."> or name="..."
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, "i"),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return decode(m[1].trim());
  }
  return null;
}

function decode(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&rsquo;/g, "\u2019")
    .replace(/&hellip;/g, "\u2026")
    .trim();
}

// Junk image patterns (logos, favicons, decorative icons, shared promos).
const IMG_JUNK = /cropped-|favicon|logo|group-547|\/a\.png$|icon|sprite|placeholder|flag|avatar|wp-content\/plugins/i;
const IMG_PROMO = /ad-story|website-|banner|footer|header|cta-|popup|review|google|trustpilot/i;

function collectImages(html, baseUrl, slug, name) {
  const raw = [...html.matchAll(/https?:\/\/[^"' )]+wp-content\/uploads\/[^"' )]+\.(?:jpe?g|png|webp)/gi)].map(
    (m) => m[0],
  );
  // Normalise away the WordPress -WIDTHxHEIGHT thumbnail suffix to get originals.
  const normalised = raw.map((u) => u.replace(/-\d+x\d+(?=\.(?:jpe?g|png|webp)$)/i, ""));
  const seen = new Set();
  const candidates = [];
  for (const u of normalised) {
    if (IMG_JUNK.test(u)) continue;
    if (seen.has(u)) continue;
    seen.add(u);
    try {
      candidates.push(new URL(u, baseUrl).toString());
    } catch {
      /* ignore */
    }
  }
  // Keyword preference so the chosen hero relates to the actual service.
  const keywords = [
    slug.replace(/-/g, " "),
    ...slug.split("-"),
    ...name.toLowerCase().split(/\s+/),
    "breast", "lipo", "abdomino", "blepharo", "face", "soft", "wrinkle", "filler",
    "skin", "exosome", "iv", "drip", "laser", "co2", "morpheus", "cryo", "ems", "sculpt",
  ].filter((k) => k && k.length > 2);
  const byKeyword = candidates.filter((c) => keywords.some((k) => c.toLowerCase().includes(k)));
  const nonPromo = candidates.filter((c) => !IMG_PROMO.test(c));
  const ordered = [...new Set([...byKeyword, ...nonPromo, ...candidates])];
  return ordered.slice(0, 4);
}

async function downloadImage(absUrl, slug, idx) {
  const imgRes = await fetch(absUrl, { headers: { "User-Agent": UA } });
  if (!imgRes.ok) return null;
  const buf = Buffer.from(await imgRes.arrayBuffer());
  if (buf.length < 3000) return null; // skip tiny/spacer images
  const fileName = idx === 0 ? `${slug}${extFromUrl(absUrl)}` : `${slug}-${idx}${extFromUrl(absUrl)}`;
  await writeFile(join(IMG_DIR, fileName), buf);
  return { path: `/services/${fileName}`, size: buf.length };
}

function firstParagraph(html) {
  // Strip scripts/styles, then grab the first reasonably long <p> text.
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");
  const paras = [...cleaned.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((m) =>
    decode(m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()),
  );
  const good = paras.find((p) => p.length > 80);
  return good || null;
}

function extFromUrl(url) {
  try {
    const p = new URL(url).pathname.toLowerCase();
    const m = p.match(/\.(jpe?g|png|webp|avif|gif)$/);
    return m ? `.${m[1].replace("jpeg", "jpg")}` : ".jpg";
  } catch {
    return ".jpg";
  }
}

async function main() {
  await mkdir(IMG_DIR, { recursive: true });
  await mkdir(dirname(DATA_FILE), { recursive: true });

  const results = [];

  for (const svc of SERVICES) {
    const url = `${BASE}/${svc.slug}/`;
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "en" } });
      if (!res.ok) {
        console.warn(`! ${svc.slug}: HTTP ${res.status}`);
        results.push({ ...svc, url, image: null, images: [], title: svc.name, description: null });
        continue;
      }
      const html = await res.text();

      const title = meta(html, "og:title") || svc.name;
      const description =
        meta(html, "og:description") || meta(html, "description") || firstParagraph(html);

      const candidates = collectImages(html, url, svc.slug, svc.name);
      const images = [];
      for (const cand of candidates) {
        try {
          const dl = await downloadImage(cand, svc.slug, images.length);
          if (dl) images.push(dl.path);
        } catch {
          /* skip individual image failures */
        }
        if (images.length >= 3) break;
      }
      console.log(`✓ ${svc.slug} (${images.length} image${images.length === 1 ? "" : "s"})`);

      const cleanTitle =
        (decode(title).replace(/\s*[|–—-]\s*Aesthetics?\s*Clinic.*$/i, "").trim()) || svc.name;

      results.push({
        ...svc,
        url,
        image: images[0] ?? null,
        images,
        title: cleanTitle,
        description: description ? description.replace(/\s+/g, " ").slice(0, 600).trim() : null,
      });
    } catch (e) {
      console.warn(`! ${svc.slug}: ${e.message}`);
      results.push({ ...svc, url, image: null, images: [], title: svc.name, description: null });
    }
  }

  const header = `// AUTO-GENERATED by scripts/scrape-services.mjs — do not edit by hand.
// Source: ${BASE}/

export type ClinicService = {
  slug: string;
  name: string;
  title: string;
  categories: string[];
  url: string;
  image: string | null;
  images: string[];
  description: string | null;
};

export const CLINIC_SERVICE_CATEGORIES = [
  "Surgery",
  "Injections",
  "Longevity Medicine",
  "Treatments",
] as const;

export const CLINIC_SERVICES: ClinicService[] = ${JSON.stringify(results, null, 2)};
`;

  await writeFile(DATA_FILE, header, "utf8");
  console.log(`\nWrote ${results.length} services to ${DATA_FILE}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
