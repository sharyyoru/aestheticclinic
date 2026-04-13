import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const runtime = "nodejs";
export const maxDuration = 60;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;

type ArticleRequest = {
  keyword: string;
  relatedKeywords: string[];
  questions: string[];
  targetAudience: string;
  articleType: "blog" | "landing" | "faq" | "guide";
  language: "en" | "fr" | "de";
  tone: "professional" | "friendly" | "authoritative";
  wordCount: number;
};

export async function POST(request: NextRequest) {
  try {
    const body: ArticleRequest = await request.json();
    const {
      keyword,
      relatedKeywords = [],
      questions = [],
      targetAudience = "European adults interested in aesthetic medicine",
      articleType = "blog",
      language = "en",
      tone = "professional",
      wordCount = 1500,
    } = body;

    if (!keyword) {
      return NextResponse.json({ error: "Keyword is required" }, { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        maxOutputTokens: 8192,
      },
    });

    const languageNames: Record<string, string> = {
      en: "English",
      fr: "French",
      de: "German",
    };

    const articleTypeInstructions: Record<string, string> = {
      blog: "Write an engaging blog post that educates and informs readers while naturally incorporating the keywords.",
      landing: "Write a persuasive landing page that highlights benefits and includes clear calls-to-action.",
      faq: "Write an FAQ-style article that answers common questions in a clear, helpful manner.",
      guide: "Write a comprehensive guide that thoroughly covers the topic with practical advice.",
    };

    const prompt = `You are an expert SEO content writer specializing in aesthetic medicine and cosmetic procedures for a European audience.

Write a ${articleType} article in ${languageNames[language]} about "${keyword}" for ${targetAudience}.

**Primary Keyword:** ${keyword}
**Related Keywords to Include:** ${relatedKeywords.slice(0, 10).join(", ") || "None provided"}
**Questions to Address:** ${questions.slice(0, 5).join("; ") || "None provided"}

**Requirements:**
- Target word count: approximately ${wordCount} words
- Tone: ${tone}
- ${articleTypeInstructions[articleType]}
- Include proper headings (H2, H3) for SEO structure
- Naturally incorporate the primary keyword and related keywords throughout
- Address the provided questions within the content
- Include a compelling meta description (150-160 characters)
- Include a suggested title tag (50-60 characters)
- For a clinic website: https://www.aesthetics-ge.ch/

**Content Guidelines for Aesthetic Medicine:**
- Be medically accurate but accessible to general readers
- Emphasize safety, professionalism, and patient care
- Include information about consultation process
- Mention that results may vary and professional consultation is recommended
- Focus on the Swiss/European market context
- Reference Swiss quality standards where appropriate

**Output Format:**
Return the article in markdown format with:
1. TITLE TAG: (at the top)
2. META DESCRIPTION: (below title)
3. The full article content with proper markdown headings
4. A "Key Takeaways" section at the end
5. A subtle call-to-action for booking a consultation`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const content = response.text();

    if (!content) {
      return NextResponse.json({ error: "Failed to generate content" }, { status: 500 });
    }

    // Parse the response to extract metadata
    const titleMatch = content.match(/TITLE TAG:\s*(.+)/i);
    const metaMatch = content.match(/META DESCRIPTION:\s*(.+)/i);
    
    const titleTag = titleMatch ? titleMatch[1].trim() : `${keyword} | Aesthetics Clinic Geneva`;
    const metaDescription = metaMatch ? metaMatch[1].trim() : "";

    // Clean up the content by removing the metadata section
    let cleanContent = content
      .replace(/TITLE TAG:\s*.+\n?/i, "")
      .replace(/META DESCRIPTION:\s*.+\n?/i, "")
      .trim();

    return NextResponse.json({
      success: true,
      article: {
        titleTag,
        metaDescription,
        content: cleanContent,
        keyword,
        language,
        wordCount: cleanContent.split(/\s+/).length,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Article generation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate article" },
      { status: 500 }
    );
  }
}
