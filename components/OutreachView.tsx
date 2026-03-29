
import React, { useState, useEffect, useMemo } from 'react';
import { ColdEmail, UserContextProfile } from '../types';
import { generateColdEmailDraft, findUniversitiesAndProfs, findLabsAtUniversity } from '../services/geminiService';
import { parse } from 'marked';

interface OutreachViewProps {
  outreachList: ColdEmail[];
  userContextProfiles: UserContextProfile[];
  activeUserContextId: string | null;
  onUpdateOutreachList: (list: ColdEmail[]) => void;
  onUpdateUserContextProfiles: (profiles: UserContextProfile[]) => void;
  onSetActiveUserContextId: (id: string | null) => void;
  isLeftSidebarOpen: boolean;
  onToggleLeftSidebar: () => void;
}

const OutreachView: React.FC<OutreachViewProps> = ({ 
  outreachList, 
  userContextProfiles,
  activeUserContextId,
  onUpdateOutreachList, 
  onUpdateUserContextProfiles,
  onSetActiveUserContextId,
  isLeftSidebarOpen,
  onToggleLeftSidebar
}) => {
  const [viewMode, setViewMode] = useState<'manage' | 'discover'>('manage');
  
  // Manage Mode State
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [emailIntent, setEmailIntent] = useState<'collaboration' | 'feedback' | 'supervisor' | 'question'>('collaboration');
  const [isGeneratingEmail, setIsGeneratingEmail] = useState(false);
  const [deletingContactId, setDeletingContactId] = useState<string | null>(null);

  // Context Profile Management State
  const [isManagingProfiles, setIsManagingProfiles] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingContent, setEditingContent] = useState('');
  const [isProfilePreview, setIsProfilePreview] = useState(false);
  
  // Discover Mode State
  const [searchMode, setSearchMode] = useState<'global' | 'university'>('global');
  const [discoveryField, setDiscoveryField] = useState('');
  const [targetUniversity, setTargetUniversity] = useState('');
  const [discoveryResults, setDiscoveryResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const activeProfile = useMemo(() => 
    userContextProfiles.find(p => p.id === activeUserContextId)
  , [userContextProfiles, activeUserContextId]);

  const profileBeingEdited = useMemo(() => 
    userContextProfiles.find(p => p.id === editingProfileId)
  , [userContextProfiles, editingProfileId]);

  // Load selected profile into editor
  useEffect(() => {
    if (profileBeingEdited) {
      setEditingName(profileBeingEdited.name);
      setEditingContent(profileBeingEdited.content);
    } else {
      setEditingName('');
      setEditingContent('');
    }
  }, [editingProfileId, profileBeingEdited]);

  // Debounced auto-save for profile editor
  useEffect(() => {
    if (!editingProfileId || !profileBeingEdited) return;

    const handler = setTimeout(() => {
      if (editingName !== profileBeingEdited.name || editingContent !== profileBeingEdited.content) {
        onUpdateUserContextProfiles(
          userContextProfiles.map(p =>
            p.id === editingProfileId ? { ...p, name: editingName, content: editingContent } : p
          )
        );
      }
    }, 500);

    return () => {
      clearTimeout(handler);
    };
  }, [editingName, editingContent, editingProfileId, profileBeingEdited, onUpdateUserContextProfiles]);


  const handleAddContact = (name: string = 'New Contact', affiliation: string = '', email: string = '') => {
      const newEmail: ColdEmail = {
          id: crypto.randomUUID(),
          recipientName: String(name || 'New Contact'),
          recipientEmail: String(email || ''),
          affiliation: String(affiliation || ''),
          status: 'draft',
          subject: '',
          body: '',
          lastUpdated: Date.now(),
          notes: ''
      };
      onUpdateOutreachList([newEmail, ...outreachList]);
      setSelectedEmailId(newEmail.id);
      setViewMode('manage'); // Switch to manage mode to start drafting
  };

  const updateContact = (id: string, updates: Partial<ColdEmail>) => {
      const updated = outreachList.map(e => 
          e.id === id ? { ...e, ...updates, lastUpdated: Date.now() } : e
      );
      onUpdateOutreachList(updated);
  };

  const confirmDeleteContact = () => {
      if (deletingContactId) {
          onUpdateOutreachList(outreachList.filter(e => e.id !== deletingContactId));
          if (selectedEmailId === deletingContactId) setSelectedEmailId(null);
          setDeletingContactId(null);
      }
  };
  
  const handleGenerateEmail = async (email: ColdEmail) => {
      if (!activeProfile?.content.trim()) {
          alert("Please select or create a context profile first.");
          return;
      }
      if (!email.recipientName) {
          alert("Please enter a recipient name.");
          return;
      }
      
      setIsGeneratingEmail(true);
      try {
          const draft = await generateColdEmailDraft(
              "General Research Inquiry",
              activeProfile.content,
              email.recipientName,
              email.affiliation,
              emailIntent,
              email.notes // Pass notes (containing bio if added from Author View) to AI
          );
          
          updateContact(email.id, {
              subject: draft.subject,
              body: draft.body,
              status: 'draft'
          });
      } catch (e) {
          console.error(e);
          alert("Failed to generate draft.");
      } finally {
          setIsGeneratingEmail(false);
      }
  };

  const handleNewProfile = () => {
    const newProfile: UserContextProfile = {
      id: crypto.randomUUID(),
      name: 'New Profile',
      content: ''
    };
    onUpdateUserContextProfiles([...userContextProfiles, newProfile]);
    setEditingProfileId(newProfile.id);
  };
  
  const handleDeleteProfile = (idToDelete: string) => {
    if (confirm(`Are you sure you want to delete this profile?`)) {
      onUpdateUserContextProfiles(userContextProfiles.filter(p => p.id !== idToDelete));
      if (editingProfileId === idToDelete) {
        setEditingProfileId(null);
      }
      if (activeUserContextId === idToDelete) {
        onSetActiveUserContextId(null);
      }
    }
  };

  const handleSearch = async () => {
      if (!discoveryField.trim()) return;
      if (searchMode === 'university' && !targetUniversity.trim()) return;

      setIsSearching(true);
      setDiscoveryResults([]);
      try {
          let results;
          if (searchMode === 'global') {
              results = await findUniversitiesAndProfs(discoveryField);
          } else {
              results = await findLabsAtUniversity(targetUniversity, discoveryField);
          }
          setDiscoveryResults(results);
      } catch (e) {
          console.error(e);
          alert("Failed to fetch data. Please try again.");
      } finally {
          setIsSearching(false);
      }
  };

  const selectedContact = outreachList.find(e => e.id === selectedEmailId);

  const renderProfileManager = () => (
    <div className="flex-1 flex overflow-hidden">
        {/* Profile List */}
        <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                <h3 className="font-bold text-white text-sm">Context Profiles</h3>
                <button onClick={() => setIsManagingProfiles(false)} className="text-xs text-indigo-400 hover:text-white">Done</button>
            </div>
            <div className="p-2">
                <button onClick={handleNewProfile} className="w-full text-center py-2 bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/40 rounded-md text-sm font-medium transition-colors">
                    + New Profile
                </button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                {userContextProfiles.map(p => (
                    <div key={p.id} onClick={() => setEditingProfileId(p.id)} className={`group/item flex justify-between items-center p-2 rounded-md cursor-pointer transition-colors ${editingProfileId === p.id ? 'bg-slate-800' : 'hover:bg-slate-800/50'}`}>
                        <span className={`text-sm truncate ${editingProfileId === p.id ? 'text-white font-semibold' : 'text-slate-400'}`}>{p.name}</span>
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteProfile(p.id); }} className="text-slate-600 hover:text-red-400 opacity-0 group-hover/item:opacity-100 p-1">
                            &times;
                        </button>
                    </div>
                ))}
            </div>
        </div>
        {/* Profile Editor */}
        <div className="flex-1 flex flex-col bg-slate-800/30 overflow-hidden">
            {editingProfileId ? (
                <>
                    <div className="p-4 border-b border-slate-700 space-y-2">
                        <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            placeholder="Profile Name"
                            className="w-full bg-transparent text-lg font-bold text-white focus:outline-none"
                        />
                        <div className="flex justify-end">
                            <button onClick={() => setIsProfilePreview(!isProfilePreview)} className="text-xs bg-slate-700 px-3 py-1 rounded hover:bg-slate-600">
                                {isProfilePreview ? 'Edit' : 'Preview'}
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 relative">
                        {isProfilePreview ? (
                            <div className="prose prose-sm prose-invert p-4 absolute inset-0 overflow-y-auto">
                                <div dangerouslySetInnerHTML={{ __html: parse(editingContent || '*No content*') as string }}/>
                            </div>
                        ) : (
                            <textarea
                                value={editingContent}
                                onChange={(e) => setEditingContent(e.target.value)}
                                placeholder="Write your context/bio here. Markdown is supported."
                                className="absolute inset-0 w-full h-full bg-transparent p-4 text-sm font-mono resize-none focus:outline-none"
                            />
                        )}
                    </div>
                </>
            ) : (
                <div className="h-full flex items-center justify-center text-slate-500">
                    Select a profile to edit, or create a new one.
                </div>
            )}
        </div>
    </div>
  );

  const renderOutreachManager = () => (
    <div className="flex flex-1 overflow-hidden">
        {/* Sidebar List */}
        <div className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
            <div className="p-4 border-b border-slate-800">
                <button 
                    onClick={() => handleAddContact()}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium text-sm transition-colors shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                    Add Contact
                </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                {outreachList.length === 0 && (
                    <div className="text-center py-10 text-slate-500 text-xs italic">
                        No contacts yet.
                    </div>
                )}
                {outreachList.map(contact => (
                    <div 
                        key={contact.id}
                        onClick={() => setSelectedEmailId(contact.id)}
                        className={`group/item p-3 rounded-lg cursor-pointer border transition-all relative ${
                            selectedEmailId === contact.id
                            ? 'bg-slate-800 border-indigo-500/50 shadow-md'
                            : 'bg-transparent border-transparent hover:bg-slate-800/50 text-slate-400'
                        }`}
                    >
                        <div className="flex justify-between items-start mb-1 pr-6">
                            <span className={`font-bold text-sm truncate pr-2 ${selectedEmailId === contact.id ? 'text-white' : 'text-slate-300'}`}>
                                {contact.recipientName}
                            </span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wide shrink-0 ${
                                contact.status === 'sent' ? 'bg-blue-500/20 text-blue-400' :
                                contact.status === 'replied' ? 'bg-emerald-500/20 text-emerald-400' :
                                contact.status === 'follow-up' ? 'bg-amber-500/20 text-amber-400' :
                                'bg-slate-700 text-slate-500'
                            }`}>
                                {contact.status}
                            </span>
                        </div>
                        <div className="text-xs text-slate-500 truncate">{contact.affiliation || 'No affiliation'}</div>
                        
                        <button 
                            onClick={(e) => { e.stopPropagation(); setDeletingContactId(contact.id); }}
                            className="absolute right-2 top-2 p-1 text-slate-600 hover:text-red-400 hover:bg-slate-700 rounded opacity-0 group-hover/item:opacity-100 transition-opacity"
                            title="Delete Contact"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                        </button>
                    </div>
                ))}
            </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col bg-slate-900 overflow-hidden relative">
            <div className="bg-slate-800/30 border-b border-slate-800 p-4 shrink-0 space-y-3">
                <div>
                    <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-2">
                        Active Context Profile
                    </h3>
                    <div className="flex items-center gap-2">
                        <select 
                            value={activeUserContextId || ''}
                            onChange={(e) => onSetActiveUserContextId(e.target.value || null)}
                            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                        >
                            <option value="">-- Select a Profile --</option>
                            {userContextProfiles.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                        <button onClick={() => setIsManagingProfiles(true)} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-xs font-bold rounded-lg transition-colors">Manage</button>
                    </div>
                </div>
            </div>
            {selectedContact ? (
                <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="p-6 pb-4 grid grid-cols-2 gap-6 border-b border-slate-800 bg-slate-900/50">
                        <div className="space-y-4">
                            <div className="group">
                                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Recipient Name</label>
                                <input type="text" value={selectedContact.recipientName} onChange={(e) => updateContact(selectedContact.id, { recipientName: e.target.value })} className="w-full bg-transparent border-b border-slate-700 py-1 text-base text-white focus:border-indigo-500 outline-none transition-colors" placeholder="e.g. Dr. Jane Doe" />
                            </div>
                            <div className="group">
                                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Affiliation / Role</label>
                                <input type="text" value={selectedContact.affiliation} onChange={(e) => updateContact(selectedContact.id, { affiliation: e.target.value })} className="w-full bg-transparent border-b border-slate-700 py-1 text-sm text-slate-300 focus:border-indigo-500 outline-none transition-colors" placeholder="e.g. Professor at MIT" />
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div className="group">
                                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Email Address</label>
                                <input type="email" value={selectedContact.recipientEmail} onChange={(e) => updateContact(selectedContact.id, { recipientEmail: e.target.value })} className="w-full bg-transparent border-b border-slate-700 py-1 text-sm text-white focus:border-indigo-500 outline-none transition-colors" placeholder="jane.doe@mit.edu"/>
                            </div>
                            <div className="flex items-center gap-4 pt-2">
                                <div className="flex-1">
                                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Status</label>
                                    <select value={selectedContact.status} onChange={(e) => updateContact(selectedContact.id, { status: e.target.value as any })} className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-300 focus:outline-none">
                                        <option value="draft">Draft</option>
                                        <option value="sent">Sent</option>
                                        <option value="replied">Replied</option>
                                        <option value="follow-up">Needs Follow-up</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="col-span-2 mt-2">
                             <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Notes / Bio (Context)</label>
                             <textarea value={selectedContact.notes} onChange={(e) => updateContact(selectedContact.id, { notes: e.target.value })} className="w-full bg-slate-900/50 border border-slate-700/50 rounded px-2 py-1.5 text-xs text-slate-300 focus:outline-none resize-none h-20 custom-scrollbar" placeholder="Add notes about their research, specific papers, or paste their bio here..." />
                        </div>
                    </div>

                    <div className="px-6 py-3 bg-indigo-900/10 border-b border-indigo-500/20 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-3">
                            <span className="text-xs font-bold text-indigo-300 uppercase tracking-wide">Generate Draft:</span>
                            <select value={emailIntent} onChange={(e) => setEmailIntent(e.target.value as any)} className="bg-slate-900 border border-indigo-500/30 text-xs text-slate-300 rounded px-2 py-1 focus:outline-none min-w-[180px]">
                                <option value="collaboration">Propose Collaboration</option>
                                <option value="feedback">Ask for Feedback</option>
                                <option value="supervisor">Prospective Student Inquiry</option>
                                <option value="question">Question about Paper</option>
                            </select>
                        </div>
                        <button onClick={() => handleGenerateEmail(selectedContact)} disabled={isGeneratingEmail} className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded shadow-lg transition-all disabled:opacity-50">
                            {isGeneratingEmail ? (<svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>) : (<svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z" clipRule="evenodd" /></svg>)}
                            Auto-Draft
                        </button>
                    </div>

                    <div className="flex-1 flex flex-col p-6 gap-4 overflow-y-auto custom-scrollbar">
                        <input type="text" value={selectedContact.subject} onChange={(e) => updateContact(selectedContact.id, { subject: e.target.value })} placeholder="Subject Line" className="w-full bg-transparent border-b border-slate-700 pb-2 text-lg font-bold text-white focus:border-indigo-500 focus:outline-none placeholder:font-normal placeholder:text-slate-600" />
                        <textarea value={selectedContact.body} onChange={(e) => updateContact(selectedContact.id, { body: e.target.value })} placeholder="Compose your email here... (Markdown is supported)" className="flex-1 w-full bg-transparent text-sm text-slate-300 leading-relaxed focus:outline-none resize-none font-mono" />
                    </div>

                    <div className="p-4 border-t border-slate-800 bg-slate-900 flex justify-between items-center shrink-0">
                        <button onClick={() => setDeletingContactId(selectedContact.id)} className="text-slate-500 hover:text-red-400 text-xs px-2 py-1 rounded hover:bg-slate-800 transition-colors">
                            Delete Contact
                        </button>
                        <div className="flex gap-3">
                            <a href={`mailto:${selectedContact.recipientEmail}?subject=${encodeURIComponent(selectedContact.subject)}&body=${encodeURIComponent(selectedContact.body)}`} target="_blank" onClick={() => updateContact(selectedContact.id, { status: 'sent' })} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-lg shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" /><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" /></svg>
                                Open Mail App
                            </a>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-600">
                    <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    </div>
                    <p className="text-sm font-medium">Select a contact to start outreach</p>
                    <p className="text-xs mt-2 max-w-xs text-center opacity-70">
                        Add contacts on the left, set your bio context, and let AI help you draft the perfect email.
                    </p>
                </div>
            )}
        </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-slate-900 overflow-hidden relative">
      <div className="bg-slate-950 border-b border-slate-800 flex items-center justify-between px-4 h-14 shrink-0 z-10">
         <div className="flex items-center gap-3">
            <button type="button" onClick={onToggleLeftSidebar} className={`p-1.5 rounded hover:bg-slate-800 text-slate-400 transition-colors ${!isLeftSidebarOpen ? 'text-indigo-400' : ''}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" /></svg>
            </button>
            <h1 className="text-xl font-bold text-white tracking-tight">Outreach Manager</h1>
         </div>
         
         <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800">
             <button onClick={() => setViewMode('manage')} className={`px-4 py-1 text-xs font-bold rounded-md transition-all ${viewMode === 'manage' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>
                 Manage List
             </button>
             <button onClick={() => setViewMode('discover')} className={`px-4 py-1 text-xs font-bold rounded-md transition-all ${viewMode === 'discover' ? 'bg-fuchsia-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>
                 Find Labs (CS Rankings)
             </button>
         </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
          {viewMode === 'manage' ? (
              isManagingProfiles ? renderProfileManager() : renderOutreachManager()
          ) : (
              // DISCOVERY VIEW
              <div className="flex-1 flex flex-col bg-slate-900 overflow-hidden relative p-8">
                  <div className="max-w-4xl mx-auto w-full flex flex-col h-full">
                      <div className="text-center mb-8">
                          <h2 className="text-3xl font-extrabold text-white mb-2 tracking-tight">Discover Top Labs</h2>
                          <p className="text-slate-400 text-sm">Find leading universities and professors in your field using Google Search & Gemini.</p>
                      </div>

                      <div className="flex flex-col items-center gap-4 mb-8">
                          {/* Search Mode Toggle */}
                          <div className="flex bg-slate-800 p-1 rounded-full border border-slate-700">
                              <button onClick={() => setSearchMode('global')} className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all ${searchMode === 'global' ? 'bg-fuchsia-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}>
                                  Global Rankings
                              </button>
                              <button onClick={() => setSearchMode('university')} className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all ${searchMode === 'university' ? 'bg-fuchsia-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}>
                                  Search University
                              </button>
                          </div>

                          <div className="flex w-full max-w-lg gap-2">
                              {searchMode === 'university' && (
                                  <input type="text" value={targetUniversity} onChange={(e) => setTargetUniversity(e.target.value)} placeholder="University Name (e.g. MIT)" className="w-1/3 bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-fuchsia-500 transition-all text-sm" />
                              )}
                              <div className="relative flex-1">
                                  <input type="text" value={discoveryField} onChange={(e) => setDiscoveryField(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} placeholder="Research Domain (e.g. Computer Vision)" className="w-full bg-slate-800 border border-slate-700 rounded-lg py-3 pl-4 pr-12 text-white focus:outline-none focus:border-fuchsia-500 transition-all text-sm"/>
                                  <button onClick={handleSearch} disabled={isSearching || !discoveryField.trim()} className="absolute right-2 top-2 p-1.5 bg-fuchsia-600 rounded-md text-white hover:bg-fuchsia-500 transition-colors disabled:opacity-50">
                                      {isSearching ? (<svg className="animate-spin h-5 w-5 p-0.5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>) : (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>)}
                                  </button>
                              </div>
                          </div>
                      </div>

                      <div className="flex-1 overflow-y-auto custom-scrollbar pb-8">
                          {discoveryResults.length === 0 && !isSearching && (<div className="text-center text-slate-500 py-12 border border-dashed border-slate-800 rounded-2xl bg-slate-900/50">{searchMode === 'global' ? 'Enter a field to find top global labs.' : 'Enter a university and field to find specific labs.'}</div>)}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {discoveryResults.map((uni, idx) => (
                                  <div key={idx} className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden hover:border-fuchsia-500/30 transition-all group">
                                      <div className="p-4 border-b border-slate-700 bg-slate-800/80 flex items-center gap-3">
                                          <div className="w-10 h-10 rounded bg-white flex items-center justify-center shrink-0 overflow-hidden">
                                              {uni.website ? (<img src={`https://www.google.com/s2/favicons?domain=${new URL(uni.website).hostname}&sz=64`} alt={String(uni.university)} className="w-6 h-6 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display='none' }}/>) : (<span className="text-slate-800 font-bold text-xs">{String(uni.university || '?')[0]}</span>)}
                                          </div>
                                          <div className="flex-1 min-w-0">
                                              <h3 className="font-bold text-white truncate">{String(uni.university)}</h3>
                                              <p className="text-xs text-slate-400 truncate">{String(uni.location)}</p>
                                          </div>
                                      </div>
                                      <div className="p-4 space-y-3">
                                          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Key Faculty</div>
                                          {uni.professors && Array.isArray(uni.professors) && uni.professors.map((prof: any, pIdx: number) => (
                                              <div key={pIdx} className="flex items-center justify-between group/prof">
                                                  <div className="flex-1 min-w-0 mr-2">
                                                      <div className="text-sm font-medium text-slate-200">{String(prof.name)}</div>
                                                      <div className="text-[10px] text-slate-500 truncate">{String(prof.focus)}</div>
                                                  </div>
                                                  <button onClick={() => handleAddContact(String(prof.name), String(uni.university))} className="text-xs bg-slate-700 hover:bg-fuchsia-600 text-white px-2 py-1 rounded transition-colors">Draft Email</button>
                                              </div>
                                          ))}
                                          <button onClick={() => handleAddContact('', String(uni.university))} className="w-full mt-2 py-1.5 text-xs border border-dashed border-slate-600 text-slate-400 rounded hover:text-white hover:border-slate-500 transition-colors">Add University (General Inquiry)</button>
                                      </div>
                                  </div>
                              ))}
                          </div>
                      </div>
                  </div>
              </div>
          )}
      </div>

      {deletingContactId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
              <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
                  <h3 className="text-lg font-bold text-white mb-2">Delete Contact</h3>
                  <p className="text-sm text-slate-400 mb-6">Are you sure you want to delete this contact? This action cannot be undone.</p>
                  <div className="flex justify-end gap-3">
                      <button onClick={() => setDeletingContactId(null)} className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors">Cancel</button>
                      <button onClick={confirmDeleteContact} className="px-4 py-2 text-xs font-bold bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors shadow-lg shadow-red-500/20">Delete</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default OutreachView;