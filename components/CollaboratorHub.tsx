
import React, { useState, useMemo, useEffect } from 'react';
import { ResearchProject, CollaboratorProfile, SelectionState } from '../types';
import { generateLorRequest } from '../services/geminiService';
import { parse } from 'marked';

interface CollaboratorHubProps {
  projects: ResearchProject[];
  profiles: CollaboratorProfile[];
  onUpdateProfile: (profile: CollaboratorProfile) => void;
  onSelectProject: (id: string) => void;
  isLeftSidebarOpen: boolean;
  onToggleLeftSidebar: () => void;
}

const LOR_FORM_DEFAULTS = {
    relation: '',
    duration: '',
    purpose: '',
    reason: '',
};

const CollaboratorHub: React.FC<CollaboratorHubProps> = ({ 
    projects, 
    profiles, 
    onUpdateProfile,
    onSelectProject,
    isLeftSidebarOpen,
    onToggleLeftSidebar
}) => {
    const [selectedName, setSelectedName] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // LOR Generator State
    const [lorForm, setLorForm] = useState(LOR_FORM_DEFAULTS);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedDraft, setGeneratedDraft] = useState<{ subject: string; body: string } | null>(null);
    
    // Notes State
    const [notesContent, setNotesContent] = useState('');
    const [isNotesPreview, setIsNotesPreview] = useState(false);

    const allCollaborators = useMemo(() => {
        const memberMap = new Map<string, { email?: string, affiliation?: string }>();
        projects.forEach(project => {
            (project.team || []).forEach(member => {
                if (!memberMap.has(member.name)) {
                    memberMap.set(member.name, { email: member.email, affiliation: member.affiliation });
                }
            });
        });
        return Array.from(memberMap.keys()).sort((a, b) => a.localeCompare(b));
    }, [projects]);
    
    const filteredCollaborators = useMemo(() => {
        if (!searchTerm) return allCollaborators;
        return allCollaborators.filter(name => name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [allCollaborators, searchTerm]);
    
    const selectedProfile = useMemo(() => {
        if (!selectedName) return null;
        return profiles.find(p => p.name === selectedName);
    }, [selectedName, profiles]);

    const sharedProjects = useMemo(() => {
        if (!selectedName) return [];
        return projects.filter(p => (p.team || []).some(m => m.name === selectedName));
    }, [selectedName, projects]);
    
    // Sync notes when selection changes
    useEffect(() => {
        setNotesContent(selectedProfile?.notes || '');
        setGeneratedDraft(null); // Clear draft when switching
        setLorForm(LOR_FORM_DEFAULTS); // Reset form
    }, [selectedName, selectedProfile]);

    // Auto-save debouncer for notes
    useEffect(() => {
        if (!selectedName) return;
        
        const slug = selectedName.toLowerCase().replace(/\s+/g, '-');
        const currentNotes = selectedProfile?.notes || '';

        const timer = setTimeout(() => {
            if (notesContent !== currentNotes) {
                onUpdateProfile({ 
                    id: slug,
                    name: selectedName,
                    notes: notesContent,
                });
            }
        }, 800);
        return () => clearTimeout(timer);
    }, [notesContent, selectedName, selectedProfile, onUpdateProfile]);

    const handleGenerateLor = async () => {
        if (!selectedName) return;
        setIsGenerating(true);
        setGeneratedDraft(null);
        try {
            const draft = await generateLorRequest(
                selectedName,
                lorForm.relation,
                lorForm.duration,
                lorForm.purpose,
                lorForm.reason,
                sharedProjects.map(p => p.title)
            );
            setGeneratedDraft(draft);
        } catch (e) {
            console.error(e);
            alert("Failed to generate LOR draft.");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="flex h-full bg-slate-900 overflow-hidden">
            {/* Left Sidebar: Collaborator List */}
            <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
                <div className="p-4 border-b border-slate-800 flex items-center gap-2">
                     <button 
                        type="button"
                        onClick={onToggleLeftSidebar}
                        className={`p-1.5 rounded hover:bg-slate-800 text-slate-400 transition-colors ${!isLeftSidebarOpen ? 'text-indigo-400' : ''}`}
                    >
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                        </svg>
                    </button>
                    <h2 className="font-bold text-white">Collaborators ({allCollaborators.length})</h2>
                </div>
                <div className="p-2 border-b border-slate-800">
                    <input 
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search..."
                        className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                    {filteredCollaborators.map(name => (
                        <button
                            key={name}
                            onClick={() => setSelectedName(name)}
                            className={`w-full text-left flex items-center gap-3 p-2 rounded-md transition-colors ${
                                selectedName === name 
                                ? 'bg-slate-800 text-white' 
                                : 'text-slate-400 hover:bg-slate-800/50'
                            }`}
                        >
                            <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold shrink-0">
                                {name.charAt(0)}
                            </div>
                            <span className="text-sm font-medium truncate">{name}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Right Pane: Details */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {!selectedName ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-600">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <p className="font-medium">Select a collaborator to see details</p>
                    </div>
                ) : (
                    <div className="max-w-4xl mx-auto p-8 space-y-8">
                        {/* Header */}
                        <div className="pb-6 border-b border-slate-800">
                            <h1 className="text-4xl font-extrabold text-white">{selectedName}</h1>
                        </div>

                        {/* Shared Projects */}
                        <div>
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Shared Projects ({sharedProjects.length})</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {sharedProjects.map(p => (
                                    <button 
                                        key={p.id} 
                                        onClick={() => onSelectProject(p.id)}
                                        className="p-3 bg-slate-800/50 border border-slate-700/50 rounded-lg text-left hover:border-cyan-500/30 transition-colors"
                                    >
                                        <h4 className="font-bold text-sm text-slate-200 truncate">{p.title}</h4>
                                        <p className="text-xs text-slate-500 truncate">{p.description}</p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Private Notes */}
                        <div className="flex flex-col h-[400px]">
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Private Notes</h3>
                                <button
                                    onClick={() => setIsNotesPreview(!isNotesPreview)}
                                    className="text-xs px-2 py-0.5 bg-slate-800 border border-slate-700 rounded hover:bg-slate-700"
                                >
                                    {isNotesPreview ? 'Edit' : 'Preview'}
                                </button>
                            </div>
                            <div className="flex-1 border border-slate-700 rounded-lg bg-slate-800/30 overflow-hidden relative">
                                {isNotesPreview ? (
                                    <div className="prose prose-sm prose-invert p-4 absolute inset-0 overflow-y-auto">
                                        <div dangerouslySetInnerHTML={{ __html: parse(notesContent || '*No notes yet...*') as string }}/>
                                    </div>
                                ) : (
                                    <textarea 
                                        value={notesContent}
                                        onChange={(e) => setNotesContent(e.target.value)}
                                        className="absolute inset-0 w-full h-full bg-transparent p-4 text-sm font-mono resize-none focus:outline-none"
                                        placeholder="Add private notes about this collaborator..."
                                    />
                                )}
                            </div>
                        </div>

                        {/* LOR Generator */}
                        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-purple-500/20 rounded-lg text-purple-400">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                                        <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-bold text-white">LOR Request Generator</h3>
                            </div>

                            <div className="space-y-4 mb-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-400 mb-1">Your Relation</label>
                                        <input type="text" value={lorForm.relation} onChange={e => setLorForm(f => ({...f, relation: e.target.value}))} placeholder="e.g., Mentee, Student" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500 placeholder:text-slate-500 transition-colors" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-400 mb-1">Duration of Work</label>
                                        <input type="text" value={lorForm.duration} onChange={e => setLorForm(f => ({...f, duration: e.target.value}))} placeholder="e.g., 2 years, Fall 2023" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500 placeholder:text-slate-500 transition-colors" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">Purpose of LOR</label>
                                    <input type="text" value={lorForm.purpose} onChange={e => setLorForm(f => ({...f, purpose: e.target.value}))} placeholder="e.g., PhD Applications" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500 placeholder:text-slate-500 transition-colors" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">Why ask them?</label>
                                    <textarea value={lorForm.reason} onChange={e => setLorForm(f => ({...f, reason: e.target.value}))} placeholder="e.g., They supervised my work on Project X and can speak to my research skills." className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500 placeholder:text-slate-500 transition-colors h-20 resize-none" />
                                </div>
                            </div>
                            
                            <button onClick={handleGenerateLor} disabled={isGenerating} className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20 transition-all">
                                {isGenerating && <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" className="opacity-25"/><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75"/></svg>}
                                Generate Draft
                            </button>

                            {generatedDraft && (
                                <div className="mt-8 border-t border-slate-700 pt-6 space-y-4 animate-in fade-in">
                                    <div className="flex justify-between items-center">
                                        <h4 className="text-sm font-bold text-slate-300">Generated Draft</h4>
                                        <button onClick={() => navigator.clipboard.writeText(`Subject: ${generatedDraft.subject}\n\n${generatedDraft.body}`)} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                                <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                                                <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                                            </svg>
                                            Copy to Clipboard
                                        </button>
                                    </div>
                                    <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 space-y-3">
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-xs font-bold text-slate-500 shrink-0">SUBJECT:</span>
                                            <p className="text-sm font-bold text-slate-200">{generatedDraft.subject}</p>
                                        </div>
                                        <div className="border-t border-slate-700/50" />
                                        <div className="prose prose-sm prose-invert max-w-none text-slate-300">
                                            <div dangerouslySetInnerHTML={{ __html: parse(generatedDraft.body) as string }}/>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CollaboratorHub;
