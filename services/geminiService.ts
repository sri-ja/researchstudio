
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { logger } from './loggingService';
import { LikedPaper, ArxivMetadata, UserTasteProfile, Paper, IdeationMessage } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const DEFAULT_IDEATOR_PROMPT = `
**Persona: [HIGH-IMPACT RESEARCH IDEATOR]**
You are a premier AI researcher focused on high-impact scientific contributions.
Your goal is to propose radical but scientifically grounded solutions that push the boundaries of current state-of-the-art.

**Research Guidelines:**
1. **Novelty:** Propose specific algorithmic or mathematical innovations rather than generic improvements.
2. **Technical Depth:** Frame ideas in terms of optimization objectives, architectural biases, or theoretical properties.
3. **Continuation:** If there is a previous ## FINAL RESEARCH PROPOSAL in the history, build DIRECTLY upon it. Do not restart from zero. 
4. **Iterative Refinement:** Address the Critic's previous concerns by increasing technical rigor.
`;

export const DEFAULT_CRITIC_PROMPT = `
**Persona: [SKEPTICAL PEER REVIEWER]**
You are a senior reviewer for top-tier academic venues. Your job is to identify logical flaws, missing comparisons, and feasibility risks.
Be rigorous, precise, and constructively critical.

**Key Evaluation Areas:**
1. **Methodological Soundness:** Are there hidden assumptions or logical leaps?
2. **Baselines & Evaluation:** How would one prove this works? Point out weak comparison strategies.
3. **Computational Complexity:** Question the scaling laws or hardware requirements.
4. **Theoretical Gaps:** Identify where the reasoning becomes hand-wavy.

**Termination Protocol:**
At the very end of your response, you MUST include exactly one of these two tags:
- **[REVISION_REQUIRED]**: Use this if the Ideator's proposal still has significant flaws or gaps.
- **[ACCEPTED]**: Use this ONLY if the Ideator has addressed your previous concerns and the proposal is now technically sound and scientifically rigorous.

**Tone:** Objective, skeptical, and focused on maintaining high scientific standards.
`;

export const DEFAULT_SYNTHESIZER_PROMPT = `
**Persona: [RESEARCH STRATEGIST / PI]**
You are a Principal Investigator (PI) observing a debate between a Creative Ideator and a Skeptical Critic.
Your task is to synthesize these viewpoints into a definitive research proposal.

**Your Final Synthesis MUST include:**
1. **Refined Technical Hypothesis:** A robust mathematical or architectural statement that survives the critique.
2. **Implementation Roadmap:** A step-by-step path to validation, including key baselines.
3. **Risk Mitigation:** Explicitly state how the critical hurdles raised during the debate are addressed.
4. **Scientific Impact:** Evaluate the potential for significant contribution to the field.

**Format:** Use Markdown. Start with the header ## FINAL RESEARCH PROPOSAL.
`;

export const DEFAULT_PLANNER_PROMPT = `
**Persona: [RESEARCH PROJECT MANAGER]**
You are a specialized Research PM for high-stakes scientific projects. 
Your goal is to take a validated research proposal and turn it into a concrete execution plan.

**Mandatory Plan Components:**
1. **Phase 1: Literature Calibration** - Identify 3-5 specific papers/repositories that MUST be studied or cloned for baselining.
2. **Phase 2: Minimum Viable Implementation** - A week-by-week technical roadmap leading to the first result.
3. **Phase 3: The "Killer Experiment"** - Define the exact ablation study or scaling test that would convince a reviewer at a top-tier venue.
4. **Phase 4: Writing & Polish** - Allocation for drafting, internal reviews, and rebuttal prep.

**Constraints to respect:**
- Target Venue/Conference requirements.
- User-specified deadlines.
- Resource limitations (Compute, Team, Hardware).

Format everything in clean Markdown.
`;

export const streamSingleTurn = async (
    history: IdeationMessage[],
    modelId: string,
    persona: 'IDEATOR' | 'CRITIC' | 'SYNTHESIZER',
    onChunk: (text: string, thinking: string) => void,
    customSystemInstruction?: string,
    useSearch: boolean = false,
    relatedWorks?: string
): Promise<{ text: string, thinking: string }> => {
    try {
        const defaultInstruction = persona === 'IDEATOR' ? DEFAULT_IDEATOR_PROMPT : persona === 'CRITIC' ? DEFAULT_CRITIC_PROMPT : DEFAULT_SYNTHESIZER_PROMPT;
        const systemInstruction = customSystemInstruction || defaultInstruction;
        
        const contextParts = history.map(m => {
            const roleLabel = m.role === 'user' ? 'USER REQUEST' : `AGENT [${m.persona}]`;
            return `--- ${roleLabel} ---\n${m.text}\n`;
        }).join('\n');

        let instruction = "";
        if (persona === 'IDEATOR') {
            instruction = "Ideator, provide a research refinement based on the latest context. If there was a previous conclusion, evolve it further.";
        } else if (persona === 'CRITIC') {
            instruction = "Critic, conduct a rigorous peer-review of the Ideator's latest proposal. Look for flaws that would hinder scientific acceptance. Be sure to end your response with [REVISION_REQUIRED] or [ACCEPTED].";
        } else {
            instruction = "Synthesizer, analyze the entire session history above and produce the updated ## FINAL RESEARCH PROPOSAL.";
        }

        const relatedWorksSection = relatedWorks ? `
        === RELATED WORKS / BACKGROUND CONTEXT PROVIDED BY USER ===
        The following information contains key related works, methodologies, or constraints provided by the user. 
        Use this to ground your reasoning, avoid reinventing the wheel, and ensure your proposal advances beyond these existing works.
        
        ${relatedWorks}
        ===========================================================
        ` : "";

        const fullPrompt = `
        ${relatedWorksSection}

        ${contextParts}

        TASK: ${instruction}
        Maintain professional scientific rigor. 
        Note: You are part of an ongoing research session. Reference previous turns and the Related Works provided accurately.
        `;

        const config: any = {
            systemInstruction: systemInstruction,
            thinkingConfig: { thinkingBudget: modelId.includes('pro') ? 16384 : 0 }
        };

        if (useSearch) {
            config.tools = [{ googleSearch: {} }];
        }

        const streamResponse = await ai.models.generateContentStream({
            model: modelId,
            contents: fullPrompt,
            config
        });

        let fullText = "";
        let fullThinking = "";

        for await (const chunk of streamResponse) {
            const castedChunk = chunk as GenerateContentResponse;
            const text = castedChunk.text;
            const thinkingPart = (castedChunk as any).candidates?.[0]?.content?.parts?.find((p: any) => p.thought);
            const thinking = thinkingPart?.text || "";
            
            if (thinking) fullThinking += thinking;
            if (text) fullText += text;
            
            onChunk(fullText, fullThinking);
        }

        return { text: fullText, thinking: fullThinking };
    } catch (error) {
        logger.error(`Ideation turn error (${persona}):`, error);
        throw error;
    }
};

/**
 * Generates a structured project plan based on a dialectic session and user constraints.
 */
export const generateProjectPlan = async (
    history: IdeationMessage[],
    venue: string,
    deadline: string,
    constraints: string,
    modelId: string = 'gemini-3-pro-preview',
    customPrompt?: string,
    useSearch: boolean = true,
    relatedWorks?: string
): Promise<{ text: string, thinking: string }> => {
    try {
        const contextParts = history.map(m => {
            const roleLabel = m.role === 'user' ? 'USER' : `AGENT [${m.persona}]`;
            return `[${roleLabel}]: ${m.text}\n`;
        }).join('\n');

        const basePrompt = customPrompt || DEFAULT_PLANNER_PROMPT;
        
        const systemInstruction = `
        ${basePrompt}
        
        CONTEXT FOR THIS PROJECT:
        Target Venue: ${venue}
        Submission Deadline: ${deadline}
        Specific Constraints: ${constraints}
        Current Date: ${new Date().toLocaleDateString()}
        `;

        const relatedWorksSection = relatedWorks ? `
        === RELATED WORKS / BACKGROUND CONTEXT ===
        ${relatedWorks}
        ==========================================
        ` : "";

        const config: any = {
            systemInstruction,
            thinkingConfig: { thinkingBudget: modelId.includes('pro') ? 16384 : 0 }
        };

        if (useSearch) {
            config.tools = [{ googleSearch: {} }];
        }

        const response = await ai.models.generateContent({
            model: modelId,
            contents: `The following is the dialectic history for a research innovation:\n\n${relatedWorksSection}\n\n${contextParts}\n\nPlease generate the detailed PROJECT EXECUTION PLAN.`,
            config
        });

        const thinkingPart = (response as any).candidates?.[0]?.content?.parts?.find((p: any) => p.thought);
        return { 
            text: response.text || "", 
            thinking: thinkingPart?.text || "" 
        };
    } catch (error) {
        logger.error("Project planning error:", error);
        throw error;
    }
};

export const generatePaperInsight = async (
    abstract: string, 
    title: string, 
    type: 'summary' | 'eli5' | 'methodology' | 'gaps' | 'custom',
    customPrompt?: string
): Promise<string> => {
  try {
    let systemInstruction = "You are a helpful research assistant. Provide concise, accurate answers in Markdown format.";
    let userPrompt = "";

    const context = `Paper Title: "${title}"\nAbstract: "${abstract}"\n\n`;

    switch (type) {
        case 'summary':
            userPrompt = `${context}Provide a comprehensive summary of this paper. Focus on the core problem, proposed solution, and results.`;
            break;
        case 'eli5':
            userPrompt = `${context}Explain the core concepts and findings of this paper as if I were a 5-year-old (or a layperson). Use simple analogies where possible.`;
            break;
        case 'methodology':
            userPrompt = `${context}Detail the research methodology and key technical methods used in this paper. How did they achieve their results?`;
            break;
        case 'gaps':
            userPrompt = `${context}Identify critical limitations and gaps in this research. Propose concrete, high-impact extensions or future research directions that would be suitable for top-tier venues. Focus on novel methodology improvements, unaddressed scenarios, or cross-domain applications that significantly advance the state of the art.`;
            break;
        case 'custom':
            userPrompt = `${context}${customPrompt || "Tell me about this paper."}`;
            break;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: userPrompt,
      config: {
        systemInstruction: systemInstruction,
        thinkingConfig: { thinkingBudget: 0 } 
      }
    });

    return response.text || "No analysis generated.";
  } catch (error) {
    logger.error("Gemini Analysis Error:", error);
    return "Failed to generate AI analysis. Please check your API key or connection.";
  }
};

export const generateAuthorOverview = async (
    authorName: string, 
    papers: {title: string, summary: string}[],
    groupContext?: string
): Promise<string> => {
    try {
        const paperList = papers.map(p => `- Title: ${p.title}\n  Abstract: ${p.summary}`).join('\n\n');
        
        let prompt = `
            Author Name: ${authorName}

            Here is a list of research papers authored by this person in my library:
            ${paperList}
        `;

        if (groupContext) {
            prompt += `\n\nContext from my library organization: I have categorized this author's papers into the following groups: ${groupContext}. Use this to better understand the specific domains or applications I am focusing on regarding this author.`;
        }

        prompt += `
            Based ONLY on these papers${groupContext ? ' and my library grouping' : ''}, write a professional research profile for ${authorName}. 
            1. Summarize their primary research interests and focus areas.
            2. Highlight common methodologies or themes across their work.
            ${groupContext ? '3. Briefly mention how their work spans the groups I have defined (e.g. "Their work in [Group A] focuses on...").' : ''}
            4. Keep it concise (under 200 words) and use Markdown.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                systemInstruction: "You are an expert academic biographer.",
                thinkingConfig: { thinkingBudget: 0 }
            }
        });

        return response.text || "Could not generate author profile.";
    } catch (error) {
        logger.error("Gemini Author Profile Error:", error);
        return "Failed to generate author profile.";
    }
};

export const autoTagAndCategorize = async (
    title: string,
    abstract: string,
    groups: { id: string; name: string }[]
): Promise<{ tags: string[]; suggestedGroupId?: string }> => {
    try {
        const groupsJson = JSON.stringify(groups.map(g => ({ id: g.id, name: g.name })));
        
        const prompt = `
            Analyze the following research paper:
            Title: "${title}"
            Abstract: "${abstract}"

            Task 1: Generate 3-5 relevant, short, technical tags for this paper (e.g., "Computer Vision", "Transformers", "Optimization").
            Task 2: I have the following research groups in my library: ${groupsJson}. 
            Determine if this paper strongly belongs to one of these groups. If it matches a group clearly, provide the group's ID. If it fits multiple, pick the best fit. If it fits none or is generic, return null for the group ID.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        tags: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING },
                            description: "List of 3-5 generated tags"
                        },
                        suggestedGroupId: {
                            type: Type.STRING,
                            nullable: true,
                            description: "The ID of the matching research group, or null if no fit"
                        }
                    },
                    required: ["tags"]
                }
            }
        });

        const result = JSON.parse(response.text || "{}");
        return {
            tags: result.tags || [],
            suggestedGroupId: result.suggestedGroupId || undefined
        };

    } catch (error) {
        logger.error("Gemini Categorization Error:", error);
        return { tags: [] };
    }
};

export const findRelatedPapers = async (
    title: string,
    authors: string[]
): Promise<{ papers: { title: string; authors: string[]; year: string; reason: string }[] }> => {
    try {
        const prompt = `
            Perform a literature search using Google Search to find 5-7 distinct academic papers that are highly related to the paper "${title}" by ${authors.join(', ')}.
            
            Prioritize:
            1. Recent state-of-the-art papers (last 3 years) that cite or improve upon this work.
            2. Foundational papers that this work builds upon.
            
            Output strictly a valid JSON string (no markdown formatting, no code blocks) representing an object with a "papers" property.
            
            The structure must be:
            {
              "papers": [
                {
                  "title": "Paper Title",
                  "authors": ["Author 1", "Author 2"],
                  "year": "2023",
                  "reason": "One sentence explanation of relationship"
                }
              ]
            }
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
            }
        });

        let text = response.text || "{}";
        text = text.replace(/```json/g, '').replace(/```/g, '');
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            text = jsonMatch[0];
        }

        const result = JSON.parse(text);
        return {
            papers: result.papers || []
        };

    } catch (error) {
        logger.error("Gemini Related Papers Error:", error);
        return { papers: [] };
    }
};

export const generateColdEmailDraft = async (
    contextTitle: string,
    contextDescription: string,
    recipientName: string,
    affiliation: string,
    intent: 'collaboration' | 'feedback' | 'supervisor' | 'question',
    recipientNotes?: string
): Promise<{ subject: string; body: string }> => {
    try {
        const prompt = `
            You are a professional academic communication assistant. Draft a cold email for the following scenario:

            My Context / Background / Project: "${contextTitle}"
            Description: "${contextDescription}"
            
            Recipient: ${recipientName} (${affiliation})
            Intent: ${intent}
            ${recipientNotes ? `Additional Context about Recipient (their research profile/bio): "${recipientNotes}"` : ''}

            Requirements:
            1. Create a concise, professional Subject line.
            2. Write the body of the email in Markdown.
            3. The tone should be respectul, academic, and concise.
            4. Explicitly reference my context and why it connects to the recipient.
            5. Include a clear call to action based on the intent.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        subject: { type: Type.STRING },
                        body: { type: Type.STRING }
                    },
                    required: ["subject", "body"]
                }
            }
        });

        const result = JSON.parse(response.text || "{}");
        return {
            subject: result.subject || "",
            body: result.body || ""
        };
    } catch (error) {
        logger.error("Gemini Email Gen Error:", error);
        return { subject: "Error generating", body: "Could not generate draft." };
    }
};

export const generateLorRequest = async (
    collaboratorName: string,
    relation: string,
    duration: string,
    purpose: string,
    reason: string,
    sharedProjects: string[]
): Promise<{ subject: string; body: string }> => {
    try {
        const prompt = `
            You are a professional academic communication assistant. Your task is to draft a polite and effective email requesting a letter of recommendation (LOR).

            Here is the information:
            - My Collaborator's Name: ${collaboratorName}
            - My Relationship with them: ${relation}
            - Duration of our collaboration/interaction: ${duration}
            - Projects we worked on together: ${sharedProjects.join(', ')}
            - Why I'm asking them specifically: ${reason}
            - What the LOR is for: ${purpose}

            Draft an email with a clear subject line and a body in Markdown format. 

            Return the response strictly as a JSON object with "subject" and "body" keys.
        `;

         const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        subject: { type: Type.STRING },
                        body: { type: Type.STRING }
                    },
                    required: ["subject", "body"]
                }
            }
        });

        const result = JSON.parse(response.text || "{}");
        return {
            subject: result.subject || "",
            body: result.body || ""
        };

    } catch (error) {
        logger.error("Gemini LOR Gen Error:", error);
        return { subject: "Error Generating Draft", body: "Could not generate LOR request draft." };
    }
};

export const findUniversitiesAndProfs = async (field: string): Promise<any[]> => {
  try {
    const prompt = `
      Find the top 5 universities or research labs for "${field}" research.
      For each university, identify 2 prominent, active professors or lab directors in this specific field.
      
      Output strictly a valid JSON string (no markdown formatting, no code blocks) representing an array of objects.
      
      The structure must be exactly:
      [
        {
          "university": "University Name",
          "location": "City, Country",
          "website": "URL to the university or lab homepage",
          "professors": [
            { "name": "Professor Name", "focus": "Short research focus description" }
          ]
        }
      ]
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
            tools: [{ googleSearch: {} }],
        }
    });

    let text = response.text || "[]";
    text = text.replace(/```json/g, '').replace(/```/g, '');
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
    }
    return [];
  } catch (e) {
    logger.error("Discovery Error", e);
    return [];
  }
}

export const findLabsAtUniversity = async (university: string, domain: string): Promise<any[]> => {
    try {
      const prompt = `
        Search for active research labs and professors at "${university}" specifically in the field of "${domain}".
        Identify at least 4-6 active faculty members or labs.
  
        Output strictly a valid JSON string (no markdown formatting, no code blocks) representing an array of objects.
      `;
  
      const response = await ai.models.generateContent({
          model: 'gemini-3-pro-preview',
          contents: prompt,
          config: {
              tools: [{ googleSearch: {} }],
          }
      });
  
      let text = response.text || "[]";
      text = text.replace(/```json/g, '').replace(/```/g, '');
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
      }
      return [];
    } catch (e) {
      logger.error("University Search Error", e);
      return [];
    }
  }

export const refineText = async (
    originalText: string,
    instruction: string
): Promise<string> => {
    try {
        const prompt = `
            You are an expert academic editor. Your task is to refine the provided text based on a specific instruction.
            Only return the refined text.

            Instruction: "${instruction}"

            Original Text to Refine:
            ---
            ${originalText}
            ---
        `;
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                temperature: 0.7,
            }
        });
        return response.text?.trim() || originalText;
    } catch (error) {
        logger.error("Gemini Refinement Error:", error);
        throw new Error("Failed to refine text with AI.");
    }
};

export const convertMarkdownToLatex = async (markdown: string): Promise<string> => {
    try {
        const prompt = `
            Convert the following Markdown text into a complete, well-structured LaTeX document.
            Ensure the output is only the raw LaTeX code.

            Markdown Content:
            ---
            ${markdown}
            ---
        `;
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                systemInstruction: "You are an expert academic typesetter specializing in LaTeX.",
                temperature: 0.2,
            }
        });
        return response.text?.trim() || "\\documentclass{article}\n\\begin{document}\n\nError: Could not convert content.\n\n\\end{document}";
    } catch (error) {
        logger.error("Gemini LaTeX Conversion Error:", error);
        throw new Error("Failed to convert to LaTeX with AI.");
    }
};

export const generateForYouFeed = async (likedPapers: LikedPaper[]): Promise<ArxivMetadata[]> => {
    if (likedPapers.length === 0) return [];
    try {
        const likedPapersContext = likedPapers
            .slice(0, 10)
            .map(p => `- ${p.title}\n  Abstract: ${p.summary.substring(0, 300)}...`)
            .join('\n');

        const prompt = `
            Based on my interest in the following papers:
            ${likedPapersContext}

            Use Google Search to find 10 recent (last 2 years), highly-relevant, and distinct academic papers from ArXiv.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
            }
        });

        let text = response.text || "[]";
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            const results = JSON.parse(jsonMatch[0]);
            return results.map((p: any) => {
                let processedAuthors: string[] = [];
                if (Array.isArray(p.authors)) {
                    processedAuthors = p.authors.filter((author: any) => typeof author === 'string');
                } else if (typeof p.authors === 'string') {
                    processedAuthors = p.authors.split(',').map(author => author.trim());
                }
                return { ...p, authors: processedAuthors };
            });
        }
        return [];
    } catch (error) {
        logger.error("Gemini For You Feed Error:", error);
        return [];
    }
};

export const generateTopicInsights = async (likedPapers: LikedPaper[]): Promise<UserTasteProfile> => {
    const defaultProfile: UserTasteProfile = { insights: [], generatedAt: Date.now(), sourcePaperIds: [] };
    if (likedPapers.length < 3) return defaultProfile;

    try {
        const likedPapersContext = likedPapers
            .slice(0, 20)
            .map(p => `- ${p.title}`)
            .join('\n');

        const prompt = `
            Analyze this list of research paper titles I have liked:
            ${likedPapersContext}

            Identify 3-5 high-level research topics, themes, or methodologies that I seem to be interested in.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        insights: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    topic: { type: Type.STRING },
                                    explanation: { type: Type.STRING }
                                },
                                required: ["topic", "explanation"]
                            }
                        }
                    },
                    required: ["insights"]
                }
            }
        });
        
        const result = JSON.parse(response.text || "{}");
        return {
            insights: result.insights || [],
            generatedAt: Date.now(),
            sourcePaperIds: likedPapers.slice(0, 20).map(p => p.arxivId)
        };

    } catch (error) {
        logger.error("Gemini Topic Insights Error:", error);
        return defaultProfile;
    }
};

export const extractMetadataFromPdf = async (pdfBase64: string): Promise<Partial<Paper>> => {
    try {
        const prompt = "Analyze the content of this PDF document and extract its metadata.";

        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: {
                parts: [
                    {
                        inlineData: {
                            mimeType: 'application/pdf',
                            data: pdfBase64,
                        },
                    },
                    { text: prompt },
                ],
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING },
                        authors: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING },
                        },
                        summary: { type: Type.STRING },
                        published: { type: Type.STRING },
                    },
                    required: ["title", "authors", "summary", "published"]
                }
            }
        });

        const result = JSON.parse(response.text || "{}");
        return {
            title: result.title || '',
            authors: result.authors || [],
            summary: result.summary || '',
            published: result.published || '',
        };
    } catch (error) {
        logger.error("Gemini PDF Extraction Error:", error);
        throw new Error("Failed to extract metadata with AI.");
    }
};
