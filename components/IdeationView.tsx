
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { IdeationSession, IdeationMessage, ResearchProject, PromptTemplate, PersonaType } from '../types';
import { streamSingleTurn, generateProjectPlan, DEFAULT_IDEATOR_PROMPT, DEFAULT_CRITIC_PROMPT, DEFAULT_SYNTHESIZER_PROMPT, DEFAULT_PLANNER_PROMPT } from '../services/geminiService';
import { dbService } from '../services/idbService';
import { parse } from 'marked';

interface IdeationViewProps {
  initialSessionId?: string;
  isLeftSidebarOpen: boolean;
  onToggleLeftSidebar: () => void;
  triggerConfirm: (title: string, message: string, onConfirm: () => void) => void;
}

const MODELS = [
    { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro', desc: 'Superior reasoning' },
    { id: 'gemini-3-flash-preview', name: 'Gemini-3 Flash', desc: 'Fast & creative' },
    { id: 'gemini-2.5-flash-lite-latest', name: 'Gemini 2.5 Lite', desc: 'Lightweight' },
];

const MessageCard: React.FC<{ msg: IdeationMessage }> = ({ msg }) => {
    const isUser = msg.role === 'user';
    const personaColor = msg.persona === 'IDEATOR' ? 'bg-indigo-500' : msg.persona === 'CRITIC' ? 'bg-rose-500' : msg.persona === 'SYNTHESIZER' ? 'bg-amber-500' : 'bg-cyan-600';
    const [copied, setCopied] = useState(false);

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(msg.text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300 group/msg`}>
            <div className={`relative max-w-[90%] rounded-2xl overflow-hidden ${isUser ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-800/60 border border-slate-700/50 text-slate-200'}`}>
                {!isUser && msg.persona && (
                    <div className={`px-4 py-1.5 text-[9px] font-black tracking-widest text-white uppercase flex justify-between items-center ${personaColor}`}>
                        <span>{msg.persona === 'SYNTHESIZER' ? 'Final PI Synthesis' : msg.persona === 'PLANNER' ? 'Execution Plan' : msg.persona}</span>
                        {msg.thinking && <span className="opacity-70 font-mono tracking-normal capitalize">Internal Reasoning Logged</span>}
                    </div>
                )}
                
                {!isUser && (
                    <button 
                        onClick={handleCopy}
                        className="absolute top-8 right-3 z-10 p-1.5 bg-slate-900/80 border border-slate-700 rounded-lg text-slate-400 hover:text-white transition-all opacity-0 group-hover/msg:opacity-100 flex items-center gap-1.5 backdrop-blur-sm"
                        title="Copy Markdown"
                    >
                        {copied ? (
                            <svg className="w-3 h-3 text-emerald-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                        ) : (
                            <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" /><path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" /></svg>
                        )}
                        <span className="text-[9px] font-bold uppercase">{copied ? 'Copied' : 'Markdown'}</span>
                    </button>
                )}

                {msg.thinking && !isUser && (
                    <div className="bg-slate-900/50 px-4 py-3 border-b border-slate-700/30">
                        <details className="group">
                            <summary className="text-[10px] font-bold text-slate-500 uppercase cursor-pointer hover:text-slate-400 flex items-center gap-1.5 select-none outline-none">
                                <svg className="w-3 h-3 transition-transform group-open:rotate-180" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                View Agent Logic
                            </summary>
                            <div className="mt-2 text-xs text-slate-500 font-serif leading-relaxed pl-2 border-l border-slate-700/50 whitespace-pre-wrap">
                                {msg.thinking}
                            </div>
                        </details>
                    </div>
                )}
                <div className={`p-5 prose prose-invert prose-sm max-w-none ${isUser ? 'text-white' : ''}`}>
                    <div dangerouslySetInnerHTML={{ __html: parse(msg.text) as string }} />
                </div>
                <div className={`px-5 pb-3 text-[9px] font-mono ${isUser ? 'text-indigo-200/50' : 'text-slate-500'}`}>
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
            </div>
        </div>
    );
};

interface PromptModalProps {
    type: PersonaType | null;
    session: IdeationSession | undefined;
    templates: PromptTemplate[];
    onUpdate: (updated: IdeationSession) => void;
    onSaveTemplate: (name: string, text: string, persona: PersonaType) => Promise<void>;
    onDeleteTemplate: (id: string) => Promise<void>;
    onClose: () => void;
}

const PromptModal: React.FC<PromptModalProps> = ({ type, session, templates, onUpdate, onSaveTemplate, onDeleteTemplate, onClose }) => {
    const [localValue, setLocalValue] = useState('');
    const [isSavingTemplate, setIsSavingTemplate] = useState(false);
    const [templateName, setTemplateName] = useState('');
    const [isLibraryOpen, setIsLibraryOpen] = useState(false);

    useEffect(() => {
        if (type && session) {
            const initial = type === 'IDEATOR' ? session.ideatorPrompt 
                         : type === 'CRITIC' ? session.criticPrompt 
                         : type === 'SYNTHESIZER' ? session.synthesizerPrompt
                         : session.plannerPrompt;
            setLocalValue(initial || '');
        }
    }, [type, session?.id]);

    if (!type || !session) return null;

    const labels = {
        IDEATOR: { title: 'Ideator Instructions', colorClass: 'bg-indigo-500', shadowClass: 'shadow-indigo-500/40', key: 'ideatorPrompt', default: DEFAULT_IDEATOR_PROMPT },
        CRITIC: { title: 'Critic Instructions', colorClass: 'bg-rose-500', shadowClass: 'shadow-rose-500/40', key: 'criticPrompt', default: DEFAULT_CRITIC_PROMPT },
        SYNTHESIZER: { title: 'Synthesizer Instructions', colorClass: 'bg-amber-500', shadowClass: 'shadow-amber-500/40', key: 'synthesizerPrompt', default: DEFAULT_SYNTHESIZER_PROMPT },
        PLANNER: { title: 'Planner Instructions', colorClass: 'bg-cyan-500', shadowClass: 'shadow-cyan-500/40', key: 'plannerPrompt', default: DEFAULT_PLANNER_PROMPT },
    };

    const config = labels[type];
    const filteredTemplates = templates.filter(t => t.persona === type);

    const handleSave = () => {
        onUpdate({ ...session, [config.key]: localValue });
        onClose();
    };

    const handleConfirmSaveTemplate = async () => {
        if (!templateName.trim()) return;
        await onSaveTemplate(templateName.trim(), localValue, type);
        setIsSavingTemplate(false);
        setTemplateName('');
    };

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 relative" onClick={e => e.stopPropagation()}>
                
                {/* Library Sidebar Overlay */}
                <div className={`absolute top-0 right-0 h-full w-80 bg-slate-950 border-l border-slate-800 z-30 transition-transform duration-300 transform ${isLibraryOpen ? 'translate-x-0' : 'translate-x-full'} flex flex-col shadow-2xl`}>
                    <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Prompt Library</h4>
                        <button onClick={() => setIsLibraryOpen(false)} className="text-slate-500 hover:text-white p-1">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3">
                        <button 
                            onClick={() => { setLocalValue(config.default); setIsLibraryOpen(false); }}
                            className="w-full text-left p-3 rounded-xl border border-dashed border-slate-700 hover:border-slate-500 hover:bg-slate-900 transition-all group"
                        >
                            <div className="text-[10px] font-black text-slate-500 group-hover:text-slate-300 uppercase tracking-tight mb-1">Standard Default</div>
                            <div className="text-[11px] text-slate-600 italic">Revert to the built-in system persona.</div>
                        </button>

                        {filteredTemplates.map(t => (
                            <div key={t.id} className="group relative">
                                <button 
                                    onClick={() => { setLocalValue(t.text); setIsLibraryOpen(false); }}
                                    className="w-full text-left p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-800/50 transition-all"
                                >
                                    <div className="text-xs font-bold text-slate-300 mb-1 truncate pr-6">{t.name}</div>
                                    <div className="text-[10px] text-slate-500 line-clamp-2">{t.text}</div>
                                </button>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onDeleteTemplate(t.id); }}
                                    className="absolute top-3 right-3 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                </button>
                            </div>
                        ))}

                        {filteredTemplates.length === 0 && (
                            <div className="py-10 text-center px-4">
                                <p className="text-[10px] text-slate-600 uppercase font-black mb-2">Empty Library</p>
                                <p className="text-[11px] text-slate-700 leading-relaxed italic">You haven't saved any custom templates for this persona yet.</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${config.colorClass} shadow-[0_0_10px_rgba(0,0,0,0.4)] ${config.shadowClass}`}></div>
                        <h3 className="text-lg font-black text-white tracking-tight uppercase">{config.title}</h3>
                    </div>
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={() => setIsLibraryOpen(true)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition-all border border-slate-700"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                            Library
                        </button>
                        <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-800 text-slate-500 hover:text-white transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                <div className="flex-1 p-6 overflow-hidden flex flex-col">
                    <textarea 
                        value={localValue}
                        onChange={e => setLocalValue(e.target.value)}
                        className="w-full flex-1 bg-slate-950/50 border border-slate-800 rounded-xl p-6 text-sm text-slate-300 font-mono focus:outline-none focus:border-indigo-500/50 resize-none custom-scrollbar leading-relaxed"
                        placeholder="Enter detailed system instructions for the agent..."
                        autoFocus
                    />
                </div>

                <div className="px-6 py-4 border-t border-slate-800 bg-slate-950 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-4">
                        {isSavingTemplate ? (
                            <div className="flex items-center gap-2 animate-in slide-in-from-left-2">
                                <input 
                                    autoFocus
                                    value={templateName}
                                    onChange={e => setTemplateName(e.target.value)}
                                    placeholder="Template Name..."
                                    className="bg-slate-900 border border-indigo-500/50 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                                />
                                <button onClick={handleConfirmSaveTemplate} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-all">Confirm</button>
                                <button onClick={() => { setIsSavingTemplate(false); setTemplateName(''); }} className="text-xs text-slate-500 hover:text-white">Cancel</button>
                            </div>
                        ) : (
                            <button onClick={() => setIsSavingTemplate(true)} className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 px-3 py-1.5 hover:bg-indigo-500/10 rounded-lg transition-all">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                Save to Library
                            </button>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors">Cancel</button>
                        <button onClick={handleSave} className="px-8 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-black rounded-xl shadow-lg shadow-indigo-500/20 transition-all uppercase tracking-widest">Apply Instruction</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const PipelinePreview = ({ 
    rounds, 
    isStreaming, 
    currentTurnIndex, 
    useDynamicTermination, 
    isUncapped,
    currentTurnPersona
}: { 
    rounds: number, 
    isStreaming: boolean, 
    currentTurnIndex: number, 
    useDynamicTermination?: boolean, 
    isUncapped?: boolean,
    currentTurnPersona?: PersonaType | null
}) => {
    
    if (useDynamicTermination) {
        const stepUserActive = isStreaming && currentTurnIndex === 0;
        const stepLoopActive = isStreaming && (currentTurnPersona === 'IDEATOR' || currentTurnPersona === 'CRITIC');
        const stepSynthesizerActive = isStreaming && currentTurnPersona === 'SYNTHESIZER';
        const stepLoopCompleted = isStreaming && currentTurnPersona === 'SYNTHESIZER';

        return (
            <div className="flex items-center gap-1.5 px-4 py-2 bg-slate-900/80 border border-slate-800 rounded-xl overflow-x-auto no-scrollbar shrink-0">
                <div className={`flex flex-col items-center gap-1 shrink-0 transition-opacity ${isStreaming && !stepUserActive ? 'opacity-40' : ''}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${isStreaming && !stepUserActive ? 'border-emerald-500' : 'border-slate-700'}`}>
                        {isStreaming && !stepUserActive ? <svg className="w-4 h-4 text-emerald-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg> : <div className="w-3 h-3 rounded-full bg-slate-600"></div>}
                    </div>
                    <span className="text-[8px] font-black uppercase tracking-tighter">User</span>
                </div>
                
                <div className="h-0.5 w-4 bg-slate-800 rounded-full"></div>

                <div className={`relative px-4 py-1.5 rounded-xl border-2 transition-all ${stepLoopActive ? 'border-indigo-500 bg-indigo-500/5' : stepLoopCompleted ? 'border-emerald-500' : 'border-slate-800'}`}>
                    <div className="flex items-center gap-4">
                        <div className={`flex flex-col items-center gap-1 ${isStreaming && currentTurnPersona !== 'IDEATOR' && currentTurnPersona !== 'CRITIC' ? 'opacity-40' : ''}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${currentTurnPersona === 'IDEATOR' ? 'border-indigo-400 animate-pulse' : 'border-slate-700'}`}>
                                <div className="w-3 h-3 rounded-full bg-indigo-500"></div>
                            </div>
                            <span className="text-[8px] font-black uppercase tracking-tighter">Ideator</span>
                        </div>
                        <div className="flex flex-col items-center gap-1 text-slate-600">
                             <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${stepLoopActive ? 'animate-spin' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v3.276a1 1 0 01-2 0V14.808a7.002 7.002 0 01-11.269-2.566 1 1 0 01.678-1.185z" clipRule="evenodd" />
                             </svg>
                             <span className="text-[7px] font-black uppercase tracking-widest">Loop</span>
                        </div>
                        <div className={`flex flex-col items-center gap-1 ${isStreaming && currentTurnPersona !== 'CRITIC' ? 'opacity-40' : ''}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${currentTurnPersona === 'CRITIC' ? 'border-rose-400 animate-pulse' : 'border-slate-700'}`}>
                                <div className="w-3 h-3 rounded-full bg-rose-500"></div>
                            </div>
                            <span className="text-[8px] font-black uppercase tracking-tighter">Critic</span>
                        </div>
                    </div>
                    {stepLoopActive && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2 bg-slate-900 border border-indigo-500/50 rounded text-[7px] font-black text-indigo-400 uppercase whitespace-nowrap">
                            Iterative Refinement
                        </div>
                    )}
                </div>

                <div className="h-0.5 w-4 bg-slate-800 rounded-full"></div>

                <div className={`flex flex-col items-center gap-1 shrink-0 transition-opacity ${isStreaming && !stepSynthesizerActive ? 'opacity-40' : ''}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${stepSynthesizerActive ? 'border-amber-400 animate-pulse' : 'border-slate-700'}`}>
                        <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                    </div>
                    <span className="text-[8px] font-black uppercase tracking-tighter">Synthesizer</span>
                </div>
            </div>
        );
    }

    const steps = useMemo(() => {
        const sequence = ['User'];
        for (let i = 0; i < rounds; i++) {
            sequence.push('Ideator', 'Critic');
        }
        sequence.push('Synthesizer');
        return sequence;
    }, [rounds]);

    return (
        <div className="flex items-center gap-1.5 px-4 py-2 bg-slate-900/80 border border-slate-800 rounded-xl overflow-x-auto no-scrollbar shrink-0">
            {steps.map((step, idx) => {
                const isActive = isStreaming && idx === currentTurnIndex;
                const isCompleted = isStreaming && idx < currentTurnIndex;
                const personaColor = step === 'Ideator' ? 'bg-indigo-500' : step === 'Critic' ? 'bg-rose-500' : step === 'Synthesizer' ? 'bg-amber-500' : 'bg-slate-600';
                
                return (
                    <React.Fragment key={idx}>
                        <div className={`flex flex-col items-center gap-1 shrink-0 transition-all duration-300 ${isActive ? 'scale-110' : 'opacity-40'}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${isActive ? `border-${personaColor.split('-')[1]}-400 shadow-[0_0_10px_rgba(0,0,0,0.5)]` : isCompleted ? 'border-emerald-500' : 'border-slate-700'}`}>
                                {isCompleted ? (
                                    <svg className="w-4 h-4 text-emerald-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                ) : (
                                    <div className={`w-3 h-3 rounded-full ${personaColor}`}></div>
                                )}
                            </div>
                            <span className={`text-[8px] font-black uppercase tracking-tighter ${isActive ? 'text-white' : 'text-slate-600'}`}>{step}</span>
                        </div>
                        {idx < steps.length - 1 && (
                            <div className={`h-0.5 w-4 rounded-full shrink-0 ${isCompleted ? 'bg-emerald-500/30' : 'bg-slate-800'}`}></div>
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
};

const IdeationView: React.FC<IdeationViewProps> = ({ initialSessionId, isLeftSidebarOpen, onToggleLeftSidebar, triggerConfirm }) => {
    const [sessions, setSessions] = useState<IdeationSession[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(initialSessionId || null);
    const [input, setInput] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);
    const [isConfigOpen, setIsConfigOpen] = useState(true);
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [tempTitle, setTempTitle] = useState('');
    const [copyAllStatus, setCopyAllStatus] = useState(false);
    const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>([]);
    
    // Planning State
    const [isPlanningOpen, setIsPlanningOpen] = useState(false);
    const [planVenue, setPlanVenue] = useState('');
    const [planDeadline, setPlanDeadline] = useState('');
    const [planConstraints, setPlanConstraints] = useState('');
    const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);

    // Related Works State
    const [isRelatedWorksOpen, setIsRelatedWorksOpen] = useState(false);
    const [localRelatedWorks, setLocalRelatedWorks] = useState('');

    const [currentTurn, setCurrentTurn] = useState<{persona: PersonaType, text: string, thinking: string} | null>(null);
    const [currentTurnIndex, setCurrentTurnIndex] = useState<number>(0);
    const [turnCopied, setTurnCopied] = useState(false);

    const [editingPromptType, setEditingPromptType] = useState<PersonaType | null>(null);

    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const load = async () => {
            const [allSessions, allTemplates] = await Promise.all([
                dbService.getAll('ideationSessions'),
                dbService.getAll('promptTemplates')
            ]);
            setSessions(allSessions.sort((a,b) => b.updatedAt - a.updatedAt));
            setPromptTemplates(allTemplates.sort((a,b) => b.createdAt - a.createdAt));
            if (!activeSessionId && allSessions.length > 0) {
                setActiveSessionId(allSessions[0].id);
            }
        };
        load();
    }, []);

    const activeSession = useMemo(() => sessions.find(s => s.id === activeSessionId), [sessions, activeSessionId]);

    useEffect(() => {
        if (activeSession) {
            setTempTitle(activeSession.title);
            setLocalRelatedWorks(activeSession.relatedWorks || '');
        }
    }, [activeSession?.id, activeSession?.title, activeSession?.relatedWorks]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [activeSession?.messages, currentTurn]);

    const handleUpdateSession = async (updated: IdeationSession) => {
        await dbService.set('ideationSessions', updated);
        setSessions(prev => prev.map(s => s.id === updated.id ? updated : s));
    };

    const handleSaveRelatedWorks = async () => {
        if (!activeSession) return;
        await handleUpdateSession({ ...activeSession, relatedWorks: localRelatedWorks });
        setIsRelatedWorksOpen(false);
    };

    const handleSaveTemplate = async (name: string, text: string, persona: PersonaType) => {
        const newTemplate: PromptTemplate = {
            id: crypto.randomUUID(),
            name,
            text,
            persona,
            createdAt: Date.now()
        };
        await dbService.set('promptTemplates', newTemplate);
        setPromptTemplates(prev => [newTemplate, ...prev]);
    };

    const handleDeleteTemplate = async (id: string) => {
        await dbService.deleteItem('promptTemplates', id);
        setPromptTemplates(prev => prev.filter(t => t.id !== id));
    };

    const handleCreateSession = async () => {
        const newSession: IdeationSession = {
            id: crypto.randomUUID(),
            title: 'New Brainstorm',
            messages: [],
            ideatorModelId: MODELS[1].id,
            criticModelId: MODELS[0].id,
            synthesizerModelId: MODELS[0].id,
            plannerModelId: MODELS[0].id,
            ideatorPrompt: DEFAULT_IDEATOR_PROMPT,
            criticPrompt: DEFAULT_CRITIC_PROMPT,
            synthesizerPrompt: DEFAULT_SYNTHESIZER_PROMPT,
            plannerPrompt: DEFAULT_PLANNER_PROMPT,
            useSearchIdeator: false,
            useSearchCritic: false,
            useSearchSynthesizer: false,
            useSearchPlanner: true,
            useDynamicTermination: false,
            isUncapped: false,
            maxRounds: 5,
            rounds: 1,
            relatedWorks: '',
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        await dbService.set('ideationSessions', newSession);
        setSessions(prev => [newSession, ...prev]);
        setActiveSessionId(newSession.id);
    };

    const handleDeleteSession = (id: string) => {
        triggerConfirm(
            "Delete Brainstorm",
            "Are you sure you want to permanently delete this brainstorm session and all its turn history?",
            async () => {
                await dbService.deleteItem('ideationSessions', id);
                setSessions(prev => prev.filter(s => s.id !== id));
                if (activeSessionId === id) setActiveSessionId(null);
            }
        );
    };

    const handleRename = async () => {
        if (!activeSession || !tempTitle.trim()) {
            setTempTitle(activeSession?.title || '');
            setIsEditingTitle(false);
            return;
        }
        await handleUpdateSession({ ...activeSession, title: tempTitle.trim(), updatedAt: Date.now() });
        setIsEditingTitle(false);
    };

    const handleCopyActiveTurn = () => {
        if (currentTurn?.text) {
            navigator.clipboard.writeText(currentTurn.text);
            setTurnCopied(true);
            setTimeout(() => setTurnCopied(false), 2000);
        }
    };

    const handleCopyFullTranscript = () => {
        if (!activeSession) return;
        const transcript = activeSession.messages.map(m => {
            const label = m.role === 'user' ? '### USER REQUEST' : `### AGENT [${m.persona}]`;
            return `${label}\n\n${m.text}\n\n---\n`;
        }).join('\n');

        navigator.clipboard.writeText(transcript);
        setCopyAllStatus(true);
        setTimeout(() => setCopyAllStatus(false), 2000);
    };

    const handleGenerateProjectPlan = async () => {
        if (!activeSession || !planVenue || !planDeadline || isGeneratingPlan) return;
        
        setIsGeneratingPlan(true);
        try {
            const result = await generateProjectPlan(
                activeSession.messages,
                planVenue,
                planDeadline,
                planConstraints,
                activeSession.plannerModelId,
                activeSession.plannerPrompt,
                activeSession.useSearchPlanner,
                activeSession.relatedWorks
            );

            const planMsg: IdeationMessage = {
                id: crypto.randomUUID(),
                role: 'model',
                persona: 'PLANNER',
                text: `# PROJECT EXECUTION PLAN: ${planVenue}\n\n${result.text}`,
                thinking: result.thinking,
                timestamp: Date.now()
            };

            const updatedMessages = [...activeSession.messages, planMsg];
            await handleUpdateSession({ ...activeSession, messages: updatedMessages, updatedAt: Date.now() });
            setIsPlanningOpen(false);
        } catch (e) {
            console.error(e);
            alert("Planning failed. Ensure your Gemini model supports search.");
        } finally {
            setIsGeneratingPlan(false);
        }
    };

    const handleExportToProject = async () => {
        if (!activeSession) return;
        
        triggerConfirm(
            "Export to Projects",
            "This will create a new research project in your library based on this dialectic session. Proceed?",
            async () => {
                const newProject: ResearchProject = {
                    id: crypto.randomUUID(),
                    title: activeSession.title,
                    description: `Synthesized from Dialectic Session: ${activeSession.title}`,
                    status: 'active',
                    deadline: planDeadline ? new Date(planDeadline).getTime() : undefined,
                    tasks: [],
                    logs: [],
                    literature: [],
                    meetings: [],
                    outreach: [],
                    team: [],
                    paperOutline: activeSession.messages.find(m => m.persona === 'SYNTHESIZER')?.text || '',
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                };
                await dbService.set('projects', newProject);
                window.location.reload(); 
            }
        );
    };

    const handleSendMessage = async () => {
        if (!input.trim() || !activeSession || isStreaming) return;

        const userMsg: IdeationMessage = {
            id: crypto.randomUUID(),
            role: 'user',
            text: input.trim(),
            timestamp: Date.now()
        };

        let updatedMessages = [...activeSession.messages, userMsg];
        let runningSession = {
            ...activeSession,
            messages: updatedMessages,
            updatedAt: Date.now(),
            title: activeSession.messages.length === 0 && activeSession.title === 'New Brainstorm' 
                ? input.trim().substring(0, 30) + (input.length > 30 ? '...' : '') 
                : activeSession.title
        };

        setInput('');
        await handleUpdateSession(runningSession);
        setIsStreaming(true);
        setCurrentTurnIndex(1); 

        try {
            const isDynamic = runningSession.useDynamicTermination;
            const isUncapped = runningSession.isUncapped;
            const maxCycles = isDynamic ? (isUncapped ? 50 : runningSession.maxRounds || 5) : runningSession.rounds;
            let currentCycle = 0;
            let isAccepted = false;

            while (currentCycle < maxCycles && !isAccepted) {
                setCurrentTurn({ persona: 'IDEATOR', text: '', thinking: '' });
                const ideatorRes = await streamSingleTurn(
                    updatedMessages,
                    runningSession.ideatorModelId,
                    'IDEATOR',
                    (text, thinking) => setCurrentTurn({ persona: 'IDEATOR', text, thinking }),
                    runningSession.ideatorPrompt,
                    runningSession.useSearchIdeator,
                    runningSession.relatedWorks
                );
                const ideatorMsg: IdeationMessage = {
                    id: crypto.randomUUID(),
                    role: 'model',
                    persona: 'IDEATOR',
                    text: ideatorRes.text,
                    thinking: ideatorRes.thinking,
                    timestamp: Date.now()
                };
                updatedMessages = [...updatedMessages, ideatorMsg];
                runningSession = { ...runningSession, messages: updatedMessages, updatedAt: Date.now() };
                await handleUpdateSession(runningSession);
                setCurrentTurnIndex(prev => prev + 1);

                setCurrentTurn({ persona: 'CRITIC', text: '', thinking: '' });
                const criticRes = await streamSingleTurn(
                    updatedMessages,
                    runningSession.criticModelId,
                    'CRITIC',
                    (text, thinking) => setCurrentTurn({ persona: 'CRITIC', text, thinking }),
                    runningSession.criticPrompt,
                    runningSession.useSearchCritic,
                    runningSession.relatedWorks
                );
                
                if (isDynamic && criticRes.text.includes('[ACCEPTED]')) {
                    isAccepted = true;
                }

                const criticMsg: IdeationMessage = {
                    id: crypto.randomUUID(),
                    role: 'model',
                    persona: 'CRITIC',
                    text: criticRes.text,
                    thinking: criticRes.thinking,
                    timestamp: Date.now()
                };
                updatedMessages = [...updatedMessages, criticMsg];
                runningSession = { ...runningSession, messages: updatedMessages, updatedAt: Date.now() };
                await handleUpdateSession(runningSession);
                setCurrentTurnIndex(prev => prev + 1);
                currentCycle++;
            }

            setCurrentTurn({ persona: 'SYNTHESIZER', text: '', thinking: '' });
            const syncRes = await streamSingleTurn(
                updatedMessages,
                runningSession.synthesizerModelId,
                'SYNTHESIZER',
                (text, thinking) => setCurrentTurn({ persona: 'SYNTHESIZER', text, thinking }),
                runningSession.synthesizerPrompt,
                runningSession.useSearchSynthesizer,
                runningSession.relatedWorks
            );
            const syncMsg: IdeationMessage = {
                id: crypto.randomUUID(),
                role: 'model',
                persona: 'SYNTHESIZER',
                text: syncRes.text,
                thinking: syncRes.thinking,
                timestamp: Date.now()
            };
            updatedMessages = [...updatedMessages, syncMsg];
            runningSession = { ...runningSession, messages: updatedMessages, updatedAt: Date.now() };
            await handleUpdateSession(runningSession);

        } catch (e) {
            console.error(e);
        } finally {
            setIsStreaming(false);
            setCurrentTurn(null);
            setCurrentTurnIndex(0);
        }
    };

    const hasSynthesis = useMemo(() => 
        activeSession?.messages.some(m => m.persona === 'SYNTHESIZER'),
    [activeSession]);

    return (
        <div className="flex h-full bg-slate-900 overflow-hidden">
            <div className={`bg-slate-950 border-r border-slate-800 flex flex-col shrink-0 transition-[width] duration-300 ease-in-out ${!isLeftSidebarOpen ? 'w-0 overflow-hidden border-r-0' : 'w-64'}`}>
                <div className="p-4 border-b border-slate-800 flex items-center gap-3">
                    <button onClick={onToggleLeftSidebar} className="p-1.5 rounded hover:bg-slate-800 text-slate-400 transition-colors">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" /></svg>
                    </button>
                    <h2 className="font-bold text-white text-xs uppercase tracking-widest truncate">Brainstorms</h2>
                </div>
                <div className="p-3">
                    <button onClick={handleCreateSession} className="w-full py-2 bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/40 rounded-lg text-xs font-bold transition-all border border-indigo-500/20">+ New Research Goal</button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                    {sessions.map(s => (
                        <div key={s.id} onClick={() => setActiveSessionId(s.id)} className={`group relative p-2.5 rounded-lg cursor-pointer transition-all border ${activeSessionId === s.id ? 'bg-slate-800 border-indigo-500/30' : 'hover:bg-slate-800/40 border-transparent'}`}>
                            <div className={`text-xs font-medium truncate pr-6 ${activeSessionId === s.id ? 'text-white' : 'text-slate-400'}`}>{s.title}</div>
                            <div className="text-[10px] text-slate-600 mt-1">{new Date(s.updatedAt).toLocaleDateString()}</div>
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteSession(s.id); }} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-opacity">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex-1 flex flex-col bg-slate-900 relative">
                <div className="h-14 bg-slate-950 border-b border-slate-800 flex items-center justify-between px-4 shrink-0 z-20">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        {!isLeftSidebarOpen && (
                            <button onClick={onToggleLeftSidebar} className="p-1.5 rounded hover:bg-slate-800 text-indigo-400 transition-colors shrink-0">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" /></svg>
                            </button>
                        )}
                        {activeSession && (
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                {isEditingTitle ? (
                                    <input autoFocus value={tempTitle} onChange={e => setTempTitle(e.target.value)} onBlur={handleRename} onKeyDown={e => e.key === 'Enter' && handleRename()} className="bg-slate-900 border border-indigo-500/50 rounded px-2 py-1 text-sm font-bold text-white focus:outline-none w-full max-w-md" />
                                ) : (
                                    <div className="flex items-center gap-2 group cursor-pointer overflow-hidden" onClick={() => setIsEditingTitle(true)}>
                                        <h1 className="text-sm font-black text-white tracking-widest uppercase truncate">{activeSession.title}</h1>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-slate-600 group-hover:text-indigo-400 transition-colors shrink-0" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {activeSession && (
                            <>
                                <button 
                                    onClick={() => setIsRelatedWorksOpen(true)}
                                    className={`p-2 rounded-lg transition-all border shrink-0 ${activeSession?.relatedWorks ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300' : 'text-slate-500 hover:text-white border-transparent'}`}
                                    title="Edit Related Works / Context"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
                                    </svg>
                                </button>
                                <button 
                                    onClick={handleCopyFullTranscript}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all border ${copyAllStatus ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'}`}
                                >
                                    {copyAllStatus ? (
                                        <>
                                            <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                            Copied Transcript
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" /><path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" /></svg>
                                            Copy Transcript
                                        </>
                                    )}
                                </button>
                            </>
                        )}
                        <button onClick={() => setIsConfigOpen(!isConfigOpen)} className={`p-2 rounded-lg transition-all border shrink-0 ${isConfigOpen ? 'bg-slate-800 border-slate-700 text-indigo-400' : 'text-slate-500 hover:text-white border-transparent'}`} title="Toggle Agent Configuration">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" /></svg>
                        </button>
                    </div>
                </div>

                {!activeSession ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-600 p-8 text-center">
                        <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mb-4 text-indigo-500 shadow-xl border border-white/5"><svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg></div>
                        <h3 className="text-white font-bold text-lg mb-2 tracking-tight">Research Dialectic</h3>
                        <p className="text-sm max-w-xs leading-relaxed opacity-70">Begin a multi-agent debate to validate your innovations. Session history is maintained for context.</p>
                    </div>
                ) : (
                    <div className="flex-1 flex overflow-hidden">
                        <div className="flex-1 flex flex-col min-w-0">
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8" ref={scrollRef}>
                                <div className="max-w-3xl mx-auto space-y-8">
                                    {activeSession.messages.length === 0 && (
                                        <div className="text-center py-20 border border-dashed border-slate-800 rounded-3xl animate-in fade-in duration-1000">
                                            <div className="inline-flex items-center justify-center p-4 bg-indigo-500/10 rounded-2xl text-indigo-400 mb-6 shadow-2xl"><svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg></div>
                                            <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Propose a Research Hypothesis</h2>
                                            <p className="text-slate-500 text-sm max-w-md mx-auto leading-relaxed px-8">Your input triggers an agentic pipeline: an <span className="text-indigo-400">Ideator</span> proposes a technical path, a <span className="text-rose-400">Critic</span> peer-reviews it, and a <span className="text-amber-400">PI</span> synthesizes the final result.</p>
                                        </div>
                                    )}

                                    {activeSession.messages.map(msg => <MessageCard key={msg.id} msg={msg} />)}
                                    
                                    {isStreaming && (
                                        <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-200 group/active">
                                            <div className="relative max-w-[90%] rounded-2xl overflow-hidden bg-slate-800/60 border border-slate-700/50 text-slate-200 shadow-xl ring-1 ring-indigo-500/20">
                                                <div className={`px-4 py-1.5 text-[9px] font-black tracking-widest text-white uppercase flex justify-between items-center ${currentTurn?.persona === 'IDEATOR' ? 'bg-indigo-500' : currentTurn?.persona === 'CRITIC' ? 'bg-rose-500' : currentTurn?.persona === 'SYNTHESIZER' ? 'bg-amber-500' : 'bg-cyan-600'}`}>
                                                    <span className="flex items-center gap-2">
                                                        {currentTurn?.persona === 'SYNTHESIZER' ? 'FINAL PI SYNTHESIS' : currentTurn?.persona === 'PLANNER' ? 'MAPPING EXECUTION PLAN' : currentTurn?.persona || 'INITIALIZING'}
                                                        <div className="flex gap-1">
                                                            <div className="w-1 h-1 bg-white rounded-full animate-bounce"></div>
                                                            <div className="w-1 h-1 bg-white rounded-full animate-bounce delay-75"></div>
                                                            <div className="w-1 h-1 bg-white rounded-full animate-bounce delay-150"></div>
                                                        </div>
                                                    </span>
                                                </div>

                                                <button onClick={handleCopyActiveTurn} className="absolute top-8 right-3 z-10 p-1.5 bg-slate-900/80 border border-slate-700 rounded-lg text-slate-400 hover:text-white transition-all opacity-0 group-hover/active:opacity-100 flex items-center gap-1.5 backdrop-blur-sm" title="Copy Partial Content">
                                                    {turnCopied ? <svg className="w-3 h-3 text-emerald-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg> : <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" /><path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" /></svg>}
                                                    <span className="text-[9px] font-bold uppercase">{turnCopied ? 'Copied' : 'Markdown'}</span>
                                                </button>

                                                {currentTurn?.thinking && (
                                                    <div className="bg-slate-950/80 px-4 py-3 border-b border-slate-700/30">
                                                        <div className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-2 mb-2">
                                                            <div className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span></div>
                                                            Deep Reasoning In Progress...
                                                        </div>
                                                        <div className="text-xs text-slate-500 font-serif leading-relaxed italic opacity-80 pl-2 border-l border-indigo-500/20 whitespace-pre-wrap">{currentTurn.thinking}</div>
                                                    </div>
                                                )}
                                                <div className="p-5 prose prose-invert prose-sm max-w-none min-h-[3rem]"><div dangerouslySetInnerHTML={{ __html: parse(currentTurn?.text || '_Generating response..._') as string }} /></div>
                                            </div>
                                        </div>
                                    )}

                                    {!isStreaming && hasSynthesis && (
                                        <div className="pt-6 border-t border-slate-800 flex flex-col items-center gap-4 animate-in fade-in duration-700">
                                            <p className="text-xs text-slate-500 font-medium">Ready to take the next step?</p>
                                            <div className="flex gap-4">
                                                <button 
                                                    onClick={() => setIsPlanningOpen(true)}
                                                    className="flex items-center gap-2 px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl shadow-xl shadow-cyan-500/20 transition-all active:scale-95"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                                    Construct Project Plan
                                                </button>
                                                <button 
                                                    onClick={handleExportToProject}
                                                    className="flex items-center gap-2 px-6 py-3 bg-slate-800 border border-slate-700 hover:border-indigo-500 text-slate-300 hover:text-white font-black uppercase text-[10px] tracking-widest rounded-2xl shadow-xl transition-all active:scale-95"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                                    Export to Workspace
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="p-4 bg-slate-900 border-t border-slate-800 shrink-0">
                                <div className="max-w-3xl mx-auto space-y-4">
                                    <div className="flex justify-between items-end gap-4">
                                        <div className="flex-1 space-y-3 overflow-hidden">
                                            <div className="flex flex-col gap-1.5">
                                                <span className={`text-[10px] font-black uppercase tracking-widest px-1 flex items-center gap-2 ${isStreaming ? 'text-indigo-400' : 'text-slate-500'}`}>
                                                    {isStreaming && <div className="w-1 h-1 rounded-full bg-indigo-500 animate-ping"></div>}
                                                    {isStreaming ? 'Active Pipeline Execution' : 'Pipeline Sequence Preview'}
                                                </span>
                                                <PipelinePreview 
                                                    rounds={activeSession.rounds} 
                                                    isStreaming={isStreaming} 
                                                    currentTurnIndex={currentTurnIndex} 
                                                    useDynamicTermination={activeSession.useDynamicTermination} 
                                                    isUncapped={activeSession.isUncapped}
                                                    currentTurnPersona={currentTurn?.persona}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="relative group">
                                        <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }} disabled={isStreaming} placeholder={isStreaming ? "Agents are evaluating history..." : "Describe your core innovation or refinement..."} className="w-full bg-slate-800/80 backdrop-blur-sm border border-slate-700 rounded-2xl py-4 pl-5 pr-16 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all resize-none shadow-2xl min-h-[60px] max-h-[200px] custom-scrollbar disabled:opacity-50" rows={1} />
                                        <button onClick={handleSendMessage} disabled={!input.trim() || isStreaming} className="absolute right-3 bottom-3 p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg transition-all disabled:opacity-0 disabled:pointer-events-none active:scale-95"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg></button>
                                    </div>

                                    <div className="h-4 flex items-center justify-between px-2">
                                        <div className="flex items-center justify-between w-full opacity-60">
                                            <div className="text-[9px] text-slate-600 font-mono tracking-wider uppercase flex items-center gap-2"><span className={`w-1.5 h-1.5 rounded-full ${isStreaming ? 'bg-indigo-500' : 'bg-emerald-500/50'}`}></span>{isStreaming ? `Processing: ${currentTurn?.persona || 'Wait...'}` : `Engine Idle • ${activeSession.useDynamicTermination ? (activeSession.isUncapped ? 'Infinite Loop Mode' : 'Refine Mode') : activeSession.rounds + ' Loop Ready'}`}</div>
                                            <div className="text-[9px] text-slate-600 font-mono tracking-tighter">Markdown & Persistence Supported</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className={`bg-slate-950 border-l border-slate-800 p-4 space-y-6 shrink-0 transition-[width] duration-300 ease-in-out overflow-y-auto overflow-x-hidden custom-scrollbar ${!isConfigOpen ? 'w-0 border-l-0 p-0' : 'w-96'}`}>
                            <div className="w-full">
                                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>Agent Setup</h3>
                                <div className="space-y-6">
                                    <div><div className="flex items-center justify-between mb-2"><div className="flex items-center gap-2"><label className="block text-[10px] font-black text-indigo-400 uppercase tracking-wider">Ideator Agent</label><button onClick={() => handleUpdateSession({...activeSession, useSearchIdeator: !activeSession.useSearchIdeator})} className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase transition-all flex items-center gap-1 ${activeSession.useSearchIdeator ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-800 text-slate-500 border border-slate-700'}`} title="Toggle Google Search grounding"><svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>Search</button></div><button onClick={() => setEditingPromptType('IDEATOR')} className="text-[9px] font-bold text-indigo-500 hover:text-indigo-400 transition-colors uppercase">Edit Prompt</button></div><select value={activeSession.ideatorModelId} onChange={e => handleUpdateSession({...activeSession, ideatorModelId: e.target.value})} disabled={isStreaming} className="w-full bg-slate-900 border border-slate-800 text-xs text-slate-300 rounded-lg px-2 py-2.5 focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50">{MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
                                    <div><div className="flex items-center justify-between mb-2"><div className="flex items-center gap-2"><label className="block text-[10px] font-black text-rose-400 uppercase tracking-wider">Critic Agent</label><button onClick={() => handleUpdateSession({...activeSession, useSearchCritic: !activeSession.useSearchCritic})} className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase transition-all flex items-center gap-1 ${activeSession.useSearchCritic ? 'bg-rose-600 text-white shadow-lg shadow-rose-500/20' : 'bg-slate-800 text-slate-500 border border-slate-700'}`} title="Toggle Google Search grounding"><svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>Search</button></div><button onClick={() => setEditingPromptType('CRITIC')} className="text-[9px] font-bold text-rose-500 hover:text-rose-400 transition-colors uppercase">Edit Prompt</button></div><select value={activeSession.criticModelId} onChange={e => handleUpdateSession({...activeSession, criticModelId: e.target.value})} disabled={isStreaming} className="w-full bg-slate-900 border border-slate-800 text-xs text-slate-300 rounded-lg px-2 py-2.5 focus:outline-none focus:border-rose-500 transition-colors disabled:opacity-50">{MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
                                    <div><div className="flex items-center justify-between mb-2"><div className="flex items-center gap-2"><label className="block text-[10px] font-black text-amber-400 uppercase tracking-wider">Synthesis (PI)</label><button onClick={() => handleUpdateSession({...activeSession, useSearchSynthesizer: !activeSession.useSearchSynthesizer})} className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase transition-all flex items-center gap-1 ${activeSession.useSearchSynthesizer ? 'bg-amber-600 text-white shadow-lg shadow-amber-500/20' : 'bg-slate-800 text-slate-500 border border-slate-700'}`} title="Toggle Google Search grounding"><svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>Search</button></div><button onClick={() => setEditingPromptType('SYNTHESIZER')} className="text-[9px] font-bold text-amber-500 hover:text-amber-400 transition-colors uppercase">Edit Prompt</button></div><select value={activeSession.synthesizerModelId} onChange={e => handleUpdateSession({...activeSession, synthesizerModelId: e.target.value})} disabled={isStreaming} className="w-full bg-slate-900 border border-slate-800 text-xs text-slate-300 rounded-lg px-2 py-2.5 focus:outline-none focus:border-amber-500 transition-colors disabled:opacity-50">{MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
                                    <div><div className="flex items-center justify-between mb-2"><div className="flex items-center gap-2"><label className="block text-[10px] font-black text-cyan-400 uppercase tracking-wider">Planner (Final Step)</label><button onClick={() => handleUpdateSession({...activeSession, useSearchPlanner: !activeSession.useSearchPlanner})} className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase transition-all flex items-center gap-1 ${activeSession.useSearchPlanner ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/20' : 'bg-slate-800 text-slate-500 border border-slate-700'}`} title="Toggle Google Search grounding"><svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>Search</button></div><button onClick={() => setEditingPromptType('PLANNER')} className="text-[9px] font-bold text-cyan-500 hover:text-cyan-400 transition-colors uppercase">Edit Prompt</button></div><select value={activeSession.plannerModelId} onChange={e => handleUpdateSession({...activeSession, plannerModelId: e.target.value})} disabled={isStreaming} className="w-full bg-slate-900 border border-slate-800 text-xs text-slate-300 rounded-lg px-2 py-2.5 focus:outline-none focus:border-cyan-500 transition-colors disabled:opacity-50">{MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
                                    
                                    <div className="pt-2 space-y-4">
                                        <div className="flex items-center justify-between"><label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Termination Strategy</label><button onClick={() => handleUpdateSession({...activeSession, useDynamicTermination: !activeSession.useDynamicTermination})} className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${activeSession.useDynamicTermination ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}>{activeSession.useDynamicTermination ? 'Loop Until Accepted' : 'Fixed Rounds'}</button></div>
                                        {!activeSession.useDynamicTermination ? (
                                            <div className="animate-in fade-in slide-in-from-top-1"><div className="flex justify-between items-center mb-3"><label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">Dialectic Cycles</label><span className="text-[10px] font-mono font-bold text-white bg-indigo-600 px-2 py-0.5 rounded-full">{activeSession.rounds} Rounds</span></div><input type="range" min="1" max="5" step="1" value={activeSession.rounds} onChange={e => handleUpdateSession({...activeSession, rounds: parseInt(e.target.value)})} disabled={isStreaming} className="w-full accent-indigo-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer disabled:opacity-50" /></div>
                                        ) : (
                                            <div className="animate-in fade-in slide-in-from-bottom-1 space-y-3"><div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl"><p className="text-[10px] text-indigo-200/70 leading-relaxed italic">Critic will signal <strong>[REVISION_REQUIRED]</strong> or <strong>[ACCEPTED]</strong>.</p></div><div className="flex items-center justify-between px-1"><div className="flex items-center gap-2"><svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-amber-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM11 2a1 1 0 011 1v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0V6h-1a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1h-1a1 1 0 110-2h1v-1a1 1 0 011-1z" clipRule="evenodd" /></svg><label className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Essentially Infinite Loop</label></div><button onClick={() => handleUpdateSession({...activeSession, isUncapped: !activeSession.isUncapped})} className={`w-8 h-4 rounded-full transition-all relative ${activeSession.isUncapped ? 'bg-indigo-600' : 'bg-slate-700'}`}><div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${activeSession.isUncapped ? 'left-4.5' : 'left-0.5'}`} /></button></div>{!activeSession.isUncapped && (<div className="animate-in fade-in"><div className="flex justify-between items-center mb-1"><label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">Safety Cap</label><span className="text-[10px] font-mono font-bold text-slate-400">{activeSession.maxRounds || 5} Max</span></div><input type="range" min="3" max="15" step="1" value={activeSession.maxRounds || 5} onChange={e => handleUpdateSession({...activeSession, maxRounds: parseInt(e.target.value)})} disabled={isStreaming} className="w-full accent-indigo-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer disabled:opacity-50" /></div>)}</div>
                                        )}
                                    </div>
                                </div>
                                <div className="pt-8 border-t border-slate-800 space-y-4">
                                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2">Agent Persona Presets</h4>
                                    <div className="space-y-2">
                                        <button onClick={() => setEditingPromptType('IDEATOR')} className="w-full flex items-center justify-between p-3 bg-slate-900/50 rounded-xl border border-slate-800 hover:border-indigo-500/30 transition-all text-left group"><span className="text-[10px] font-bold text-slate-400 uppercase group-hover:text-indigo-400">Ideator Prompt</span><svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg></button>
                                        <button onClick={() => setEditingPromptType('CRITIC')} className="w-full flex items-center justify-between p-3 bg-slate-900/50 rounded-xl border border-slate-800 hover:border-rose-500/30 transition-all text-left group"><span className="text-[10px] font-bold text-slate-400 uppercase group-hover:text-rose-400">Critic Prompt</span><svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg></button>
                                        <button onClick={() => setEditingPromptType('SYNTHESIZER')} className="w-full flex items-center justify-between p-3 bg-slate-900/50 rounded-xl border border-slate-800 hover:border-amber-500/30 transition-all text-left group"><span className="text-[10px] font-bold text-slate-400 uppercase group-hover:text-amber-400">PI Prompt</span><svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg></button>
                                        <button onClick={() => setEditingPromptType('PLANNER')} className="w-full flex items-center justify-between p-3 bg-slate-900/50 rounded-xl border border-slate-800 hover:border-cyan-500/30 transition-all text-left group"><span className="text-[10px] font-bold text-slate-400 uppercase group-hover:text-cyan-400">Planner Prompt</span><svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg></button>
                                    </div>
                                    <button onClick={() => handleUpdateSession({...activeSession, ideatorPrompt: DEFAULT_IDEATOR_PROMPT, criticPrompt: DEFAULT_CRITIC_PROMPT, synthesizerPrompt: DEFAULT_SYNTHESIZER_PROMPT, plannerPrompt: DEFAULT_PLANNER_PROMPT, useSearchIdeator: false, useSearchCritic: false, useSearchSynthesizer: false, useSearchPlanner: true, useDynamicTermination: false, isUncapped: false, maxRounds: 5})} className="w-full py-2.5 text-[9px] font-black text-slate-600 border border-slate-800 rounded-xl hover:bg-slate-800 hover:text-slate-400 transition-all uppercase tracking-widest">Restore Personas</button>
                                </div>
                                <div className="mt-8 p-4 bg-indigo-500/5 rounded-2xl border border-indigo-500/10">
                                    <p className="text-[9px] text-indigo-200/40 leading-relaxed italic text-center">Engine automatically constructs full dialectic context from your turn history.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Planning Modal */}
            {isPlanningOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200" onClick={() => setIsPlanningOpen(false)}>
                    <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="px-8 py-6 border-b border-slate-800 bg-slate-900/50">
                            <h3 className="text-xl font-bold text-white tracking-tight">Project Planning Strategy</h3>
                            <p className="text-xs text-slate-500 mt-1">Ground your research into a real-world execution timeline.</p>
                        </div>
                        <div className="p-8 space-y-6">
                            <div>
                                <label className="block text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-2">Target Venue</label>
                                <input 
                                    autoFocus
                                    value={planVenue}
                                    onChange={e => setPlanVenue(e.target.value)}
                                    placeholder="e.g. NeurIPS 2025, ICML, Nature Machine Intelligence"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500/50 transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-2">Submission Deadline</label>
                                <input 
                                    type="date"
                                    value={planDeadline}
                                    onChange={e => setPlanDeadline(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500/50 transition-all [&::-webkit-calendar-picker-indicator]:invert"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-2">Additional Constraints</label>
                                <textarea 
                                    value={planConstraints}
                                    onChange={e => setPlanConstraints(e.target.value)}
                                    placeholder="e.g. Limited compute (1x RTX 4090), must be interpretable, using specific baseline X..."
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500/50 transition-all h-24 resize-none custom-scrollbar"
                                />
                            </div>
                        </div>
                        <div className="px-8 py-6 bg-slate-950/50 border-t border-slate-800 flex justify-end gap-4">
                            <button onClick={() => setIsPlanningOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors">Cancel</button>
                            <button 
                                onClick={handleGenerateProjectPlan}
                                disabled={!planVenue || !planDeadline || isGeneratingPlan}
                                className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
                            >
                                {isGeneratingPlan ? (
                                    <>
                                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" className="opacity-25"/><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75"/></svg>
                                        Mapping Strategy...
                                    </>
                                ) : 'Generate Execution Plan'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Related Works Modal */}
            {isRelatedWorksOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200" onClick={() => setIsRelatedWorksOpen(false)}>
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl h-[70vh] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
                            <div>
                                <h3 className="text-lg font-bold text-white tracking-tight">Related Works & Context</h3>
                                <p className="text-xs text-slate-500 mt-0.5">Provide existing papers or background info to ground the AI's reasoning.</p>
                            </div>
                            <button onClick={() => setIsRelatedWorksOpen(false)} className="p-1 rounded-full hover:bg-slate-800 text-slate-500 hover:text-white transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="flex-1 p-0">
                            <textarea 
                                autoFocus
                                value={localRelatedWorks}
                                onChange={e => setLocalRelatedWorks(e.target.value)}
                                placeholder="Paste abstracts, list key papers, or describe technical constraints here...&#10;&#10;Example:&#10;- Paper A uses method X but fails at Y.&#10;- We want to avoid using heavy CNNs.&#10;- Baseline Z is the current SOTA."
                                className="w-full h-full bg-slate-950/50 p-6 text-sm text-slate-300 font-mono focus:outline-none resize-none custom-scrollbar leading-relaxed"
                            />
                        </div>
                        <div className="px-6 py-4 bg-slate-950/50 border-t border-slate-800 flex justify-end gap-3">
                            <button onClick={() => setIsRelatedWorksOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors">Cancel</button>
                            <button onClick={handleSaveRelatedWorks} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all">Save Context</button>
                        </div>
                    </div>
                </div>
            )}

            <PromptModal 
                type={editingPromptType} 
                session={activeSession} 
                templates={promptTemplates}
                onUpdate={handleUpdateSession} 
                onSaveTemplate={handleSaveTemplate}
                onDeleteTemplate={handleDeleteTemplate}
                onClose={() => setEditingPromptType(null)} 
            />
        </div>
    );
};

export default IdeationView;
