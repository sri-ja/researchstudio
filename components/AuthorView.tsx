
import React, { useState, useMemo } from 'react';
import { Paper, AuthorProfile, ResearchGroup } from '../types';
import { generateAuthorOverview } from '../services/geminiService';
import { parse } from 'marked';

interface AuthorViewProps {
  authorName: string;
  papers: Paper[];
  groups: ResearchGroup[];
  profile?: AuthorProfile;
  onUpdateProfile: (profile: AuthorProfile) => void;
  onSelectPaper: (id: string) => void;
  onAddToOutreach: (name: string, notes?: string) => void;
  isLeftSidebarOpen: boolean;
  onToggleLeftSidebar: () => void;
}

const AuthorView: React.FC<AuthorViewProps> = ({ 
  authorName, 
  papers, 
  groups,
  profile, 
  onUpdateProfile,
  onSelectPaper,
  onAddToOutreach,
  isLeftSidebarOpen,
  onToggleLeftSidebar
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  const groupStats = useMemo(() => {
    const stats = new Map<string, number>();
    let inbox = 0;
    papers.forEach(p => {
        if (p.groupId) stats.set(p.groupId, (stats.get(p.groupId) || 0) + 1);
        else inbox++;
    });
    return { stats, inbox };
  }, [papers]);

  const filteredPapers = useMemo(() => {
    if (!selectedGroupId) return papers;
    if (selectedGroupId === 'inbox') return papers.filter(p => !p.groupId);
    return papers.filter(p => p.groupId === selectedGroupId);
  }, [papers, selectedGroupId]);

  const handleGenerateProfile = async () => {
    setIsGenerating(true);
    try {
        // Construct group context string
        const contextParts: string[] = [];
        groupStats.stats.forEach((count, groupId) => {
            const group = groups.find(g => g.id === groupId);
            if (group) {
                contextParts.push(`${group.name} (${count} papers)`);
            }
        });
        if (groupStats.inbox > 0) {
            contextParts.push(`Uncategorized/Inbox (${groupStats.inbox} papers)`);
        }
        
        const groupContext = contextParts.join(', ');

        const overview = await generateAuthorOverview(authorName, papers, groupContext);
        onUpdateProfile({
            name: authorName,
            bio: overview,
            generatedAt: Date.now()
        });
    } catch (e) {
        console.error(e);
    } finally {
        setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 overflow-hidden">
      {/* Header */}
      <div className="h-14 bg-slate-950 border-b border-slate-800 flex items-center justify-between px-4 shrink-0 gap-4">
         <div className="flex items-center gap-3">
            <button 
                type="button"
                onClick={onToggleLeftSidebar}
                className={`p-1.5 rounded hover:bg-slate-800 text-slate-400 transition-colors ${!isLeftSidebarOpen ? 'text-indigo-400' : ''}`}
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
            </button>
            <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold text-sm">
                {authorName.charAt(0).toUpperCase()}
            </div>
            <h1 className="text-xl font-bold text-white">{authorName}</h1>
            <button 
                onClick={() => onAddToOutreach(authorName, profile?.bio)}
                className="ml-2 px-3 py-1 bg-fuchsia-600/20 hover:bg-fuchsia-600/40 text-fuchsia-300 text-xs font-bold rounded border border-fuchsia-500/30 transition-colors flex items-center gap-1"
                title="Add to Outreach List"
            >
                <span>+</span> Outreach
            </button>
         </div>
      </div>

      <div className="flex-1 overflow-auto p-6 custom-scrollbar">
          <div className="max-w-4xl mx-auto space-y-8">
              
              {/* Profile Section */}
              <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden shadow-sm">
                  <div className="p-4 border-b border-slate-700 bg-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clipRule="evenodd" />
                        </svg>
                        <h2 className="font-bold text-slate-200">Researcher Profile</h2>
                      </div>
                      <div className="text-[10px] text-slate-500">
                          {profile ? `Generated ${new Date(profile.generatedAt).toLocaleDateString()}` : 'AI Generated'}
                      </div>
                  </div>
                  
                  <div className="p-6">
                      {profile ? (
                          <div className="prose prose-invert prose-sm max-w-none text-slate-300">
                              <div dangerouslySetInnerHTML={{ __html: parse(profile.bio) as string }} />
                              <div className="mt-4 pt-4 border-t border-slate-700/50 flex justify-end">
                                  <button 
                                    onClick={handleGenerateProfile}
                                    className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                                  >
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v3.276a1 1 0 01-2 0V14.808a7.002 7.002 0 01-11.269-2.566 1 1 0 01.678-1.185z" clipRule="evenodd" />
                                      </svg>
                                      Refresh Profile
                                  </button>
                              </div>
                          </div>
                      ) : (
                          <div className="text-center py-6">
                              <p className="text-slate-400 text-sm mb-4">
                                  Generate an AI overview of {authorName}'s work based on the {papers.length} paper{papers.length !== 1 ? 's' : ''} in your library.
                              </p>
                              <button
                                onClick={handleGenerateProfile}
                                disabled={isGenerating}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2 mx-auto disabled:opacity-50"
                              >
                                {isGenerating ? (
                                    <>
                                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                                        </svg>
                                        Analyzing Papers...
                                    </>
                                ) : (
                                    <>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                            <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                                        </svg>
                                        Generate Profile
                                    </>
                                )}
                              </button>
                          </div>
                      )}
                  </div>
              </div>

              {/* Group Distribution */}
              <div>
                 <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Group Distribution</h3>
                 <div className="flex flex-wrap gap-2">
                    {groups.map(g => {
                        const count = groupStats.stats.get(g.id);
                        if (!count) return null;
                        const isSelected = selectedGroupId === g.id;
                        return (
                            <button 
                                key={g.id} 
                                onClick={() => setSelectedGroupId(isSelected ? null : g.id)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${
                                    isSelected 
                                    ? 'bg-indigo-600 border-indigo-500 ring-2 ring-indigo-500/30' 
                                    : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                                }`}
                            >
                                <div className="w-2 h-2 rounded-full" style={{backgroundColor: g.color}} />
                                <span className={`text-xs ${isSelected ? 'text-white' : 'text-slate-300'}`}>{g.name}</span>
                                <span className={`text-xs font-bold px-1.5 rounded ${isSelected ? 'text-indigo-600 bg-white' : 'text-white bg-slate-700'}`}>{count}</span>
                            </button>
                        )
                    })}
                    {groupStats.inbox > 0 && (
                        <button 
                            onClick={() => setSelectedGroupId(selectedGroupId === 'inbox' ? null : 'inbox')}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${
                                selectedGroupId === 'inbox'
                                ? 'bg-slate-600 border-slate-500 ring-2 ring-slate-500/30'
                                : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                            }`}
                        >
                            <div className="w-2 h-2 rounded-full bg-slate-500" />
                            <span className={`text-xs ${selectedGroupId === 'inbox' ? 'text-white' : 'text-slate-300'}`}>Inbox</span>
                            <span className={`text-xs font-bold px-1.5 rounded ${selectedGroupId === 'inbox' ? 'text-slate-800 bg-white' : 'text-white bg-slate-700'}`}>{groupStats.inbox}</span>
                        </button>
                    )}
                 </div>
              </div>

              {/* Papers List */}
              <div>
                  <h3 className="text-lg font-bold text-slate-300 mb-4 flex items-center gap-2">
                      <span className="bg-slate-800 text-slate-400 text-xs px-2 py-1 rounded-full">{filteredPapers.length}</span>
                      {selectedGroupId ? 'Filtered Papers' : 'Papers in Library'}
                      {selectedGroupId && (
                          <button 
                            onClick={() => setSelectedGroupId(null)}
                            className="text-xs text-indigo-400 hover:text-indigo-300 font-normal ml-2"
                          >
                              (Show All)
                          </button>
                      )}
                  </h3>
                  <div className="grid gap-3">
                      {filteredPapers.map(paper => (
                          <div 
                            key={paper.id} 
                            onClick={() => onSelectPaper(paper.id)}
                            className="bg-slate-800 border border-slate-700 p-4 rounded-lg hover:border-indigo-500/50 hover:bg-slate-800/80 cursor-pointer transition-all group"
                          >
                              <h4 className="font-bold text-slate-200 group-hover:text-indigo-300 transition-colors mb-2">{paper.title}</h4>
                              <p className="text-xs text-slate-400 line-clamp-2 mb-3">{paper.summary}</p>
                              <div className="flex items-center justify-between">
                                  <div className="text-[10px] text-slate-500 font-mono">
                                      {paper.published ? new Date(paper.published).toLocaleDateString() : 'Unknown Date'}
                                  </div>
                                  <div className="text-[10px] text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                      View Paper &rarr;
                                  </div>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>

          </div>
      </div>
    </div>
  );
};

export default AuthorView;
