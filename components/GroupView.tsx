
import React, { useState, useEffect } from 'react';
import { ResearchGroup } from '../types';
import { parse } from 'marked';

interface GroupViewProps {
  group: ResearchGroup;
  onUpdateGroup: (group: ResearchGroup) => void;
  onDeleteGroup: (id: string) => void;
  isLeftSidebarOpen: boolean;
  onToggleLeftSidebar: () => void;
}

const COLORS = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6'];

const GroupView: React.FC<GroupViewProps> = ({ 
  group, 
  onUpdateGroup, 
  onDeleteGroup,
  isLeftSidebarOpen,
  onToggleLeftSidebar
}) => {
  const [isPreview, setIsPreview] = useState(false);
  const [title, setTitle] = useState(group.name);
  const [content, setContent] = useState(group.readme);

  // Sync local state when group prop changes
  useEffect(() => {
    setTitle(group.name);
    setContent(group.readme);
  }, [group.id]);

  const handleSave = () => {
    onUpdateGroup({
      ...group,
      name: title,
      readme: content
    });
  };

  // Auto-save on blur or periodic could be added, for now manual/effect based
  useEffect(() => {
    const timer = setTimeout(() => {
      if (title !== group.name || content !== group.readme) {
        onUpdateGroup({ ...group, name: title, readme: content });
      }
    }, 1000);
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
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
            </svg>
          </button>
          
          <div className="h-6 w-1 rounded-full" style={{ backgroundColor: group.color }}></div>
          
          <input 
            type="text" 
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="bg-transparent text-lg font-bold text-white focus:outline-none focus:bg-slate-900 rounded px-2 w-full max-w-md"
            placeholder="Group Name"
          />
        </div>

        <div className="flex items-center gap-3">
           <div className="flex gap-1">
             {COLORS.map(c => (
               <button
                 key={c}
                 type="button"
                 onClick={() => onUpdateGroup({ ...group, color: c })}
                 className={`w-4 h-4 rounded-full transition-transform ${group.color === c ? 'scale-125 ring-2 ring-white/50' : 'hover:scale-110'}`}
                 style={{ backgroundColor: c }}
               />
             ))}
           </div>
           
           <div className="h-4 w-px bg-slate-700 mx-2"></div>

           <button 
             type="button"
             onClick={(e) => {
               e.stopPropagation();
               e.preventDefault();
               onDeleteGroup(group.id);
             }}
             className="text-slate-500 hover:text-red-400 p-2 hover:bg-red-400/10 rounded-full transition-colors"
             title="Delete Group"
           >
             <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
             </svg>
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
          <div className="prose prose-invert prose-slate max-w-4xl mx-auto p-8">
            <h1 className="mb-4 text-3xl font-extrabold">{title}</h1>
            <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
          </div>
        ) : (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full h-full bg-slate-900 p-8 text-slate-300 font-mono text-sm focus:outline-none resize-none leading-relaxed"
            placeholder={`# ${title}\n\nAdd your research notes, images, and links here...\n\nExample image: ![Alt Text](https://via.placeholder.com/150)`}
          />
        )}
      </div>
    </div>
  );
};

export default GroupView;