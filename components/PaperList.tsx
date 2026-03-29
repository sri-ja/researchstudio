
import React, { useState, useMemo } from 'react';
import { Paper, ResearchGroup, ResearchNote, ResearchProject, SelectionState } from '../types';

interface PaperListProps {
  papers: Paper[];
  notes: ResearchNote[];
  groups: ResearchGroup[];
  projects: ResearchProject[];
  selection: SelectionState;
  onSelect: (selection: SelectionState) => void;
  onDeletePaper: (id: string) => void;
  onDeleteNote: (id: string) => void;
  onCreateGroup: () => void;
  onCreateNote: () => void;
  onCreateProject: () => void;
  onCreatePaper: () => void;
  onMoveItem: (itemId: string, itemType: 'paper' | 'note', groupId: string | undefined) => void;
  onAdminClick: () => void;
  onLogout: () => void;
}

interface PaperItemProps {
    paper: Paper;
    isActive: boolean;
    onSelect: (selection: SelectionState) => void;
    onDelete: (id: string) => void;
    onDragStart: (e: React.DragEvent, id: string) => void;
}

const PaperItem: React.FC<PaperItemProps> = ({ 
    paper, 
    isActive, 
    onSelect, 
    onDelete, 
    onDragStart 
}) => {
    const isLocal = paper.arxivId.startsWith('local-');

    return (
      <div
        draggable
        onDragStart={(e) => onDragStart(e, paper.id)}
        onClick={() => onSelect({ type: 'paper', id: paper.id })}
        className={`group/item relative p-2.5 pl-3 rounded-lg cursor-pointer transition-all duration-200 mb-0.5 ${
          isActive
            ? 'bg-slate-800 text-white shadow-sm'
            : 'bg-transparent text-slate-400 hover:bg-slate-900 hover:text-slate-300'
        }`}
      >
        <div className="pr-6">
          <h3 className={`font-medium text-[13px] leading-snug truncate ${isActive ? 'text-indigo-100' : 'text-slate-300'}`}>
            {paper.title}
          </h3>
          <div className="flex items-center gap-2 mt-1 opacity-70">
             <div className="flex items-center gap-1">
                 {isLocal ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                    </svg>
                 ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-indigo-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                    </svg>
                 )}
                 <span className="text-[10px] font-medium">{isLocal ? 'Local PDF' : 'ArXiv'}</span>
             </div>
             <p className="text-[11px] truncate">
                {paper.authors.length > 0 ? `${paper.authors[0]} ${paper.authors.length > 1 ? `+${paper.authors.length - 1}` : ''}` : 'No authors listed'}
             </p>
          </div>
        </div>
        
        <div
            className="absolute top-2.5 right-2 z-20 opacity-0 group-hover/item:opacity-100 transition-opacity"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
        >
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDelete(paper.id); }}
              className="p-1 rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors"
              title="Delete paper"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </button>
        </div>
      </div>
    );
};

interface NoteItemProps {
    note: ResearchNote;
    isActive: boolean;
    onSelect: (selection: SelectionState) => void;
    onDelete: (id: string) => void;
    onDragStart: (e: React.DragEvent, id: string) => void;
}

const NoteItem: React.FC<NoteItemProps> = ({ 
    note, 
    isActive, 
    onSelect, 
    onDelete, 
    onDragStart 
}) => {
    return (
      <div
        draggable
        onDragStart={(e) => onDragStart(e, note.id)}
        onClick={() => onSelect({ type: 'note', id: note.id })}
        className={`group/item relative p-2.5 pl-3 rounded-lg cursor-pointer transition-all duration-200 mb-0.5 ${
          isActive
            ? 'bg-slate-800 text-white shadow-sm'
            : 'bg-transparent text-slate-400 hover:bg-slate-900 hover:text-slate-300'
        }`}
      >
        <div className="pr-6">
          <h3 className={`font-medium text-[13px] leading-snug truncate ${isActive ? 'text-amber-100' : 'text-slate-300'}`}>
            {note.title}
          </h3>
          <div className="flex items-center gap-2 mt-1 opacity-70">
             <div className="flex items-center gap-1">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                   <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                 </svg>
                 <span className="text-[10px] font-medium">Note</span>
             </div>
             <p className="text-[11px] truncate">
                Updated {new Date(note.updatedAt || note.createdAt).toLocaleDateString()}
             </p>
          </div>
        </div>
        
        <div
            className="absolute top-2.5 right-2 z-20 opacity-0 group-hover/item:opacity-100 transition-opacity"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
        >
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDelete(note.id); }}
              className="p-1 rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors"
              title="Delete note"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </button>
        </div>
      </div>
    );
};

const PaperList: React.FC<PaperListProps> = ({ 
  papers,
  notes, 
  groups,
  projects,
  selection, 
  onSelect, 
  onDeletePaper,
  onDeleteNote,
  onCreateGroup,
  onCreateNote,
  onCreateProject,
  onCreatePaper,
  onMoveItem,
  onAdminClick,
  onLogout
}) => {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const lowerSearchTerm = searchTerm.toLowerCase();

  const isMac = useMemo(() => typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform), []);

  const toggleGroup = (e: React.MouseEvent, groupId: string) => {
    e.stopPropagation();
    const newSet = new Set(collapsedGroups);
    if (newSet.has(groupId)) {
      newSet.delete(groupId);
    } else {
      newSet.add(groupId);
    }
    setCollapsedGroups(newSet);
  };

  const filteredProjects = useMemo(() => {
      if (!lowerSearchTerm) return projects;
      return projects.filter(p => p.title.toLowerCase().includes(lowerSearchTerm));
  }, [projects, lowerSearchTerm]);

  const filteredGroups = useMemo(() => {
    if (!lowerSearchTerm) return groups;
    return groups.filter(g => g.name.toLowerCase().includes(lowerSearchTerm));
  }, [groups, lowerSearchTerm]);

  const inboxItems = useMemo(() => {
    const inboxPapers = papers.filter(p => !p.groupId);
    const inboxNotes = notes.filter(n => !n.groupId);
    const allItems = [...inboxPapers, ...inboxNotes].sort((a, b) => 
        ((b as any).addedAt || (b as any).createdAt) - ((a as any).addedAt || (a as any).createdAt)
    );
    if (!lowerSearchTerm) return allItems;
    return allItems.filter(item => {
        if ('arxivId' in item) { // It's a Paper
            return item.title.toLowerCase().includes(lowerSearchTerm) || item.authors.some(a => a.toLowerCase().includes(lowerSearchTerm));
        } else { // It's a Note
            return item.title.toLowerCase().includes(lowerSearchTerm);
        }
    });
  }, [papers, notes, lowerSearchTerm]);

  const handleDragStartPaper = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('paperId', id);
  };

  const handleDragStartNote = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('noteId', id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, groupId: string | undefined) => {
    e.preventDefault();
    const paperId = e.dataTransfer.getData('paperId');
    const noteId = e.dataTransfer.getData('noteId');
    if (paperId) {
      onMoveItem(paperId, 'paper', groupId);
    } else if (noteId) {
      onMoveItem(noteId, 'note', groupId);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto flex flex-col custom-scrollbar">
      <div className="p-2 border-b border-slate-800">
        <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter library..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 placeholder:text-slate-500"
        />
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-4 pb-10 custom-scrollbar">
            {/* Action Bar for Create Note */}
            <div className="mb-4 px-1">
                <button 
                    onClick={onCreateNote}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 hover:text-white hover:bg-indigo-500/20 transition-all text-xs font-medium group"
                >
                    <div className="bg-indigo-500/20 rounded p-0.5 text-indigo-400 group-hover:text-white transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                        </svg>
                    </div>
                    Quick Note
                </button>
            </div>
            
            {/* Projects Section */}
            <div className="space-y-1 mb-6">
                <div className="flex items-center justify-between px-2 mb-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Active Projects</span>
                    <button 
                        onClick={onCreateProject} 
                        className="text-slate-500 hover:text-cyan-400 p-1 hover:bg-slate-800 rounded transition-colors" 
                        title="Create Project"
                        type="button"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 3a1 1 0 011-1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>
                {filteredProjects.map(project => {
                    const isActive = selection?.type === 'project' && selection.id === project.id;
                    return (
                        <div 
                            key={project.id}
                            onClick={() => onSelect({ type: 'project', id: project.id })}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all ${
                                isActive 
                                ? 'bg-gradient-to-r from-cyan-600/20 to-cyan-900/10 border border-cyan-500/30 text-cyan-100' 
                                : 'text-slate-400 hover:bg-slate-800 hover:text-white border border-transparent'
                            }`}
                        >
                            <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-cyan-400' : 'bg-slate-600'}`}></div>
                            <span className="text-sm font-medium truncate flex-1">{project.title}</span>
                            {project.tasks.length > 0 && (
                                <span className="text-[10px] bg-slate-950/50 px-1.5 rounded text-slate-500">
                                    {project.tasks.filter(t => t.status === 'done').length}/{project.tasks.length}
                                </span>
                            )}
                        </div>
                    )
                })}
                {filteredProjects.length === 0 && projects.length > 0 && (
                    <div className="px-2 text-[10px] text-slate-600 italic">No matching projects</div>
                )}
            </div>

            {/* Groups Section */}
            <div className="space-y-2">
                <div className="flex items-center justify-between px-2 mb-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Research Groups</span>
                    <button 
                        onClick={() => onCreateGroup()} 
                        className="text-slate-500 hover:text-indigo-400 p-1 hover:bg-slate-800 rounded transition-colors" 
                        title="Create Group"
                        type="button"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 3a1 1 0 011-1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>

                {filteredGroups.map(group => {
                    const groupPapers = papers.filter(p => p.groupId === group.id);
                    const groupNotes = notes.filter(n => n.groupId === group.id);
                    // Combine and sort by date
                    const items = [...groupPapers, ...groupNotes].sort((a, b) => 
                    ((b as any).addedAt || (b as any).createdAt) - ((a as any).addedAt || (a as any).createdAt)
                    );

                    const isCollapsed = collapsedGroups.has(group.id);
                    const isGroupActive = selection?.type === 'group' && selection.id === group.id;

                    return (
                        <div 
                            key={group.id} 
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, group.id)}
                        >
                            <div 
                                onClick={() => onSelect({ type: 'group', id: group.id })}
                                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer group/header transition-colors mb-1 ${
                                    isGroupActive ? 'bg-slate-800/80' : 'hover:bg-slate-800/40'
                                }`}
                            >
                                <button 
                                    type="button"
                                    onClick={(e) => toggleGroup(e, group.id)}
                                    className="text-slate-500 hover:text-slate-300 p-0.5 rounded"
                                >
                                    <svg 
                                        xmlns="http://www.w3.org/2000/svg" 
                                        className={`h-3 w-3 transition-transform ${isCollapsed ? '-rotate-90' : 'rotate-0'}`} 
                                        viewBox="0 0 20 20" 
                                        fill="currentColor"
                                    >
                                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                </button>
                                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: group.color }}></div>
                                <span className={`text-sm font-medium truncate flex-1 ${isGroupActive ? 'text-white' : 'text-slate-400'}`}>
                                    {group.name}
                                </span>
                                {items.length > 0 && (
                                    <span className="text-[10px] text-slate-500 font-mono">
                                        {items.length}
                                    </span>
                                )}
                            </div>

                            {!isCollapsed && (
                                <div className="pl-2 space-y-0.5">
                                    {items.length === 0 && !lowerSearchTerm && (
                                        <div className="text-[10px] text-slate-600 italic py-2 pl-4">Drag papers here</div>
                                    )}
                                    {items.map(item => {
                                        if ('arxivId' in item) {
                                            return (
                                                <PaperItem 
                                                    key={item.id} 
                                                    paper={item as Paper} 
                                                    isActive={selection?.type === 'paper' && selection.id === item.id}
                                                    onSelect={onSelect}
                                                    onDelete={onDeletePaper}
                                                    onDragStart={handleDragStartPaper}
                                                />
                                            );
                                        } else {
                                            return (
                                                <NoteItem
                                                    key={item.id}
                                                    note={item as ResearchNote}
                                                    isActive={selection?.type === 'note' && selection.id === item.id}
                                                    onSelect={onSelect}
                                                    onDelete={onDeleteNote}
                                                    onDragStart={handleDragStartNote}
                                                />
                                            );
                                        }
                                    })}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Inbox Section */}
            <div 
                className="mt-6 space-y-2"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, undefined)}
            >
                <div className="px-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                    <span>Inbox</span>
                    <div className="flex items-center gap-1">
                        {inboxItems.length > 0 && <span className="bg-slate-800 text-slate-500 px-1.5 rounded-full text-[10px]">{inboxItems.length}</span>}
                        <button 
                            onClick={onCreatePaper}
                            className="text-slate-500 hover:text-indigo-400 p-1 hover:bg-slate-800 rounded transition-colors" 
                            title="Add Paper"
                            type="button"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                            </svg>
                        </button>
                    </div>
                </div>
                {inboxItems.length === 0 ? (
                <div className="text-[10px] text-slate-600 p-3 text-center border border-dashed border-slate-800/50 rounded-lg mx-2">
                    {searchTerm ? 'No matching items' : 'Inbox empty'}
                </div>
                ) : (
                <div className="pl-2 space-y-0.5">
                    {inboxItems.map(item => {
                        if ('arxivId' in item) {
                            return (
                                <PaperItem 
                                    key={item.id} 
                                    paper={item as Paper} 
                                    isActive={selection?.type === 'paper' && selection.id === item.id}
                                    onSelect={onSelect}
                                    onDelete={onDeletePaper}
                                    onDragStart={handleDragStartPaper}
                                />
                            );
                        } else {
                            return (
                                <NoteItem
                                    key={item.id}
                                    note={item as ResearchNote}
                                    isActive={selection?.type === 'note' && selection.id === item.id}
                                    onSelect={onSelect}
                                    onDelete={onDeleteNote}
                                    onDragStart={handleDragStartNote}
                                />
                            );
                        }
                    })}
                </div>
                )}
            </div>
      </div>
      {/* Footer */}
      <div className="p-2 border-t border-slate-800 mt-auto space-y-1">
        <div className="flex gap-1">
            <button 
                onClick={onAdminClick}
                className="flex-1 flex items-center justify-center gap-2 p-2 rounded-lg text-slate-500 hover:bg-slate-800 hover:text-slate-300 transition-colors"
                title="Admin Panel"
            >
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                </svg>
            </button>
            <button 
                onClick={onLogout}
                className="flex-1 flex items-center justify-center gap-2 p-2 rounded-lg text-slate-500 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                title="Lock Vault"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
            </button>
        </div>
        <div className="text-center text-[10px] text-slate-700 py-1 font-mono">
            {isMac ? '⌘' : 'Ctrl'}+K to search
        </div>
      </div>
    </div>
  );
};

export default PaperList;
