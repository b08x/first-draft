import { GoogleGenerativeAI } from "@google/generative-ai";

export async function generateWithGemini(prompt: string, apiKey: string) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  
  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text();
}

export function parseSections(markdown: string) {
  const sections: { title: string; body: string }[] = [];
  const lines = markdown.split("\n");
  let currentSection: { title: string; body: string } | null = null;
  
  for (const line of lines) {
    if (line.startsWith("## ")) {
      if (currentSection) {
        sections.push(currentSection);
      }
      currentSection = { title: line.replace("## ", "").trim(), body: "" };
    } else if (currentSection) {
      currentSection.body += line + "\n";
    }
  }
  
  if (currentSection) {
    sections.push(currentSection);
  }
  
  return sections;
}

export const SYSTEM_PROMPTS = {
  INTAKE: `You are a technical intake conductor for a Ruby AI project.
Your job is to extract structured project context from a natural language feature description.
Ask only what is necessary. Infer what you can from the description.
Output a single JSON object — no preamble, no explanation, no markdown fences.`,
  // ... other prompts will be used in context
};
