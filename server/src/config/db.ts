import { initDb, isDbReady, getDbDiagnostics as jsonDbDiagnostics } from './jsonDb.js';

export function isConnected(): boolean {
  return isDbReady();
}

export function getDBDiagnostics() {
  const d = jsonDbDiagnostics();
  return {
    connected: d.connected,
    engine: 'json-file',
    userCount: d.userCount,
    otpCount: d.otpCount,
    file: d.file,
  };
}

export async function connectDB(): Promise<void> {
  initDb();
  console.log('📁 JSON file database initialized — no MongoDB needed');
}
