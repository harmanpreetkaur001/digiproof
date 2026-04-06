require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/evidence', require('./routes/evidence'));
app.use('/api/fir', require('./routes/fir'));
app.use('/api/audit', require('./routes/audit'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Connect DB and start
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    app.listen(process.env.PORT, () =>
      console.log(`🔒 LockBox API running on http://localhost:${process.env.PORT}`)
    );
  })
  .catch(err => {
    console.error('MongoDB connection failed:', err.message);
    console.log('⚠️  Starting without DB (demo mode)...');
    app.listen(process.env.PORT, () =>
      console.log(`🔒 LockBox API running on http://localhost:${process.env.PORT} (no DB)`)
    );
  });
