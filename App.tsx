
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Paper, ResearchGroup, ResearchNote, SelectionState, AuthorProfile, ArxivMetadata, HistoryItem, ResearchProject, ColdEmail, CollaboratorProfile, UserContextProfile, CommandAction, LikedPaper, UserTasteProfile, Fellowship, IdeationSession } from './types';
import PaperList from './components/PaperList';
import { PaperViewer } from './components/PaperViewer';
import GroupView from './components/GroupView';
import AuthorView from './components/AuthorView';
import NoteEditor from './components/NoteEditor';
import PaperFeed from './components/PaperFeed';
import ProjectView from './components/ProjectView';
import OutreachView from './components/OutreachView';
import CollaboratorHub from './components/CollaboratorHub';
import AuthorsHubView from './components/AuthorsHubView';
import AdminView from './components/AdminView';
import CommandPalette from './components/CommandPalette';
import FellowshipsView from './components/FellowshipsView';
import IdeationView from './components/IdeationView';
import LoginScreen from './components/LoginScreen';
import { extractArxivId, fetchArxivMetadata, getCoreArxivId } from './services/arxivService';
import { autoTagAndCategorize } from './services/geminiService';
import { dbService } from './services/idbService';
import { authService } from './services/authService';
import { logger } from './services/loggingService';
import { importData } from './services/backupService';

// --- Internal Dashboard Component ---
const Dashboard = ({ 
    history, 
    papers, 
    notes, 
    projects,
    fellowships,
    onSelect, 
    onAddPaper, 
    onNewNote, 
    onNewProject,
    onDiscover,
    onOutreach,
    onCollaborators,
    onAuthors,
    onApplications,
    onIdeation,
    isLeftSidebarOpen,
    onToggleLeftSidebar
}: { 
    history: HistoryItem[], 
    papers: Paper[], 
    notes: ResearchNote[], 
    projects: ResearchProject[],
    fellowships: Fellowship[],
    onSelect: (s: SelectionState) => void,
    onAddPaper: () => void,
    onNewNote: () => void,
    onNewProject: () => void,
    onDiscover: () => void,
    onOutreach: () => void,
    onCollaborators: () => void,
    onAuthors: () => void,
    onApplications: () => void,
    onIdeation: () => void;
    isLeftSidebarOpen: boolean,
    onToggleLeftSidebar: () => void
}) => {
    const recentActivity = useMemo(() => {
        const items: { type: 'paper'|'note'|'project', id: string, title: string, date: number, sub: string }[] = [];
        history.slice(0, 3).forEach(h => {
             const p = papers.find(paper => paper.arxivId === h.metadata.arxivId);
             if (p) {
                 items.push({ type: 'paper', id: p.id, title: p.title, date: h.seenAt, sub: 'Paper' });
             }
        });
        notes.slice(0, 3).sort((a,b) => b.updatedAt - a.updatedAt).forEach(n => {
            items.push({ type: 'note', id: n.id, title: n.title, date: n.updatedAt, sub: 'Note' });
        });
        return items.sort((a, b) => b.date - a.date).slice(0, 4);
    }, [history, papers, notes]);

    const activeProjects = useMemo(() => {
        return projects
            .filter(p => p.status === 'active')
            .sort((a, b) => {
                const da = a.deadline || 9999999999999;
                const db = b.deadline || 9999999999999;
                return da - db;
            });
    }, [projects]);

    const openFellowships = useMemo(() => {
        return fellowships
            .filter(f => f.status === 'open')
            .sort((a, b) => a.deadline - b.deadline);
    }, [fellowships]);

    const getDaysLeft = (deadline?: number) => {
        if (!deadline) return null;
        const diff = deadline - Date.now();
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
        return days;
    };

    return (
        <div className="flex-1 flex flex-col p-6 md:p-12 overflow-y-auto bg-slate-900 relative">
             {!isLeftSidebarOpen && (
                <button 
                    onClick={onToggleLeftSidebar}
                    className="absolute top-6 left-6 z-50 p-2.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 hover:text-white shadow-xl hover:bg-slate-700 transition-all group"
                    title="Open Sidebar"
                >
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                    </svg>
                </button>
            )}

            <div className="max-w-5xl mx-auto w-full space-y-10 animate-in fade-in duration-500">
                <div className="space-y-2 mt-8 md:mt-0">
                    <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
                        Research<span className="text-indigo-400">Studio</span>
                    </h1>
                    <p className="text-slate-400 text-base md:text-lg max-w-2xl">
                        Your personal knowledge base. You have <strong className="text-white">{papers.length} papers</strong> and <strong className="text-white">{projects.length} active projects</strong>.
                    </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    <button onClick={onAddPaper} className="group p-4 md:p-6 rounded-2xl bg-gradient-to-br from-indigo-600/20 to-indigo-900/20 border border-indigo-500/20 hover:border-indigo-500/50 hover:from-indigo-600/30 transition-all text-left flex flex-col gap-3 md:gap-4 min-w-0">
                        <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30 group-hover:scale-110 transition-transform shrink-0"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011-1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg></div>
                        <div className="min-w-0 overflow-hidden"><h3 className="text-sm md:text-lg font-bold text-white mb-1 truncate">Add Paper</h3><p className="text-[10px] md:text-xs text-indigo-200/70 truncate">Import from ArXiv</p></div>
                    </button>
                    <button onClick={onIdeation} className="group p-4 md:p-6 rounded-2xl bg-gradient-to-br from-violet-600/10 to-violet-900/10 border border-violet-500/20 hover:border-violet-500/50 hover:from-violet-600/20 transition-all text-left flex flex-col gap-3 md:gap-4 min-w-0">
                        <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-violet-500 flex items-center justify-center text-white shadow-lg shadow-violet-500/30 group-hover:scale-110 transition-transform shrink-0"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg></div>
                        <div className="min-w-0 overflow-hidden"><h3 className="text-sm md:text-lg font-bold text-white mb-1 truncate">Dialectic</h3><p className="text-[10px] md:text-xs text-violet-200/70 truncate">AI Brainstorming</p></div>
                    </button>
                    <button onClick={onNewProject} className="group p-4 md:p-6 rounded-2xl bg-gradient-to-br from-cyan-600/10 to-cyan-900/10 border border-cyan-500/20 hover:border-cyan-500/50 hover:from-cyan-600/20 transition-all text-left flex flex-col gap-3 md:gap-4 min-w-0">
                        <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-cyan-500 flex items-center justify-center text-white shadow-lg shadow-cyan-500/30 group-hover:scale-110 transition-transform shrink-0"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 11-1.414 1.414L5 6.414V8a1 1 0 01-2 0V4zm9 1a1 1 0 010-2h4a1 1 0 011 1v4a1 1 0 01-2 0V6.414l-2.293 2.293a1 1 0 11-1.414-1.414L13.586 5H12zm-9 7a1 1 0 011 1v1.586l2.293-2.293a1 1 0 011.414 1.414L5.414 15H7a1 1 0 010 2H3a1 1 0 01-1-1v-4a1 1 0 011-1zm13-1a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 010-2h1.586l-2.293-2.293a1 1 0 011.414-1.414L15 13.586V12a1 1 0 011-1z" clipRule="evenodd" /></svg></div>
                        <div className="min-w-0 overflow-hidden"><h3 className="text-sm md:text-lg font-bold text-white mb-1 truncate">Projects</h3><p className="text-[10px] md:text-xs text-cyan-200/70 truncate">Track work</p></div>
                    </button>
                    <button onClick={onNewNote} className="group p-4 md:p-6 rounded-2xl bg-gradient-to-br from-amber-600/10 to-amber-900/10 border border-amber-500/20 hover:border-amber-500/50 hover:from-amber-600/20 transition-all text-left flex flex-col gap-3 md:gap-4 min-w-0">
                        <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-amber-500 flex items-center justify-center text-white shadow-lg shadow-amber-500/30 group-hover:scale-110 transition-transform shrink-0"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg></div>
                        <div className="min-w-0 overflow-hidden"><h3 className="text-sm md:text-lg font-bold text-white mb-1 truncate">Notes</h3><p className="text-[10px] md:text-xs text-amber-200/70 truncate">Drafting space</p></div>
                    </button>
                    <button onClick={onCollaborators} className="group p-4 md:p-6 rounded-2xl bg-gradient-to-br from-orange-600/10 to-orange-900/10 border border-orange-500/20 hover:border-orange-500/50 hover:from-orange-600/20 transition-all text-left flex flex-col gap-3 md:gap-4 min-w-0">
                        <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-orange-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/30 group-hover:scale-110 transition-transform shrink-0"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" /></svg></div>
                        <div className="min-w-0 overflow-hidden"><h3 className="text-sm md:text-lg font-bold text-white mb-1 truncate">Collaborators</h3><p className="text-[10px] md:text-xs text-orange-200/70 truncate">LOR Helper</p></div>
                    </button>
                    <button onClick={onApplications} className="group p-4 md:p-6 rounded-2xl bg-gradient-to-br from-teal-600/10 to-teal-900/10 border border-teal-500/20 hover:border-teal-500/50 hover:from-teal-600/20 transition-all text-left flex flex-col gap-3 md:gap-4 min-w-0">
                        <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-teal-500 flex items-center justify-center text-white shadow-lg shadow-teal-500/30 group-hover:scale-110 transition-transform shrink-0"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" /></svg></div>
                        <div className="min-w-0 overflow-hidden"><h3 className="text-sm md:text-lg font-bold text-white mb-1 truncate">Applications</h3><p className="text-[10px] md:text-xs text-teal-200/70 truncate">Opportunities</p></div>
                    </button>
                    <button onClick={onDiscover} className="group p-4 md:p-6 rounded-2xl bg-gradient-to-br from-emerald-600/10 to-emerald-900/10 border border-emerald-500/20 hover:border-emerald-500/50 hover:from-emerald-600/20 transition-all text-left flex flex-col gap-3 md:gap-4 min-w-0">
                        <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/30 group-hover:scale-110 transition-transform shrink-0"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM13 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 00-2-2h-2z" /></svg></div>
                        <div className="min-w-0 overflow-hidden"><h3 className="text-sm md:text-lg font-bold text-white mb-1 truncate">Discover</h3><p className="text-[10px] md:text-xs text-emerald-200/70 truncate">Recent papers</p></div>
                    </button>
                    <button onClick={onAuthors} className="group p-4 md:p-6 rounded-2xl bg-gradient-to-br from-rose-600/10 to-rose-900/10 border border-rose-500/20 hover:border-rose-500/50 hover:from-rose-600/20 transition-all text-left flex flex-col gap-3 md:gap-4 min-w-0">
                        <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-rose-500 flex items-center justify-center text-white shadow-lg shadow-rose-500/30 group-hover:scale-110 transition-transform shrink-0"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clipRule="evenodd" /></svg></div>
                        <div className="min-w-0 overflow-hidden"><h3 className="text-sm md:text-lg font-bold text-white mb-1 truncate">Authors</h3><p className="text-[10px] md:text-xs text-rose-200/70 truncate">Research network</p></div>
                    </button>
                    <button onClick={onOutreach} className="group p-4 md:p-6 rounded-2xl bg-gradient-to-br from-fuchsia-600/10 to-fuchsia-900/10 border border-fuchsia-500/20 hover:border-fuchsia-500/50 hover:from-fuchsia-600/20 transition-all text-left flex flex-col gap-3 md:gap-4 min-w-0">
                        <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-fuchsia-500 flex items-center justify-center text-white shadow-lg shadow-fuchsia-500/30 group-hover:scale-110 transition-transform shrink-0"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" /><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" /></svg></div>
                        <div className="min-w-0 overflow-hidden"><h3 className="text-sm md:text-lg font-bold text-white mb-1 truncate">Outreach</h3><p className="text-[10px] md:text-xs text-fuchsia-200/70 truncate">Email helper</p></div>
                    </button>
                </div>

                {activeProjects.length > 0 && (
                    <div>
                        <h2 className="text-lg font-bold text-slate-400 mb-4 uppercase tracking-wider text-xs">Ongoing Projects</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {activeProjects.map(project => {
                                const daysLeft = getDaysLeft(project.deadline);
                                const isOverdue = daysLeft !== null && daysLeft < 0;
                                const isUrgent = daysLeft !== null && daysLeft <= 7 && daysLeft >= 0;
                                return (
                                    <div key={project.id} onClick={() => onSelect({ type: 'project', id: project.id })} className="flex items-center gap-4 p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:bg-slate-800 hover:border-cyan-500/30 cursor-pointer transition-all group">
                                        <div className="w-10 h-10 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 11-1.414 1.414L5 6.414V8a1 1 0 01-2 0V4zm9 1a1 1 0 010-2h4a1 1 0 011 1v4a1 1 0 01-2 0V6.414l-2.293 2.293a1 1 0 11-1.414-1.414L13.586 5H12zm-9 7a1 1 0 011 1v1.586l2.293-2.293a1 1 0 011.414 1.414L5.414 15H7a1 1 0 010 2H3a1 1 0 01-1-1v-4a1 1 0 011-1zm13-1a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 010-2h1.586l-2.293-2.293a1 1 0 011.414-1.414L15 13.586V12a1 1 0 011-1z" clipRule="evenodd" /></svg></div>
                                        <div className="min-w-0 flex-1"><h4 className="text-sm font-bold text-slate-200 truncate group-hover:text-white transition-colors">{project.title}</h4><div className="flex items-center gap-2 mt-1">{project.deadline ? (<span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide ${isOverdue ? 'bg-red-500/20 text-red-400' : isUrgent ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>{isOverdue ? `Overdue ${Math.abs(daysLeft!)} days` : `${daysLeft} days left`}</span>) : (<span className="text-[10px] text-slate-500">No deadline</span>)}<span className="text-[10px] text-slate-500">• {project.tasks.filter(t => t.status === 'done').length}/{project.tasks.length} Tasks</span></div></div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {openFellowships.length > 0 && (
                    <div>
                        <h2 className="text-lg font-bold text-slate-400 mb-4 uppercase tracking-wider text-xs">Upcoming Deadlines</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {openFellowships.map(fellowship => {
                                const daysLeft = getDaysLeft(fellowship.deadline);
                                const isOverdue = daysLeft !== null && daysLeft < 0;
                                const isUrgent = daysLeft !== null && daysLeft <= 14 && daysLeft >= 0;
                                return (
                                    <div key={fellowship.id} onClick={() => onSelect({ type: 'applications' })} className="flex items-center gap-4 p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:bg-slate-800 hover:border-teal-500/30 cursor-pointer transition-all group">
                                        <div className="w-10 h-10 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center shrink-0"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" /></svg></div>
                                        <div className="min-w-0 flex-1"><h4 className="text-sm font-bold text-slate-200 truncate group-hover:text-white transition-colors">{fellowship.title}</h4><div className="flex items-center gap-2 mt-1">{fellowship.deadline ? (<span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide ${isOverdue ? 'bg-red-500/20 text-red-400' : isUrgent ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>{isOverdue ? `Overdue ${Math.abs(daysLeft!)} days` : `${daysLeft} days left`}</span>) : (<span className="text-[10px] text-slate-500">No deadline</span>)}<span className="text-[10px] text-slate-500 truncate">• {fellowship.organization}</span></div></div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {recentActivity.length > 0 && (
                    <div>
                        <h2 className="text-lg font-bold text-slate-400 mb-4 uppercase tracking-wider text-xs">Recently Viewed</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {recentActivity.map((item, idx) => (
                                <div key={`${item.type}-${item.id}`} onClick={() => onSelect({ type: item.type as any, id: item.id })} className="flex items-center gap-4 p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:bg-slate-800 hover:border-indigo-500/30 cursor-pointer transition-all group">
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${item.type === 'paper' ? 'bg-indigo-500/20 text-indigo-400' : item.type === 'project' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-amber-500/20 text-amber-300'}`}>
                                        {item.type === 'paper' ? (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" /></svg>) : item.type === 'project' ? (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 11-1.414 1.414L5 6.414V8a1 1 0 01-2 0V4zm9 1a1 1 0 010-2h4a1 1 0 011 1v4a1 1 0 01-2 0V6.414l-2.293 2.293a1 1 0 11-1.414-1.414L13.586 5H12zm-9 7a1 1 0 011 1v1.586l2.293-2.293a1 1 0 011.414 1.414L5.414 15H7a1 1 0 010 2H3a1 1 0 01-1-1v-4a1 1 0 011-1zm13-1a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 010-2h1.586l-2.293-2.293a1 1 0 011.414-1.414L15 13.586V12a1 1 0 011-1z" clipRule="evenodd" /></svg>) : (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>)}
                                    </div>
                                    <div className="min-w-0"><h4 className="text-sm font-bold text-slate-200 truncate group-hover:text-white transition-colors">{item.title || 'Untitled'}</h4><div className="flex items-center gap-2 mt-0.5"><span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${item.type === 'paper' ? 'bg-indigo-500/10 text-indigo-300' : item.type === 'project' ? 'bg-cyan-500/10 text-cyan-300' : 'bg-amber-500/10 text-amber-300'}`}>{item.sub}</span><span className="text-[10px] text-slate-500">{new Date(item.date).toLocaleDateString()}</span></div></div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const App = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isSetupRequired, setIsSetupRequired] = useState<boolean>(false);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [groups, setGroups] = useState<ResearchGroup[]>([]);
  const [notes, setNotes] = useState<ResearchNote[]>([]);
  const [projects, setProjects] = useState<ResearchProject[]>([]);
  const [authorProfiles, setAuthorProfiles] = useState<Record<string, AuthorProfile>>({});
  const [collaboratorProfiles, setCollaboratorProfiles] = useState<CollaboratorProfile[]>([]);
  const [seenPapers, setSeenPapers] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [outreachList, setOutreachList] = useState<ColdEmail[]>([]);
  const [userContextProfiles, setUserContextProfiles] = useState<UserContextProfile[]>([]);
  const [likedPapers, setLikedPapers] = useState<LikedPaper[]>([]);
  const [fellowships, setFellowships] = useState<Fellowship[]>([]);
  const [activeUserContextId, setActiveUserContextId] = useState<string | null>(null);
  const [userTasteProfile, setUserTasteProfile] = useState<UserTasteProfile | null>(null);
  const [selection, setSelection] = useState<SelectionState>(null);
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(256);
  const [groupCreationContext, setGroupCreationContext] = useState<{ paperId: string } | null>(null);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isAddPaperModalOpen, setIsAddPaperModalOpen] = useState(false);
  const [addPaperInput, setAddPaperInput] = useState('');
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void; }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  // --- Auth Check ---
  useEffect(() => {
    const checkAuth = async () => {
        const storedAuth = await dbService.get('settings', 'masterPassword');
        if (!storedAuth) {
            setIsSetupRequired(true);
        } else {
            // Check session storage for existing auth
            const sessionAuth = sessionStorage.getItem('rs-authenticated');
            if (sessionAuth === 'true') {
                setIsAuthenticated(true);
                loadData();
            }
        }
        setIsLoading(false);
    };
    checkAuth();
  }, []);

  const handleSetupPassword = async (password: string) => {
    const hashed = await authService.hashPassword(password);
    await dbService.set('settings', { key: 'masterPassword', value: hashed });
    setIsSetupRequired(false);
    setIsAuthenticated(true);
    sessionStorage.setItem('rs-authenticated', 'true');
    loadData();
  };

  const handleUnlock = async (password: string) => {
    const stored = await dbService.get('settings', 'masterPassword');
    if (stored) {
        const isValid = await authService.verifyPassword(password, stored.value);
        if (isValid) {
            setIsAuthenticated(true);
            sessionStorage.setItem('rs-authenticated', 'true');
            loadData();
            return true;
        }
    }
    return false;
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('rs-authenticated');
  };

  const loadData = async () => {
    try {
        const [
            loadedPapers, loadedGroups, loadedNotes, loadedProjects, 
            loadedAuthorProfiles, loadedCollbProfiles, loadedHistory,
            loadedOutreach, loadedUserCtx, loadedSettings,
            loadedLikedPapers, loadedFellowships
        ] = await Promise.all([
            dbService.getAll('papers'),
            dbService.getAll('groups'),
            dbService.getAll('notes'),
            dbService.getAll('projects'),
            dbService.getAll('authorProfiles'),
            dbService.getAll('collaboratorProfiles'),
            dbService.getAll('history'),
            dbService.getAll('outreach'),
            dbService.getAll('userContextProfiles'),
            dbService.getAll('settings'),
            dbService.getAll('likedPapers'),
            dbService.getAll('fellowships')
        ]);
        setPapers(loadedPapers.filter(p => p && p.id && p.arxivId));
        setGroups(loadedGroups.filter(g => g && g.id));
        setNotes(loadedNotes.filter(n => n && n.id));
        setProjects(loadedProjects.filter(p => p && p.id));
        setFellowships(loadedFellowships.filter(f => f && f.id));
        const profilesMap = loadedAuthorProfiles.filter(p => p && p.name).reduce((acc, profile) => { acc[profile.name] = profile; return acc; }, {} as Record<string, AuthorProfile>);
        setAuthorProfiles(profilesMap);
        setCollaboratorProfiles(loadedCollbProfiles.filter(p => p && p.id));
        setHistory(loadedHistory.filter(h => h && h.metadata && h.metadata.arxivId));
        setOutreachList(loadedOutreach.filter(o => o && o.id));
        setUserContextProfiles(loadedUserCtx.filter(u => u && u.id));
        setLikedPapers(loadedLikedPapers.filter(p => p && p.arxivId).sort((a, b) => b.likedAt - a.likedAt));
        const seenPapersSetting = loadedSettings.find(s => s.key === 'seenPapers');
        setSeenPapers(new Set<string>(Array.isArray(seenPapersSetting?.value) ? seenPapersSetting.value.filter((v: any) => typeof v === 'string') : []));
        const activeCtxIdSetting = loadedSettings.find(s => s.key === 'activeUserContextId');
        setActiveUserContextId(activeCtxIdSetting?.value || null);
        const tasteProfile = loadedSettings.find(s => s.key === 'userTasteProfile')?.value;
        setUserTasteProfile(tasteProfile && Array.isArray(tasteProfile.insights) ? tasteProfile : null);
    } catch (error) { logger.error("Failed to load data from IndexedDB", error); }
  };

  const handleMouseDownLeft = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = leftSidebarWidth;
    const handleMouseMove = (e: MouseEvent) => { const newWidth = startWidth + e.clientX - startX; setLeftSidebarWidth(Math.min(Math.max(newWidth, 200), window.innerWidth / 2)); };
    const handleMouseUp = () => { document.body.style.cursor = 'default'; document.body.style.userSelect = 'auto'; window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
    document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none'; window.addEventListener('mousemove', handleMouseMove); window.addEventListener('mouseup', handleMouseUp);
  }, [leftSidebarWidth]);

  const triggerConfirm = useCallback((title: string, message: string, onConfirm: () => void) => { setConfirmModal({ isOpen: true, title, message, onConfirm }); }, []);
  const handleImport = useCallback(async (file: File) => { window.__IS_IMPORTING__ = true; setIsImporting(true); setTimeout(async () => { try { await importData(file); window.location.replace(window.location.href); } catch (e: any) { alert(`Import failed: ${e.message}`); window.location.reload(); } }, 500); }, []);
  const handleUpdatePaper = useCallback(async (updated: Paper) => { await dbService.set('papers', updated); setPapers(prev => prev.map(p => p.id === updated.id ? updated : p)); }, []);
  const createGroupInternal = useCallback(async (name: string, navigate: boolean = true): Promise<ResearchGroup | undefined> => { if (groups.some(g => g.name.toLowerCase() === name.toLowerCase())) { alert(`A group named "${name}" already exists.`); return undefined; } const newGroup: ResearchGroup = { id: crypto.randomUUID(), name, color: '#6366f1', readme: '', createdAt: Date.now() }; await dbService.set('groups', newGroup); setGroups(prev => [...prev, newGroup]); if (groupCreationContext?.paperId) { const paperToUpdate = papers.find(p => p.id === groupCreationContext.paperId); if (paperToUpdate) await handleUpdatePaper({ ...paperToUpdate, groupId: newGroup.id }); setGroupCreationContext(null); } else if (navigate) { setSelection({ type: 'group', id: newGroup.id }); } setIsGroupModalOpen(false); setNewGroupName(''); return newGroup; }, [groups, groupCreationContext, papers, handleUpdatePaper]);
  const handleCreateGroup = useCallback((nameOrEvent?: string | any) => { if (typeof nameOrEvent === 'string' && nameOrEvent.trim().length > 0) { createGroupInternal(nameOrEvent); } else { setIsGroupModalOpen(true); setNewGroupName(''); } }, [createGroupInternal]);
  const handleAddPaper = useCallback(async (urlOrId?: string, options?: { suppressNavigation?: boolean }): Promise<string | undefined> => { if (!urlOrId || typeof urlOrId !== 'string') { setIsAddPaperModalOpen(true); return undefined; } const arxivId = extractArxivId(urlOrId); if (!arxivId) { alert("Invalid ArXiv URL or ID"); return undefined; } const coreId = getCoreArxivId(arxivId); const existingPaper = papers.find(p => getCoreArxivId(p.arxivId) === coreId); if (existingPaper) { if (!options?.suppressNavigation) setSelection({ type: 'paper', id: existingPaper.id }); setIsAddPaperModalOpen(false); setAddPaperInput(''); return existingPaper.id; } const tempId = crypto.randomUUID(); let newPaper: Paper = { id: tempId, arxivId, title: `Loading ${arxivId}...`, authors: [], summary: 'Fetching metadata...', published: '', notes: '', tags: [], highlights: [], addedAt: Date.now() }; setPapers(prev => [newPaper, ...prev]); if (!options?.suppressNavigation) setSelection({ type: 'paper', id: tempId }); setIsAddPaperModalOpen(false); setAddPaperInput(''); try { const metadata = await fetchArxivMetadata(arxivId); const { tags, suggestedGroupId } = await autoTagAndCategorize(metadata.title, metadata.summary, groups); const finalPaper = { ...newPaper, ...metadata, tags, groupId: suggestedGroupId || undefined }; await dbService.set('papers', finalPaper); setPapers(prev => prev.map(p => (p.id === tempId ? finalPaper : p))); return tempId; } catch (e: any) { alert(`Failed to fetch paper: ${e.message}`); await dbService.deleteItem('papers', tempId); setPapers(prev => prev.filter(p => p.id !== tempId)); if (selection?.type === 'paper' && selection.id === tempId) setSelection(null); return undefined; } }, [papers, groups, selection]);
  const handleAddLocalPdf = useCallback(async (file: File) => { if (!file || file.type !== 'application/pdf') return; setIsAddPaperModalOpen(false); try { const pdfData = await file.arrayBuffer(); const tempId = crypto.randomUUID(); const newPaper: Paper = { id: tempId, arxivId: `local-${tempId}`, title: file.name.replace(/\.pdf$/i, ''), authors: [], summary: 'Local PDF imported.', published: new Date().toISOString(), notes: '', tags: ['local'], highlights: [], addedAt: Date.now(), }; await dbService.set('localPdfs', { paperId: tempId, data: pdfData }); await dbService.set('papers', newPaper); setPapers(prev => [newPaper, ...prev]); setSelection({ type: 'paper', id: tempId }); } catch (e: any) { logger.error('Local PDF import failed', e); } }, []);
  const handleDeletePaper = useCallback((id: string) => { triggerConfirm("Delete Paper", "Are you sure?", async () => { const paperToDelete = papers.find(p => p.id === id); if (paperToDelete?.arxivId.startsWith('local-')) await dbService.deleteItem('localPdfs', id); await dbService.deleteItem('papers', id); setPapers(prev => prev.filter(p => p.id !== id)); if (selection?.type === 'paper' && selection.id === id) setSelection(null); }); }, [papers, selection, triggerConfirm]);
  const handleUpdateGroup = useCallback(async (updated: ResearchGroup) => { await dbService.set('groups', updated); setGroups(prev => prev.map(g => g.id === updated.id ? updated : g)); }, []);
  const handleDeleteGroup = useCallback((id: string) => { triggerConfirm("Delete Group", "Delete this group? Papers will be moved to Inbox.", async () => { await dbService.deleteItem('groups', id); setGroups(prev => prev.filter(g => g.id !== id)); const updatedPapers = papers.filter(p => p.groupId === id).map(p => ({...p, groupId: undefined})); await dbService.bulkSet('papers', updatedPapers); setPapers(prev => prev.map(p => p.groupId === id ? { ...p, groupId: undefined } : p)); const updatedNotes = notes.filter(n => n.groupId === id).map(n => ({...n, groupId: undefined})); await dbService.bulkSet('notes', updatedNotes); setNotes(prev => prev.map(n => n.groupId === id ? { ...n, groupId: undefined } : n)); if (selection?.type === 'group' && selection.id === id) setSelection(null); }); }, [papers, notes, selection, triggerConfirm]);
  const handleCreateNote = useCallback(async () => { const newNote: ResearchNote = { id: crypto.randomUUID(), title: 'Untitled Note', content: '', createdAt: Date.now(), updatedAt: Date.now() }; await dbService.set('notes', newNote); setNotes(prev => [newNote, ...prev]); setSelection({ type: 'note', id: newNote.id }); }, []);
  const handleUpdateNote = useCallback(async (updated: ResearchNote) => { await dbService.set('notes', updated); setNotes(prev => prev.map(n => n.id === updated.id ? updated : n)); }, []);
  const handleDeleteNote = useCallback((id: string) => { triggerConfirm("Delete Note", "Are you sure?", async () => { await dbService.deleteItem('notes', id); setNotes(prev => prev.filter(n => n.id !== id)); if (selection?.type === 'note' && selection.id === id) setSelection(null); }); }, [selection, triggerConfirm]);
  const handleCreateProject = useCallback(async () => { const newProject: ResearchProject = { id: crypto.randomUUID(), title: 'New Project', description: '', status: 'active', tasks: [], logs: [], literature: [], meetings: [], outreach: [], team: [], paperOutline: '', createdAt: Date.now(), updatedAt: Date.now() }; await dbService.set('projects', newProject); setProjects(prev => [newProject, ...prev]); setSelection({ type: 'project', id: newProject.id }); }, []);
  const handleUpdateProject = useCallback(async (updated: ResearchProject) => { await dbService.set('projects', updated); setProjects(prev => prev.map(p => p.id === updated.id ? updated : p)); }, []);
  const handleDeleteProject = useCallback((id: string) => { triggerConfirm("Delete Project", "Are you sure?", async () => { await dbService.deleteItem('projects', id); setProjects(prev => prev.filter(p => p.id !== id)); if (selection?.type === 'project' && selection.id === id) setSelection(null); }); }, [selection, triggerConfirm]);
  const handleUpdateCollaboratorProfile = useCallback(async (updated: CollaboratorProfile) => { await dbService.set('collaboratorProfiles', updated); setCollaboratorProfiles(prev => { const existing = prev.find(p => p.id === updated.id); return existing ? prev.map(p => p.id === updated.id ? updated : p) : [...prev, updated]; }); }, []);
  const handleCreateFellowship = useCallback(async () => { const newFellowship: Fellowship = { id: crypto.randomUUID(), title: 'New Opportunity', organization: '', status: 'open', deadline: Date.now() + 30 * 24 * 60 * 60 * 1000, website: '', description: '', notes: '', createdAt: Date.now() }; await dbService.set('fellowships', newFellowship); setFellowships(prev => [newFellowship, ...prev]); }, []);
  const handleUpdateFellowship = useCallback(async (updated: Fellowship) => { await dbService.set('fellowships', updated); setFellowships(prev => prev.map(f => f.id === updated.id ? updated : f)); }, []);
  const handleDeleteFellowship = useCallback((id: string) => { triggerConfirm("Delete Opportunity", "Are you sure?", async () => { await dbService.deleteItem('fellowships', id); setFellowships(prev => prev.filter(f => f.id !== id)); }); }, [triggerConfirm]);
  const handleMoveItem = useCallback(async (itemId: string, itemType: 'paper' | 'note', groupId: string | undefined) => { if (itemType === 'paper') { const paper = papers.find(p => p.id === itemId); if (paper) await handleUpdatePaper({ ...paper, groupId }); } else { const note = notes.find(n => n.id === itemId); if (note) await handleUpdateNote({ ...note, groupId }); } }, [papers, notes, handleUpdatePaper, handleUpdateNote]);
  const handleMarkAsSeen = useCallback(async (meta: ArxivMetadata) => { const newSeen = new Set(seenPapers).add(meta.arxivId); setSeenPapers(newSeen); await dbService.set('settings', { key: 'seenPapers', value: Array.from(newSeen) }); let newHistory: HistoryItem[]; const existingHistory = history.find(h => h.metadata.arxivId === meta.arxivId); if (existingHistory) { newHistory = [{ ...existingHistory, seenAt: Date.now() }, ...history.filter(h => h.metadata.arxivId !== meta.arxivId)]; } else { newHistory = [{ metadata: meta, seenAt: Date.now() }, ...history].slice(0, 100); } setHistory(newHistory); await dbService.bulkSet('history', newHistory); }, [seenPapers, history]);
  const handleSaveFromFeed = useCallback(async (meta: ArxivMetadata) => { const coreId = getCoreArxivId(meta.arxivId); if (papers.some(p => getCoreArxivId(p.arxivId) === coreId)) return; const newId = crypto.randomUUID(); let newPaper: Paper = { id: newId, ...meta, notes: '', tags: [], highlights: [], addedAt: Date.now() }; setPapers(prev => [newPaper, ...prev]); try { const { tags, suggestedGroupId } = await autoTagAndCategorize(meta.title, meta.summary, groups); newPaper = { ...newPaper, tags, groupId: suggestedGroupId }; setPapers(prev => prev.map(p => p.id === newId ? newPaper : p)); } catch (e) { console.warn("Auto-cat failed", e); } await dbService.set('papers', newPaper); }, [papers, groups]);
  const handleReadNowSafe = useCallback(async (meta: ArxivMetadata) => { const coreId = getCoreArxivId(meta.arxivId); const existingPaper = papers.find(p => getCoreArxivId(p.arxivId) === coreId); let targetId = existingPaper?.id; if (!targetId) { const newId = crypto.randomUUID(); let newPaper: Paper = { id: newId, ...meta, notes: '', tags: [], highlights: [], addedAt: Date.now() }; setPapers(prev => [newPaper, ...prev]); targetId = newId; autoTagAndCategorize(meta.title, meta.summary, groups).then(async ({ tags, suggestedGroupId }) => { const finalPaper = { ...newPaper, tags, groupId: suggestedGroupId }; await dbService.set('papers', finalPaper); setPapers(prev => prev.map(p => p.id === newId ? finalPaper : p)); }); } setSelection({ type: 'paper', id: targetId }); }, [papers, groups]);
  const handleAddToOutreach = useCallback(async (name: string, notes?: string) => { if (outreachList.some(c => c.recipientName.toLowerCase() === name.toLowerCase())) { alert(`${name} is already in your outreach list.`); return; } const newContact: ColdEmail = { id: crypto.randomUUID(), recipientName: name, recipientEmail: '', affiliation: 'Researcher', status: 'draft', subject: '', body: '', lastUpdated: Date.now(), notes: notes || '' }; await dbService.set('outreach', newContact); setOutreachList(prev => [newContact, ...prev]); if(confirm(`${name} added to Outreach. Go to Outreach view?`)) setSelection({ type: 'outreach' }); }, [outreachList]);
  const handleToggleLike = useCallback(async (meta: ArxivMetadata) => { const coreId = getCoreArxivId(meta.arxivId); const isLiked = likedPapers.some(p => p.arxivId === coreId); if (isLiked) { const newLiked = likedPapers.filter(p => p.arxivId !== coreId); setLikedPapers(newLiked); await dbService.deleteItem('likedPapers', coreId); } else { const newLike: LikedPaper = { ...meta, arxivId: coreId, likedAt: Date.now() }; const newLiked = [newLike, ...likedPapers]; setLikedPapers(newLiked); await dbService.set('likedPapers', newLike); } }, [likedPapers]);
  const handleUpdateTasteProfile = useCallback(async (profile: UserTasteProfile | null) => { setUserTasteProfile(profile); await dbService.set('settings', { key: 'userTasteProfile', value: profile }); }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setIsCommandPaletteOpen(prev => !prev); } };
    window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler);
  }, []);

  const commandActions = useMemo<CommandAction[]>(() => {
    const actions: CommandAction[] = [];
    actions.push({ id: 'action-add-paper', title: 'Add Paper...', category: 'Action', onSelect: () => handleAddPaper(), icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011-1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg> });
    actions.push({ id: 'action-new-note', title: 'New Note', category: 'Action', onSelect: handleCreateNote, icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg> });
    actions.push({ id: 'action-dialectic', title: 'Start Dialectic Session', category: 'Action', onSelect: () => setSelection({ type: 'ideation' }), icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> });
    actions.push({ id: 'action-collaborators', title: 'Collaborators Hub (LOR Requests)', category: 'Navigation', onSelect: () => setSelection({ type: 'collaborators' }), icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" /></svg> });
    actions.push({ id: 'nav-dashboard', title: 'Go to Dashboard', category: 'Navigation', onSelect: () => setSelection(null), icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" /></svg> });
    papers.forEach(p => actions.push({ id: p.id, title: p.title, category: 'Paper', onSelect: () => setSelection({ type: 'paper', id: p.id }), icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" /></svg> }));
    return actions;
  }, [papers, handleAddPaper, handleCreateNote]);

  if (isImporting) return <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-950 text-slate-300 p-8"><h2 className="text-xl font-bold text-white">Importing Data...</h2></div>;
  if (isLoading) return <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-950"><span className="font-bold text-slate-200 tracking-tight">ResearchStudio</span></div>;

  // --- Show Login Gate ---
  if (!isAuthenticated || isSetupRequired) {
    return <LoginScreen isSetupMode={isSetupRequired} onUnlock={handleUnlock} onSetup={handleSetupPassword} />;
  }

  const renderContent = () => {
    if (!selection) return <Dashboard history={history} papers={papers} notes={notes} projects={projects} fellowships={fellowships} onSelect={setSelection} onAddPaper={() => handleAddPaper()} onNewNote={handleCreateNote} onNewProject={handleCreateProject} onDiscover={() => setSelection({ type: 'feed' })} onOutreach={() => setSelection({ type: 'outreach' })} onCollaborators={() => setSelection({ type: 'collaborators' })} onAuthors={() => setSelection({ type: 'authors' })} onApplications={() => setSelection({ type: 'applications' })} onIdeation={() => setSelection({ type: 'ideation' })} isLeftSidebarOpen={isLeftSidebarOpen} onToggleLeftSidebar={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)} />;
    switch (selection.type) {
        case 'ideation': return <IdeationView initialSessionId={selection.id} isLeftSidebarOpen={isLeftSidebarOpen} onToggleLeftSidebar={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)} triggerConfirm={triggerConfirm} />;
        case 'feed': return <PaperFeed onSaveForLater={handleSaveFromFeed} onReadNow={handleReadNowSafe} savedPaperIds={new Set(papers.map(p => getCoreArxivId(p.arxivId)))} seenPaperIds={seenPapers} onMarkAsSeen={handleMarkAsSeen} history={history} likedPapers={likedPapers} onToggleLike={handleToggleLike} userTasteProfile={userTasteProfile} onUpdateTasteProfile={handleUpdateTasteProfile} />;
        case 'outreach': return <OutreachView outreachList={outreachList} userContextProfiles={userContextProfiles} activeUserContextId={activeUserContextId} onUpdateOutreachList={async (l) => { await dbService.bulkSet('outreach', l); setOutreachList(l); }} onUpdateUserContextProfiles={async (p) => { await dbService.bulkSet('userContextProfiles', p); setUserContextProfiles(p); }} onSetActiveUserContextId={async (id) => { await dbService.set('settings', { key: 'activeUserContextId', value: id }); setActiveUserContextId(id); }} isLeftSidebarOpen={isLeftSidebarOpen} onToggleLeftSidebar={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)} />;
        case 'collaborators': return <CollaboratorHub projects={projects} profiles={collaboratorProfiles} onUpdateProfile={handleUpdateCollaboratorProfile} onSelectProject={(id) => setSelection({ type: 'project', id })} isLeftSidebarOpen={isLeftSidebarOpen} onToggleLeftSidebar={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)} />;
        case 'authors': return <AuthorsHubView papers={papers} selection={selection} onSelect={setSelection} isLeftSidebarOpen={isLeftSidebarOpen} onToggleLeftSidebar={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)} />;
        case 'applications': return <FellowshipsView fellowships={fellowships} onUpdate={handleUpdateFellowship} onCreate={handleCreateFellowship} onDelete={handleDeleteFellowship} triggerConfirm={triggerConfirm} isLeftSidebarOpen={isLeftSidebarOpen} onToggleLeftSidebar={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)} />;
        case 'note': { const note = notes.find(n => n.id === selection.id); return note ? <NoteEditor note={note} groups={groups} onUpdateNote={handleUpdateNote} onDeleteNote={handleDeleteNote} isLeftSidebarOpen={isLeftSidebarOpen} onToggleLeftSidebar={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)} /> : <div>Note not found</div>; }
        case 'project': { const project = projects.find(p => p.id === selection.id); return project ? <ProjectView project={project} papers={papers} onUpdateProject={handleUpdateProject} onDeleteProject={handleDeleteProject} onSelectPaper={(id) => setSelection({ type: 'paper', id })} onAddPaperToLibrary={async (url) => { const res = await handleAddPaper(url, {suppressNavigation: true}); if (!res) throw new Error("Import failed"); return res; }} onRemoveTeamMember={(memberId) => handleUpdateProject({...project, team: (project.team||[]).filter(m => m.id !== memberId)})} isLeftSidebarOpen={isLeftSidebarOpen} onToggleLeftSidebar={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)} /> : <div>Project not found</div>; }
        case 'group': { const group = groups.find(g => g.id === selection.id); return group ? <GroupView group={group} onUpdateGroup={handleUpdateGroup} onDeleteGroup={handleDeleteGroup} isLeftSidebarOpen={isLeftSidebarOpen} onToggleLeftSidebar={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)} /> : <div>Group not found</div>; }
        case 'author': { const author = selection.id; const authorPapers = papers.filter(p => p.authors.includes(author)); return <AuthorView authorName={author} papers={authorPapers} groups={groups} profile={authorProfiles[author]} onUpdateProfile={async (p) => { await dbService.set('authorProfiles', p); setAuthorProfiles(prev => ({ ...prev, [p.name]: p })); }} onSelectPaper={(id) => setSelection({ type: 'paper', id })} onAddToOutreach={handleAddToOutreach} isLeftSidebarOpen={isLeftSidebarOpen} onToggleLeftSidebar={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)} />; }
        case 'paper': default: { const paper = papers.find(p => p.id === selection.id); return paper ? <PaperViewer paper={paper} groups={groups} onUpdatePaper={handleUpdatePaper} isLeftSidebarOpen={isLeftSidebarOpen} onToggleLeftSidebar={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)} onRequestCreateGroup={() => { setGroupCreationContext({ paperId: paper.id }); setIsGroupModalOpen(true); }} onCreateGroup={createGroupInternal} /> : <div>Paper not found</div>; }
    }
  };

  return (
    <div className="flex h-screen w-screen bg-slate-950 text-slate-200 font-sans overflow-hidden">
      {isGroupModalOpen && ( <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in" onClick={() => setIsGroupModalOpen(false)}><div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}><h3 className="text-lg font-bold text-white mb-4">Create New Group</h3><input autoFocus type="text" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreateGroup(newGroupName)} placeholder="Group Name" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500 mb-4" /><div className="flex justify-end gap-2"><button onClick={() => setIsGroupModalOpen(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-white">Cancel</button><button onClick={() => handleCreateGroup(newGroupName)} disabled={!newGroupName.trim()} className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg">Create</button></div></div></div> )}
      {isAddPaperModalOpen && ( <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in" onClick={() => setIsAddPaperModalOpen(false)}><div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}><h3 className="text-lg font-bold text-white mb-4">Add Paper to Library</h3><div className="flex gap-2"><input autoFocus type="text" value={addPaperInput} onChange={(e) => setAddPaperInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddPaper(addPaperInput)} placeholder="https://arxiv.org/abs/..." className="flex-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500 font-mono text-sm" /><button onClick={() => handleAddPaper(addPaperInput)} disabled={!addPaperInput.trim()} className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg">Import</button></div><div className="my-4 flex items-center gap-4"><div className="flex-1 h-px bg-slate-700"></div><span className="text-xs text-slate-500 font-medium">OR</span><div className="flex-1 h-px bg-slate-700"></div></div><label htmlFor="pdf-upload" className="w-full cursor-pointer text-center px-4 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-2">Import Local PDF File...</label><input id="pdf-upload" type="file" accept="application/pdf" className="hidden" onChange={(e) => { if (e.target.files && e.target.files[0]) handleAddLocalPdf(e.target.files[0]); e.target.value = ''; }} /></div></div> )}
      <div className={`bg-slate-950 border-r border-slate-800 flex flex-col shrink-0 transition-[width] duration-300 ease-in-out ${!isLeftSidebarOpen ? 'w-0 border-r-0' : ''}`} style={{ width: isLeftSidebarOpen ? `${leftSidebarWidth}px` : '0px' }}>
        <button onClick={() => setSelection(null)} className="p-4 flex items-center gap-3 border-b border-slate-800 shrink-0 w-full text-left hover:bg-slate-900 transition-colors"><div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-fuchsia-500 flex items-center justify-center text-white font-bold shadow-lg">RS</div><span className="font-bold text-lg text-slate-200 tracking-tight">ResearchStudio</span></button>
        <PaperList papers={papers} notes={notes} groups={groups} projects={projects} selection={selection} onSelect={setSelection} onDeletePaper={handleDeletePaper} onDeleteNote={handleDeleteNote} onCreateGroup={handleCreateGroup} onCreateNote={handleCreateNote} onCreateProject={handleCreateProject} onCreatePaper={() => handleAddPaper()} onMoveItem={handleMoveItem} onAdminClick={() => setIsAdminModalOpen(true)} onLogout={handleLogout} />
      </div>
      {isLeftSidebarOpen && ( <div onMouseDown={handleMouseDownLeft} className="w-1 hover:w-1.5 -ml-0.5 z-20 cursor-col-resize bg-transparent hover:bg-indigo-500/50 transition-all" /> )}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-900 relative">{renderContent()}</div>
      <CommandPalette isOpen={isCommandPaletteOpen} onClose={() => setIsCommandPaletteOpen(false)} actions={commandActions} />
      <AdminView isOpen={isAdminModalOpen} onClose={() => setIsAdminModalOpen(false)} triggerConfirm={triggerConfirm} onImport={handleImport} />

      {/* GLOBAL CONFIRMATION MODAL */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-sm shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-white mb-2">{confirmModal.title}</h3>
                <p className="text-sm text-slate-400 mb-6">{confirmModal.message}</p>
                <div className="flex justify-end gap-3">
                    <button onClick={() => setConfirmModal(prev => ({...prev, isOpen: false}))} className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors">Cancel</button>
                    <button 
                        onClick={() => { confirmModal.onConfirm(); setConfirmModal(prev => ({...prev, isOpen: false})); }} 
                        className="px-4 py-2 text-xs font-bold bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors shadow-lg shadow-red-500/20"
                    >
                        Confirm
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default App;
