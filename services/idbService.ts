
import { openDB, DBSchema } from 'idb';
import { Paper, ResearchGroup, ResearchNote, ResearchProject, AuthorProfile, CollaboratorProfile, HistoryItem, ColdEmail, UserContextProfile, FeatureIdea, LogEntry, LikedPaper, Fellowship, IdeationSession, PromptTemplate } from '../types';

const DB_NAME = 'ResearchStudioDB';
const DB_VERSION = 1;

export const STORE_NAMES = [
  'papers', 'groups', 'notes', 'projects', 'authorProfiles', 
  'collaboratorProfiles', 'history', 'outreach', 'userContextProfiles', 
  'featureIdeas', 'logs', 'settings', 'likedPapers', 'localPdfs',
  'fellowships', 'ideationSessions', 'promptTemplates'
] as const;

type StoreName = typeof STORE_NAMES[number];

interface ResearchStudioDB extends DBSchema {
  papers: { key: string; value: Paper; };
  groups: { key: string; value: ResearchGroup; };
  notes: { key: string; value: ResearchNote; };
  projects: { key: string; value: ResearchProject; };
  authorProfiles: { key: string; value: AuthorProfile & { name: string }; };
  collaboratorProfiles: { key: string; value: CollaboratorProfile; };
  history: { key: string; value: HistoryItem; };
  outreach: { key: string; value: ColdEmail; };
  userContextProfiles: { key: string; value: UserContextProfile; };
  featureIdeas: { key: string; value: FeatureIdea; };
  logs: { key: string; value: LogEntry; };
  settings: { key: string; value: { key: string; value: any }; };
  likedPapers: { key: string; value: LikedPaper; };
  localPdfs: {
    key: string;
    value: {
      paperId: string;
      data: ArrayBuffer;
    };
  };
  fellowships: { key: string; value: Fellowship; };
  ideationSessions: { key: string; value: IdeationSession; };
  promptTemplates: { key: string; value: PromptTemplate; };
}

export const dbPromise = openDB<ResearchStudioDB>(DB_NAME, DB_VERSION, {
  upgrade(db) {
    if (!db.objectStoreNames.contains('papers')) {
      db.createObjectStore('papers', { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains('groups')) {
      db.createObjectStore('groups', { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains('notes')) {
      db.createObjectStore('notes', { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains('projects')) {
      db.createObjectStore('projects', { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains('authorProfiles')) {
      db.createObjectStore('authorProfiles', { keyPath: 'name' });
    }
    if (!db.objectStoreNames.contains('collaboratorProfiles')) {
      db.createObjectStore('collaboratorProfiles', { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains('history')) {
      db.createObjectStore('history', { keyPath: 'metadata.arxivId' });
    }
    if (!db.objectStoreNames.contains('outreach')) {
      db.createObjectStore('outreach', { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains('userContextProfiles')) {
      db.createObjectStore('userContextProfiles', { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains('featureIdeas')) {
      db.createObjectStore('featureIdeas', { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains('logs')) {
      db.createObjectStore('logs', { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains('settings')) {
      db.createObjectStore('settings', { keyPath: 'key' });
    }
    if (!db.objectStoreNames.contains('likedPapers')) {
      db.createObjectStore('likedPapers', { keyPath: 'arxivId' });
    }
    if (!db.objectStoreNames.contains('localPdfs')) {
      db.createObjectStore('localPdfs', { keyPath: 'paperId' });
    }
    if (!db.objectStoreNames.contains('fellowships')) {
      db.createObjectStore('fellowships', { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains('ideationSessions')) {
      db.createObjectStore('ideationSessions', { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains('promptTemplates')) {
      db.createObjectStore('promptTemplates', { keyPath: 'id' });
    }
  },
});

export const dbService = {
  async getAll<T extends StoreName>(storeName: T): Promise<ResearchStudioDB[T]['value'][]> {
    return (await dbPromise).getAll(storeName);
  },

  async get<T extends StoreName>(storeName: T, key: string): Promise<ResearchStudioDB[T]['value'] | undefined> {
    return (await dbPromise).get(storeName, key);
  },
  
  async set<T extends StoreName>(storeName: T, value: ResearchStudioDB[T]['value']): Promise<IDBValidKey> {
    return (await dbPromise).put(storeName, value);
  },

  async bulkSet<T extends StoreName>(storeName: T, values: ResearchStudioDB[T]['value'][]): Promise<void> {
    const db = await dbPromise;
    const tx = db.transaction(storeName, 'readwrite');
    await Promise.all(values.map(value => tx.store.put(value)));
    await tx.done;
  },

  async deleteItem<T extends StoreName>(storeName: T, key: string): Promise<void> {
    return (await dbPromise).delete(storeName, key);
  },

  async clearStore(storeName: StoreName): Promise<void> {
    return (await dbPromise).clear(storeName);
  },
};
