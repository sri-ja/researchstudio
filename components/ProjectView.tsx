
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ResearchProject, Paper, ProjectTask, ProjectLogEntry, ProjectLiterature, ProjectMeeting, ProjectMember } from '../types';
import { parse } from 'marked';
import { refineText, convertMarkdownToLatex } from '../services/geminiService';
import { exportProjectToBibtex } from '../services/bibtexService';

interface ProjectViewProps {
  project: ResearchProject;
  papers: Paper[]; // Needed for literature review selection
  onUpdateProject: (project: ResearchProject) => void;
  onDeleteProject: (id: string) => void;
  onSelectPaper: (id: string) => void;
  onAddPaperToLibrary: (url: string) => Promise<string>;
  onRemoveTeamMember: (memberId: string) => void;
  isLeftSidebarOpen: boolean;
  onToggleLeftSidebar: () => void;
}

const ProjectView: React.FC<ProjectViewProps> = ({ 
  project, 
  papers,
  onUpdateProject, 
  onDeleteProject,
  onSelectPaper,
  onAddPaperToLibrary,
  onRemoveTeamMember,
  isLeftSidebarOpen,
  onToggleLeftSidebar
}) => {
  const toYyyyMmDd = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
  };

  const [activeTab, setActiveTab] = useState<'log' | 'meetings' | 'plan' | 'literature' | 'drafting' | 'team'>('log');
  const [title, setTitle] = useState(project.title);
  const [description, setDescription] = useState(project.description);
  const [deadline, setDeadline] = useState(project.deadline ? toYyyyMmDd(new Date(project.deadline)) : '');
  
  // Log State
  const [newLogContent, setNewLogContent] = useState('');
  const [newLogImages, setNewLogImages] = useState<string[]>([]);
  
  // Task State
  const [newTaskContent, setNewTaskContent] = useState('');

  // Lit Review State
  const [selectedPaperId, setSelectedPaperId] = useState('');
  const [newArxivUrl, setNewArxivUrl] = useState('');
  const [isAddingPaper, setIsAddingPaper] = useState(false);

  // Meeting State
  const [newMeetingTitle, setNewMeetingTitle] = useState('');
  const [newMeetingDate, setNewMeetingDate] = useState(new Date().toISOString().split('T')[0]);
  const [newMeetingAttendees, setNewMeetingAttendees] = useState('');
  const [newMeetingContent, setNewMeetingContent] = useState('');
  
  // Drafting State
  const [outlineContent, setOutlineContent] = useState(project.paperOutline || '');
  const [isPreviewOutline, setIsPreviewOutline] = useState(false);
  const [selectionState, setSelectionState] = useState<{ start: number; end: number; text: string } | null>(null);
  const [refinePrompt, setRefinePrompt] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  
  // LaTeX Export State
  const [isLatexModalOpen, setIsLatexModalOpen] = useState(false);
  const [latexContent, setLatexContent] = useState('');
  const [isConvertingToLatex, setIsConvertingToLatex] = useState(false);
  const [copyButtonText, setCopyButtonText] = useState('Copy to Clipboard');

  // Team State
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('');
  const [newMemberAffiliation, setNewMemberAffiliation] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');

  const popoverRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const logInputRef = useRef<HTMLTextAreaElement>(null);

  // Sync state on prop change
  useEffect(() => {
      setTitle(project.title);
      setDescription(project.description);
      setDeadline(project.deadline ? toYyyyMmDd(new Date(project.deadline)) : '');
      setOutlineContent(project.paperOutline || '');
  }, [project.id]);

  // Debounced save for outline
  useEffect(() => {
      const timer = setTimeout(() => {
          if (outlineContent !== project.paperOutline) {
              onUpdateProject({
                  ...project,
                  paperOutline: outlineContent,
                  updatedAt: Date.now()
              });
          }
      }, 1000);
      return () => clearTimeout(timer);
  }, [outlineContent, project, onUpdateProject]);

  const handleSaveMeta = useCallback(() => {
      // Using T12:00:00 makes it robust against timezone shifts around midnight.
      const deadlineTs = deadline ? new Date(`${deadline}T12:00:00`).getTime() : undefined;
      if (title !== project.title || description !== project.description || deadlineTs !== project.deadline) {
          onUpdateProject({ 
              ...project, 
              title, 
              description, 
              deadline: deadlineTs,
              updatedAt: Date.now() 
          });
      }
  }, [title, description, deadline, project, onUpdateProject]);

  // Save on unmount to prevent data loss when navigating away before blur
  const handleSaveMetaRef = useRef(handleSaveMeta);
  useEffect(() => {
      handleSaveMetaRef.current = handleSaveMeta;
  }, [handleSaveMeta]);

  useEffect(() => {
      return () => {
          handleSaveMetaRef.current();
      };
  }, []);

  // Close selection popover on outside click
  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (popoverRef.current && !popoverRef.current.contains(event.target as Node) && textareaRef.current && !textareaRef.current.contains(event.target as Node)) {
              setSelectionState(null);
          }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // --- Log Handlers ---
  const handleAddLog = () => {
      if (!newLogContent.trim() && newLogImages.length === 0) return;
      
      const newEntry: ProjectLogEntry = {
          id: crypto.randomUUID(),
          content: newLogContent,
          images: newLogImages,
          createdAt: Date.now()
      };

      onUpdateProject({
          ...project,
          logs: [newEntry, ...project.logs],
          updatedAt: Date.now()
      });

      setNewLogContent('');
      setNewLogImages([]);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const reader = new FileReader();
          reader.onload = (ev) => {
              if (ev.target?.result) {
                  setNewLogImages(prev => [...prev, ev.target!.result as string]);
              }
          };
          reader.readAsDataURL(e.target.files[0]);
      }
  };

  // --- Meeting Handlers ---
  const handleAddMeeting = () => {
      if (!newMeetingTitle.trim() || !newMeetingContent.trim()) return;

      const meeting: ProjectMeeting = {
          id: crypto.randomUUID(),
          title: newMeetingTitle,
          date: new Date(newMeetingDate).getTime(),
          attendees: newMeetingAttendees,
          content: newMeetingContent
      };

      onUpdateProject({
          ...project,
          meetings: [meeting, ...(project.meetings || [])].sort((a, b) => b.date - a.date),
          updatedAt: Date.now()
      });

      setNewMeetingTitle('');
      setNewMeetingContent('');
      setNewMeetingAttendees('');
      setNewMeetingDate(new Date().toISOString().split('T')[0]);
  };

  const handleDeleteMeeting = (id: string) => {
      onUpdateProject({
          ...project,
          meetings: (project.meetings || []).filter(m => m.id !== id)
      });
  };

  // --- Task Handlers ---
  const handleAddTask = () => {
      if (!newTaskContent.trim()) return;
      const task: ProjectTask = {
          id: crypto.randomUUID(),
          content: newTaskContent,
          status: 'todo',
          createdAt: Date.now()
      };
      onUpdateProject({
          ...project,
          tasks: [...project.tasks, task],
          updatedAt: Date.now()
      });
      setNewTaskContent('');
  };

  const toggleTaskStatus = (taskId: string) => {
      const updatedTasks = project.tasks.map(t => {
          if (t.id === taskId) {
              return { ...t, status: t.status === 'done' ? 'todo' : 'done' as any };
          }
          return t;
      });
      onUpdateProject({ ...project, tasks: updatedTasks });
  };

  const deleteTask = (taskId: string) => {
      onUpdateProject({
          ...project,
          tasks: project.tasks.filter(t => t.id !== taskId)
      });
  };

  // --- Literature Handlers ---
  const handleAddLiterature = () => {
      if (!selectedPaperId) return;
      if (project.literature.some(l => l.paperId === selectedPaperId)) {
          alert("Paper already in project literature.");
          return;
      }

      const entry: ProjectLiterature = {
          paperId: selectedPaperId,
          relevanceNote: ''
      };

      onUpdateProject({
          ...project,
          literature: [...project.literature, entry],
          updatedAt: Date.now()
      });
      setSelectedPaperId('');
  };

  const handleAddFromUrl = async () => {
      if (!newArxivUrl.trim()) return;
      setIsAddingPaper(true);
      try {
          const paperId = await onAddPaperToLibrary(newArxivUrl);
          
          if (project.literature.some(l => l.paperId === paperId)) {
              alert("This paper is already in the literature review for this project.");
              setNewArxivUrl('');
              setIsAddingPaper(false);
              return;
          }

          const entry: ProjectLiterature = {
              paperId: paperId,
              relevanceNote: 'Added directly via URL.'
          };

          onUpdateProject({
              ...project,
              literature: [...project.literature, entry],
              updatedAt: Date.now()
          });
          setNewArxivUrl('');
      } catch (e: any) {
          alert(e.message || "Failed to add paper");
      } finally {
          setIsAddingPaper(false);
      }
  };

  const updateLitNote = (paperId: string, note: string) => {
      const updated = project.literature.map(l => l.paperId === paperId ? { ...l, relevanceNote: note } : l);
      onUpdateProject({ ...project, literature: updated });
  };

  const removeLiterature = (paperId: string) => {
      onUpdateProject({
          ...project,
          literature: project.literature.filter(l => l.paperId !== paperId)
      });
  };

  // --- Drafting Handlers ---
  const handleTextSelection = () => {
    const textarea = textareaRef.current;
    if (!textarea || isRefining) return;

    const { selectionStart, selectionEnd } = textarea;
    if (selectionStart !== selectionEnd) {
      const selectedText = textarea.value.substring(selectionStart, selectionEnd);
      setSelectionState({
        start: selectionStart,
        end: selectionEnd,
        text: selectedText,
      });
    } else {
        setSelectionState(null);
    }
  };

  const handleRefineText = async (instruction: string) => {
      if (!selectionState || !instruction.trim()) return;
      
      setIsRefining(true);
      try {
          const refined = await refineText(selectionState.text, instruction);
          const { start, end } = selectionState;
          
          const newOutline = outlineContent.substring(0, start) + refined + outlineContent.substring(end);
          setOutlineContent(newOutline);

      } catch (error) {
          console.error(error);
          alert("Failed to refine text.");
      } finally {
          setIsRefining(false);
          setSelectionState(null);
          setRefinePrompt('');
      }
  };

  const handleExportToLatex = async () => {
    setIsConvertingToLatex(true);
    try {
        const result = await convertMarkdownToLatex(outlineContent);
        setLatexContent(result);
        setIsLatexModalOpen(true);
    } catch (error) {
        console.error(error);
        alert("Failed to convert to LaTeX.");
    } finally {
        setIsConvertingToLatex(false);
    }
  };

  const handleCopyLatex = () => {
    navigator.clipboard.writeText(latexContent).then(() => {
        setCopyButtonText('Copied!');
        setTimeout(() => setCopyButtonText('Copy to Clipboard'), 2000);
    });
  };

  // --- Team Handlers ---
  const handleAddTeamMember = () => {
      if (!newMemberName.trim()) return;

      const newMember: ProjectMember = {
          id: crypto.randomUUID(),
          name: newMemberName,
          role: newMemberRole || 'Collaborator',
          affiliation: newMemberAffiliation,
          email: newMemberEmail
      };

      onUpdateProject({
          ...project,
          team: [...(project.team || []), newMember],
          updatedAt: Date.now()
      });

      setNewMemberName('');
      setNewMemberRole('');
      setNewMemberAffiliation('');
      setNewMemberEmail('');
  };

  // Progress Calculation
  const progress = project.tasks.length > 0 
    ? Math.round((project.tasks.filter(t => t.status === 'done').length / project.tasks.length) * 100) 
    : 0;

  return (
    <div className="flex flex-col h-full bg-slate-900 overflow-hidden">
      {/* Header */}
      <div className="bg-slate-950 border-b border-slate-800 flex flex-col shrink-0 z-10 relative">
        
        {/* Top Section: Navigation & Identity */}
        <div className="px-8 pt-6 pb-2 flex items-start justify-between gap-6">
            <div className="flex items-start gap-4 flex-1">
                <button 
                    type="button"
                    onClick={onToggleLeftSidebar}
                    className={`mt-1 p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-all ${!isLeftSidebarOpen ? 'text-indigo-400 border-indigo-500/30' : ''}`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                    </svg>
                </button>
                
                <div className="flex-1 space-y-2">
                    <input 
                        type="text" 
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        onBlur={handleSaveMeta}
                        className="bg-transparent text-3xl font-extrabold text-white focus:outline-none placeholder:text-slate-700 w-full transition-colors"
                        placeholder="Project Title"
                    />
                    <input 
                        type="text" 
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        onBlur={handleSaveMeta}
                        className="bg-transparent text-base text-slate-400 focus:outline-none placeholder:text-slate-600 w-full transition-colors"
                        placeholder="Add a brief description of your research goals..."
                    />
                </div>
            </div>

            <button 
                onClick={() => onDeleteProject(project.id)}
                className="mt-1 p-2 text-slate-500 hover:text-red-400 hover:bg-slate-900 rounded-lg transition-colors"
                title="Delete Project"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
            </button>
        </div>

        {/* Middle Section: Metadata Grid */}
        <div className="px-8 py-6 grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-slate-900">
            {/* Deadline Picker */}
            <div className="flex items-center gap-3 bg-slate-900/50 border border-slate-800/50 rounded-xl p-3 w-fit pr-6 hover:border-slate-700 transition-colors group">
                <div className="p-2 bg-slate-800 rounded-lg text-cyan-400 group-hover:scale-110 transition-transform">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                    </svg>
                </div>
                <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Target Deadline</span>
                    <input 
                        type="date" 
                        value={deadline}
                        onChange={(e) => setDeadline(e.target.value)}
                        onBlur={handleSaveMeta}
                        className="bg-transparent text-sm font-medium text-slate-200 focus:outline-none [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-50 [&::-webkit-calendar-picker-indicator]:hover:opacity-100 cursor-pointer"
                    />
                </div>
            </div>

            {/* Progress Bar */}
            <div className="flex items-center justify-end gap-4">
                <div className="flex flex-col items-end w-full max-w-xs">
                    <div className="flex justify-between w-full mb-2">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Project Completion</span>
                        <span className="text-xs font-mono font-bold text-cyan-400">{progress}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                        <div 
                            className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.3)] transition-all duration-700 ease-out relative" 
                            style={{ width: `${progress}%` }}
                        >
                            <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* Bottom Section: Tabs */}
        <div className="px-8 flex gap-8 overflow-x-auto no-scrollbar">
            {/* FIX: Use 'as const' to ensure type-safe comparison for tabs. */}
            {(['log', 'meetings', 'plan', 'literature', 'drafting', 'team'] as const).map(tab => (
                <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`pb-4 text-sm font-bold transition-all border-b-2 capitalize whitespace-nowrap ${
                        activeTab === tab 
                        ? 'text-cyan-400 border-cyan-400' 
                        : 'text-slate-500 border-transparent hover:text-slate-300'
                    }`}
                >
                    {tab === 'log' ? 'Research Log' : 
                     tab === 'meetings' ? 'Meeting Minutes' :
                     tab === 'plan' ? 'Plan & Tasks' : 
                     tab === 'literature' ? 'Literature Review' : 
                     tab === 'drafting' ? 'Drafting' : 'Team'}
                </button>
            ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-slate-900 p-6 custom-scrollbar">
          <div className="max-w-4xl mx-auto h-full flex flex-col">
              
              {/* --- LOG TAB --- */}
              {activeTab === 'log' && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                      {/* Input Area */}
                      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 shadow-sm">
                          <textarea 
                              ref={logInputRef}
                              value={newLogContent}
                              onChange={(e) => setNewLogContent(e.target.value)}
                              placeholder="What did you work on today? Any results?"
                              className="w-full bg-transparent text-slate-200 text-sm focus:outline-none resize-none min-h-[80px]"
                          />
                          
                          {/* Image Previews */}
                          {newLogImages.length > 0 && (
                              <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
                                  {newLogImages.map((img, idx) => (
                                      <div key={idx} className="relative w-20 h-20 shrink-0 group">
                                          <img src={img} alt="Preview" className="w-full h-full object-cover rounded-lg border border-slate-600" />
                                          <button 
                                            onClick={() => setNewLogImages(prev => prev.filter((_, i) => i !== idx))}
                                            className="absolute top-0 right-0 bg-red-500/80 text-white p-0.5 rounded-bl-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                          >
                                              &times;
                                          </button>
                                      </div>
                                  ))}
                              </div>
                          )}

                          <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-700/50">
                              <label className="text-xs text-cyan-400 cursor-pointer hover:text-cyan-300 flex items-center gap-1">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                      <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                                  </svg>
                                  Add Image
                                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                              </label>
                              <button 
                                onClick={handleAddLog}
                                disabled={!newLogContent.trim() && newLogImages.length === 0}
                                className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
                              >
                                  Post Entry
                              </button>
                          </div>
                      </div>

                      {/* Timeline */}
                      <div className="relative pl-8 border-l-2 border-slate-800 space-y-8">
                          {project.logs.length === 0 && (
                              <div className="text-slate-500 text-sm italic ml-2">No log entries yet. Start tracking your progress!</div>
                          )}
                          {project.logs.map((log) => (
                              <div key={log.id} className="relative group">
                                  {/* Timeline Dot */}
                                  <div className="absolute -left-[41px] top-0 w-5 h-5 rounded-full bg-slate-900 border-2 border-cyan-500 flex items-center justify-center">
                                      <div className="w-2 h-2 rounded-full bg-cyan-500"></div>
                                  </div>
                                  
                                  <div className="flex flex-col gap-2">
                                      <span className="text-xs text-slate-500 font-mono">
                                          {new Date(log.createdAt).toLocaleString()}
                                      </span>
                                      <div className="prose prose-invert prose-sm max-w-none text-slate-300">
                                          <div dangerouslySetInnerHTML={{ __html: parse(log.content) as string }} />
                                      </div>
                                      {log.images.length > 0 && (
                                          <div className="flex flex-wrap gap-2 mt-2">
                                              {log.images.map((img, i) => (
                                                  <img 
                                                    key={i} 
                                                    src={img} 
                                                    alt="Experiment result" 
                                                    className="max-h-48 rounded-lg border border-slate-700 hover:scale-105 transition-transform cursor-pointer"
                                                    onClick={() => {
                                                        const w = window.open("");
                                                        w?.document.write(`<img src="${img}" style="max-width: 100%;" />`);
                                                    }}
                                                  />
                                              ))}
                                          </div>
                                      )}
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>
              )}

              {/* --- MEETINGS TAB --- */}
              {activeTab === 'meetings' && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                      {/* Meeting Input */}
                      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 shadow-sm flex flex-col gap-3">
                          <div className="flex gap-2">
                              <input 
                                  type="text" 
                                  value={newMeetingTitle}
                                  onChange={(e) => setNewMeetingTitle(e.target.value)}
                                  placeholder="Meeting Title (e.g. Weekly Sync)"
                                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                              />
                              <input 
                                  type="date"
                                  value={newMeetingDate}
                                  onChange={(e) => setNewMeetingDate(e.target.value)}
                                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-cyan-500 [&::-webkit-calendar-picker-indicator]:invert"
                              />
                          </div>
                          <input 
                              type="text"
                              value={newMeetingAttendees}
                              onChange={(e) => setNewMeetingAttendees(e.target.value)}
                              placeholder="Attendees (comma separated)"
                              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                          />
                          <textarea 
                              value={newMeetingContent}
                              onChange={(e) => setNewMeetingContent(e.target.value)}
                              placeholder="Meeting Minutes / Notes..."
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500 resize-none min-h-[100px]"
                          />
                          <div className="flex justify-end">
                              <button 
                                  onClick={handleAddMeeting}
                                  disabled={!newMeetingTitle || !newMeetingContent}
                                  className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
                              >
                                  Save Meeting
                              </button>
                          </div>
                      </div>

                      {/* Meeting List */}
                      <div className="space-y-4">
                          {(project.meetings || []).length === 0 && (
                              <div className="text-center py-8 text-slate-500 text-sm border border-dashed border-slate-800 rounded-lg">
                                  No meetings recorded yet.
                              </div>
                          )}
                          {(project.meetings || []).map(meeting => (
                              <div key={meeting.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex flex-col gap-2">
                                  <div className="flex justify-between items-start border-b border-slate-700/50 pb-2">
                                      <div>
                                          <h4 className="font-bold text-slate-200 text-sm">{meeting.title}</h4>
                                          <div className="flex gap-3 text-xs text-slate-500 mt-1">
                                              <span>{new Date(meeting.date).toLocaleDateString()}</span>
                                              <span>•</span>
                                              <span>{meeting.attendees}</span>
                                          </div>
                                      </div>
                                      <button 
                                          onClick={() => handleDeleteMeeting(meeting.id)}
                                          className="text-slate-600 hover:text-red-400 p-1"
                                      >
                                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                          </svg>
                                      </button>
                                  </div>
                                  <div className="prose prose-invert prose-sm max-w-none text-slate-300 pt-2">
                                      <div dangerouslySetInnerHTML={{ __html: parse(meeting.content) as string }} />
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>
              )}

              {/* --- PLAN TAB --- */}
              {activeTab === 'plan' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                      <div className="flex gap-2">
                          <input 
                              type="text" 
                              value={newTaskContent}
                              onChange={(e) => setNewTaskContent(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
                              placeholder="Add a new task or experiment..."
                              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                          />
                          <button 
                              onClick={handleAddTask}
                              className="bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 px-4 rounded-lg transition-colors"
                          >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                              </svg>
                          </button>
                      </div>

                      <div className="space-y-2">
                          {project.tasks.length === 0 && (
                              <div className="text-center py-10 text-slate-500 text-sm border border-dashed border-slate-800 rounded-lg">
                                  No tasks planned.
                              </div>
                          )}
                          
                          {/* To Do & In Progress */}
                          {project.tasks.filter(t => t.status !== 'done').map(task => (
                              <div key={task.id} className="group flex items-center gap-3 p-3 bg-slate-800/30 border border-slate-700/50 rounded-lg hover:bg-slate-800 transition-colors">
                                  <button 
                                    onClick={() => toggleTaskStatus(task.id)}
                                    className="w-5 h-5 rounded border-2 border-slate-500 hover:border-cyan-400 flex items-center justify-center transition-colors"
                                  >
                                  </button>
                                  <span className="flex-1 text-sm text-slate-200">{task.content}</span>
                                  <button onClick={() => deleteTask(task.id)} className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                      &times;
                                  </button>
                              </div>
                          ))}

                          {/* Done */}
                          {project.tasks.filter(t => t.status === 'done').length > 0 && (
                              <div className="pt-4 mt-4 border-t border-slate-800">
                                  <h4 className="text-xs text-slate-500 uppercase font-bold mb-2">Completed</h4>
                                  {project.tasks.filter(t => t.status === 'done').map(task => (
                                      <div key={task.id} className="group flex items-center gap-3 p-3 opacity-50 hover:opacity-100 transition-opacity">
                                          <button 
                                            onClick={() => toggleTaskStatus(task.id)}
                                            className="w-5 h-5 rounded border-2 border-cyan-500 bg-cyan-500/20 text-cyan-500 flex items-center justify-center"
                                          >
                                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                              </svg>
                                          </button>
                                          <span className="flex-1 text-sm text-slate-400 line-through decoration-slate-600">{task.content}</span>
                                          <button onClick={() => deleteTask(task.id)} className="text-slate-600 hover:text-red-400">
                                              &times;
                                          </button>
                                      </div>
                                  ))}
                              </div>
                          )}
                      </div>
                  </div>
              )}

              {/* --- LITERATURE TAB --- */}
              {activeTab === 'literature' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                      <div className="flex justify-between items-center mb-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
                          {/* Selector for existing papers */}
                          <div className="flex gap-2">
                              <select 
                                  value={selectedPaperId}
                                  onChange={(e) => setSelectedPaperId(e.target.value)}
                                  className="flex-1 min-w-0 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                              >
                                  <option value="">Select from library...</option>
                                  {papers
                                    .filter(p => !project.literature.some(l => l.paperId === p.id))
                                    .map(p => (
                                      <option key={p.id} value={p.id}>{p.title}</option>
                                  ))}
                              </select>
                              <button 
                                  onClick={handleAddLiterature}
                                  disabled={!selectedPaperId}
                                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 rounded-lg transition-colors font-medium disabled:opacity-50"
                              >
                                  Add
                              </button>
                          </div>

                          {/* Quick Add from URL */}
                          <div className="flex gap-2">
                              <input 
                                  type="text" 
                                  value={newArxivUrl}
                                  onChange={(e) => setNewArxivUrl(e.target.value)}
                                  placeholder="Or paste ArXiv URL..."
                                  className="flex-1 min-w-0 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                              />
                              <button 
                                  onClick={handleAddFromUrl}
                                  disabled={isAddingPaper || !newArxivUrl}
                                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 rounded-lg transition-colors font-medium disabled:opacity-50 whitespace-nowrap"
                              >
                                  {isAddingPaper ? 'Adding...' : '+ Fetch'}
                              </button>
                          </div>
                        </div>

                        <button 
                            onClick={() => exportProjectToBibtex(project, papers)}
                            className="ml-6 text-xs px-3 py-1 bg-slate-800 border border-slate-700 rounded hover:bg-slate-700 transition-colors text-slate-300 flex items-center gap-2"
                            title="Export as BibTeX"
                        >
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                            </svg>
                            Export as BibTeX
                        </button>
                      </div>

                      <div className="space-y-4">
                          {project.literature.length === 0 && (
                              <div className="text-center py-10 text-slate-500 text-sm border border-dashed border-slate-800 rounded-lg">
                                  No literature linked to this project yet.
                              </div>
                          )}

                          {project.literature.map((item) => {
                              const paper = papers.find(p => p.id === item.paperId);
                              if (!paper) return null;

                              return (
                                  <div key={item.paperId} className="bg-slate-800/40 border border-slate-700 rounded-xl p-4">
                                      <div className="flex justify-between items-start mb-2">
                                          <div className="cursor-pointer hover:text-cyan-400 transition-colors" onClick={() => onSelectPaper(paper.id)}>
                                              <h4 className="font-bold text-slate-200 text-sm">{paper.title}</h4>
                                              <p className="text-xs text-slate-500">{paper.authors.join(', ')}</p>
                                          </div>
                                          <button onClick={() => removeLiterature(item.paperId)} className="text-slate-600 hover:text-red-400">
                                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                              </svg>
                                          </button>
                                      </div>
                                      
                                      <div className="relative">
                                          <textarea 
                                              value={item.relevanceNote}
                                              onChange={(e) => updateLitNote(item.paperId, e.target.value)}
                                              placeholder="Why is this paper relevant to this project? Key takeaways?"
                                              className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg p-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-500/50 min-h-[60px]"
                                          />
                                      </div>
                                  </div>
                              )
                          })}
                      </div>
                  </div>
              )}

              {/* --- DRAFTING TAB --- */}
              {activeTab === 'drafting' && (
                  <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-300">
                      <div className="flex justify-between items-center mb-4">
                          <h3 className="text-sm font-bold text-slate-300">Drafting: Paper Outline</h3>
                          <div className="flex items-center gap-2">
                                <button 
                                    onClick={handleExportToLatex}
                                    disabled={isConvertingToLatex}
                                    className="text-xs px-3 py-1 bg-slate-800 border border-slate-700 rounded hover:bg-slate-700 transition-colors text-slate-300 disabled:opacity-50"
                                >
                                    {isConvertingToLatex ? 'Converting...' : 'Export as LaTeX'}
                                </button>
                                <button 
                                    onClick={() => setIsPreviewOutline(!isPreviewOutline)}
                                    className="text-xs px-3 py-1 bg-slate-800 border border-slate-700 rounded hover:bg-slate-700 transition-colors text-slate-300"
                                >
                                    {isPreviewOutline ? 'Edit Mode' : 'Preview Mode'}
                                </button>
                          </div>
                      </div>
                      
                      <div className="flex-1 relative border border-slate-700 rounded-lg bg-slate-800/50 overflow-hidden">
                          {selectionState && !isPreviewOutline && (
                              <div
                                  ref={popoverRef}
                                  className="absolute top-2 left-1/2 -translate-x-1/2 z-20 w-full max-w-lg p-3 bg-slate-950 border border-slate-700 rounded-xl shadow-2xl flex flex-col gap-2 animate-in fade-in duration-200"
                              >
                                  {isRefining ? (
                                      <div className="flex items-center justify-center gap-3 py-4">
                                          <svg className="animate-spin h-5 w-5 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                          </svg>
                                          <span className="text-sm text-slate-300 font-medium">Refining text...</span>
                                      </div>
                                  ) : (
                                      <>
                                          <div className="flex gap-2">
                                              {['Make more concise', 'Improve clarity', 'Use academic tone'].map(p => (
                                                  <button
                                                      key={p}
                                                      onMouseDown={(e) => e.preventDefault()}
                                                      onClick={() => handleRefineText(p)}
                                                      className="flex-1 text-xs px-2 py-1 bg-slate-800 border border-slate-700 rounded hover:bg-slate-700 hover:text-white text-slate-300 transition-colors"
                                                  >
                                                      {p}
                                                  </button>
                                              ))}
                                          </div>
                                          <div className="flex gap-2">
                                              <input
                                                  type="text"
                                                  value={refinePrompt}
                                                  onChange={e => setRefinePrompt(e.target.value)}
                                                  onKeyDown={e => e.key === 'Enter' && refinePrompt && handleRefineText(refinePrompt)}
                                                  placeholder="Or type custom instruction..."
                                                  className="flex-1 bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                                              />
                                              <button
                                                  onClick={() => handleRefineText(refinePrompt)}
                                                  onMouseDown={(e) => e.preventDefault()}
                                                  disabled={isRefining || !refinePrompt.trim()}
                                                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-md text-xs disabled:opacity-50 flex items-center justify-center gap-2"
                                              >
                                                  Refine
                                              </button>
                                          </div>
                                      </>
                                  )}
                              </div>
                          )}

                          {isPreviewOutline ? (
                              <div className="absolute inset-0 p-6 overflow-y-auto prose prose-invert prose-sm max-w-none">
                                  <div dangerouslySetInnerHTML={{ __html: parse(outlineContent || '*Start drafting your outline...*') as string }} />
                              </div>
                          ) : (
                              <textarea
                                  ref={textareaRef}
                                  value={outlineContent}
                                  onChange={(e) => setOutlineContent(e.target.value)}
                                  onMouseUp={handleTextSelection}
                                  onBlur={() => setTimeout(() => { if (!isRefining) setSelectionState(null); }, 150)}
                                  placeholder={"# Paper Title\n## Abstract\n## 1. Introduction\n- Motivation\n- Contributions\n## 2. Related Work\n## 3. Methodology\n## 4. Conclusion"}
                                  className="absolute inset-0 w-full h-full bg-transparent p-6 text-slate-300 font-mono text-sm focus:outline-none resize-none"
                              />
                          )}
                      </div>
                      <div className="mt-2 text-right text-[10px] text-slate-500">
                          {outlineContent !== project.paperOutline ? 'Saving...' : 'All changes saved'}
                      </div>
                  </div>
              )}

              {/* --- TEAM TAB --- */}
              {activeTab === 'team' && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                      {/* Add Member Form */}
                      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 shadow-sm">
                          <h3 className="text-sm font-bold text-slate-300 mb-3 uppercase tracking-wider">Add Collaborator</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                              <input 
                                  value={newMemberName} 
                                  onChange={e => setNewMemberName(e.target.value)} 
                                  placeholder="Full Name" 
                                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                              />
                              <input 
                                  value={newMemberRole} 
                                  onChange={e => setNewMemberRole(e.target.value)} 
                                  placeholder="Role (e.g. PI, PhD Student)" 
                                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                              />
                              <input 
                                  value={newMemberEmail} 
                                  onChange={e => setNewMemberEmail(e.target.value)} 
                                  placeholder="Email Address" 
                                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                              />
                              <input 
                                  value={newMemberAffiliation} 
                                  onChange={e => setNewMemberAffiliation(e.target.value)} 
                                  placeholder="Affiliation / University" 
                                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                              />
                          </div>
                          <div className="flex justify-end">
                              <button 
                                  onClick={handleAddTeamMember}
                                  disabled={!newMemberName.trim()}
                                  className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
                              >
                                  Add Member
                              </button>
                          </div>
                      </div>

                      {/* Team Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {(project.team || []).length === 0 && (
                              <div className="col-span-full text-center py-12 text-slate-500 border border-dashed border-slate-800 rounded-xl">
                                  No team members added yet.
                              </div>
                          )}
                          {(project.team || []).map(member => (
                              <div key={member.id} className="bg-slate-800 border border-slate-700 p-4 rounded-xl flex items-start justify-between group hover:border-cyan-500/30 transition-all">
                                  <div className="flex items-start gap-3">
                                      <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 font-bold text-sm shrink-0">
                                          {member.name.charAt(0).toUpperCase()}
                                      </div>
                                      <div>
                                          <div className="font-bold text-white text-sm">{member.name}</div>
                                          <div className="text-xs text-cyan-400 font-medium mb-0.5">{member.role}</div>
                                          <div className="text-xs text-slate-400 mb-1">{member.affiliation}</div>
                                          {member.email && (
                                              <a href={`mailto:${member.email}`} className="text-xs text-slate-500 hover:text-white hover:underline flex items-center gap-1">
                                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                                      <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                                                      <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                                                  </svg>
                                                  {member.email}
                                              </a>
                                          )}
                                      </div>
                                  </div>
                                  <button 
                                      onClick={() => onRemoveTeamMember(member.id)}
                                      className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                      </svg>
                                  </button>
                              </div>
                          ))}
                      </div>
                  </div>
              )}
          </div>
      </div>
      
      {/* LaTeX Export Modal */}
      {isLatexModalOpen && (
            <div 
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
                onClick={() => setIsLatexModalOpen(false)}
            >
                <div 
                    className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-3xl h-[80vh] flex flex-col"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="p-4 border-b border-slate-700 flex justify-between items-center shrink-0">
                        <h3 className="text-lg font-bold text-white">LaTeX Export</h3>
                        <button 
                            onClick={() => setIsLatexModalOpen(false)}
                            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400"
                        >
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                        </button>
                    </div>
                    <div className="flex-1 p-4 overflow-auto bg-slate-950/50">
                        <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono">
                            <code>{latexContent}</code>
                        </pre>
                    </div>
                    <div className="p-4 border-t border-slate-700 flex justify-end">
                        <button 
                            onClick={handleCopyLatex}
                            className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors shadow-lg shadow-indigo-500/20"
                        >
                            {copyButtonText}
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default ProjectView;
