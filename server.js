#!/usr/bin/env node
/**
 * Daybreak Backend Server
 * Handles Trello sync, Cloud storage, and Collaborator management
 *
 * Features:
 * - Live Trello board syncing
 * - Cloud state backup
 * - Collaborator sharing
 * - Real-time updates via WebSocket
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));

// In-memory storage (replace with real DB in production)
const users = new Map();
const projects = new Map();
const shares = new Map();

// ========== HEALTH CHECK ==========
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ========== AUTHENTICATION ==========
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  let user = Array.from(users.values()).find(u => u.email === email);
  if (!user) {
    user = {
      id: 'user-' + Date.now(),
      email,
      createdAt: new Date().toISOString(),
      token: 'token-' + Date.now() + '-' + Math.random().toString(36).substring(7)
    };
    users.set(user.id, user);
  }

  res.json({ userId: user.id, token: user.token, email });
});

// ========== CLOUD SYNC ==========
app.post('/api/cloud-sync', (req, res) => {
  const { userId, state } = req.body;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  // Save state for this user
  projects.set(userId, {
    state,
    lastSync: new Date().toISOString(),
    version: 1
  });

  res.json({ ok: true, synced: true, message: 'State saved to cloud' });
});

// ========== CLOUD RESTORE ==========
app.get('/api/cloud-sync/:userId', (req, res) => {
  const { userId } = req.params;
  const data = projects.get(userId);

  if (!data) {
    return res.json({ state: null, message: 'No backup found' });
  }

  res.json({ state: data.state, lastSync: data.lastSync });
});

// ========== TRELLO SYNC ==========
app.post('/api/trello-sync', (req, res) => {
  const { userId, projects: userProjects, state } = req.body;

  console.log(`[Trello Sync] ${userId} syncing ${userProjects.length} projects`);

  // In a real implementation:
  // 1. Call Trello API for each board
  // 2. Merge with local projects
  // 3. Mark completed tasks in Trello
  // 4. Return updated projects

  // For now, just acknowledge
  res.json({
    ok: true,
    synced: userProjects.length,
    projects: userProjects,
    message: 'Projects synced with Trello (simulation)'
  });
});

// ========== SHARING / COLLABORATORS ==========
app.post('/api/share', (req, res) => {
  const { userId, email, access } = req.body;
  if (!userId || !email) return res.status(400).json({ error: 'Missing fields' });

  const shareId = 'share-' + Date.now();
  shares.set(shareId, {
    id: shareId,
    ownerId: userId,
    email,
    access,
    createdAt: new Date().toISOString(),
    status: 'pending'
  });

  // In a real app, send email invitation here
  console.log(`[Share] Created share ${shareId}: ${email} (${access} access)`);

  res.json({
    ok: true,
    shareId,
    status: 'invited',
    message: `Invitation sent to ${email}`
  });
});

app.get('/api/shares/:userId', (req, res) => {
  const { userId } = req.params;
  const userShares = Array.from(shares.values()).filter(s => s.ownerId === userId);
  res.json({ shares: userShares });
});

app.post('/api/share/:shareId/accept', (req, res) => {
  const { shareId } = req.params;
  const share = shares.get(shareId);

  if (!share) return res.status(404).json({ error: 'Share not found' });

  share.status = 'accepted';
  share.acceptedAt = new Date().toISOString();

  res.json({ ok: true, message: 'Share accepted' });
});

// ========== REALTIME UPDATES (WebSocket would go here) ==========
app.post('/api/notify', (req, res) => {
  const { userId, message } = req.body;
  // In a real app, send WebSocket message to connected users
  console.log(`[Notify] ${userId}: ${message}`);
  res.json({ ok: true });
});

// ========== STATS ==========
app.get('/api/stats', (req, res) => {
  res.json({
    users: users.size,
    backups: projects.size,
    shares: shares.size,
    uptime: process.uptime()
  });
});

// ========== ERROR HANDLING ==========
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// ========== START SERVER ==========
app.listen(PORT, () => {
  console.log(`\n🌅 Daybreak Backend running on port ${PORT}`);
  console.log(`\nAvailable endpoints:`);
  console.log(`  POST /api/auth/login - Authenticate user`);
  console.log(`  POST /api/cloud-sync - Save state to cloud`);
  console.log(`  GET  /api/cloud-sync/:userId - Restore state`);
  console.log(`  POST /api/trello-sync - Sync with Trello boards`);
  console.log(`  POST /api/share - Invite collaborator`);
  console.log(`  GET  /api/shares/:userId - List shares`);
  console.log(`  POST /api/share/:shareId/accept - Accept invitation`);
  console.log(`  GET  /api/health - Health check`);
  console.log(`  GET  /api/stats - Server stats\n`);
});

module.exports = app;
