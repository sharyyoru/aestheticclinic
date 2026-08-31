# AI Integration

## Overview

The system uses Google Gemini AI for:
- Personalized email generation
- Document summarization
- Patient communication assistance

## Setup

```bash
npm install @google/generative-ai
```

```env
GEMINI_API_KEY=your_api_key_here
```

## Email Generation API

```typescript
// src/app/api/patients/generate-email/route.ts
import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(request: NextRequest) {
  const { patientId, description, tone, knowledgebaseTopicIds } = await request.json();

  if (!patientId || !description) {
    return NextResponse.json(
      { error: "patientId and description are required" },
      { status: 400 }
    );
  }

  // Fetch patient details
  const { data: patient } = await supabaseAdmin
    .from("patients")
    .select("first_name, last_name, email, phone")
    .eq("id", patientId)
    .single();

  if (!patient) {
    return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  }

  // Fetch knowledgebase context if provided
  let knowledgebaseContext = "";
  if (knowledgebaseTopicIds?.length) {
    const { data: topics } = await supabaseAdmin
      .from("knowledgebase_topics")
      .select("title, messages:knowledgebase_messages(content)")
      .in("id", knowledgebaseTopicIds);

    knowledgebaseContext = topics?.map(t => 
      `Topic: ${t.title}\n${t.messages.map(m => m.content).join("\n")}`
    ).join("\n\n") || "";
  }

  // Build prompt
  const prompt = `
You are writing an email for an aesthetics clinic.

Patient: ${patient.first_name} ${patient.last_name}
Email goal: ${description}
Tone: ${tone || "professional and reassuring"}

${knowledgebaseContext ? `Context from knowledgebase:\n${knowledgebaseContext}` : ""}

Write a personalized email. Include a greeting with the patient's first name.
Do NOT include clinic signature or contact info (added separately).

Respond with strict JSON only:
{
  "subject": "email subject line",
  "body": "email body in plain text"
}`;

  try {
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash",
      systemInstruction: "You are an email assistant for Aesthetics Clinic. You write concise, empathetic, medically appropriate emails. Always output strict JSON with keys 'subject' and 'body' (plain text, no HTML)."
    });

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    // Parse JSON response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Invalid response format");
    }
    
    const emailData = JSON.parse(jsonMatch[0]);
    return NextResponse.json(emailData);
    
  } catch (error) {
    console.error("AI generation error:", error);
    return NextResponse.json(
      { 
        subject: "Follow-up from Aesthetics Clinic",
        body: `Dear ${patient.first_name},\n\nThank you for your interest. We will be in touch soon.\n\nBest regards`
      },
      { status: 200 }
    );
  }
}
```

## Request/Response Types

```typescript
// Request
interface GenerateEmailRequest {
  patientId: string;           // Required - Patient UUID
  description: string;         // Required - Goal/context for the email
  tone?: string;               // Optional - Default: "professional and reassuring"
  knowledgebaseTopicIds?: string[];  // Optional - Topics to include as context
}

// Response
interface GenerateEmailResponse {
  subject: string;  // Generated email subject line
  body: string;     // Generated email body (plain text)
}
```

## Frontend Integration

```typescript
// In PatientActivityCard or similar component
"use client";

import { useState } from "react";

export function EmailComposer({ patientId }) {
  const [description, setDescription] = useState("");
  const [generating, setGenerating] = useState(false);
  const [email, setEmail] = useState({ subject: "", body: "" });

  const generateEmail = async () => {
    setGenerating(true);
    try {
      const response = await fetch("/api/patients/generate-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          description,
          tone: "warm and professional",
        }),
      });
      
      const data = await response.json();
      setEmail(data);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Describe what the email should be about..."
      />
      <button onClick={generateEmail} disabled={generating}>
        {generating ? "Generating..." : "Generate with AI"}
      </button>
      
      {email.subject && (
        <div>
          <input value={email.subject} readOnly />
          <textarea value={email.body} readOnly />
        </div>
      )}
    </div>
  );
}
```

## Knowledgebase Context

Store clinic policies, procedures, and FAQs that AI can reference:

```sql
CREATE TABLE knowledgebase_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE knowledgebase_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID REFERENCES knowledgebase_topics(id),
  content TEXT NOT NULL,
  role TEXT DEFAULT 'assistant',  -- 'user' or 'assistant'
  created_at TIMESTAMPTZ DEFAULT now()
);
```

## AI Model Configuration

```typescript
const model = genAI.getGenerativeModel({
  model: "gemini-2.0-flash",  // Fast, good for most tasks
  generationConfig: {
    temperature: 0.7,         // Creativity level (0-1)
    maxOutputTokens: 1024,
    topP: 0.95,
  },
  systemInstruction: "...",   // Global context/rules
});
```

## Best Practices

1. **Always validate AI output** - Parse JSON carefully, have fallbacks
2. **Rate limiting** - Implement request throttling for AI endpoints
3. **Context length** - Keep prompts concise, trim knowledgebase content
4. **Audit logging** - Log AI generations for review
5. **Human review** - AI-generated content should be editable before sending

## Error Handling

```typescript
try {
  const result = await model.generateContent(prompt);
  // Process result...
} catch (error) {
  if (error.message.includes("SAFETY")) {
    // Content was blocked by safety filters
    return NextResponse.json({ error: "Content flagged" }, { status: 400 });
  }
  if (error.message.includes("QUOTA")) {
    // Rate limited
    return NextResponse.json({ error: "Try again later" }, { status: 429 });
  }
  // Generic fallback
  return NextResponse.json({ error: "Generation failed" }, { status: 500 });
}
```

## Markdown to HTML Conversion

For AI-generated content that needs HTML rendering:

```typescript
// src/utils/markdownToHtml.ts
export function markdownToHtml(markdown: string): string {
  return markdown
    .replace(/\n\n/g, "</p><p>")           // Paragraphs
    .replace(/\n/g, "<br>")                 // Line breaks
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")  // Bold
    .replace(/\*(.+?)\*/g, "<em>$1</em>")   // Italic
    .replace(/^- (.+)/gm, "<li>$1</li>")    // List items
    .replace(/<li>/g, "<ul><li>")           // Wrap lists
    .replace(/<\/li>(?![\s\S]*<li>)/g, "</li></ul>");
}
```
