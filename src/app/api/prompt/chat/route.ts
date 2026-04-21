import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI, Part } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 60;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type MessageInput = {
  role: "user" | "assistant" | "system";
  content: string;
  attachments?: {
    id?: string;
    type: string;
    mimeType: string;
    data?: string; // base64 for new uploads
    storagePath?: string; // for existing attachments
    fileName?: string;
  }[];
};

type RequestBody = {
  topicId: string;
  userId: string;
  messages: MessageInput[];
  newAttachments?: {
    fileName: string;
    mimeType: string;
    data: string; // base64
  }[];
};

async function getFileFromStorage(storagePath: string): Promise<{ data: string; mimeType: string } | null> {
  try {
    const { data, error } = await supabaseAdmin.storage
      .from("knowledge-files")
      .download(storagePath);
    
    if (error || !data) return null;
    
    const buffer = await data.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const mimeType = storagePath.toLowerCase().endsWith(".pdf") 
      ? "application/pdf" 
      : data.type || "application/octet-stream";
    
    return { data: base64, mimeType };
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Missing GEMINI_API_KEY" }, { status: 500 });
    }

    const body: RequestBody = await request.json();
    const { topicId, userId, messages, newAttachments } = body;

    if (!topicId || !userId || !messages?.length) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify topic ownership
    const { data: topic, error: topicError } = await supabaseAdmin
      .from("knowledge_topics")
      .select("id")
      .eq("id", topicId)
      .eq("user_id", userId)
      .single();

    if (topicError || !topic) {
      return NextResponse.json({ error: "Topic not found" }, { status: 404 });
    }

    const systemInstruction = `You are an intelligent AI assistant helping users build a knowledge base. Your role is to:

1. **Analyze and understand** any documents, images, or text provided by the user
2. **Extract key information** and insights from uploaded files
3. **Answer questions** based on the context of the conversation and any provided materials
4. **Summarize and organize** information in a clear, structured way
5. **Help users** understand complex topics by breaking them down

When analyzing images or documents:
- Describe what you see in detail
- Extract any text or data present
- Identify key themes, topics, or entities
- Provide relevant insights and connections

Always be helpful, accurate, and thorough. If you're unsure about something, say so. Format your responses using markdown for better readability.`;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction,
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 8192,
      },
    });

    // Process attachments for the latest user message
    const latestMessage = messages[messages.length - 1];
    const parts: Part[] = [];

    // Add text content
    if (latestMessage.content) {
      parts.push({ text: latestMessage.content });
    }

    // Process new attachments (base64 data)
    if (newAttachments && newAttachments.length > 0) {
      for (const attachment of newAttachments) {
        if (attachment.mimeType.startsWith("image/")) {
          parts.push({
            inlineData: {
              mimeType: attachment.mimeType,
              data: attachment.data,
            },
          });
        } else if (attachment.mimeType === "application/pdf") {
          parts.push({
            inlineData: {
              mimeType: attachment.mimeType,
              data: attachment.data,
            },
          });
        }
      }
    }

    // Process existing attachments from storage
    if (latestMessage.attachments && latestMessage.attachments.length > 0) {
      for (const attachment of latestMessage.attachments) {
        if (attachment.storagePath) {
          const fileData = await getFileFromStorage(attachment.storagePath);
          if (fileData) {
            parts.push({
              inlineData: {
                mimeType: fileData.mimeType,
                data: fileData.data,
              },
            });
          }
        } else if (attachment.data) {
          parts.push({
            inlineData: {
              mimeType: attachment.mimeType,
              data: attachment.data,
            },
          });
        }
      }
    }

    if (parts.length === 0) {
      return NextResponse.json(
        { error: "Message must contain text or attachments" },
        { status: 400 },
      );
    }

    // Build conversation history (all messages except the last one)
    const historyMapped = messages
      .slice(0, -1)
      .filter((msg) => msg.role !== "system" && msg.content?.trim())
      .map((msg) => ({
        role: (msg.role === "assistant" ? "model" : "user") as "user" | "model",
        parts: [{ text: msg.content }] as Part[],
      }));

    // Drop leading model entries (Gemini requires history starts with user)
    while (historyMapped.length > 0 && historyMapped[0].role !== "user") {
      historyMapped.shift();
    }

    // Collapse consecutive same-role entries to guarantee alternation
    const historyContents: Array<{ role: "user" | "model"; parts: Part[] }> = [];
    for (const entry of historyMapped) {
      const prev = historyContents[historyContents.length - 1];
      if (prev && prev.role === entry.role) {
        const prevPart = prev.parts[0];
        const nextPart = entry.parts[0];
        if ("text" in prevPart && "text" in nextPart) {
          prev.parts[0] = { text: (prevPart.text || "") + "\n\n" + (nextPart.text || "") };
        } else {
          prev.parts.push(...entry.parts);
        }
      } else {
        historyContents.push({ role: entry.role, parts: [...entry.parts] });
      }
    }

    // Append the current user turn
    const contents: Array<{ role: "user" | "model"; parts: Part[] }> = [
      ...historyContents,
      { role: "user", parts },
    ];

    // Ensure the final turn is user
    if (contents[contents.length - 1].role !== "user") {
      return NextResponse.json(
        { error: "Last message must be from the user" },
        { status: 400 },
      );
    }

    // Use generateContent directly (more robust than startChat)
    const result = await model.generateContent({ contents });
    const response = result.response;
    const text = response.text();

    if (!text || !text.trim()) {
      const blockReason =
        response.promptFeedback?.blockReason || "Empty response from AI";
      return NextResponse.json(
        { error: `No response from AI: ${blockReason}` },
        { status: 502 },
      );
    }

    // Save user message to database
    const userMessageContent = latestMessage.content || "[Attachment]";
    const hasAttachments = (newAttachments && newAttachments.length > 0) || 
                          (latestMessage.attachments && latestMessage.attachments.length > 0);

    const { data: userMsg, error: userMsgError } = await supabaseAdmin
      .from("knowledge_messages")
      .insert({
        topic_id: topicId,
        role: "user",
        content: userMessageContent,
        has_attachments: hasAttachments,
      })
      .select()
      .single();

    if (userMsgError) {
      console.error("Failed to save user message:", userMsgError);
    }

    // Save attachments to storage and database
    if (userMsg && newAttachments && newAttachments.length > 0) {
      for (const attachment of newAttachments) {
        const buffer = Buffer.from(attachment.data, "base64");
        const storagePath = `${userId}/${topicId}/${Date.now()}_${attachment.fileName}`;
        
        const { error: uploadError } = await supabaseAdmin.storage
          .from("knowledge-files")
          .upload(storagePath, buffer, {
            contentType: attachment.mimeType,
            upsert: false,
          });

        if (!uploadError) {
          await supabaseAdmin.from("knowledge_attachments").insert({
            message_id: userMsg.id,
            topic_id: topicId,
            file_name: attachment.fileName,
            file_type: attachment.mimeType.split("/")[0],
            file_size: buffer.length,
            mime_type: attachment.mimeType,
            storage_path: storagePath,
            is_processed: true,
          });
        }
      }
    }

    // Save assistant message
    const { error: assistantMsgError } = await supabaseAdmin
      .from("knowledge_messages")
      .insert({
        topic_id: topicId,
        role: "assistant",
        content: text,
        model_used: "gemini-2.0-flash",
      });

    if (assistantMsgError) {
      console.error("Failed to save assistant message:", assistantMsgError);
    }

    // Update topic title if it's still default
    const { data: currentTopic } = await supabaseAdmin
      .from("knowledge_topics")
      .select("title")
      .eq("id", topicId)
      .single();

    if (currentTopic && (currentTopic.title === "New Topic" || !currentTopic.title)) {
      const newTitle = userMessageContent.slice(0, 60) + (userMessageContent.length > 60 ? "..." : "");
      await supabaseAdmin
        .from("knowledge_topics")
        .update({ title: newTitle })
        .eq("id", topicId);
    }

    return NextResponse.json({
      message: {
        role: "assistant",
        content: text,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[/api/prompt/chat] Error:", error);
    return NextResponse.json(
      { error: `Failed to generate response: ${message}` },
      { status: 500 }
    );
  }
}
