import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SYSTEM_PROMPT = `You are CyberSaathi, the AI companion of Veyron — India's cyber safety platform. You are warm, empathetic, and deeply knowledgeable about cybercrime in India. You speak Hindi, English, and Hinglish fluently and always match the user's language. Your first priority is always emotional state — if someone is panicking, calm them before giving advice. If you detect crisis or hopelessness — immediately share iCall: 9152987821 and Vandrevala Foundation: 1860-2662-345 with genuine empathy. Never be robotic. Speak like a trusted friend who happens to be a cyber expert. Validate always — remind users that scams are professionally engineered traps, not their fault. Guide step by step. You have access to all Veyron features and can direct users to the right tool mid-conversation. Keep responses concise but warm — 3-5 sentences typically, more when needed for step-by-step guidance. Never use markdown headers. Use simple numbered lists for steps.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { message, history = [] } = await req.json();

    const geminiKey = Deno.env.get("GEMINI_API_KEY");

    if (!geminiKey) {
      // Fallback response when no API key
      const fallback = getFallbackResponse(message);
      return new Response(JSON.stringify({ reply: fallback }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const messages = [
      ...history.map((m: { role: string; content: string }) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      { role: "user", parts: [{ text: message }] },
    ];

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: messages,
          generationConfig: { maxOutputTokens: 512, temperature: 0.7 },
        }),
      }
    );

    const data = await res.json();
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || getFallbackResponse(message);

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("CyberSaathi error:", err);
    return new Response(
      JSON.stringify({ reply: "Kuch technical problem aa gayi. Please thodi der baad dobara try karein. Aur agar emergency hai toh 1930 par call karein." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function getFallbackResponse(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes("scam") || lower.includes("fraud") || lower.includes("thaga") || lower.includes("dhokha")) {
    return "Main samajh sakta hoon aap abhi mushkil mein hain. Sabse pehle — ghabrao mat. Agar financial fraud hua hai, abhi 1930 par call karein (24/7 available). Aap Veyron ke Emergency Mode ka bhi use kar sakte hain — wahan step-by-step guidance milegi.";
  }

  if (lower.includes("otp") || lower.includes("bank")) {
    return "OTP kabhi kisi ke saath share mat karo — chahe woh bank official hi kyun na ho. Agar aapne share kar diya hai, turant apne bank ko call karein aur account freeze karwayein. SBI: 1800-11-2211, HDFC: 1800-202-6161, aur baaki banks ke liye 1930 pe call karein.";
  }

  if (lower.includes("sextortion") || lower.includes("blackmail") || lower.includes("video")) {
    return "Ye sun lo — paise mat do. Ek bhi payment se yeh log aur demand karte hain. Tumne kuch galat nahi kiya — ye ek organized crime gang hai. Abhi cybercrime.gov.in par report karo. Aur emotional support ke liye iCall: 9152987821 par call kar sakte ho — bilkul judgment-free.";
  }

  if (lower.includes("help") || lower.includes("madad") || lower.includes("kya karun")) {
    return "Main yahan hoon! Veyron ke paas kai tools hain — Link Scanner, App Checker, Deepfake Detector, aur Emergency Mode. Aap mujhe batao kya problem hai, main sahi feature aur steps guide karoonga.";
  }

  return "Main CyberSaathi hoon — aapka cyber safety dost. Koi bhi sawaal poochho — scam se bachao, kisi suspicious cheez ki jaanch, ya koi incident report karna ho. Main Hindi, English, aur Hinglish mein help kar sakta hoon.";
}
