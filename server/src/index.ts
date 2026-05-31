import { connectDB } from './config/db.js';
import app from './app.js';

const PORT = process.env.PORT || 3001;

// Initialize JSON DB and start listening
connectDB();
app.listen(PORT, () => {
  console.log(`🚀 Raksha server running on port ${PORT}`);
});
