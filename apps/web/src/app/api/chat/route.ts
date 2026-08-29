import { NextResponse } from "next/server";
import { generateBotResponse } from "@/components/chatbot/bot-engine";

export async function POST(req: Request) {
  try {
    const { message, photoUrl } = await req.json();
    if (!message && !photoUrl) {
      return NextResponse.json({ error: "Message or photo is required" }, { status: 400 });
    }

    // Process via civic intent engine
    const botReply = generateBotResponse(message || "", photoUrl);
    return NextResponse.json({ reply: botReply });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to process message" },
      { status: 500 }
    );
  }
}
