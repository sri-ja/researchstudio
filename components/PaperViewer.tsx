import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Paper, ResearchGroup, AiInsight, RelatedPapersResult, Highlight } from '../types';
import { fetchPdfBlob } from '../services/pdfService';
import { generatePaperInsight, findRelatedPapers, autoTagAndCategorize, extractMetadataFromPdf } from '../services/geminiService';
import { parse } from 'marked';
import { dbService } from '../services/idbService';

// Configure PDF.js worker
const pdfjs = (pdfjsLib as any).default || pdfjsLib;
const workerUrl = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
if (pdfjs.GlobalWorkerOptions) {
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
}

// Highlight Color Palette
const HIGHLIGHT_COLORS = [
    { id: 'yellow', value: '#fde047', display: '#facc15', label: 'Key Point' }, 
    { id: 'green', value: '#86efac', display: '#4ade80', label: 'Valid / Good' }, 
    { id: 'blue', value: '#93c5fd', display: '#60a5fa', label: 'Neutral / Info' }, 
    { id: 'red', value: '#fca5a5', display: '#f87171', label: 'Issue / Critique' }, 
    { id: 'purple', value: '#d8b4fe', display: '#c084fc', label: 'Interesting' }, 
];

// Helper to convert ArrayBuffer to Base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}


interface PaperViewerProps {
  paper: Paper;
  groups: ResearchGroup[];
  onUpdatePaper: (paper: Paper) => void;
  isLeftSidebarOpen: boolean;
  onToggleLeftSidebar: () => void;
  onRequestCreateGroup: () => void;
  onCreateGroup: (name: string) => void;
}

export const PaperViewer: React.FC<PaperViewerProps> = ({ 
    paper, 
    groups, 
    onUpdatePaper,
    isLeftSidebarOpen,
    onToggleLeftSidebar,
    onRequestCreateGroup,
    onCreateGroup
}) => {
    // --- State ---
    const [activeTab, setActiveTab] = useState<'notes' | 'highlights' | 'insights' | 'related'>('notes');
    const [localNotes, setLocalNotes] = useState(paper.notes);
    const [isNotesPreview, setIsNotesPreview] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isGeneratingTags, setIsGeneratingTags] = useState(false);
    const [customPrompt, setCustomPrompt] = useState('');
    const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
    const [isFocusMode, setIsFocusMode] = useState(false);
    const lastSidebarState = useRef({ left: true, right: true });
    const [rightSidebarWidth, setRightSidebarWidth] = useState(400);

    // PDF State
    const [pdfDocument, setPdfDocument] = useState<any>(null);
    const [loadingPdf, setLoadingPdf] = useState(false);
    const [pdfError, setPdfError] = useState<string | null>(null);
    const [scale, setScale] = useState(1.0); // 1.0 = 100% zoom
    const [currentPage, setCurrentPage] = useState(1);
    const [numPages, setNumPages] = useState(0);

    // Selection State
    const [selectionRect, setSelectionRect] = useState<{top: number, left: number, text: string, showBelow?: boolean} | null>(null);
    const [tempHighlight, setTempHighlight] = useState<{
        text: string;
        rects: { x: number; y: number; width: number; height: number }[];
    } | null>(null);
    const [highlightNote, setHighlightNote] = useState('');

    // --- NEW: Local state for editing paper metadata ---
    const [editablePaper, setEditablePaper] = useState<Paper>(paper);
    const [isExtracting, setIsExtracting] = useState(false);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const textLayerRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const renderTaskRef = useRef<any>(null);

    const groupNames = useMemo(() => new Set(groups.map(g => g.name.toLowerCase())), [groups]);
    const isLocalPaper = useMemo(() => paper.arxivId.startsWith('local-'), [paper.arxivId]);

    // --- Sync external prop changes to internal editable state ---
    useEffect(() => {
        setEditablePaper(paper);
    }, [paper]);

    // --- Debounced auto-save for editablePaper changes ---
    useEffect(() => {
        const handler = setTimeout(() => {
            if (JSON.stringify(editablePaper) !== JSON.stringify(paper)) {
                onUpdatePaper(editablePaper);
            }
        }, 800);
        return () => clearTimeout(handler);
    }, [editablePaper, paper, onUpdatePaper]);

    const handleFieldChange = (field: keyof Paper, value: any) => {
        setEditablePaper(prev => ({ ...prev, [field]: value }));
    };

    const handleExtractMetadata = async () => {
        setIsExtracting(true);
        try {
            const pdfRecord = await dbService.get('localPdfs', paper.id);
            if (!pdfRecord?.data) {
                throw new Error("Local PDF data not found in the database.");
            }
            const base64Data = arrayBufferToBase64(pdfRecord.data);
            const metadata = await extractMetadataFromPdf(base64Data);

            setEditablePaper(prev => ({
                ...prev,
                title: metadata.title || prev.title,
                authors: metadata.authors && metadata.authors.length > 0 ? metadata.authors : prev.authors,
                summary: metadata.summary || prev.summary,
                published: metadata.published || prev.published,
            }));
            
        } catch (error: any) {
            alert(error.message);
            console.error(error);
        } finally {
            setIsExtracting(false);
        }
    };


    // --- Resizing Logic ---
    const handleMouseDownRight = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        const startX = e.clientX;
        const startWidth = rightSidebarWidth;

        const handleMouseMove = (e: MouseEvent) => {
            const newWidth = startWidth - (e.clientX - startX);
            setRightSidebarWidth(Math.min(Math.max(newWidth, 280), window.innerWidth * 0.6));
        };

        const handleMouseUp = () => {
            document.body.style.cursor = 'default';
            document.body.style.userSelect = 'auto';
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };

        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    }, [rightSidebarWidth]);

    // --- PDF Logic ---
    const loadPdfData = useCallback(async () => {
      setLoadingPdf(true);
      setPdfError(null);
      setPdfDocument(null);
      setCurrentPage(1);
      
      try {
          let data: ArrayBuffer;

          if (isLocalPaper) {
              const pdfRecord = await dbService.get('localPdfs', paper.id);
              if (pdfRecord?.data) {
                  data = pdfRecord.data;
              } else {
                  throw new Error("Local PDF data not found in the database. It might have been corrupted or deleted. Try re-importing it.");
              }
          } else {
              const blob = await fetchPdfBlob(paper.arxivId);
              data = await blob.arrayBuffer();
          }

          if (!pdfjs.GlobalWorkerOptions.workerSrc) {
               pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
          }

          const loadingTask = pdfjs.getDocument({ data });
          const pdf = await loadingTask.promise;
          setPdfDocument(pdf);
          setNumPages(pdf.numPages);
      } catch (err: any) {
          console.error("PDF Load Error:", err);
          setPdfError(err.message || "Failed to load PDF. Network or Proxy Error.");
      } finally {
          setLoadingPdf(false);
      }
    }, [paper.id, paper.arxivId, isLocalPaper]);
    
    // Manual upload handler for temporary viewing if ArXiv fails
    const handleManualUploadForView = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoadingPdf(true);
        setPdfError(null);
        setPdfDocument(null);
        setCurrentPage(1);

        try {
            const data = await file.arrayBuffer();
            const loadingTask = pdfjs.getDocument({ data });
            const pdf = await loadingTask.promise;
            setPdfDocument(pdf);
            setNumPages(pdf.numPages);
        } catch (err: any) {
            setPdfError('Failed to load manually selected PDF.');
        } finally {
            setLoadingPdf(false);
        }
    };


    // Initial Load
    useEffect(() => {
        if (paper.arxivId) {
            loadPdfData();
        } else {
            setPdfError("This paper has no associated PDF (no ArXiv or local ID).");
        }
    }, [paper.id, loadPdfData]);

    // Sync Notes
    useEffect(() => {
        setLocalNotes(paper.notes);
    }, [paper.id]);

    // Auto-save Notes
    useEffect(() => {
        const timer = setTimeout(() => {
            if (localNotes !== paper.notes) {
                onUpdatePaper({ ...paper, notes: localNotes });
            }
        }, 800);
        return () => clearTimeout(timer);
    }, [localNotes, paper.notes, onUpdatePaper, paper]);

    // Render Page with Text Layer (High DPI Support)
    useEffect(() => {
        if (!pdfDocument || !canvasRef.current || !wrapperRef.current || !textLayerRef.current) return;

        const renderPage = async () => {
            if (renderTaskRef.current) {
                try { await renderTaskRef.current.cancel(); } catch(e) {}
            }

            try {
                const page = await pdfDocument.getPage(currentPage);
                
                const outputScale = window.devicePixelRatio || 1;
                const viewport = page.getViewport({ scale: scale });

                const wrapper = wrapperRef.current!;
                wrapper.style.width = `${Math.floor(viewport.width)}px`;
                wrapper.style.height = `${Math.floor(viewport.height)}px`;

                const canvas = canvasRef.current!;
                const context = canvas.getContext('2d');
                if (!context) return;

                canvas.width = Math.floor(viewport.width * outputScale);
                canvas.height = Math.floor(viewport.height * outputScale);
                canvas.style.width = `${Math.floor(viewport.width)}px`;
                canvas.style.height = `${Math.floor(viewport.height)}px`;

                const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;

                const renderContext = { canvasContext: context, transform: transform, viewport: viewport };
                const renderTask = page.render(renderContext);
                renderTaskRef.current = renderTask;
                await renderTask.promise;

                const textLayerDiv = textLayerRef.current!;
                textLayerDiv.innerHTML = ''; 
                textLayerDiv.style.width = `${Math.floor(viewport.width)}px`;
                textLayerDiv.style.height = `${Math.floor(viewport.height)}px`;
                textLayerDiv.style.setProperty('--scale-factor', `${scale}`);
                
                const textContent = await page.getTextContent();
                pdfjs.renderTextLayer({
                    textContentSource: textContent,
                    container: textLayerDiv,
                    viewport: viewport,
                    textDivs: []
                });

            } catch (error: any) {}
        };
        renderPage();
    }, [pdfDocument, currentPage, scale]);

    // --- Actions ---

    const toggleFocusMode = () => {
        if (!isFocusMode) {
            lastSidebarState.current = { left: isLeftSidebarOpen, right: isRightSidebarOpen };
            if (isLeftSidebarOpen) onToggleLeftSidebar();
            if (isRightSidebarOpen) setIsRightSidebarOpen(false);
            setIsFocusMode(true);
        } else {
            if (lastSidebarState.current.left && !isLeftSidebarOpen) onToggleLeftSidebar();
            if (lastSidebarState.current.right && !isRightSidebarOpen) setIsRightSidebarOpen(true);
            setIsFocusMode(false);
        }
    };

    const handleGenerateInsight = async (type: 'summary' | 'eli5' | 'methodology' | 'gaps') => {
        setIsGenerating(true);
        setActiveTab('insights');
        try {
            const answer = await generatePaperInsight(paper.summary, paper.title, type);
            const newInsight: AiInsight = { id: crypto.randomUUID(), type, question: type, answer, createdAt: Date.now() };
            onUpdatePaper({ ...paper, aiInsights: [newInsight, ...(paper.aiInsights || [])] });
        } catch (e) { console.error(e); } finally { setIsGenerating(false); }
    };

    const handleGenerateCustomInsight = async () => {
        if (!customPrompt.trim()) return;
        setIsGenerating(true);
        try {
            const question = customPrompt.trim();
            const answer = await generatePaperInsight(paper.summary, paper.title, 'custom', question);
            const newInsight: AiInsight = { 
                id: crypto.randomUUID(), 
                type: 'custom', 
                question: question, 
                answer, 
                createdAt: Date.now() 
            };
            onUpdatePaper({ ...paper, aiInsights: [newInsight, ...(paper.aiInsights || [])] });
            setCustomPrompt('');
        } catch (e) { 
            console.error(e); 
        } finally { 
            setIsGenerating(false); 
        }
    };

    const handleGenerateTags = async () => {
        setIsGeneratingTags(true);
        try {
            const { tags, suggestedGroupId } = await autoTagAndCategorize(paper.title, paper.summary, groups);
            onUpdatePaper({ ...paper, tags, groupId: suggestedGroupId || paper.groupId });
        } catch (error) {
            console.error("Failed to generate tags", error);
            alert("Could not generate tags. Please check the console for details.");
        } finally { setIsGeneratingTags(false); }
    };

    const handleFindRelated = async () => {
        setIsGenerating(true);
        setActiveTab('related');
        try {
            const result = await findRelatedPapers(paper.title, paper.authors);
            onUpdatePaper({ ...paper, relatedPapers: { papers: result.papers, generatedAt: Date.now() } });
        } catch(e) { console.error(e); } finally { setIsGenerating(false); }
    };

    // --- Highlight Logic ---
    const handleTextSelection = (e: React.MouseEvent) => {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
            setSelectionRect(null); setHighlightNote(''); setTempHighlight(null); return;
        }
        const wrapper = wrapperRef.current;
        if (!wrapper || !wrapper.contains(selection.anchorNode)) return;

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        const wrapperRect = wrapper.getBoundingClientRect();
        
        const relativeTop = rect.top - wrapperRect.top;
        const relativeLeft = rect.left - wrapperRect.left + (rect.width / 2);
        const showBelow = relativeTop < 150;

        setSelectionRect({ top: relativeTop, left: relativeLeft, text: selection.toString().trim(), showBelow });

        const clientRects = Array.from(range.getClientRects());
        const relativeRects = clientRects
            .filter(r => r.width > 0 && r.height > 0)
            .map(r => ({
                x: ((r.left - wrapperRect.left) / wrapperRect.width) * 100,
                y: ((r.top - wrapperRect.top) / wrapperRect.height) * 100,
                width: (r.width / wrapperRect.width) * 100,
                height: (r.height / wrapperRect.height) * 100
            }));

        if (relativeRects.length > 0) {
            setTempHighlight({ text: selection.toString().trim(), rects: relativeRects });
        }
    };

    const saveHighlight = (color: string) => {
        if (!tempHighlight || !wrapperRef.current) return;
        const newHighlight: Highlight = {
            id: crypto.randomUUID(), text: tempHighlight.text, note: highlightNote, color: color, createdAt: Date.now(),
            position: { pageNumber: currentPage, rects: tempHighlight.rects, boundingRect: tempHighlight.rects[0] }
        };
        const updatedHighlights = [newHighlight, ...(paper.highlights || [])];
        onUpdatePaper({ ...paper, highlights: updatedHighlights });
        setSelectionRect(null); setHighlightNote(''); setTempHighlight(null);
        window.getSelection()?.removeAllRanges();
        setActiveTab('highlights');
    };

    const updateHighlightNote = (id: string, newNote: string) => {
        const updatedHighlights = (paper.highlights || []).map(h => h.id === id ? { ...h, note: newNote } : h);
        onUpdatePaper({ ...paper, highlights: updatedHighlights });
    };

    const deleteHighlight = (id: string) => {
        onUpdatePaper({ ...paper, highlights: (paper.highlights || []).filter(h => h.id !== id) });
    };

    const fitToWidth = () => {
        if (containerRef.current && wrapperRef.current && pdfDocument) {
            pdfDocument.getPage(currentPage).then((page: any) => {
                const containerWidth = containerRef.current!.clientWidth - 80;
                const viewport = page.getViewport({ scale: 1.0 });
                setScale(containerWidth / viewport.width);
            });
        }
    };

    const getScholarLink = (title: string) => `https://scholar.google.com/scholar?q=${encodeURIComponent(title)}`;
    const getSemanticLink = (title: string) => `https://www.semanticscholar.org/search?q=${encodeURIComponent(title)}`;

    return (
        <div className="flex flex-col h-full bg-slate-900 overflow-hidden">
             {/* Header */}
             <div className="h-auto md:h-14 bg-slate-950 border-b border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between px-4 py-2 md:py-0 shrink-0 z-10 gap-2">
                <div className="flex items-center gap-3 overflow-hidden flex-1 w-full">
                    <button onClick={onToggleLeftSidebar} className={`p-1.5 rounded hover:bg-slate-800 text-slate-400 transition-colors self-start mt-1 md:mt-0 ${!isLeftSidebarOpen ? 'text-indigo-400' : ''}`} title="Toggle Left Sidebar">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" /></svg>
                    </button>
                    {isLocalPaper ? (
                        <div className="flex-1 space-y-1">
                            <input type="text" value={editablePaper.title} onChange={(e) => handleFieldChange('title', e.target.value)} placeholder="Paper Title" className="w-full bg-transparent text-sm font-bold text-white focus:outline-none border-b border-dashed border-transparent focus:border-slate-600 py-0.5" />
                            <input type="text" value={editablePaper.authors.join(', ')} onChange={(e) => handleFieldChange('authors', e.target.value.split(',').map(a => a.trim()))} placeholder="Authors (comma-separated)" className="w-full bg-transparent text-xs text-slate-400 focus:outline-none border-b border-dashed border-transparent focus:border-slate-600 py-0.5" />
                        </div>
                    ) : (
                        <div className="flex flex-col overflow-hidden min-w-0">
                            <h2 className="text-sm font-bold text-white truncate" title={paper.title}>{paper.title}</h2>
                            <div className="flex items-center gap-2 text-xs text-slate-500 truncate">
                                <span>{paper.authors.slice(0, 2).join(', ')} {paper.authors.length > 2 ? `+${paper.authors.length - 2}` : ''}</span>
                                <span className="text-slate-700">|</span>
                                <div className="flex gap-2">
                                    <a href={getScholarLink(paper.title)} target="_blank" rel="noreferrer" className="hover:text-indigo-400 transition-colors">Scholar</a>
                                    <a href={getSemanticLink(paper.title)} target="_blank" rel="noreferrer" className="hover:text-indigo-400 transition-colors">Semantic</a>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-4 shrink-0 w-full md:w-auto justify-end">
                    {isLocalPaper && (
                        <>
                            <div className="flex items-center gap-2">
                                <input type="date" value={editablePaper.published ? editablePaper.published.split('T')[0] : ''} onChange={(e) => handleFieldChange('published', e.target.value)} className="bg-slate-900 border border-slate-700 text-xs rounded px-2 py-1 text-slate-300 focus:outline-none focus:border-indigo-500 [&::-webkit-calendar-picker-indicator]:invert" />
                                <button onClick={handleExtractMetadata} disabled={isExtracting} className="px-3 py-1.5 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 text-xs font-bold rounded border border-indigo-500/30 transition-colors flex items-center gap-1.5 disabled:opacity-50">
                                    {isExtracting ? (<svg className="animate-spin h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>) : (<svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>)}
                                    Extract Info
                                </button>
                            </div>
                            <div className="w-px h-6 bg-slate-800 hidden md:block"></div>
                        </>
                    )}
                    <select value={paper.groupId || ''} onChange={(e) => onUpdatePaper({ ...paper, groupId: e.target.value === 'new' ? paper.groupId : (e.target.value || undefined) })} onClick={(e) => { if ((e.target as HTMLSelectElement).value === 'new') { onRequestCreateGroup(); } }} className="bg-slate-900 border border-slate-700 text-xs rounded px-2 py-1 text-slate-300 focus:outline-none focus:border-indigo-500 max-w-[150px]">
                        <option value="">Inbox</option>
                        {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                        <option disabled>──────────</option>
                        <option value="new">+ New Group</option>
                    </select>
                    {!isLocalPaper && (<a href={`https://arxiv.org/abs/${paper.arxivId}`} target="_blank" rel="noreferrer" className="text-slate-500 hover:text-white" title="Open ArXiv Page"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" /><path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" /></svg></a>)}
                    <div className="w-px h-6 bg-slate-800 hidden md:block"></div>
                    <button onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)} className={`p-1.5 rounded hover:bg-slate-800 text-slate-400 transition-colors ${!isRightSidebarOpen ? 'text-indigo-400' : ''}`} title="Toggle Notes Sidebar">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" /></svg>
                    </button>
                </div>
             </div>

             {/* Main Layout */}
             <div className="flex-1 flex overflow-hidden">
                 <div className="flex-1 bg-slate-800/50 relative flex flex-col items-center overflow-hidden">
                     <div ref={containerRef} className="flex-1 w-full overflow-auto flex justify-center p-8 pdf-container relative">
                         {loadingPdf ? ( <div className="flex flex-col items-center justify-center text-slate-500 gap-4 mt-20"><svg className="animate-spin h-8 w-8 text-indigo-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg><p>Loading PDF...</p>{!isLocalPaper && <p className="text-xs text-slate-600">Trying multiple proxies...</p>}</div>
                         ) : pdfError ? ( <div className="flex flex-col items-center justify-center text-slate-400 gap-4 mt-20 max-w-md text-center"><svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-red-500/50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg><p className="font-bold text-white">Could not load PDF</p><p className="text-sm bg-slate-900 p-2 rounded border border-slate-700 font-mono text-red-300">{pdfError}</p>{!isLocalPaper && ( <div className="mt-4 p-4 bg-slate-900 border border-slate-700 rounded-lg w-full"><p className="text-xs mb-2 font-bold text-slate-300">Workaround: Manual View</p><p className="text-[10px] text-slate-500 mb-3">ArXiv can block automated viewers. You can download the PDF and open it here for a temporary viewing session to use highlighting tools.</p><input type="file" accept="application/pdf" onChange={handleManualUploadForView} className="text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-500/10 file:text-indigo-400 hover:file:bg-indigo-500/20"/><div className="mt-4 text-xs text-center"><a href={`https://arxiv.org/pdf/${paper.arxivId}.pdf`} target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">Download PDF from ArXiv &rarr;</a></div></div> )}</div>
                         ) : ( <div ref={wrapperRef} onMouseUp={handleTextSelection} className="pdf-page relative shadow-2xl transition-transform duration-75 ease-out origin-top"><canvas ref={canvasRef} className="block" /><div ref={textLayerRef} className="textLayer" /><div className="highlight-layer">{(paper.highlights || []).filter(h => h.position?.pageNumber === currentPage).map(highlight => (highlight.position?.rects.map((rect, idx) => ( <div key={`${highlight.id}-${idx}`} className="absolute" style={{ top: `${rect.y}%`, left: `${rect.x}%`, width: `${rect.width}%`, height: `${rect.height}%`, backgroundColor: highlight.color, mixBlendMode: 'multiply', opacity: 0.25 }}/> ))))}</div>{selectionRect && ( <div className={`absolute z-50 bg-slate-900 border border-slate-700 rounded-lg shadow-xl p-3 flex flex-col gap-3 animate-in zoom-in-95 duration-100 w-72 -translate-x-1/2 ${selectionRect.showBelow ? 'translate-y-2' : '-translate-y-[calc(100%+10px)]' }`} style={{ top: selectionRect.showBelow ? (selectionRect.top + 20) : selectionRect.top, left: selectionRect.left }} onMouseUp={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}><div className="flex items-center justify-between"><span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Add Highlight</span><button onClick={() => { setSelectionRect(null); setHighlightNote(''); window.getSelection()?.removeAllRanges(); }} className="text-slate-500 hover:text-white"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg></button></div><textarea value={highlightNote} onChange={(e) => setHighlightNote(e.target.value)} placeholder="Add a note (optional)..." className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 resize-none h-16" autoFocus /><div className="flex flex-col gap-2"><div className="text-[9px] text-slate-500 uppercase font-bold">Pick Color & Save</div><div className="flex justify-between gap-1">{HIGHLIGHT_COLORS.map(color => ( <button key={color.id} onMouseDown={(e) => e.preventDefault()} onClick={() => saveHighlight(color.value)} className="w-8 h-8 rounded-full border-2 border-slate-700 hover:border-white hover:scale-110 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-indigo-500" style={{ backgroundColor: color.display }} title={color.label} /> ))}</div></div></div> )}</div>)}
                     </div>
                     <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 bg-slate-900/90 backdrop-blur-md border border-slate-700 rounded-full px-4 py-2 shadow-2xl">
                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1} className="p-1.5 hover:bg-slate-700 rounded-full text-slate-300 disabled:opacity-30" title="Previous Page"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414L4 10l-3.293 3.293a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg></button>
                        <span className="text-xs font-mono text-white min-w-[3rem] text-center font-bold">{currentPage} / {numPages || '-'}</span>
                        <button onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))} disabled={currentPage >= numPages} className="p-1.5 hover:bg-slate-700 rounded-full text-slate-300 disabled:opacity-30" title="Next Page"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg></button>
                        <div className="w-px h-5 bg-slate-700 mx-2"></div>
                        <button onClick={() => setScale(s => Math.max(0.5, s - 0.2))} className="p-1.5 text-slate-400 hover:text-white" title="Zoom Out"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" clipRule="evenodd" /></svg></button>
                        <span className="text-xs text-slate-400 w-10 text-center font-mono">{Math.round(scale * 100)}%</span>
                        <button onClick={() => setScale(s => Math.min(3, s + 0.2))} className="p-1.5 text-slate-400 hover:text-white" title="Zoom In"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" /></svg></button>
                        <button onClick={fitToWidth} className="ml-2 text-[10px] bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded text-slate-300 hover:text-white transition-colors">Fit Width</button>
                        <div className="w-px h-5 bg-slate-700 mx-2"></div>
                        <button onClick={toggleFocusMode} className={`p-1.5 rounded-full transition-colors ${isFocusMode ? 'text-indigo-400 bg-slate-700' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`} title={isFocusMode ? "Exit Focus Mode" : "Focus Mode"}>{isFocusMode ? (<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 0h4m4 0l-5-5" /></svg>) : (<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>)}</button>
                     </div>
                 </div>
                 {isRightSidebarOpen && ( <div onMouseDown={handleMouseDownRight} className="w-1.5 shrink-0 cursor-col-resize bg-slate-800 hover:bg-indigo-500 transition-colors duration-200 ease-in-out"/> )}
                 <div style={{ width: isRightSidebarOpen ? `${rightSidebarWidth}px` : '0px' }} className={`bg-slate-900 flex flex-col shrink-0 transition-[width] duration-300 ease-in-out overflow-hidden`}>
                     <div className="p-4 border-b border-slate-800 min-w-[400px]">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Abstract / Summary</label>
                        <textarea value={editablePaper.summary} onChange={(e) => handleFieldChange('summary', e.target.value)} readOnly={!isLocalPaper} placeholder={isLocalPaper ? "Enter or paste the paper's abstract here..." : "No summary available."} className={`w-full h-32 bg-slate-800 border rounded-md p-2 mt-2 text-xs text-slate-300 focus:outline-none resize-none custom-scrollbar ${isLocalPaper ? 'border-slate-700 focus:border-indigo-500' : 'border-transparent bg-transparent text-slate-400 p-0 mt-1'}`} />
                    </div>
                     <div className="flex border-b border-slate-800 min-w-[400px]">
                         {(['notes', 'highlights', 'insights', 'related'] as const).map(tab => ( <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-wider border-b-2 transition-colors ${ activeTab === tab ? 'border-indigo-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>{tab}</button>))}
                     </div>
                     <div className="flex-1 overflow-y-auto custom-scrollbar p-0 min-w-[400px]">
                         {activeTab === 'notes' && (
                             <div className="flex flex-col h-full">
                                 {isNotesPreview ? (
                                     <div className="prose prose-invert prose-sm max-w-none p-4 overflow-y-auto custom-scrollbar flex-1">
                                         <div dangerouslySetInnerHTML={{ __html: parse(localNotes || '*No notes yet...*') as string }} />
                                     </div>
                                 ) : (
                                     <textarea
                                         value={localNotes}
                                         onChange={(e) => setLocalNotes(e.target.value)}
                                         placeholder="Take notes about this paper here (Markdown supported)..."
                                         className="flex-1 bg-transparent p-4 text-sm text-slate-300 focus:outline-none resize-none font-mono leading-relaxed"
                                     />
                                 )}
                                 <div className="p-2 border-t border-slate-800 text-[10px] text-slate-500 flex justify-between items-center px-4">
                                     <button onClick={() => setIsNotesPreview(!isNotesPreview)} className="text-xs text-indigo-400 hover:text-indigo-300 font-medium">
                                         {isNotesPreview ? 'Edit' : 'Preview'}
                                     </button>
                                     <span>{localNotes !== paper.notes ? 'Saving...' : 'Saved'}</span>
                                 </div>
                             </div>
                         )}

                         {activeTab === 'highlights' && (
                             <div className="p-4 space-y-4">
                                 {(paper.highlights || []).length === 0 && (
                                     <div className="text-center text-slate-500 text-xs py-10 border border-dashed border-slate-800 rounded-lg">
                                         Select text in the PDF to add highlights.
                                     </div>
                                 )}
                                 {(paper.highlights || []).map((highlight) => (
                                     <div
                                         key={highlight.id}
                                         className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 group relative cursor-pointer hover:bg-slate-800 transition-colors"
                                         onClick={() => setCurrentPage(highlight.position?.pageNumber || 1)}
                                     >
                                         <div className="flex justify-between items-start mb-2">
                                             <div className="flex gap-1.5 items-center">
                                                 <div className="w-2 h-2 rounded-full" style={{ backgroundColor: highlight.color }}></div>
                                                 <span className="text-[10px] text-slate-500">Page {highlight.position?.pageNumber || '?'}</span>
                                             </div>
                                             <button
                                                 onClick={(e) => { e.stopPropagation(); deleteHighlight(highlight.id); }}
                                                 className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                             >
                                                 &times;
                                             </button>
                                         </div>
                                         <blockquote className="text-xs text-slate-300 border-l-2 border-slate-600 pl-3 italic mb-2">"{highlight.text}"</blockquote>
                                         <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                                             <label className="text-[9px] font-bold text-slate-500 uppercase mb-1 block">Note</label>
                                             <textarea
                                                 defaultValue={highlight.note}
                                                 onBlur={(e) => { if (e.target.value !== highlight.note) { updateHighlightNote(highlight.id, e.target.value); } }}
                                                 placeholder="Add a note..."
                                                 className="w-full bg-slate-900/50 border border-slate-700/50 rounded p-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500/50 resize-none h-auto min-h-[60px] transition-colors"
                                             />
                                         </div>
                                     </div>
                                 ))}
                             </div>
                         )}

                         {activeTab === 'insights' && (
                             <div className="p-4 space-y-4">
                                 <div className="pb-4 border-b border-slate-800">
                                     <div className="flex justify-between items-center mb-2">
                                         <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">AI Tags</h3>
                                     </div>
                                     {paper.tags && paper.tags.length > 0 ? (
                                         <div className="flex flex-wrap items-center gap-2">
                                             {paper.tags.map(tag => {
                                                 const groupExists = groupNames.has(tag.toLowerCase());
                                                 return (
                                                     <div key={tag} className="flex items-center bg-slate-700 rounded-full">
                                                         <span className="text-slate-200 text-xs font-medium pl-2.5 pr-1.5 py-1">{tag}</span>
                                                         {!groupExists && (
                                                             <button onClick={() => onCreateGroup(tag)} title={`Create group "${tag}"`} className="pr-2 text-slate-400 hover:text-white transition-colors">
                                                                 <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                                                     <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                                                                 </svg>
                                                             </button>
                                                         )}
                                                     </div>
                                                 );
                                             })}
                                             <button onClick={handleGenerateTags} disabled={isGeneratingTags || !paper.summary} className="p-1.5 rounded-full hover:bg-slate-700 text-slate-400 transition-colors disabled:opacity-50" title={!paper.summary ? "AI Tagging requires an abstract. Please add one first." : "Regenerate Tags"}>
                                                 <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                     <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v3.276a1 1 0 01-2 0V14.808a7.002 7.002 0 01-11.269-2.566 1 1 0 01.678-1.185z" clipRule="evenodd" />
                                                 </svg>
                                             </button>
                                         </div>
                                     ) : (
                                         <button onClick={handleGenerateTags} disabled={isGeneratingTags || !paper.summary} className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/30 rounded text-sm font-bold text-indigo-300 hover:text-white transition-colors disabled:opacity-50">
                                             {isGeneratingTags ? 'Generating...' : 'Auto-tag & Group'}
                                         </button>
                                     )}
                                 </div>
                                 <div className="grid grid-cols-2 gap-2">
                                     {(['Summary', 'ELI5', 'Methodology', 'Gaps'] as const).map(type => (
                                         <button
                                             key={type}
                                             onClick={() => handleGenerateInsight(type.toLowerCase() as any)}
                                             disabled={isGenerating || !paper.summary}
                                             className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs font-bold text-slate-300 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                             title={!paper.summary ? "AI Insights require an abstract. Please add one first." : ""}
                                         >
                                             {type}
                                         </button>
                                     ))}
                                 </div>
                                 <div className="pt-2">
                                     <div className="relative">
                                         <textarea
                                             value={customPrompt}
                                             onChange={(e) => setCustomPrompt(e.target.value)}
                                             onKeyDown={(e) => {
                                                 if (e.key === 'Enter' && !e.shiftKey) {
                                                     e.preventDefault();
                                                     handleGenerateCustomInsight();
                                                 }
                                             }}
                                             placeholder="Ask a custom question..."
                                             className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 pr-10 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 resize-none h-20 custom-scrollbar shadow-inner"
                                         />
                                         <button
                                             onClick={handleGenerateCustomInsight}
                                             disabled={isGenerating || !customPrompt.trim() || !paper.summary}
                                             className="absolute bottom-2 right-2 p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md transition-colors disabled:opacity-0 disabled:pointer-events-none shadow-lg"
                                             title="Send"
                                         >
                                             <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                                 <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                                             </svg>
                                         </button>
                                     </div>
                                 </div>
                                 {isGenerating && (
                                     <div className="flex items-center justify-center py-4 text-xs text-indigo-400 animate-pulse">
                                         Generating Analysis...
                                     </div>
                                 )}
                                 <div className="space-y-4">
                                     {(paper.aiInsights || []).map(insight => (
                                         <div key={insight.id} className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                                             <div className="text-[10px] font-bold text-indigo-400 uppercase mb-1 tracking-wider">{insight.question}</div>
                                             <div className="prose prose-invert prose-sm text-xs text-slate-300 max-w-none">
                                                 <div dangerouslySetInnerHTML={{ __html: parse(insight.answer) as string }} />
                                             </div>
                                         </div>
                                     ))}
                                 </div>
                             </div>
                         )}

                         {activeTab === 'related' && (
                             <div className="p-4">
                                 {!paper.relatedPapers ? (
                                     <div className="text-center py-8">
                                         <p className="text-sm text-slate-400 mb-4">Find similar or connected papers using Google Search & Gemini.</p>
                                         <button onClick={handleFindRelated} disabled={isGenerating || !paper.title || paper.authors.length === 0} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded shadow-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title={!paper.title || paper.authors.length === 0 ? "Finding related papers requires a title and authors." : ""}>{isGenerating ? 'Searching...' : 'Find Related Papers'}</button>
                                         <div className="mt-8 pt-6 border-t border-slate-800/50">
                                             <a href="https://asta.allen.ai/chat" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-xs text-slate-500 hover:text-indigo-400 transition-colors">
                                                 <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                                 Open Asta (Allen AI) for deep search
                                             </a>
                                         </div>
                                     </div>
                                 ) : (
                                     <div className="space-y-4">
                                         <div className="flex justify-between items-center">
                                             <span className="text-[10px] text-slate-500">Generated {new Date(paper.relatedPapers.generatedAt).toLocaleDateString()}</span>
                                             <button onClick={handleFindRelated} className="text-xs text-indigo-400 hover:text-white">Refresh</button>
                                         </div>
                                         <a href="https://asta.allen.ai/chat" target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 w-full py-2 bg-slate-800 border border-dashed border-slate-700 rounded text-xs text-slate-400 hover:text-indigo-300 hover:border-indigo-500/30 transition-colors">
                                             <span>Use <strong>Asta (Allen AI)</strong> for deeper literature review</span>
                                             <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                         </a>
                                         <div className="space-y-3">
                                             {paper.relatedPapers.papers.map((rp, idx) => (
                                                 <div key={idx} className="bg-slate-800 border border-slate-700 rounded-lg p-3 hover:border-indigo-500/30 transition-colors">
                                                     <h4 className="font-bold text-slate-200 text-sm mb-1 leading-snug">{rp.title}</h4>
                                                     <div className="text-xs text-slate-400 mb-2 flex items-center gap-2">
                                                         <span>{rp.authors[0]} et al.</span>
                                                         {rp.year && <span className="text-slate-600">• {rp.year}</span>}
                                                     </div>
                                                     <p className="text-xs text-slate-500 italic mb-3 border-l-2 border-slate-700 pl-2">{rp.reason}</p>
                                                     <div className="flex gap-2 border-t border-slate-700/50 pt-2">
                                                         <a href={getScholarLink(rp.title)} target="_blank" rel="noreferrer" className="flex-1 text-center py-1 bg-slate-700 hover:bg-slate-600 text-white text-[10px] font-bold rounded-sm transition-colors">Scholar</a>
                                                         <a href={getSemanticLink(rp.title)} target="_blank" rel="noreferrer" className="flex-1 text-center py-1 bg-slate-700 hover:bg-slate-600 text-white text-[10px] font-bold rounded-sm transition-colors">Semantic</a>
                                                     </div>
                                                 </div>
                                             ))}
                                         </div>
                                     </div>
                                 )}
                             </div>
                         )}
                     </div>
                 </div>
             </div>
        </div>
    );
};
