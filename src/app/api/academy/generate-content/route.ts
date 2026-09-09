import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const LESSON_CONTENT_MAP: Record<string, string> = {
  // Getting Started
  "dashboard-overview": `The Aliice dashboard provides a quick overview of your clinic's activity.
Key sections include:
- **Upcoming Appointments**: Shows your next scheduled appointments
- **Recent Patients**: Quick access to recently viewed patients
- **Tasks & Mentions**: Notifications and assigned tasks
- **Quick Stats**: Key metrics like patients, revenue, and appointments`,

  "navigation-basics": `Aliice uses a sidebar navigation with these main sections:
- **Dashboard**: Home view with overview
- **Patients**: Patient list and management
- **Agenda**: Calendar and appointments
- **Deals**: Sales pipeline
- **Financials**: Invoices and billing
- **Settings**: System configuration

Use the **Favorites Bar** at the top for quick access to your most-used pages.`,

  "user-profile": `Your user profile contains:
- **Personal Info**: Name, email, role
- **Preferences**: Language, timezone, notification settings
- **Security**: Password change, two-factor authentication
- **Activity Log**: Your recent actions in the system`,

  // Patient Management
  "patient-list": `The patient list shows all your clinic's patients with:
- **Search**: Find patients by name, email, or phone
- **Filters**: Filter by lifecycle stage, source, or date
- **Columns**: Customize visible columns
- **Export**: Download patient data as CSV/Excel`,

  "creating-patients": `To create a new patient:
1. Click **"New Patient"** button
2. Fill in required fields: First name, Last name
3. Add optional info: Email, phone, DOB, address
4. Set lifecycle stage and source
5. Click **"Create"**

Pro tip: Use the quick-add form for faster entry.`,

  "patient-details": `Each patient profile contains tabs:
- **Cockpit**: Overview with key info
- **Medical**: Consultations, medications, 3D scans
- **CRM**: Activity, notes, emails, tasks, deals
- **Documents**: Files and templates
- **Appointments**: Scheduled visits`,

  "lifecycle-stages": `Lifecycle stages track patient journey:
- **Lead**: Initial contact
- **Prospect**: Showed interest
- **Consultation**: Had consultation
- **Active**: Current patient
- **Inactive**: Past patient
- **VIP**: High-value patient

Stages can be customized in Settings.`,

  // Swiss Billing
  "tardoc-codes": `TarDoc is the Swiss medical tariff system.
Key points:
- Each procedure has a unique TarDoc code
- Codes have point values (AL, TL)
- Points × tariff rate = price
- Use the search to find codes by name or number
- Common codes can be saved as favorites`,

  "sumex-invoices": `SUMEX is the Swiss standard for medical invoices.
Creating a SUMEX invoice:
1. Select patient and services
2. Add TarDoc codes
3. Set billing type (KVG/VVG/UVG)
4. Generate XML file
5. Send to insurance or patient`,

  "qr-bills": `Swiss QR Bills replaced the old payment slips.
Features:
- QR code contains all payment info
- IBAN and reference number embedded
- Automatic bank reconciliation
- Print directly from invoices`,

  "insurance-billing": `For insurance billing:
1. Verify patient's insurance card
2. Check coverage (KVG basic vs VVG supplemental)
3. Create invoice with correct guarantor
4. Export SUMEX XML
5. Submit to insurance
6. Track payment status`,

  "medidata": `Medidata is a Swiss healthcare network.
Use it to:
- Verify patient insurance coverage
- Look up provider information
- Submit electronic claims
- Check claim status`,
};

async function generateWithAI(lessonTitle: string, moduleTitle: string): Promise<string> {
  if (!process.env.GEMINI_API_KEY) {
    return `<h2>About ${lessonTitle}</h2><p>This lesson covers ${lessonTitle} in the ${moduleTitle} module. Content will be available soon.</p>`;
  }

  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const prompt = `Generate educational content for a lesson titled "${lessonTitle}" in the "${moduleTitle}" module of a medical clinic CRM system called Aliice.

The content should:
1. Be practical and actionable
2. Include step-by-step instructions where appropriate
3. Highlight key features and best practices
4. Be formatted in HTML with proper headings (h2, h3), paragraphs, and lists
5. Be approximately 300-500 words
6. Focus on Swiss medical clinic context when relevant

Aliice features include: patient management, appointments, Swiss medical billing (TarDoc, SUMEX), documents, email/WhatsApp communication, AI assistance, and workflow automation.

Output only the HTML content, no markdown code blocks.`;

  const result = await model.generateContent(prompt);
  return result.response.text();
}

export async function POST(request: Request) {
  try {
    const { lessonId, lessonTitle, moduleTitle } = await request.json();

    if (!lessonId || !lessonTitle) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Check if we have pre-defined content
    const { data: lesson } = await supabaseAdmin
      .from("academy_lessons")
      .select("slug, content")
      .eq("id", lessonId)
      .single();

    if (lesson?.content) {
      return NextResponse.json({ content: lesson.content });
    }

    // Check our content map
    const mappedContent = LESSON_CONTENT_MAP[lesson?.slug || ""];
    if (mappedContent) {
      const htmlContent = `<div class="lesson-content">
        <h2>${lessonTitle}</h2>
        ${mappedContent.split('\n').map(line => {
          if (line.startsWith('- **')) {
            return `<li><strong>${line.replace('- **', '').replace('**:', '</strong>:')}</li>`;
          }
          if (line.match(/^\d+\./)) {
            return `<li>${line.replace(/^\d+\.\s*/, '')}</li>`;
          }
          if (line.trim()) {
            return `<p>${line}</p>`;
          }
          return '';
        }).join('\n')}
      </div>`;

      // Save to database
      await supabaseAdmin
        .from("academy_lessons")
        .update({ content: htmlContent })
        .eq("id", lessonId);

      return NextResponse.json({ content: htmlContent });
    }

    // Generate with AI
    const content = await generateWithAI(lessonTitle, moduleTitle);

    // Save to database
    await supabaseAdmin
      .from("academy_lessons")
      .update({ content })
      .eq("id", lessonId);

    return NextResponse.json({ content });
  } catch (error) {
    console.error("Content generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate content" },
      { status: 500 }
    );
  }
}
