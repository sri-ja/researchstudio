import React, { useState, useMemo, useEffect, useRef } from 'react';
import { FeatureIdea, LogEntry } from '../types';
import { featureIdeasService } from '../services/featureIdeasService';
import { logger } from '../services/loggingService';
import { exportData } from '../services/backupService';

interface AdminViewProps {
  isOpen: boolean;
  onClose: () => void;
  triggerConfirm: (title: string, message: string, onConfirm: () => void) => void;
  onImport: (file: File) => void;
}

const FeatureIdeasTab: React.FC = () => {
  const [ideas, setIdeas] = useState<FeatureIdea[]>([]);
  const [newIdeaContent, setNewIdeaContent] = useState('');

  useEffect(() => {
    const unsubscribe = featureIdeasService.subscribe(setIdeas);
    return () => unsubscribe();
  }, []);

  const handleAddIdea = () => {
    if (newIdeaContent.trim()) {
      featureIdeasService.add(newIdeaContent.trim());
      setNewIdeaContent('');
    }
  };

  const todoIdeas = useMemo(() => ideas.filter(i => i.status === 'todo').sort((a,b) => b.createdAt - a.createdAt), [ideas]);
  const doneIdeas = useMemo(() => ideas.filter(i => i.status === 'done').sort((a,b) => b.createdAt - a.createdAt), [ideas]);

  return (
    <div className="p-6 space-y-8">
      {/* Input Form */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newIdeaContent}
          onChange={(e) => setNewIdeaContent(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddIdea()}
          placeholder="Add a new feature idea..."
          className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
        />
        <button
          onClick={handleAddIdea}
          className="px-4 bg-slate-700 hover:bg-slate-600 text-indigo-300 font-bold border border-slate-600 rounded-lg transition-colors"
        >
          Add
        </button>
      </div>

      {/* To Do List */}
      <div className="space-y-2">
        {todoIdeas.length === 0 && doneIdeas.length === 0 && (
             <div className="text-center py-16 text-slate-500 border border-dashed border-slate-800 rounded-xl">
                <p className="font-medium">Have a great idea for the app?</p>
                <p className="text-sm">Add it here to keep track of it.</p>
            </div>
        )}
        {todoIdeas.map(idea => (
          <div key={idea.id} className="group flex items-center gap-3 p-3 bg-slate-800/50 border border-slate-700/50 rounded-lg hover:bg-slate-800 transition-colors">
            <button
              onClick={() => featureIdeasService.updateStatus(idea.id, 'done')}
              className="w-5 h-5 rounded border-2 border-slate-500 hover:border-indigo-400 flex items-center justify-center transition-colors"
            ></button>
            <span className="flex-1 text-sm text-slate-200">{idea.content}</span>
            <button onClick={() => featureIdeasService.delete(idea.id)} className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                &times;
            </button>
          </div>
        ))}
      </div>

      {/* Completed List */}
      {doneIdeas.length > 0 && (
        <div className="pt-6 border-t border-slate-800">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Completed</h3>
          <div className="space-y-2">
            {doneIdeas.map(idea => (
              <div key={idea.id} className="group flex items-center gap-3 p-3 opacity-50 hover:opacity-100 transition-opacity">
                <button
                  onClick={() => featureIdeasService.updateStatus(idea.id, 'todo')}
                  className="w-5 h-5 rounded border-2 border-indigo-500 bg-indigo-500/20 text-indigo-400 flex items-center justify-center"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                       <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                </button>
                <span className="flex-1 text-sm text-slate-400 line-through decoration-slate-600">{idea.content}</span>
                 <button onClick={() => featureIdeasService.delete(idea.id)} className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100">
                    &times;
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const LogsTab: React.FC = () => {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  
    useEffect(() => {
      const unsubscribe = logger.subscribe(setLogs);
      return () => unsubscribe();
    }, []);

    const getLogStyle = (type: LogEntry['type']) => {
        switch (type) {
            case 'error': return { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400' };
            case 'warn': return { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400' };
            case 'info': return { bg: 'bg-sky-500/10', border: 'border-sky-500/30', text: 'text-sky-400' };
            default: return { bg: 'bg-slate-800/50', border: 'border-slate-700/50', text: 'text-slate-400' };
        }
    }

    return (
        <div className="p-6 space-y-3">
            <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-slate-300">Application Logs</h3>
                <button
                    onClick={() => { if(confirm('Are you sure you want to clear all logs?')) logger.clearLogs()}}
                    className="text-xs px-2 py-1 bg-slate-800 border border-slate-700 rounded hover:bg-red-500/20 hover:text-red-400 text-slate-400"
                >
                    Clear Logs
                </button>
            </div>
            {logs.length === 0 ? (
                <div className="text-center py-16 text-slate-500 border border-dashed border-slate-800 rounded-xl">
                    No logs recorded yet.
                </div>
            ) : (
                <div className="font-mono text-xs space-y-2">
                    {logs.map(log => {
                        const style = getLogStyle(log.type);
                        return (
                            <div key={log.id} className={`p-2 rounded border ${style.bg} ${style.border}`}>
                                <div className="flex items-start gap-3">
                                    <span className={`font-bold shrink-0 ${style.text}`}>{log.type.toUpperCase()}</span>
                                    <span className="text-slate-500 shrink-0">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                    <p className="flex-1 text-slate-300 whitespace-pre-wrap break-words">{log.message}</p>
                                    {log.stack && (
                                        <button onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)} className="text-slate-500 hover:text-white">
                                            {expandedLogId === log.id ? 'Hide' : 'Show'} Stack
                                        </button>
                                    )}
                                </div>
                                {expandedLogId === log.id && log.stack && (
                                    <pre className="mt-2 p-2 bg-black/30 rounded text-slate-400 overflow-auto max-h-48">
                                        <code>{log.stack}</code>
                                    </pre>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    );
};

const ImportExportTab: React.FC<{ 
    triggerConfirm: (title: string, message: string, onConfirm: () => void) => void,
    onImport: (file: File) => void 
}> = ({ triggerConfirm, onImport }) => {
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleExport = () => {
        try {
            exportData();
        } catch (e: any) {
            alert(`Export failed: ${e.message}`);
            logger.error('Export failed', e);
        }
    };

    const handleImportClick = () => {
        // Reset value to allow selecting the same file again if needed
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
            fileInputRef.current.click();
        }
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        triggerConfirm(
            "Confirm Data Import",
            "Importing a backup file will overwrite all current data in this browser. This action cannot be undone.",
            () => onImport(file)
        );
    };

    return (
        <div className="p-6 space-y-8">
            {/* Export Section */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-2">Export Data</h3>
                <p className="text-sm text-slate-400 mb-4">
                    Download a single JSON file containing all your papers, notes, projects, and settings. Keep this file in a safe place for backups or to transfer to another device.
                </p>
                <button
                    onClick={handleExport}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-lg shadow-lg shadow-indigo-500/20 transition-all"
                >
                    Download Backup File
                </button>
            </div>
            
            {/* Import Section */}
            <div className="border-t-2 border-red-500/30 pt-6">
                 <h3 className="text-lg font-bold text-white mb-2">Import Data</h3>
                <div className="border-l-4 border-red-500 p-4 bg-red-500/10 text-red-300 rounded-r-lg mb-4">
                    <p className="font-bold text-red-200">Warning</p>
                    <p className="text-sm">
                        Importing a backup file will <strong className="font-bold">overwrite all current data</strong> in this browser. This action cannot be undone. It is recommended to download a fresh backup before importing.
                    </p>
                </div>
                <input
                    type="file"
                    ref={fileInputRef}
                    accept=".json,application/json"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                />
                <button
                    onClick={handleImportClick}
                    className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-lg shadow-lg shadow-red-500/20 transition-all flex items-center gap-2"
                >
                    Import from Backup File...
                </button>
            </div>
        </div>
    );
};


const AdminView: React.FC<AdminViewProps> = (props) => {
  const [activeTab, setActiveTab] = useState('featureIdeas');

  if (!props.isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={props.onClose}>
      <div 
        className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-3xl h-[80vh] shadow-2xl flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-slate-800 flex justify-between items-center shrink-0">
          <h2 className="text-lg font-bold text-white">Admin Panel</h2>
          <button onClick={props.onClose} className="p-1.5 text-slate-500 hover:text-white rounded-full hover:bg-slate-800">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
             </svg>
          </button>
        </div>
        
        <div className="flex border-b border-slate-800 px-4">
            <button 
                onClick={() => setActiveTab('featureIdeas')}
                className={`px-3 py-3 text-sm font-medium border-b-2 ${activeTab === 'featureIdeas' ? 'text-indigo-400 border-indigo-400' : 'text-slate-400 border-transparent hover:text-white'}`}
            >
                Feature Ideas
            </button>
            <button 
                onClick={() => setActiveTab('logs')}
                className={`px-3 py-3 text-sm font-medium border-b-2 ${activeTab === 'logs' ? 'text-indigo-400 border-indigo-400' : 'text-slate-400 border-transparent hover:text-white'}`}
            >
                Logs
            </button>
            <button 
                onClick={() => setActiveTab('importExport')}
                className={`px-3 py-3 text-sm font-medium border-b-2 ${activeTab === 'importExport' ? 'text-indigo-400 border-indigo-400' : 'text-slate-400 border-transparent hover:text-white'}`}
            >
                Import / Export
            </button>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
            {activeTab === 'featureIdeas' && <FeatureIdeasTab />}
            {activeTab === 'logs' && <LogsTab />}
            {activeTab === 'importExport' && <ImportExportTab triggerConfirm={props.triggerConfirm} onImport={props.onImport} />}
        </div>
      </div>
    </div>
  );
};

export default AdminView;