
import React, { useMemo, useState } from 'react';
import { Paper, SelectionState } from '../types';

interface AuthorsHubViewProps {
  papers: Paper[];
  selection: SelectionState;
  onSelect: (selection: SelectionState) => void;
  isLeftSidebarOpen: boolean;
  onToggleLeftSidebar: () => void;
}

const AuthorsHubView: React.FC<AuthorsHubViewProps> = ({
  papers,
  selection,
  onSelect,
  isLeftSidebarOpen,
  onToggleLeftSidebar,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const authors = useMemo(() => {
    const authorMap = new Map<string, number>();
    papers.forEach(p => {
        p.authors.forEach(a => {
            const trimmed = a.trim();
            authorMap.set(trimmed, (authorMap.get(trimmed) || 0) + 1);
        });
    });
    return Array.from(authorMap.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [papers]);

  const filteredAuthors = useMemo(() => {
    if (!searchTerm.trim()) return authors;
    return authors.filter(a => a.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [authors, searchTerm]);

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
                        <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                    </svg>
                </button>
                <h1 className="text-xl font-bold text-white">All Authors ({authors.length})</h1>
            </div>
            <div className="relative w-full max-w-xs">
                 <input 
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search authors..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                 />
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                 </svg>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredAuthors.map(({ name, count }) => (
                    <div
                        key={name}
                        onClick={() => onSelect({ type: 'author', id: name })}
                        className={`flex items-center justify-between p-4 rounded-lg cursor-pointer transition-all border ${
                            selection?.type === 'author' && selection.id === name
                                ? 'bg-indigo-600/20 text-indigo-100 border-indigo-500/30'
                                : 'bg-slate-800/50 hover:bg-slate-800 border-slate-700/50 text-slate-300 hover:border-slate-600'
                        }`}
                    >
                        <div className="flex items-center gap-3 overflow-hidden">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                                selection?.type === 'author' && selection.id === name
                                ? 'bg-indigo-500 text-white'
                                : 'bg-slate-700 text-slate-400'
                            }`}>
                                {name.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-sm truncate font-medium">{name}</span>
                        </div>
                        <span className="text-xs font-mono text-slate-500 bg-slate-900/50 px-2 py-0.5 rounded">{count}</span>
                    </div>
                ))}
            </div>
        </div>
    </div>
  );
};

export default AuthorsHubView;
