
import React, { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react';
import { ArxivMetadata, HistoryItem, LikedPaper, UserTasteProfile } from '../types';
import { fetchRecentPapers, getCoreArxivId } from '../services/arxivService';
import ForYouView from './ForYouView'; // Import the new component

interface PaperFeedProps {
    onSaveForLater: (metadata: ArxivMetadata) => void;
    onReadNow: (metadata: ArxivMetadata) => void;
    savedPaperIds: Set<string>; // To show 'Saved' state
    seenPaperIds: Set<string>; // To filter out seen papers
    onMarkAsSeen: (metadata: ArxivMetadata) => void;
    history: HistoryItem[];
    likedPapers: LikedPaper[];
    onToggleLike: (metadata: ArxivMetadata) => void;
    userTasteProfile: UserTasteProfile | null;
    onUpdateTasteProfile: (profile: UserTasteProfile | null) => void;
}

const CATEGORIES = [
    { id: 'all', label: 'All' },
    { id: 'cs.AI', label: 'AI' },
    { id: 'cs.CV', label: 'Vision' },
    { id: 'cs.CL', label: 'NLP' },
    { id: 'cs.RO', label: 'Robotics' }
];

// Utility to generate consistent colors from string
const stringToHue = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash % 360);
};

// Reusable Action Button for the Sidebar
const SidebarAction = ({ 
    icon, 
    label, 
    onClick, 
    isActive = false, 
    activeColor = "text-indigo-400" 
}: { 
    icon: React.ReactNode; 
    label: string; 
    onClick: (e: React.MouseEvent) => void; 
    isActive?: boolean;
    activeColor?: string;
}) => (
    <button 
        onClick={(e) => { e.stopPropagation(); onClick(e); }}
        className="group flex flex-col items-center gap-1 transition-transform active:scale-90"
    >
        <div className={`p-3 rounded-full backdrop-blur-md border transition-all shadow-lg ${
            isActive 
            ? `bg-slate-900/80 border-${activeColor.split('-')[1]}-500/50 ${activeColor}` 
            : 'bg-slate-800/40 border-white/10 text-white hover:bg-slate-700/60'
        }`}>
            {icon}
        </div>
        <span className="text-[10px] font-medium text-white/80 shadow-black drop-shadow-md">{label}</span>
    </button>
);

// Memoized Immersive Card
const PaperCard = memo(({ 
    paper, 
    isActive, 
    onSave, 
    onRead,
    isSaved,
    isLiked,
    onLike
}: { 
    paper: ArxivMetadata; 
    isActive: boolean; 
    onSave: () => void; 
    onRead: () => void;
    isSaved: boolean;
    isLiked: boolean;
    onLike: () => void;
}) => {
    // Generate dynamic background styles based on paper ID
    const bgStyle = useMemo(() => {
        const hue = stringToHue(paper.arxivId);
        const secondaryHue = (hue + 40) % 360;
        return {
            background: `radial-gradient(circle at 50% 50%, hsla(${hue}, 60%, 15%, 1) 0%, #020617 100%)`,
            accentColor: `hsla(${secondaryHue}, 70%, 60%, 1)`
        };
    }, [paper.arxivId]);

    return (
        <div className="relative h-full w-full flex-shrink-0 bg-slate-950 overflow-hidden snap-start">
            {/* Ambient Background Layer */}
            <div 
                className="absolute inset-0 transition-opacity duration-1000"
                style={{ background: bgStyle.background }} 
            />
            
            {/* Animated Orbs for "Live" feel */}
            <div className={`absolute top-1/4 -left-20 w-96 h-96 rounded-full blur-[100px] opacity-20 animate-pulse`} 
                 style={{ backgroundColor: bgStyle.accentColor, animationDuration: '8s' }} />
            <div className={`absolute bottom-1/4 -right-20 w-80 h-80 rounded-full blur-[80px] opacity-10 animate-pulse`} 
                 style={{ backgroundColor: 'white', animationDuration: '10s', animationDelay: '1s' }} />

            {/* Content Overlay */}
            <div className="absolute inset-0 z-10 flex flex-row h-full w-full">
                
                {/* Main Text Content Area */}
                <div className="flex-1 h-full flex flex-col justify-end p-6 pb-8 md:p-10 md:pb-12 pointer-events-none">
                    <div className={`pointer-events-auto overflow-y-auto no-scrollbar max-h-[75vh] mask-image-linear-fade transition-all duration-700 ${isActive ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
                        
                        {/* Meta Badges */}
                        <div className="flex items-center gap-3 mb-4">
                            <span className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-xs font-bold text-white tracking-wider shadow-sm">
                                {paper.category || 'CS.AI'}
                            </span>
                            <span className="text-xs font-medium text-white/60 shadow-black drop-shadow-md">
                                {new Date(paper.published).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                            </span>
                        </div>

                        {/* Title */}
                        <h1 className="text-2xl md:text-4xl font-extrabold text-white leading-tight mb-4 shadow-black drop-shadow-lg text-balance">
                            {paper.title}
                        </h1>

                        {/* Authors */}
                        <div className="text-sm font-medium text-white/80 mb-6 flex flex-wrap gap-2">
                            {paper.authors.slice(0, 3).map(author => (
                                <span key={author} className="flex items-center gap-1">
                                    <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-bold">
                                        {author[0]}
                                    </span>
                                    {author}
                                </span>
                            ))}
                            {paper.authors.length > 3 && <span className="text-white/50">+{paper.authors.length - 3} others</span>}
                        </div>

                        {/* Abstract / Summary */}
                        <div className="relative group/summary">
                            <div className="absolute -inset-4 bg-slate-950/40 blur-xl rounded-xl -z-10 group-hover/summary:bg-slate-950/60 transition-colors"></div>
                            <p className="text-base md:text-lg text-white/90 leading-relaxed font-serif drop-shadow-md text-justify">
                                {paper.summary}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Right Sidebar Actions (TikTok style) */}
                <div className="w-20 shrink-0 h-full flex flex-col justify-end items-center pb-12 gap-6 z-20 pr-2">
                    <SidebarAction 
                        icon={
                            isLiked ? (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                                </svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                </svg>
                            )
                        } 
                        label={isLiked ? "Liked" : "Like"} 
                        onClick={onLike}
                        isActive={isLiked}
                        activeColor="text-rose-400"
                    />
                    <SidebarAction 
                        icon={
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
                            </svg>
                        } 
                        label="Read Now" 
                        onClick={onRead}
                    />

                    <SidebarAction 
                        icon={
                            isSaved ? (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
                                </svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                                </svg>
                            )
                        } 
                        label={isSaved ? "Saved" : "Save"} 
                        onClick={onSave}
                        isActive={isSaved}
                        activeColor="text-green-400"
                    />

                    <a 
                        href={`https://arxiv.org/abs/${paper.arxivId}`}
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="group flex flex-col items-center gap-1 transition-transform active:scale-90"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-3 rounded-full backdrop-blur-md border border-white/10 bg-slate-800/40 text-white hover:bg-slate-700/60 shadow-lg">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                        </div>
                        <span className="text-[10px] font-medium text-white/80 shadow-black drop-shadow-md">ArXiv</span>
                    </a>
                </div>

            </div>
        </div>
    );
});

const PaperFeed: React.FC<PaperFeedProps> = ({ 
    onSaveForLater, 
    onReadNow, 
    savedPaperIds, 
    seenPaperIds, 
    onMarkAsSeen,
    history,
    likedPapers,
    onToggleLike,
    userTasteProfile,
    onUpdateTasteProfile
}) => {
    const [tab, setTab] = useState<'discover' | 'for-you' | 'history'>('discover');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [papers, setPapers] = useState<ArxivMetadata[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [activeindex, setActiveIndex] = useState(0);
    const [offset, setOffset] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    // Track ALL loaded IDs in the current session feed to prevent duplicates
    // independently of the 'seen' list (which persists across sessions)
    const loadedIdsRef = useRef<Set<string>>(new Set());

    // Track the current active category to handle race conditions
    const activeCategoryRef = useRef(selectedCategory);

    // Keep a reference to current seen IDs
    const seenRef = useRef(seenPaperIds);
    useEffect(() => { seenRef.current = seenPaperIds; }, [seenPaperIds]);

    const likedPaperIds = useMemo(() => new Set(likedPapers.map(p => getCoreArxivId(p.arxivId))), [likedPapers]);

    // Update active category ref whenever state changes
    useEffect(() => {
        activeCategoryRef.current = selectedCategory;
    }, [selectedCategory]);

    const BATCH_SIZE = 15;

    const loadPapers = useCallback(async (startOffset: number, isInitial: boolean = false) => {
        // Capture the category this fetch is intended for
        const fetchCategory = selectedCategory;

        try {
            // Reset loaded IDs tracking if this is a fresh reload
            if (isInitial) {
                loadedIdsRef.current = new Set();
            }

            let currentOffset = startOffset;
            let collectedPapers: ArxivMetadata[] = [];
            let attempts = 0;
            const MAX_ATTEMPTS = 5;

            // Fetch loop to ensure we get enough *new* papers
            // We fetch up to MAX_ATTEMPTS batches to find at least 5 new papers
            while (collectedPapers.length < 5 && attempts < MAX_ATTEMPTS) {
                // RACE CONDITION CHECK: Abort if category changed during loop
                if (activeCategoryRef.current !== fetchCategory) return;

                let fetchedBatches: ArxivMetadata[][] = [];

                if (fetchCategory === 'all') {
                    // Fetch mixed content
                    const [aiPapers, cvPapers, lgPapers] = await Promise.all([
                        fetchRecentPapers('cs.AI', currentOffset, BATCH_SIZE),
                        fetchRecentPapers('cs.CV', currentOffset, BATCH_SIZE),
                        fetchRecentPapers('cs.LG', currentOffset, BATCH_SIZE)
                    ]);
                    
                    // Interleave sources
                    const max = Math.max(aiPapers.length, cvPapers.length, lgPapers.length);
                    const combined = [];
                    for (let i = 0; i < max; i++) {
                        if (aiPapers[i]) combined.push(aiPapers[i]);
                        if (cvPapers[i]) combined.push(cvPapers[i]);
                        if (lgPapers[i]) combined.push(lgPapers[i]);
                    }
                    fetchedBatches.push(combined);
                } else {
                    // Fetch specific category
                    const papers = await fetchRecentPapers(fetchCategory, currentOffset, BATCH_SIZE);
                    fetchedBatches.push(papers);
                }

                // RACE CONDITION CHECK AGAIN
                if (activeCategoryRef.current !== fetchCategory) return;

                const combined = fetchedBatches.flat();
                
                // 1. Deduplicate the combined batch itself
                const uniqueBatch: ArxivMetadata[] = [];
                const batchIds = new Set<string>();
                for (const p of combined) {
                    if (!batchIds.has(p.arxivId)) {
                        batchIds.add(p.arxivId);
                        uniqueBatch.push(p);
                    }
                }

                // 2. Filter out papers already seen (Historical) AND already loaded in this feed (Session)
                const validNewPapers = uniqueBatch.filter(p => {
                    const isSeen = seenRef.current.has(p.arxivId);
                    const isLoaded = loadedIdsRef.current.has(p.arxivId);
                    return !isSeen && !isLoaded;
                });
                
                // Add valid papers to our collection
                for (const p of validNewPapers) {
                    loadedIdsRef.current.add(p.arxivId); 
                    collectedPapers.push(p);
                }

                currentOffset += BATCH_SIZE;
                attempts++;

                if (collectedPapers.length >= 5) break;
            }

            // FINAL RACE CONDITION CHECK
            if (activeCategoryRef.current !== fetchCategory) return;

            setOffset(currentOffset); 

            setPapers(prev => {
                if (isInitial) return collectedPapers;
                // Double safety check
                const existingIds = new Set(prev.map(p => p.arxivId));
                const newUnique = collectedPapers.filter(p => !existingIds.has(p.arxivId));
                return [...prev, ...newUnique];
            });

        } catch (e) {
            console.error("Failed to fetch papers:", e);
        } finally {
            // Only update loading state if we are still on the same category
            if (activeCategoryRef.current === fetchCategory) {
                if (isInitial) setLoading(false);
                setLoadingMore(false);
            }
        }
    }, [selectedCategory]);

    // Reload when category changes
    useEffect(() => {
        if (tab !== 'discover') return;
        setLoading(true);
        setPapers([]);
        setActiveIndex(0);
        
        loadPapers(0, true);
        if (containerRef.current) containerRef.current.scrollTo(0,0);
    }, [selectedCategory, loadPapers, tab]);

    // Restore scroll position when switching back to discover tab
    useEffect(() => {
        if (tab === 'discover' && containerRef.current) {
            const el = containerRef.current;
            requestAnimationFrame(() => {
                if (el) {
                    const height = el.clientHeight;
                    if (activeindex > 0 && height > 0) {
                        el.scrollTo({ top: activeindex * height, behavior: 'instant' });
                    } else if (activeindex === 0) {
                        el.scrollTo({ top: 0, behavior: 'instant' });
                    }
                }
            });
        }
    }, [tab]);

    // Mark current paper as seen when index changes
    useEffect(() => {
        if (tab === 'discover' && papers.length > 0 && papers[activeindex]) {
            onMarkAsSeen(papers[activeindex]);
        }
    }, [activeindex, papers, onMarkAsSeen, tab]);

    const handleScroll = () => {
        if (!containerRef.current || tab !== 'discover') return;
        
        const scrollTop = containerRef.current.scrollTop;
        const clientHeight = containerRef.current.clientHeight;
        const index = Math.round(scrollTop / clientHeight);
        
        if (index !== activeindex) {
            setActiveIndex(index);
        }

        // Infinite Scroll
        if (!loading && !loadingMore && index >= papers.length - 4) {
            setLoadingMore(true);
            loadPapers(offset, false);
        }
    };

    // Group history by date
    const groupedHistory = React.useMemo(() => {
        const today = new Date().setHours(0,0,0,0);
        const yesterday = new Date(Date.now() - 86400000).setHours(0,0,0,0);
        
        const groups: { label: string; items: HistoryItem[] }[] = [
            { label: 'Today', items: [] },
            { label: 'Yesterday', items: [] },
            { label: 'Older', items: [] }
        ];

        history.forEach(item => {
            const date = new Date(item.seenAt).setHours(0,0,0,0);
            if (date === today) groups[0].items.push(item);
            else if (date === yesterday) groups[1].items.push(item);
            else groups[2].items.push(item);
        });

        return groups.filter(g => g.items.length > 0);
    }, [history]);

    const renderTabContent = () => {
        switch (tab) {
            case 'for-you':
                return <ForYouView 
                    likedPapers={likedPapers} 
                    onReadNow={onReadNow}
                    onSaveForLater={onSaveForLater}
                    onToggleLike={onToggleLike}
                    savedPaperIds={savedPaperIds}
                    likedPaperIds={likedPaperIds}
                    tasteProfile={userTasteProfile}
                    onUpdateTasteProfile={onUpdateTasteProfile}
                />;
            case 'history':
                return (
                    <div className="h-full w-full overflow-y-auto custom-scrollbar p-6 pt-20 bg-slate-950">
                        <div className="max-w-2xl mx-auto">
                            <h2 className="text-2xl font-bold text-white mb-6">Viewing History</h2>
                            
                            {groupedHistory.length === 0 ? (
                                <div className="text-center py-12 text-slate-500">
                                    No viewed papers yet.
                                </div>
                            ) : (
                                <div className="space-y-8">
                                    {groupedHistory.map(group => (
                                        <div key={group.label}>
                                            <div className="sticky top-0 bg-slate-950/95 backdrop-blur py-2 z-10 border-b border-slate-800 mb-4">
                                                <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider">{group.label}</h3>
                                            </div>
                                            <div className="space-y-3">
                                                {group.items.map(item => (
                                                    <div key={item.metadata.arxivId} className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors">
                                                        <div className="flex justify-between items-start gap-4">
                                                            <div>
                                                                <h4 className="font-bold text-slate-200 mb-1 leading-snug">{item.metadata.title}</h4>
                                                                <p className="text-xs text-slate-400 mb-2">{item.metadata.authors.join(', ')}</p>
                                                                <div className="flex gap-2">
                                                                    <button 
                                                                        onClick={() => onReadNow(item.metadata)}
                                                                        className="text-xs text-indigo-400 hover:text-white font-medium flex items-center gap-1"
                                                                    >
                                                                        Read Again &rarr;
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => onSaveForLater(item.metadata)}
                                                                        disabled={savedPaperIds.has(getCoreArxivId(item.metadata.arxivId))}
                                                                        className={`text-xs font-medium flex items-center gap-1 ${
                                                                            savedPaperIds.has(getCoreArxivId(item.metadata.arxivId)) 
                                                                            ? 'text-green-500 cursor-default' 
                                                                            : 'text-slate-500 hover:text-white'
                                                                        }`}
                                                                    >
                                                                        {savedPaperIds.has(getCoreArxivId(item.metadata.arxivId)) ? 'Saved' : 'Save for Later'}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            <span className="text-[10px] text-slate-600 font-mono whitespace-nowrap">
                                                                {new Date(item.seenAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                );
            case 'discover':
            default:
                if (loading) {
                    return (
                        <div className="h-full w-full flex items-center justify-center bg-slate-950">
                            <div className="flex flex-col items-center">
                                <svg className="animate-spin h-10 w-10 text-indigo-500 mb-4" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                                </svg>
                                <p className="text-slate-400 font-medium animate-pulse">Curating fresh research for you...</p>
                            </div>
                        </div>
                    );
                }
                if (papers.length === 0) {
                     return (
                         <div className="h-full w-full flex items-center justify-center bg-slate-950 flex-col p-8 text-center relative overflow-hidden">
                             <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-900/20 via-slate-950 to-slate-950"></div>
                            <div className="relative z-10 flex flex-col items-center">
                                <div className="w-20 h-20 bg-slate-900/50 backdrop-blur rounded-full flex items-center justify-center mb-6 border border-white/5 shadow-2xl">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <h3 className="text-3xl font-extrabold text-white mb-4 tracking-tight">You're up to date</h3>
                                <p className="text-slate-400 max-w-md text-lg leading-relaxed mb-8">
                                    We've scanned ArXiv's latest feeds for {CATEGORIES.find(c => c.id === selectedCategory)?.label} papers.
                                </p>
                                <button 
                                    onClick={() => {
                                        setLoading(true);
                                        loadPapers(0, true);
                                    }}
                                    className="px-8 py-3 bg-white text-black font-bold rounded-full hover:scale-105 transition-transform shadow-xl shadow-white/10"
                                >
                                    Refresh Feed
                                </button>
                            </div>
                        </div>
                    );
                }
                return (
                    <div 
                        ref={containerRef}
                        onScroll={handleScroll}
                        className="h-full w-full overflow-y-scroll snap-y snap-mandatory scroll-smooth no-scrollbar"
                    >
                        <style>{`.no-scrollbar::-webkit-scrollbar { display: none; }`}</style>
                        {papers.map((paper, index) => (
                            <div key={`${paper.arxivId}-${index}`} className="h-full w-full snap-start">
                                <PaperCard 
                                    paper={paper} 
                                    isActive={index === activeindex}
                                    isSaved={savedPaperIds.has(getCoreArxivId(paper.arxivId))}
                                    isLiked={likedPaperIds.has(getCoreArxivId(paper.arxivId))}
                                    onSave={() => onSaveForLater(paper)}
                                    onRead={() => onReadNow(paper)}
                                    onLike={() => onToggleLike(paper)}
                                />
                            </div>
                        ))}
                    </div>
                );
        }
    };


    return (
        <div className="h-full w-full bg-black relative flex flex-col">
            {/* Tab Switcher - Floating */}
            <div className="absolute top-6 left-1/2 -translate-x-1/2 z-30 flex bg-black/40 backdrop-blur-xl rounded-full p-1 border border-white/10 shadow-xl">
                <button
                    onClick={() => setTab('for-you')}
                    className={`px-5 py-1.5 rounded-full text-xs font-bold transition-all ${
                        tab === 'for-you' 
                        ? 'bg-white text-black shadow-lg' 
                        : 'text-white/60 hover:text-white'
                    }`}
                >
                    For You
                </button>
                <button
                    onClick={() => setTab('discover')}
                    className={`px-5 py-1.5 rounded-full text-xs font-bold transition-all ${
                        tab === 'discover' 
                        ? 'bg-white text-black shadow-lg' 
                        : 'text-white/60 hover:text-white'
                    }`}
                >
                    Discover
                </button>
                <button
                    onClick={() => setTab('history')}
                    className={`px-5 py-1.5 rounded-full text-xs font-bold transition-all ${
                        tab === 'history' 
                        ? 'bg-white text-black shadow-lg' 
                        : 'text-white/60 hover:text-white'
                    }`}
                >
                    History
                </button>
            </div>

            {/* Category Filter Chips - Only on Discover Tab */}
            {tab === 'discover' && (
                <div className="absolute top-20 left-0 right-0 z-30 flex justify-center pointer-events-none">
                    <div className="pointer-events-auto flex gap-2 overflow-x-auto px-6 py-2 max-w-full no-scrollbar mask-gradient">
                        {CATEGORIES.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => setSelectedCategory(cat.id)}
                                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap backdrop-blur-md border ${
                                    selectedCategory === cat.id
                                    ? 'bg-white/90 text-black border-white shadow-lg scale-105'
                                    : 'bg-black/30 text-white/70 border-white/10 hover:bg-black/50 hover:text-white hover:border-white/20'
                                }`}
                            >
                                {cat.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {renderTabContent()}
        </div>
    );
};

export default PaperFeed;
