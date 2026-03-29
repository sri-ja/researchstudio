import { logger } from './loggingService';
import { dbPromise, STORE_NAMES } from './idbService';

export const exportData = async () => {
  const backupData: Record<string, any> = {};
  
  try {
    for (const storeName of STORE_NAMES) {
      const db = await dbPromise;
      backupData[storeName] = await db.getAll(storeName);
    }

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().split('T')[0];
    a.href = url;
    a.download = `research-studio-backup-${date}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
      logger.error('Export failed', error);
      throw error;
  }
};

export const importData = async (file: File): Promise<void> => {
    // Standard logger is fine here at the start
    console.log('[LOG INFO] importData service called.');
    if (!file) {
      throw new Error("No file provided.");
    }

    let text: string | null;
    try {
        text = await file.text();
    } catch (e: any) {
        console.error("File Read Error", e);
        throw new Error("Failed to read the file. It might be corrupt or unreadable.");
    }

    let data: any;
    try {
        data = JSON.parse(text);
        text = null; // Explicitly free the huge string memory immediately
    } catch (e) {
        console.error('JSON Parse Error', e);
        throw new Error("The file contains invalid JSON data.");
    }

    // Comprehensive validation & schema migration
    for (const storeName of STORE_NAMES) {
        if (!data.hasOwnProperty(storeName)) {
            data[storeName] = [];
        } else if (!Array.isArray(data[storeName])) {
            throw new Error(`Invalid backup format: '${storeName}' should be a list.`);
        }
    }

    // Perform Import within a single atomic transaction
    try {
        console.log('Starting atomic database import transaction.');
        const db = await dbPromise;
        const tx = db.transaction(STORE_NAMES, 'readwrite');
        
        await Promise.all(
            STORE_NAMES.map(async (storeName) => {
                const store = tx.objectStore(storeName);
                await store.clear();
                
                const items = data[storeName];
                // Free data property as we process it if possible, though iteration keeps ref.
                // Just process normally.
                if (items && items.length > 0) {
                    await Promise.all(items.map((item: any) => store.put(item)));
                }
            })
        );

        data = null; // Free the JSON object memory
        await tx.done; // Commit the transaction
        console.log('Database import transaction complete.');
    } catch (e: any) {
        console.error("DB Import Error", e);
        throw new Error(`Database error during import: ${e.message}`);
    }
};