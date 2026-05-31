import { initDb, isReady } from './jsonDb.js';

export function isConnected(): boolean {
  return isReady();
}

export function getDBDiagnostics() {
  return {
    type: 'json-local',
    connected: isReady(),
    dataFile: 'server/data/db.json',
  };
}

export async function connectDB(): Promise<void> {
  try {
    initDb();
    console.log('✅ JSON database ready');
  } catch (err) {
    console.error('❌ JSON database error:', err);
  }
}
