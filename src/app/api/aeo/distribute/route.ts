import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// PRNow API Configuration
const PRNOW_API_URL = "https://prnow.io/api/v1";
const PRNOW_API_KEY = process.env.PRNOW_API_KEY || "";

// Distribution service types
type DistributionService = "prnow" | "manual";

interface DistributionRequest {
  action: "submit" | "status" | "list" | "test" | "categories";
  service?: DistributionService;
  // For submit
  title?: string;
  content?: string;
  summary?: string;
  categories?: string[];
  country?: string;
  plan?: string;
  articleId?: string;
  language?: string;
  // For status
  distributionId?: string;
}

interface DistributionRecord {
  id: string;
  article_id: string;
  service: string;
  external_id: string | null;
  status: string;
  title: string;
  placements_count: number;
  report_url: string | null;
  submitted_at: string;
  completed_at: string | null;
  cost: number;
  metadata: Record<string, unknown>;
}

// Test API connection
async function testPRNowConnection(): Promise<{ success: boolean; data?: unknown; error?: string }> {
  if (!PRNOW_API_KEY) {
    return { success: false, error: "PRNOW_API_KEY not configured" };
  }

  try {
    const res = await fetch(`${PRNOW_API_URL}/test`, {
      headers: {
        Authorization: `Bearer ${PRNOW_API_KEY}`,
      },
    });
    const data = await res.json();
    return { success: data.success, data: data.data, error: data.error };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Connection failed" };
  }
}

// Get available categories
async function getPRNowCategories(): Promise<string[]> {
  try {
    const res = await fetch(`${PRNOW_API_URL}/categories`);
    const data = await res.json();
    // Handle nested structure: { data: { categories: [...] } } or { categories: [...] }
    const categories = data.data?.categories || data.categories || data.data || [];
    return Array.isArray(categories) ? categories : [];
  } catch (err) {
    // Return default categories if API fails
    return [
      "Healthcare & Medicine",
      "Fashion & Beauty",
      "Business & Professional Services",
      "Technology",
      "Lifestyle & Home",
    ];
  }
}

// Submit to PRNow
async function submitToPRNow(params: {
  title: string;
  content: string;
  summary?: string;
  categories: string[];
  country: string;
  plan?: string;
}): Promise<{ success: boolean; releaseId?: string; error?: string }> {
  if (!PRNOW_API_KEY) {
    return { success: false, error: "PRNOW_API_KEY not configured. Please add it to your environment variables." };
  }

  try {
    const res = await fetch(`${PRNOW_API_URL}/submit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${PRNOW_API_KEY}`,
      },
      body: JSON.stringify({
        title: params.title,
        content: params.content,
        summary: params.summary || params.content.substring(0, 300) + "...",
        categories: params.categories,
        country: params.country,
        plan: params.plan || "standard",
      }),
    });

    const data = await res.json();
    
    if (data.success) {
      return { success: true, releaseId: data.data?.release_id || data.data?.id };
    } else {
      return { success: false, error: data.error || "Submission failed" };
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "API request failed" };
  }
}

// Check status of a distribution
async function checkPRNowStatus(releaseId: string): Promise<{
  success: boolean;
  status?: string;
  placements?: number;
  reportUrl?: string;
  error?: string;
}> {
  if (!PRNOW_API_KEY) {
    return { success: false, error: "PRNOW_API_KEY not configured" };
  }

  try {
    const res = await fetch(`${PRNOW_API_URL}/status/${releaseId}`, {
      headers: {
        Authorization: `Bearer ${PRNOW_API_KEY}`,
      },
    });

    const data = await res.json();
    
    if (data.success) {
      return {
        success: true,
        status: data.data?.status,
        placements: data.data?.placements_count || data.data?.placements?.length || 0,
        reportUrl: data.data?.report_url,
      };
    } else {
      return { success: false, error: data.error };
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Status check failed" };
  }
}

// Save distribution record to database
async function saveDistributionRecord(record: Omit<DistributionRecord, "id">): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("article_distributions")
    .insert([record])
    .select("id")
    .single();

  if (error) {
    console.error("Failed to save distribution record:", error);
    return null;
  }

  return data?.id || null;
}

// Update distribution record
async function updateDistributionRecord(
  id: string,
  updates: Partial<DistributionRecord>
): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from("article_distributions")
    .update(updates)
    .eq("id", id);

  return !error;
}

// GET - Test connection or list distributions
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action") || "list";

  try {
    if (action === "test") {
      const result = await testPRNowConnection();
      return NextResponse.json(result);
    }

    if (action === "categories") {
      const categories = await getPRNowCategories();
      return NextResponse.json({ success: true, categories });
    }

    // List all distributions
    const { data, error } = await supabaseAdmin
      .from("article_distributions")
      .select("*")
      .order("submitted_at", { ascending: false })
      .limit(50);

    if (error) {
      // Table might not exist yet
      if (error.message.includes("does not exist")) {
        return NextResponse.json({
          success: true,
          distributions: [],
          message: "No distributions yet. Submit your first article to get started.",
        });
      }
      throw error;
    }

    return NextResponse.json({ success: true, distributions: data || [] });
  } catch (err) {
    console.error("Distribution GET error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch distributions" },
      { status: 500 }
    );
  }
}

// POST - Submit or check status
export async function POST(request: NextRequest) {
  try {
    const body: DistributionRequest = await request.json();
    const { action } = body;

    // Test API connection
    if (action === "test") {
      const result = await testPRNowConnection();
      return NextResponse.json(result);
    }

    // Get categories
    if (action === "categories") {
      const categories = await getPRNowCategories();
      return NextResponse.json({ success: true, categories });
    }

    // Check status
    if (action === "status") {
      if (!body.distributionId) {
        return NextResponse.json({ error: "distributionId required" }, { status: 400 });
      }

      // Get from database
      const { data: record } = await supabaseAdmin
        .from("article_distributions")
        .select("*")
        .eq("id", body.distributionId)
        .single();

      if (!record) {
        return NextResponse.json({ error: "Distribution not found" }, { status: 404 });
      }

      // Check external status if we have an external ID
      if (record.external_id && record.service === "prnow") {
        const status = await checkPRNowStatus(record.external_id);
        
        if (status.success) {
          // Update record if status changed
          if (status.status !== record.status || status.placements !== record.placements_count) {
            await updateDistributionRecord(record.id, {
              status: status.status || record.status,
              placements_count: status.placements || record.placements_count,
              report_url: status.reportUrl || record.report_url,
              completed_at: status.status === "completed" ? new Date().toISOString() : record.completed_at,
            });
          }

          return NextResponse.json({
            success: true,
            distribution: {
              ...record,
              status: status.status,
              placements_count: status.placements,
              report_url: status.reportUrl,
            },
          });
        }
      }

      return NextResponse.json({ success: true, distribution: record });
    }

    // Submit for distribution
    if (action === "submit") {
      const { title, content, summary, categories, country, plan, articleId, language, service = "prnow" } = body;

      if (!title || !content) {
        return NextResponse.json({ error: "title and content are required" }, { status: 400 });
      }

      // Default categories for aesthetic/medical content
      const defaultCategories = ["Healthcare & Medicine", "Fashion & Beauty"];
      const finalCategories = categories?.length ? categories : defaultCategories;

      // Default country
      const finalCountry = country || "Switzerland";

      let externalId: string | null = null;
      let status = "pending";
      let errorMessage: string | null = null;

      // Submit to PRNow if configured
      if (service === "prnow" && PRNOW_API_KEY) {
        const result = await submitToPRNow({
          title,
          content,
          summary,
          categories: finalCategories,
          country: finalCountry,
          plan,
        });

        if (result.success) {
          externalId = result.releaseId || null;
          status = "submitted";
        } else {
          status = "failed";
          errorMessage = result.error || null;
        }
      } else {
        // Manual distribution - save for later
        status = "draft";
      }

      // Save to database
      const recordId = await saveDistributionRecord({
        article_id: articleId || `manual_${Date.now()}`,
        service,
        external_id: externalId,
        status,
        title,
        placements_count: 0,
        report_url: null,
        submitted_at: new Date().toISOString(),
        completed_at: null,
        cost: plan === "premium" ? 50 : 30, // Estimated cost
        metadata: {
          categories: finalCategories,
          country: finalCountry,
          language: language || "en",
          error: errorMessage,
          content_length: content.length,
        },
      });

      if (errorMessage) {
        return NextResponse.json({
          success: false,
          error: errorMessage,
          distributionId: recordId,
        });
      }

      return NextResponse.json({
        success: true,
        distributionId: recordId,
        externalId,
        status,
        message: service === "prnow" 
          ? "Article submitted for distribution. Check status for updates."
          : "Article saved as draft. Add your PRNow API key to enable automatic distribution.",
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    console.error("Distribution POST error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Distribution failed" },
      { status: 500 }
    );
  }
}
