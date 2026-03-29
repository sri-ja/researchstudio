
import { LogEntry } from '../types';
import { dbService } from './idbService';

const MAX_LOGS = 200;

class Logger {
  private logs: LogEntry[] = [];
  private subscribers: ((logs: LogEntry[]) => void)[] = [];
  private isInitialized: Promise<void>;

  constructor() {
    this.isInitialized = this.initialize();
  }

  private async initialize() {
    try {
      this.logs = await dbService.getAll('logs');
      this.notify();
    } catch (e) {
      console.error("Failed to initialize logger from DB", e);
      this.logs = [];
    }
  }

  private notify() {
    this.subscribers.forEach(cb => cb([...this.logs]));
  }

  public subscribe(callback: (logs: LogEntry[]) => void): () => void {
    this.subscribers.push(callback);
    // Immediately notify with the current logs
    this.isInitialized.then(() => callback([...this.logs]));
    // Return an unsubscribe function
    return () => {
      this.subscribers = this.subscribers.filter(cb => cb !== callback);
    };
  }

  private async addLog(type: LogEntry['type'], message: string, stack?: string) {
    await this.isInitialized;

    const newLog: LogEntry = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      type,
      message,
      stack,
    };
    
    this.logs.unshift(newLog);
    if (this.logs.length > MAX_LOGS) {
      this.logs.length = MAX_LOGS;
    }
    
    // Persist and then notify
    try {
        await dbService.set('logs', newLog);
        // Prune old logs from DB if we exceed the limit
        if (this.logs.length >= MAX_LOGS) {
            const logsToDelete = await dbService.getAll('logs');
            logsToDelete.sort((a,b) => a.timestamp - b.timestamp);
            const oldestLog = logsToDelete[0];
            if(oldestLog) await dbService.deleteItem('logs', oldestLog.id);
        }
    } catch (e) {
        console.error("Failed to save log to DB", e);
    }

    this.notify();
  }

  public error(message: string, errorObj?: any) {
    let stack: string | undefined;
    if (errorObj instanceof Error) {
        stack = errorObj.stack;
    } else if (typeof errorObj === 'object' && errorObj !== null) {
        try {
            stack = JSON.stringify(errorObj, null, 2);
        } catch {
            stack = 'Could not stringify error object.';
        }
    } else if (errorObj) {
        stack = String(errorObj);
    }
    this.addLog('error', message, stack);
    console.error(`[LOG ERROR] ${message}`, errorObj);
  }
  
  public warn(message: string) {
    this.addLog('warn', message);
    console.warn(`[LOG WARN] ${message}`);
  }

  public info(message: string) {
    this.addLog('info', message);
    console.log(`[LOG INFO] ${message}`);
  }

  public async clearLogs() {
    this.logs = [];
    try {
        await dbService.clearStore('logs');
    } catch(e) {
        console.error("Failed to clear logs in DB", e);
    }
    this.notify();
  }
}

export const logger = new Logger();
