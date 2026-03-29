import React, { useState, useEffect, useMemo } from 'react';
import { Fellowship, ApplicationMaterial } from '../types';
import { parse } from 'marked';

interface FellowshipsViewProps {
  fellowships: Fellowship[];
  onUpdate: (updated: Fellowship) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  triggerConfirm: (title: string, message: string, onConfirm: () => void) => void;
  isLeftSidebarOpen: boolean;
  onToggleLeftSidebar: () => void;
}

const getDaysLeft = (deadline: number) => {
    const diff = deadline - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days;
};

const toYyyyMmDd = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const FellowshipsView: React.FC<FellowshipsViewProps> = ({
  fellowships,
  onUpdate,
  onCreate,
  onDelete,
  triggerConfirm,
  isLeftSidebarOpen,
  onToggleLeftSidebar,
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'description' | 'notes' | 'application'>('description');
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null);

  // State for debounced content editing
  const [editingContent, setEditingContent] = useState('');
  
  const selectedFellowship = useMemo(() => {
    return fellowships.find(f => f.id === selectedId) || null;
  }, [selectedId, fellowships]);

  const selectedMaterial = useMemo(() => {
    return selectedFellowship?.applicationMaterials?.find(m => m.id === selectedMaterialId);
  }, [selectedMaterialId, selectedFellowship]);

  // Auto-select first item if none is selected
  useEffect(() => {
    if (!selectedId && fellowships.length > 0) {
        setSelectedId(sortedFellowships[0].id);
    } else if (fellowships.length === 0) {
        setSelectedId(null);
    }
  }, [fellowships, selectedId]);

  // Handle selection of sub-tab
  useEffect(() => {
    if (selectedFellowship?.applicationMaterials?.length) {
      if (!selectedFellowship.applicationMaterials.find(m => m.id === selectedMaterialId)) {
        setSelectedMaterialId(selectedFellowship.applicationMaterials[0].id);
      }
    } else {
      setSelectedMaterialId(null);
    }
  }, [selectedFellowship]);

  // Sync editing state when selected material changes
  useEffect(() => {
    if (activeTab === 'application') {
      setEditingContent(selectedMaterial?.content || '');
    }
  }, [selectedMaterial, activeTab]);

  // Debounced save for application material content
  useEffect(() => {
    if (activeTab !== 'application' || !selectedMaterial || editingContent === selectedMaterial.content) return;

    const handler = setTimeout(() => {
      const updatedMaterials = selectedFellowship!.applicationMaterials!.map(m => 
        m.id === selectedMaterialId ? { ...m, content: editingContent } : m
      );
      onUpdate({ ...selectedFellowship!, applicationMaterials: updatedMaterials });
    }, 800);

    return () => clearTimeout(handler);
  }, [editingContent, selectedMaterial, selectedMaterialId, selectedFellowship, onUpdate, activeTab]);

  const sortedFellowships = useMemo(() => {
    return [...fellowships].sort((a, b) => {
        if (a.status === 'closed' && b.status !== 'closed') return 1;
        if (a.status !== 'closed' && b.status === 'closed') return -1;
        return a.deadline - b.deadline;
    });
  }, [fellowships]);

  const handleAddMaterial = () => {
    if (!selectedFellowship) return;
    const newMaterial: ApplicationMaterial = {
      id: crypto.randomUUID(),
      title: 'New Section',
      content: ''
    };
    const updatedMaterials = [...(selectedFellowship.applicationMaterials || []), newMaterial];
    onUpdate({ ...selectedFellowship, applicationMaterials: updatedMaterials });
    setActiveTab('application');
    setSelectedMaterialId(newMaterial.id);
  };

  const handleUpdateMaterialTitle = (materialId: string, newTitle: string) => {
    if (!selectedFellowship) return;
    const updatedMaterials = (selectedFellowship.applicationMaterials || []).map(m =>
      m.id === materialId ? { ...m, title: newTitle } : m
    );
    onUpdate({ ...selectedFellowship, applicationMaterials: updatedMaterials });
  };

  const handleDeleteMaterial = (materialId: string) => {
    if (!selectedFellowship) return;
    triggerConfirm(
        'Delete Section',
        'Are you sure you want to delete this application section?',
        () => {
            const updatedMaterials = (selectedFellowship.applicationMaterials || []).filter(m => m.id !== materialId);
            onUpdate({ ...selectedFellowship, applicationMaterials: updatedMaterials });
        }
    );
  };


  return (
    <div className="flex h-full bg-slate-900 overflow-hidden">
        {/* Sidebar List */}
        <div className="w-80 bg-slate-950 border-r border-slate-800 flex flex-col shrink-0">
             <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button type="button" onClick={onToggleLeftSidebar} className={`p-1.5 rounded hover:bg-slate-800 text-slate-400 transition-colors ${!isLeftSidebarOpen ? 'text-indigo-400' : ''}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" /></svg>
                    </button>
                    <h2 className="font-bold text-white">Applications</h2>
                </div>
                <button 
                    onClick={onCreate}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded-lg transition-colors"
                    title="Add Application"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                {sortedFellowships.map(f => {
                    const daysLeft = getDaysLeft(f.deadline);
                    const isOverdue = daysLeft < 0;
                    const isUrgent = daysLeft >= 0 && daysLeft <= 14;
                    const isSelected = selectedId === f.id;

                    return (
                        <div
                            key={f.id}
                            onClick={() => setSelectedId(f.id)}
                            className={`p-3 rounded-lg cursor-pointer border transition-all relative group ${
                                isSelected ? 'bg-slate-800 border-indigo-500/50' : 'border-transparent hover:bg-slate-800/50'
                            }`}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <span className={`font-bold text-sm truncate pr-2 ${isSelected ? 'text-white' : 'text-slate-300'}`}>{f.title}</span>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wide shrink-0 ${
                                    f.status === 'applied' ? 'bg-emerald-500/20 text-emerald-400' :
                                    f.status === 'closed' ? 'bg-slate-700 text-slate-500' : 'bg-blue-500/20 text-blue-400'
                                }`}>{f.status}</span>
                            </div>
                            <p className="text-xs text-slate-500 mb-2 truncate">{f.organization}</p>
                            {f.status !== 'closed' && (
                                <div className={`text-xs font-bold ${
                                    isOverdue ? 'text-red-400' : isUrgent ? 'text-amber-400' : 'text-slate-400'
                                }`}>
                                    {isOverdue ? `Overdue by ${Math.abs(daysLeft)} days` : `${daysLeft} days left`}
                                </div>
                            )}
                        </div>
                    );
                })}
                 {sortedFellowships.length === 0 && (
                    <div className="text-center py-16 text-slate-600 text-sm italic">No applications tracked.</div>
                 )}
            </div>
        </div>
        
        {/* Main Content */}
        <div className="flex-1 flex flex-col bg-slate-900 overflow-hidden">
            {selectedFellowship ? (
                <>
                <div className="p-6 grid grid-cols-2 gap-x-8 gap-y-4 border-b border-slate-800 bg-slate-900/50">
                    <div>
                        <label className="block text-xs uppercase font-bold text-slate-500 mb-1">Title</label>
                        <input type="text" value={selectedFellowship.title} onChange={e => onUpdate({...selectedFellowship, title: e.target.value})} className="w-full bg-transparent text-lg font-bold text-white focus:outline-none focus:bg-slate-800 rounded px-2 -mx-2"/>
                    </div>
                     <div>
                        <label className="block text-xs uppercase font-bold text-slate-500 mb-1">Organization</label>
                        <input type="text" value={selectedFellowship.organization} onChange={e => onUpdate({...selectedFellowship, organization: e.target.value})} className="w-full bg-transparent text-base text-slate-300 focus:outline-none focus:bg-slate-800 rounded px-2 -mx-2"/>
                    </div>
                    <div>
                        <label className="block text-xs uppercase font-bold text-slate-500 mb-1">Deadline</label>
                        <input type="date" value={toYyyyMmDd(new Date(selectedFellowship.deadline))} onChange={e => onUpdate({...selectedFellowship, deadline: new Date(e.target.value + 'T12:00:00').getTime()})} className="w-full bg-transparent text-base text-slate-300 focus:outline-none focus:bg-slate-800 rounded px-2 -mx-2 [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-50"/>
                    </div>
                    <div>
                        <label className="block text-xs uppercase font-bold text-slate-500 mb-1">Status</label>
                         <select value={selectedFellowship.status} onChange={e => onUpdate({...selectedFellowship, status: e.target.value as any})} className="w-full bg-slate-800 border border-slate-700 rounded-md px-2 py-1.5 text-sm text-slate-300 focus:outline-none">
                            <option value="open">Open</option>
                            <option value="applied">Applied</option>
                            <option value="closed">Closed</option>
                        </select>
                    </div>
                     <div className="col-span-2">
                        <label className="block text-xs uppercase font-bold text-slate-500 mb-1">Website URL</label>
                        <input type="text" value={selectedFellowship.website} onChange={e => onUpdate({...selectedFellowship, website: e.target.value})} className="w-full bg-transparent text-sm text-indigo-400 focus:outline-none focus:bg-slate-800 rounded px-2 -mx-2 underline" placeholder="https://..."/>
                    </div>
                </div>
                <div className="flex border-b border-slate-800 px-4">
                    <button onClick={() => setActiveTab('description')} className={`py-3 px-4 text-sm font-medium border-b-2 ${activeTab === 'description' ? 'text-white border-white' : 'text-slate-400 border-transparent hover:text-white'}`}>Description</button>
                    <button onClick={() => setActiveTab('notes')} className={`py-3 px-4 text-sm font-medium border-b-2 ${activeTab === 'notes' ? 'text-white border-white' : 'text-slate-400 border-transparent hover:text-white'}`}>My Notes</button>
                    <button onClick={() => setActiveTab('application')} className={`py-3 px-4 text-sm font-medium border-b-2 ${activeTab === 'application' ? 'text-white border-white' : 'text-slate-400 border-transparent hover:text-white'}`}>Application</button>
                    <button onClick={() => onDelete(selectedFellowship.id)} className="ml-auto text-xs text-slate-500 hover:text-red-400 px-3 flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                        Delete
                    </button>
                </div>
                <div className="flex-1 overflow-hidden flex flex-col">
                    {activeTab === 'description' && (
                        <div className="flex-1 overflow-y-auto">
                            <div className="prose prose-sm prose-invert p-6 max-w-none">
                                <div dangerouslySetInnerHTML={{ __html: parse(selectedFellowship.description || '*No description provided*') as string }}/>
                            </div>
                        </div>
                    )}
                    {activeTab === 'notes' && (
                        <textarea value={selectedFellowship.notes} onChange={e => onUpdate({...selectedFellowship, notes: e.target.value})} className="w-full h-full bg-transparent p-6 text-sm font-mono resize-none focus:outline-none" placeholder="Add personal notes here..."/>
                    )}
                    {activeTab === 'application' && (
                        <div className="flex flex-col h-full">
                            <div className="p-2 border-b border-slate-800 flex items-center gap-1 overflow-x-auto shrink-0">
                                {(selectedFellowship.applicationMaterials || []).map(material => (
                                    <div key={material.id} className={`group relative flex items-center rounded-md transition-colors ${selectedMaterialId === material.id ? 'bg-slate-800' : 'hover:bg-slate-800/50'}`}>
                                        <input
                                            type="text"
                                            defaultValue={material.title}
                                            onBlur={(e) => {
                                                if(e.target.value !== material.title) handleUpdateMaterialTitle(material.id, e.target.value)
                                            }}
                                            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                                            onClick={() => setSelectedMaterialId(material.id)}
                                            className="bg-transparent text-xs font-medium py-1.5 pl-2 pr-6 focus:outline-none w-32"
                                        />
                                        <button onClick={() => handleDeleteMaterial(material.id)} className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 text-slate-600 hover:text-red-400 rounded-full opacity-0 group-hover:opacity-100">
                                            &times;
                                        </button>
                                    </div>
                                ))}
                                <button onClick={handleAddMaterial} className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-700 rounded-md shrink-0">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                                </button>
                            </div>
                            <div className="flex-1 relative">
                                {selectedMaterial ? (
                                    <textarea 
                                        key={selectedMaterial.id} // Force re-mount to clear undo history
                                        value={editingContent}
                                        onChange={(e) => setEditingContent(e.target.value)}
                                        className="w-full h-full bg-transparent p-6 text-sm font-mono resize-none focus:outline-none" 
                                        placeholder="Draft your application materials here..."
                                    />
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-600 text-sm">
                                        <p>No application sections yet.</p>
                                        <button onClick={handleAddMaterial} className="mt-2 text-indigo-400 font-medium">Add your first section</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
                </>
            ) : (
                 <div className="h-full flex flex-col items-center justify-center text-slate-600">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="font-medium">Track your first opportunity</p>
                    <p className="text-sm">Click "Add Application" to get started.</p>
                </div>
            )}
        </div>
    </div>
  );
};

export default FellowshipsView;