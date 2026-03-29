
import * as pdfjsLib from 'pdfjs-dist';
import { logger } from './loggingService';

// Handle potential ESM import structure differences
const pdfjs = (pdfjsLib as any).default || pdfjsLib;

if (pdfjs.GlobalWorkerOptions) {
    // Use CDNJS standard script for the worker to avoid ESM module wrapping issues in the worker context
    pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
}

// Fetch the raw PDF blob via proxy
export const fetchPdfBlob = async (arxivId: string): Promise<Blob> => {
    // Clean ID (remove version if it causes issues, though usually v1 is fine)
    const cleanId = arxivId.replace(/v\d+$/, '');

    // Mirrors to try. 
    // 1. Main site (often works best with CorsProxy)
    // 2. Export site (programmatic access)
    // 3. Browse site (sometimes different rate limits)
    const arxivMirrors = [
        `https://arxiv.org/pdf/${arxivId}.pdf`,
        `https://export.arxiv.org/pdf/${arxivId}.pdf`,
        `https://browse.arxiv.org/pdf/${arxivId}.pdf`,
    ];

    const proxies = [
        // 1. CorsProxy.io - Usually fastest/most reliable for ArXiv
        {
            name: 'CorsProxy',
            url: (target: string) => `https://corsproxy.io/?${encodeURIComponent(target)}`
        },
        // 2. AllOrigins Raw - Reliable fallback for binaries
        {
            name: 'AllOriginsRaw',
            url: (target: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`
        },
        // 3. CodeTabs - Good backup
        {
            name: 'CodeTabs',
            url: (target: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(target)}`
        }
    ];

    let lastError: Error | null = null;

    // Helper to validate PDF magic bytes %PDF
    const isValidPdf = async (blob: Blob): Promise<boolean> => {
        // Too small to be a PDF
        if (blob.size < 600) return false;
        
        const buffer = await blob.slice(0, 1024).arrayBuffer();
        const data = new Uint8Array(buffer);
        
        // Look for %PDF (0x25, 0x50, 0x44, 0x46) in the first 1KB
        for (let i = 0; i < data.length - 4; i++) {
            if (data[i] === 0x25 && data[i+1] === 0x50 && data[i+2] === 0x44 && data[i+3] === 0x46) {
                return true;
            }
        }
        return false;
    };

    // Try combinations
    for (const mirrorUrl of arxivMirrors) {
        for (const proxy of proxies) {
            try {
                // Add timestamp to bypass proxy/browser caches
                const targetWithCacheBust = `${mirrorUrl}?t=${Date.now()}`;
                const fetchUrl = proxy.url(targetWithCacheBust);
                
                // console.log(`Attempting PDF fetch: ${proxy.name} -> ${mirrorUrl}`);
                
                const res = await fetch(fetchUrl);
                
                if (!res.ok) {
                    throw new Error(`Status ${res.status}`);
                }
                
                const blob = await res.blob();
                
                // Validation: Check if it is actually a PDF and not an HTML error page
                const valid = await isValidPdf(blob);
                if (!valid) {
                    throw new Error("Downloaded content is not a valid PDF (Invalid structure/magic bytes)");
                }
                
                logger.info(`Successfully loaded PDF via ${proxy.name} from ${mirrorUrl}`);
                return blob;
            } catch (e: any) {
                logger.warn(`PDF fetch failed (${proxy.name} -> ${mirrorUrl}): ${e.message}`);
                lastError = e;
                // Continue to next combination
            }
        }
    }

    throw new Error(`Could not load PDF. Last error: ${lastError?.message || 'Unknown'}. Try the manual download link.`);
}

// Legacy text extraction (kept for compatibility)
export const extractTextFromPdf = async (arxivId: string): Promise<string> => {
  try {
      const blob = await fetchPdfBlob(arxivId);
      const arrayBuffer = await blob.arrayBuffer();
      
      const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;

      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += `--- Page ${i} ---\n\n${pageText}\n\n`;
      }
      return fullText;
  } catch (error: any) {
      throw new Error(`PDF Extraction failed: ${error.message}`);
  }
};