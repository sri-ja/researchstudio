
import { FeatureIdea } from '../types';
import { dbService } from './idbService';

class FeatureIdeasService {
  private ideas: FeatureIdea[] = [];
  private subscribers: ((ideas: FeatureIdea[]) => void)[] = [];
  private isInitialized: Promise<void>;

  constructor() {
    this.isInitialized = this.initialize();
  }

  private async initialize() {
    try {
      this.ideas = await dbService.getAll('featureIdeas');
      this.notify();
    } catch (e) {
      console.error("Failed to initialize ideas from DB", e);
      this.ideas = [];
    }
  }

  private notify() {
    this.subscribers.forEach(cb => cb([...this.ideas]));
  }

  public subscribe(callback: (ideas: FeatureIdea[]) => void): () => void {
    this.subscribers.push(callback);
    this.isInitialized.then(() => callback([...this.ideas])); // Initial call after loaded
    return () => {
      this.subscribers = this.subscribers.filter(cb => cb !== callback);
    };
  }

  public async add(content: string) {
    await this.isInitialized;
    const newIdea: FeatureIdea = {
      id: crypto.randomUUID(),
      content,
      status: 'todo',
      createdAt: Date.now(),
    };
    this.ideas.unshift(newIdea);
    await dbService.set('featureIdeas', newIdea);
    this.notify();
  }

  public async updateStatus(id: string, status: 'todo' | 'done') {
    await this.isInitialized;
    const ideaToUpdate = this.ideas.find(idea => idea.id === id);
    if (ideaToUpdate) {
      const updatedIdea = { ...ideaToUpdate, status };
      this.ideas = this.ideas.map(idea =>
        idea.id === id ? updatedIdea : idea
      );
      await dbService.set('featureIdeas', updatedIdea);
      this.notify();
    }
  }

  public async delete(id: string) {
    await this.isInitialized;
    this.ideas = this.ideas.filter(idea => idea.id !== id);
    await dbService.deleteItem('featureIdeas', id);
    this.notify();
  }
}

export const featureIdeasService = new FeatureIdeasService();
