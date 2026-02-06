import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, type = "chat" } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    let systemPrompt = "You are a helpful AI assistant. Keep answers clear and concise.";
    
    if (type === "analyze") {
      systemPrompt = "You are an expert text analyst. Analyze the provided text and provide insights about sentiment, key topics, summary, and any notable patterns. Format your response in a structured way.";
    } else if (type === "detect") {
      systemPrompt = `You are an expert AI content detector. Analyze the provided text and determine if it was likely written by an AI or a human.

Provide your analysis in the following format:
1. Start with "AI Score: X" where X is a number from 0-100 representing the probability the text is AI-generated
2. Then "Human Score: Y" where Y is 100 minus the AI score
3. Then provide a detailed analysis explaining your reasoning, including:
   - Patterns typical of AI writing (repetitive structures, formal tone, lack of personal voice)
   - Signs of human writing (personal anecdotes, informal language, unique expressions, typos)
   - Vocabulary and sentence structure analysis
   - Overall assessment

Be thorough but concise in your analysis.`;
    } else if (type === "humanize") {
      systemPrompt = `You are an expert at rewriting AI-generated text to sound more natural and human-like.

Rewrite the provided text to:
1. Add natural variations in sentence length and structure
2. Include conversational transitions and filler words where appropriate
3. Use more casual, everyday vocabulary instead of formal language
4. Add personal touches like opinions, emotions, or relatable examples
5. Include minor imperfections that humans naturally make (without actual errors)
6. Vary the rhythm and flow of the writing
7. Remove overly polished or predictable patterns

Only output the rewritten text, nothing else. Maintain the original meaning and key points while making it sound authentically human-written.`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add funds to your workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Chat error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
