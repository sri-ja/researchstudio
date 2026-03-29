
import React from 'react';

export interface Highlight {
  id: string;
  text: string;
  note: string;
  color: string;
  createdAt: number;
  position?: {
    pageNumber: number;
    boundingRect: { x: number; y: number; width: number; height: number };
    rects: { x: number; y: number; width: number; height: number }[];
  };
}

export interface ResearchGroup {
  id: string;
  name: string;
  color: string;
  readme: string;
  createdAt: number;
}

export interface AiInsight {
  id: string;
  type: 'summary' | 'eli5' | 'methodology' | 'gaps' | 'custom' | 'legacy';
  question: string;
  answer: string;
  createdAt: number;
}

export interface RelatedPaper {
  title: string;
  authors: string[];
  year: string;
  reason: string;
}

export interface RelatedPapersResult {
  papers: RelatedPaper[];
  generatedAt: number;
}

export interface Paper {
  id: string;
  arxivId: string;
  title: string;
  authors: string[];
  summary: string;
  published: string;
  notes: string;
  tags: string[];
  highlights: Highlight[];
  aiInsights?: AiInsight[];
  relatedPapers?: RelatedPapersResult;
  aiAnalysis?: string; 
  addedAt: number;
  groupId?: string;
}

export interface ResearchNote {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  groupId?: string;
}

export interface ProjectTask {
  id: string;
  content: string;
  status: 'todo' | 'in-progress' | 'done';
  createdAt: number;
}

export interface ProjectLogEntry {
  id: string;
  content: string;
  images: string[];
  createdAt: number;
}

export interface ProjectLiterature {
  paperId: string;
  relevanceNote: string;
}

export interface ProjectMeeting {
  id: string;
  title: string;
  date: number;
  attendees: string;
  content: string;
}

export interface ColdEmail {
  id: string;
  recipientName: string;
  recipientEmail: string;
  affiliation: string;
  status: 'draft' | 'sent' | 'replied' | 'follow-up';
  subject: string;
  body: string;
  lastUpdated: number;
  notes?: string;
}

export interface UserContextProfile {
  id: string;
  name: string;
  content: string;
}

export interface ProjectMember {
  id: string;
  name: string;
  role: string;
  affiliation: string;
  email: string;
}

export interface ResearchProject {
  id: string;
  title: string;
  description: string;
  status: 'active' | 'archived' | 'completed';
  deadline?: number;
  tasks: ProjectTask[];
  logs: ProjectLogEntry[];
  literature: ProjectLiterature[];
  meetings: ProjectMeeting[];
  outreach: ColdEmail[];
  team: ProjectMember[];
  paperOutline: string;
  createdAt: number;
  updatedAt: number;
}

export interface AuthorProfile {
  name: string;
  bio: string;
  generatedAt: number;
}

export interface CollaboratorProfile {
  id: string;
  name: string;
  notes: string;
}

export type ViewMode = 'list' | 'detail';

export interface ArxivMetadata {
  title: string;
  summary: string;
  authors: string[];
  published: string;
  arxivId: string;
  category?: string;
}

export interface HistoryItem {
    metadata: ArxivMetadata;
    seenAt: number;
}

export interface FeatureIdea {
  id: string;
  content: string;
  status: 'todo' | 'done';
  createdAt: number;
}

export interface LogEntry {
  id: string;
  timestamp: number;
  type: 'error' | 'warn' | 'info';
  message: string;
  stack?: string;
}

export interface ApplicationMaterial {
  id: string;
  title: string;
  content: string;
}

export interface Fellowship {
  id: string;
  title: string;
  organization: string;
  status: 'open' | 'applied' | 'closed';
  deadline: number;
  website: string;
  description: string;
  notes: string;
  createdAt: number;
  applicationMaterials?: ApplicationMaterial[];
}

// --- IDEATION TYPES ---

export type PersonaType = 'IDEATOR' | 'CRITIC' | 'SYNTHESIZER' | 'PLANNER';

export interface PromptTemplate {
    id: string;
    name: string;
    text: string;
    persona: PersonaType;
    createdAt: number;
}

export interface IdeationMessage {
    id: string;
    role: 'user' | 'model';
    text: string;
    thinking?: string;
    timestamp: number;
    persona?: PersonaType;
}

export interface IdeationSession {
    id: string;
    title: string;
    messages: IdeationMessage[];
    ideatorModelId: string;
    criticModelId: string;
    synthesizerModelId: string;
    plannerModelId: string;
    ideatorPrompt?: string;
    criticPrompt?: string;
    synthesizerPrompt?: string;
    plannerPrompt?: string;
    useSearchIdeator?: boolean;
    useSearchCritic?: boolean;
    useSearchSynthesizer?: boolean;
    useSearchPlanner?: boolean;
    useDynamicTermination?: boolean;
    isUncapped?: boolean;
    maxRounds: number;
    rounds: number;
    relatedWorks?: string; // New field for user provided context
    createdAt: number;
    updatedAt: number;
}

export type SelectionState = 
  | { type: 'paper'; id: string }
  | { type: 'group'; id: string }
  | { type: 'note'; id: string }
  | { type: 'author'; id: string }
  | { type: 'project'; id: string }
  | { type: 'ideation'; id?: string }
  | { type: 'feed' }
  | { type: 'outreach' }
  | { type: 'collaborators' }
  | { type: 'authors' }
  | { type: 'applications' }
  | null;

export interface CommandAction {
  id: string;
  title: string;
  category: 'Navigation' | 'Action' | 'Paper' | 'Note' | 'Project' | 'Group' | 'Author' | 'Fellowship' | 'Ideation';
  onSelect: () => void;
  icon: React.ReactNode;
  keywords?: string;
}

export interface LikedPaper {
  arxivId: string;
  title: string;
  summary: string;
  authors: string[];
  likedAt: number;
}

export interface TopicInsight {
  topic: string;
  explanation: string;
}

export interface UserTasteProfile {
  insights: TopicInsight[];
  generatedAt: number;
  sourcePaperIds: string[];
}
