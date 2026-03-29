
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { CommandAction } from '../types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  actions: CommandAction[];
}

const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, actions }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const filteredActions = useMemo(() => {
    if (!searchTerm) {
      return actions;
    }
    const lowerSearch = searchTerm.toLowerCase();
    return actions.filter(
      (action) =>
        action.title.toLowerCase().includes(lowerSearch) ||
        action.category.toLowerCase().includes(lowerSearch) ||
        action.keywords?.toLowerCase().includes(lowerSearch)
    );
  }, [searchTerm, actions]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredActions.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredActions.length) % filteredActions.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredActions[selectedIndex]) {
          filteredActions[selectedIndex].onSelect();
          onClose();
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredActions, selectedIndex, onClose]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [searchTerm]);

  if (!isOpen) return null;

  const groupedActions = filteredActions.reduce((acc, action) => {
    (acc[action.category] = acc[action.category] || []).push(action);
    return acc;
  }, {} as Record<string, CommandAction[]>);

  const categoryOrder: CommandAction['category'][] = ['Action', 'Navigation', 'Project', 'Group', 'Paper', 'Note', 'Author'];

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/60 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in-5 zoom-in-95 duration-200"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="relative">
            <input
                ref={inputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search or jump to..."
                className="w-full bg-transparent border-b border-slate-800 px-6 py-4 text-white text-lg focus:outline-none placeholder:text-slate-500"
            />
             <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-500 border border-slate-700 bg-slate-800 px-1.5 py-0.5 rounded-md">
                ESC
            </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto custom-scrollbar p-2">
            {filteredActions.length === 0 ? (
                <div className="text-center p-8 text-slate-500">No results found.</div>
            ) : (
                categoryOrder.map(category => {
                    const items = groupedActions[category];
                    if (!items) return null;

                    return (
                        <div key={category} className="mb-2">
                            <h3 className="px-2 py-1 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                {category}
                            </h3>
                            {items.map((action, index) => {
                                // Global index for selection
                                const globalIndex = filteredActions.findIndex(a => a.id === action.id);
                                return (
                                <div
                                    key={action.id}
                                    onMouseEnter={() => setSelectedIndex(globalIndex)}
                                    onClick={() => { action.onSelect(); onClose(); }}
                                    className={`flex items-center gap-4 px-3 py-2.5 rounded-lg cursor-pointer ${
                                        selectedIndex === globalIndex ? 'bg-indigo-600 text-white' : 'text-slate-300'
                                    }`}
                                >
                                    <div className={`${selectedIndex === globalIndex ? 'text-white' : 'text-slate-500'}`}>{action.icon}</div>
                                    <span className="flex-1 font-medium">{action.title}</span>
                                </div>
                                );
                            })}
                        </div>
                    )
                })
            )}
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
