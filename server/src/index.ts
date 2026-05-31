import { connectDB, isConnected, getDBDiagnostics } from './config/db.js';
import app from './app.js';

const PORT = process.env.PORT || 3001;

// Health check (added here since it references db state directly)
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    db: isConnected() ? 'connected' : 'disconnected',
    diagnostics: getDBDiagnostics(),
    timestamp: Date.now(),
  });
});

// Connect to MongoDB and start listening
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Raksha server running on port ${PORT}`);
  });
});
