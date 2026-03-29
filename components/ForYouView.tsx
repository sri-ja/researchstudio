import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { LikedPaper, UserTasteProfile, ArxivMetadata } from '../types';
import { generateTopicInsights, generateForYouFeed } from '../services/geminiService';
import { getCoreArxivId } from '../services/arxivService';

interface ForYouViewProps {
    likedPapers: LikedPaper[];
    onReadNow: (metadata: ArxivMetadata) => void;
    onSaveForLater: (metadata: ArxivMetadata) => void;
    onToggleLike: (metadata: ArxivMetadata) => void;
    savedPaperIds: Set<string>;
    likedPaperIds: Set<string>;
    tasteProfile: UserTasteProfile | null;
    onUpdateTasteProfile: (profile: UserTasteProfile | null) => void;
}

const RecommendedPaperItem: React.FC<{
    paper: ArxivMetadata;
    onRead: () => void;
    onSave: () => void;
    onLike: () => void;
    isSaved: boolean;
    isLiked: boolean;
}> = ({ paper, onRead, onSave, onLike, isSaved, isLiked }) => {
    return (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 flex flex-col gap-3 hover:border-indigo-500/30 transition-all">
            <div>
                <h4 className="font-bold text-slate-200 text-sm leading-snug mb-1">{paper.title}</h4>
                <p className="text-xs text-slate-400">{Array.isArray(paper.authors) ? paper.authors.slice(0, 3).join(', ') : ''}{Array.isArray(paper.authors) && paper.authors.length > 3 ? ' et al.' : ''}</p>
            </div>
            <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">{paper.summary}</p>
            <div className="flex items-center gap-2 mt-auto pt-3 border-t border-slate-700/50">
                <button onClick={onRead} className="flex-1 text-center py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold rounded-md transition-colors">Read Now</button>
                <button onClick={onSave} disabled={isSaved} className={`flex-1 text-center py-1.5 text-[10px] font-bold rounded-md transition-colors ${isSaved ? 'bg-green-500/20 text-green-400 cursor-default' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}>{isSaved ? 'Saved' : 'Save'}</button>
                <button onClick={onLike} className={`px-3 py-1.5 rounded-md transition-colors ${isLiked ? 'bg-rose-500/20 text-rose-400' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                    </svg>
                </button>
            </div>
        </div>
    );
};


const ForYouView: React.FC<ForYouViewProps> = ({ 
    likedPapers, 
    onReadNow, 
    onSaveForLater, 
    onToggleLike, 
    savedPaperIds, 
    likedPaperIds,
    tasteProfile,
    onUpdateTasteProfile
}) => {
    const [recommendedPapers, setRecommendedPapers] = useState<ArxivMetadata[]>([]);
    const [isRegenerating, setIsRegenerating] = useState(false);
    const [isFetchingPapers, setIsFetchingPapers] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const hasFetchedPapers = useRef(false);

    const MIN_LIKES = 3;

    const generateFeed = useCallback(async () => {
        setIsRegenerating(true);
        setError(null);
        hasFetchedPapers.current = false;
        try {
            const papersForProfile = likedPapers.slice(0, 20);
            const [profileResult, papers] = await Promise.all([
                generateTopicInsights(papersForProfile),
                generateForYouFeed(papersForProfile),
            ]);
            
            const newProfile: UserTasteProfile = {
                insights: profileResult.insights,
                generatedAt: Date.now(),
                sourcePaperIds: papersForProfile.map(p => p.arxivId)
            };

            onUpdateTasteProfile(newProfile);
            const filteredPapers = papers.filter(p => !likedPaperIds.has(getCoreArxivId(p.arxivId)));
            setRecommendedPapers(filteredPapers);
            hasFetchedPapers.current = true;
        } catch (err: any) {
            setError(err.message || 'Failed to generate recommendations. Please check your connection or API key.');
            console.error(err);
        } finally {
            setIsRegenerating(false);
        }
    }, [likedPapers, onUpdateTasteProfile, likedPaperIds]);

    useEffect(() => {
        if (likedPapers.length < MIN_LIKES) {
            if (tasteProfile) onUpdateTasteProfile(null);
            setRecommendedPapers([]);
            hasFetchedPapers.current = false;
            return;
        }

        const currentLikedIds = likedPapers.slice(0, 20).map(p => p.arxivId).sort();
        const profileSourceIds = tasteProfile?.sourcePaperIds?.sort() || [];
        const needsRegeneration = !tasteProfile || JSON.stringify(currentLikedIds) !== JSON.stringify(profileSourceIds);

        if (needsRegeneration) {
            generateFeed();
        } else if (!hasFetchedPapers.current) {
            setIsFetchingPapers(true);
            setError(null);
            generateForYouFeed(likedPapers.slice(0, 20))
                .then(papers => {
                    const filteredPapers = papers.filter(p => !likedPaperIds.has(getCoreArxivId(p.arxivId)));
                    setRecommendedPapers(filteredPapers);
                    hasFetchedPapers.current = true;
                })
                .catch(err => {
                    setError(err.message || 'Failed to fetch recommendations.');
                    console.error(err);
                })
                .finally(() => {
                    setIsFetchingPapers(false);
                });
        }
    }, [likedPapers, tasteProfile, onUpdateTasteProfile, generateFeed, likedPaperIds]);


    if (likedPapers.length < MIN_LIKES) {
        return (
            <div className="h-full w-full bg-slate-950 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
                <div className="w-20 h-20 bg-slate-900/50 backdrop-blur rounded-full flex items-center justify-center mb-6 border border-white/5 shadow-2xl">
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                </div>
                <h2 className="text-3xl font-extrabold text-white tracking-tight mb-4">Unlock Your Personal Feed</h2>
                <p className="text-slate-400 max-w-md text-lg leading-relaxed mb-8">
                    Like papers in the <strong className="text-white">Discover</strong> tab to help us understand your research taste. Once you like a few more, we'll generate a personalized feed for you here.
                </p>
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-48 h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                        <div className="h-full bg-rose-500 transition-all duration-500" style={{ width: `${(likedPapers.length / MIN_LIKES) * 100}%`}}></div>
                    </div>
                    <span className="font-mono text-sm font-bold text-rose-400">{likedPapers.length} / {MIN_LIKES} Liked</span>
                </div>
                {likedPapers.length > 0 && (
                    <div className="w-full max-w-md">
                        <h3 className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-3">Papers you've liked</h3>
                        <div className="space-y-2 text-left">
                            {likedPapers.map(p => (
                                <div key={p.arxivId} className="p-2 bg-slate-900 border border-slate-800 rounded-md text-xs text-slate-400 truncate">
                                    {p.title}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    }
    
    if (isRegenerating) {
         return (
            <div className="h-full w-full flex items-center justify-center bg-slate-950">
                <div className="flex flex-col items-center gap-4">
                    <svg className="animate-spin h-10 w-10 text-indigo-500" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                    </svg>
                    <p className="text-slate-400 font-medium animate-pulse text-center">
                        Analyzing your research taste...<br/>This may take a moment.
                    </p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
             <div className="h-full w-full flex items-center justify-center bg-slate-950 flex-col p-8 text-center">
                 <h3 className="text-2xl font-bold text-red-400 mb-4">An Error Occurred</h3>
                 <p className="text-slate-400 max-w-md mb-6">{error}</p>
                 <button onClick={generateFeed} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg">
                     Retry
                 </button>
            </div>
        );
    }
    

    return (
        <div className="h-full w-full overflow-y-auto custom-scrollbar p-6 pt-24 bg-slate-950 animate-in fade-in duration-500">
            <div className="max-w-4xl mx-auto space-y-12">
                {/* Taste Profile Section */}
                {tasteProfile && tasteProfile.insights.length > 0 && (
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-white tracking-tight">Your Research Taste Profile</h2>
                            <button onClick={generateFeed} className="text-xs text-slate-500 hover:text-white flex items-center gap-1">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v3.276a1 1 0 01-2 0V14.808a7.002 7.002 0 01-11.269-2.566 1 1 0 01.678-1.185z" clipRule="evenodd" />
                                </svg>
                                Refresh
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {tasteProfile.insights.map((insight, idx) => (
                                <div key={idx} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                                    <h3 className="font-bold text-indigo-400 text-sm mb-2">{insight.topic}</h3>
                                    <p className="text-xs text-slate-400">{insight.explanation}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Recommended Papers Section */}
                <div>
                    <h2 className="text-xl font-bold text-white tracking-tight mb-4">Recommended For You</h2>
                    {isFetchingPapers ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {[...Array(6)].map((_, i) => (
                                <div key={i} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 flex flex-col gap-3 animate-pulse">
                                    <div className="h-4 bg-slate-700 rounded w-3/4"></div>
                                    <div className="h-3 bg-slate-700 rounded w-1/2"></div>
                                    <div className="space-y-2 mt-2">
                                        <div className="h-3 bg-slate-700 rounded"></div>
                                        <div className="h-3 bg-slate-700 rounded"></div>
                                        <div className="h-3 bg-slate-700 rounded w-5/6"></div>
                                    </div>
                                    <div className="h-8 bg-slate-700 rounded-md mt-auto"></div>
                                </div>
                            ))}
                        </div>
                    ) : recommendedPapers.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {recommendedPapers.map(paper => (
                                <RecommendedPaperItem
                                    key={paper.arxivId}
                                    paper={paper}
                                    onRead={() => onReadNow(paper)}
                                    onSave={() => onSaveForLater(paper)}
                                    onLike={() => onToggleLike(paper)}
                                    isSaved={savedPaperIds.has(getCoreArxivId(paper.arxivId))}
                                    isLiked={likedPaperIds.has(getCoreArxivId(paper.arxivId))}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12 text-slate-500 border border-dashed border-slate-800 rounded-xl">
                            <p>We couldn't find any new recommendations right now.</p>
                            <p className="text-xs mt-1">Try liking more papers or check back later.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ForYouView;
