
import { ArxivMetadata } from '../types';
import { logger } from './loggingService';

export const extractArxivId = (url: string): string | null => {
  // Matches typical patterns:
  // 2101.00001, 2101.00001v1, arxiv.org/abs/2101.00001
  // astro-ph/0001001
  const regex = /((?:arxiv.org\/[a-z]+\/)?(?:\d{4}\.\d{4,5}(?:v\d+)?|[a-z\-]+\/\d{7}(?:v\d+)?))/i;
  const match = url.match(regex);
  
  if (!match) return null;
  
  // Clean up the match to get just the ID
  let id = match[0];
  if (id.includes('arxiv.org/')) {
    id = id.split('/').pop() || id;
  }
  // Remove "abs" or "pdf" prefix if present in the ID part (rare edge case)
  id = id.replace(/^(abs|pdf)\//, '');
  
  return id;
};

/**
 * Strips the version suffix (e.g., v1, v2) from an ArXiv ID.
 * @param arxivId The full ArXiv ID.
 * @returns The core ArXiv ID without the version.
 */
export const getCoreArxivId = (arxivId: string): string => {
  return arxivId.replace(/v\d+$/, '');
};

const parseAtomResponse = (text: string): ArxivMetadata[] => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(text, "text/xml");
    const entries = Array.from(xmlDoc.getElementsByTagName("entry"));

    return entries.map(entry => {
        const idUrl = entry.getElementsByTagName("id")[0]?.textContent || "";
        // Extract raw ID from http://arxiv.org/abs/2101.00001v1
        const arxivId = idUrl.split('/abs/').pop() || "";
        
        const title = entry.getElementsByTagName("title")[0]?.textContent?.trim().replace(/\s+/g, ' ') || "Untitled";
        const summary = entry.getElementsByTagName("summary")[0]?.textContent?.trim().replace(/\s+/g, ' ') || "";
        const published = entry.getElementsByTagName("published")[0]?.textContent || "";
        const category = entry.getElementsByTagName("category")[0]?.getAttribute("term") || "";

        const authorElements = entry.getElementsByTagName("author");
        const authors: string[] = [];
        for (let i = 0; i < authorElements.length; i++) {
            const name = authorElements[i].getElementsByTagName("name")[0]?.textContent;
            if (name) authors.push(name);
        }

        return {
            arxivId,
            title,
            summary,
            authors,
            published,
            category
        };
    });
};

export const fetchArxivMetadata = async (arxivId: string): Promise<ArxivMetadata> => {
  const url = `https://export.arxiv.org/api/query?id_list=${arxivId}`;
  
  // Helper to validate basic Atom XML structure
  const isValidXml = (str: string) => str && str.includes('<feed') && str.includes('xmlns="http://www.w3.org/2005/Atom"');

  // Proxies to bypass CORS when fetching from browser
  const proxies = [
    {
      name: 'AllOrigins',
      fetch: async () => {
        // AllOrigins JSON wrapper is usually very reliable for text
        const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
        if (!res.ok) throw new Error(res.statusText);
        const data = await res.json();
        return data.contents;
      }
    },
    {
      name: 'CodeTabs',
      fetch: async () => {
        const res = await fetch(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`);
        if (!res.ok) throw new Error(res.statusText);
        return res.text();
      }
    },
    {
      name: 'CorsProxy',
      fetch: async () => {
        const res = await fetch(`https://corsproxy.io/?${encodeURIComponent(url)}`);
        if (!res.ok) throw new Error(res.statusText);
        return res.text();
      }
    }
  ];

  let text = '';
  let lastError = null;

  for (const proxy of proxies) {
    try {
      text = await proxy.fetch();
      if (isValidXml(text)) break;
      else throw new Error("Response was not valid XML");
    } catch (e: any) {
      logger.warn(`Metadata Proxy ${proxy.name} failed: ${e.message}`);
      lastError = e;
      await new Promise(r => setTimeout(r, 200));
    }
  }

  if (!text || !isValidXml(text)) {
    throw new Error(`Failed to fetch metadata: ${lastError?.message || "All proxies failed"}`);
  }

  const results = parseAtomResponse(text);
  if (results.length === 0) {
     throw new Error(`Paper ID '${arxivId}' not found on ArXiv.`);
  }
  return results[0];
};

export const fetchRecentPapers = async (category: string = 'cs.AI', start: number = 0, maxResults: number = 20): Promise<ArxivMetadata[]> => {
    // Sort by submission date descending
    const url = `https://export.arxiv.org/api/query?search_query=cat:${category}&sortBy=submittedDate&sortOrder=descending&start=${start}&max_results=${maxResults}`;
    
    // Fallback proxies list for robustness
    const proxies = [
        {
            name: 'AllOrigins',
            fetch: async () => {
                const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
                if (!res.ok) throw new Error(res.statusText);
                const data = await res.json();
                return data.contents;
            }
        },
        {
            name: 'CodeTabs',
            fetch: async () => {
                const res = await fetch(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`);
                if (!res.ok) throw new Error(res.statusText);
                return res.text();
            }
        },
        {
            name: 'ThingProxy',
            fetch: async () => {
                const res = await fetch(`https://thingproxy.freeboard.io/fetch/${url}`);
                if (!res.ok) throw new Error(res.statusText);
                return res.text();
            }
        }
    ];

    let text = '';
    let lastError = null;

    for (const proxy of proxies) {
        try {
            text = await proxy.fetch();
            // Basic validation
            if (text && text.includes('<feed')) break;
            else throw new Error("Response was not valid Atom XML");
        } catch (e: any) {
            logger.warn(`Feed Proxy ${proxy.name} failed: ${e.message}`);
            lastError = e;
            await new Promise(r => setTimeout(r, 200));
        }
    }

    if (!text) {
        logger.error("Failed to fetch recent papers", lastError);
        throw new Error("Could not load recent papers feed. Please check your network connection.");
    }

    return parseAtomResponse(text);
};