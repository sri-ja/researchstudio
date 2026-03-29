import React, { useState, useEffect } from 'react';
import { ResearchNote, ResearchGroup } from '../types';
import { parse } from 'marked';

interface NoteEditorProps {
  note: ResearchNote;
  groups: ResearchGroup[];
  onUpdateNote: (note: ResearchNote) => void;
  onDeleteNote: (id: string) => void;
  isLeftSidebarOpen: boolean;
  onToggleLeftSidebar: () => void;
}

const NoteEditor: React.FC<NoteEditorProps> = ({ 
  note, 
  groups,
  onUpdateNote, 
  onDeleteNote,
  isLeftSidebarOpen,
  onToggleLeftSidebar
}) => {
  const [isPreview, setIsPreview] = useState(false);
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);

  // Sync state when prop changes
  useEffect(() => {
    setTitle(note.title);
    setContent(note.content);
  }, [note.id]);

  // Auto-save debouncer
  useEffect(() => {
    const timer = setTimeout(() => {
      if (title !== note.title || content !== note.content) {
        onUpdateNote({ 
            ...note, 
            title, 
            content,
            updatedAt: Date.now() 
        });
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [title, content]);

  const htmlContent = parse(content || '*No content*') as string;

  return (
    <div className="flex flex-col h-full bg-slate-900 overflow-hidden">
      {/* Header */}
      <div className="h-14 bg-slate-950 border-b border-slate-800 flex items-center justify-between px-4 shrink-0 gap-4 z-10 relative">
        <div className="flex items-center gap-3 flex-1">
          <button 
            type="button"
            onClick={onToggleLeftSidebar}
            className={`p-1.5 rounded hover:bg-slate-800 text-slate-400 transition-colors ${!isLeftSidebarOpen ? 'text-indigo-400' : ''}`}
          >
             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
            </svg>
          </button>
          
          <div className="flex items-center bg-amber-500/10 text-amber-500 px-2 py-1 rounded text-xs font-bold uppercase tracking-wider gap-1">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
               <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
             </svg>
             Note
          </div>
          
          <input 
            type="text" 
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="bg-transparent text-lg font-bold text-white focus:outline-none focus:bg-slate-900 rounded px-2 w-full max-w-md"
            placeholder="Note Title"
          />

            <select 
                value={note.groupId || ''} 
                onChange={(e) => onUpdateNote({ ...note, groupId: e.target.value || undefined })}
                className="bg-slate-900 border border-slate-700 text-xs text-slate-400 rounded px-2 py-1 focus:outline-none focus:border-indigo-500 max-w-[150px]"
            >
                <option value="">No Group</option>
                {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                ))}
            </select>
        </div>

        <div className="flex items-center gap-3">
           <button 
             type="button"
             onClick={() => onDeleteNote(note.id)}
             className="text-slate-500 hover:text-red-400 text-sm px-3 py-1 hover:bg-red-400/10 rounded transition-colors"
           >
             Delete Note
           </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-slate-900 border-b border-slate-800 p-2 flex gap-2 items-center">
        <button 
           type="button"
           onClick={() => setIsPreview(!isPreview)}
           className="px-3 py-1 rounded text-xs font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700"
        >
          {isPreview ? 'Edit Mode' : 'Preview Mode'}
        </button>
        <span className="text-xs text-slate-500 ml-auto">Markdown Supported</span>
      </div>

      {/* Editor / Preview Area */}
      <div className="flex-1 overflow-auto bg-slate-900 relative">
        {isPreview ? (
          <div className="prose prose-invert prose-slate max-w-3xl mx-auto p-8">
            <h1 className="mb-4 text-3xl font-extrabold">{title}</h1>
            <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
          </div>
        ) : (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full h-full bg-slate-900 p-8 text-slate-300 font-mono text-sm focus:outline-none resize-none leading-relaxed"
            placeholder={`# ${title || 'My Note'}\n\nStart writing your research notes here using Markdown...`}
          />
        )}
      </div>
    </div>
  );
};

export default NoteEditor;
