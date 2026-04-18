import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const runtime = "nodejs";

/**
 * GET /api/reports/boost-report?startDate=2026-04-01&endDate=2026-04-30&accountId=uuid&format=json|csv
 * 
 * Returns boost report data for reimbursement.
 * ONLY boosted posts are included (is_boosted = TRUE).
 * Amount is in CHF (Swiss Francs) - NOT AED.
 * 
 * Report Columns:
 * - Account (social media account name)
 * - Subject (post subject/title)
 * - Date (post date)
 * - Platform (Instagram, TikTok, Facebook)
 * - Amount in CHF (boost/ad spend amount)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse filters
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const accountId = searchParams.get("accountId");
    const format = searchParams.get("format") || "json"; // json or csv

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Build query - ONLY boosted posts
    let query = supabase
      .from("social_media_posts")
      .select(`
        id,
        subject,
        post_date,
        platform,
        boost_amount_chf,
        post_url,
        boost_status,
        account:social_media_accounts(id, name, handle)
      `)
      .eq("is_boosted", true) // CRITICAL: Only boosted posts
      .order("post_date", { ascending: false });

    // Apply date range filter
    if (startDate) {
      query = query.gte("post_date", startDate);
    }
    if (endDate) {
      query = query.lte("post_date", endDate);
    }

    // Apply account filter
    if (accountId) {
      query = query.eq("account_id", accountId);
    }

    const { data: posts, error } = await query;

    if (error) {
      console.error("[Boost Report] Error fetching posts:", error);
      return NextResponse.json(
        { error: "Failed to fetch boost report data" },
        { status: 500 }
      );
    }

    // Transform data for report
    const reportData = (posts || []).map((post: any) => ({
      id: post.id,
      account: post.account?.name || "Unknown Account",
      account_handle: post.account?.handle || "",
      subject: post.subject,
      date: post.post_date,
      platform: post.platform,
      amount_chf: post.boost_amount_chf || 0, // CHF - NOT AED
      amount_formatted: `CHF ${(post.boost_amount_chf || 0).toFixed(2)}`,
      post_url: post.post_url,
      boost_status: post.boost_status,
    }));

    // Calculate totals
    const totalAmount = reportData.reduce((sum: number, post: any) => sum + post.amount_chf, 0);

    // If CSV format requested
    if (format === "csv") {
      const csvHeader = "Account,Subject,Date,Platform,Amount (CHF)\n";
      const csvRows = reportData.map((post: any) => {
        // Escape quotes and wrap fields that may contain commas
        const escape = (str: string) => `"${String(str || "").replace(/"/g, '""')}"`;
        return [
          escape(post.account),
          escape(post.subject),
          escape(post.date),
          escape(post.platform),
          post.amount_chf.toFixed(2),
        ].join(",");
      }).join("\n");
      
      const csvContent = csvHeader + csvRows;
      
      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="boost-report-${startDate || "all"}-to-${endDate || "all"}.csv"`,
        },
      });
    }

    // Return JSON format
    return NextResponse.json({
      success: true,
      filters: {
        startDate,
        endDate,
        accountId,
      },
      summary: {
        total_posts: reportData.length,
        total_amount_chf: totalAmount,
        total_amount_formatted: `CHF ${totalAmount.toFixed(2)}`,
      },
      columns: [
        { key: "account", label: "Account" },
        { key: "subject", label: "Subject" },
        { key: "date", label: "Date" },
        { key: "platform", label: "Platform" },
        { key: "amount_chf", label: "Amount (CHF)" },
      ],
      data: reportData,
      note: "Only boosted posts are included. Amount is in CHF (Swiss Francs).",
    });

  } catch (error) {
    console.error("[Boost Report] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate boost report", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/reports/boost-report
 * 
 * Create or update a social media post with boost data
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id, // If provided, update existing post
      account_id,
      subject,
      content,
      post_date,
      platform,
      post_url,
      post_id_external,
      is_boosted,
      boost_amount_chf, // CHF - NOT AED
      boost_start_date,
      boost_end_date,
      boost_status,
      notes,
    } = body;

    // Validation
    if (!subject || !post_date || !platform) {
      return NextResponse.json(
        { error: "subject, post_date, and platform are required" },
        { status: 400 }
      );
    }

    // If marked as boosted, require amount
    if (is_boosted && (!boost_amount_chf || boost_amount_chf <= 0)) {
      return NextResponse.json(
        { error: "Boost amount (CHF) is required when is_boosted is true" },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const postData = {
      account_id,
      subject,
      content,
      post_date,
      platform,
      post_url,
      post_id_external,
      is_boosted: is_boosted || false,
      boost_amount_chf: is_boosted ? boost_amount_chf : null,
      boost_start_date: is_boosted ? boost_start_date : null,
      boost_end_date: is_boosted ? boost_end_date : null,
      boost_status: is_boosted ? (boost_status || "active") : null,
      notes,
    };

    let result;

    if (id) {
      // Update existing post
      const { data, error } = await supabase
        .from("social_media_posts")
        .update(postData)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        console.error("[Boost Report] Error updating post:", error);
        return NextResponse.json(
          { error: "Failed to update post" },
          { status: 500 }
        );
      }
      result = data;
    } else {
      // Create new post
      const { data, error } = await supabase
        .from("social_media_posts")
        .insert(postData)
        .select()
        .single();

      if (error) {
        console.error("[Boost Report] Error creating post:", error);
        return NextResponse.json(
          { error: "Failed to create post" },
          { status: 500 }
        );
      }
      result = data;
    }

    return NextResponse.json({
      success: true,
      message: id ? "Post updated successfully" : "Post created successfully",
      data: result,
      note: "Amount stored in CHF (Swiss Francs)",
    });

  } catch (error) {
    console.error("[Boost Report] Error:", error);
    return NextResponse.json(
      { error: "Failed to save post", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/reports/boost-report?id=uuid
 * 
 * Delete a social media post
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "id is required" },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { error } = await supabase
      .from("social_media_posts")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[Boost Report] Error deleting post:", error);
      return NextResponse.json(
        { error: "Failed to delete post" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Post deleted successfully",
    });

  } catch (error) {
    console.error("[Boost Report] Error:", error);
    return NextResponse.json(
      { error: "Failed to delete post", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
