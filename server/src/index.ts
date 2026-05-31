import { connectDB } from './config/db.js';
import app from './app.js';

const PORT = process.env.PORT || 3001;

// Connect to MongoDB and start listening
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Raksha server running on port ${PORT}`);
  });
});
