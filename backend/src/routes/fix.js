const express = require('express');
const router = express.Router();
const db = require('../db']);

// create audit table if not exists (run once)
try {
  db.prepare(`CREATE TABLE IF NOT EXISTS corrections_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER,
    field TEXT,
    old_value TEXT,
    new_value TEXT,
    user TEXT,
    reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`).run();
} catch(e){}

// Structured correction endpoint
router.post('/:itemId/correct', (req, res) => {
  const itemId = req.params.itemId;
  const { corrections, user, reason } = req.body || {};
  if(!corrections || typeof corrections !== 'object') return res.status(400).json({ error: 'corrections object required' });
  try {
    const getStmt = db.prepare('SELECT * FROM claim_items WHERE id = ?');
    const row = getStmt.get(itemId);
    if(!row) return res.status(404).json({ error: 'Item not found' });
    const fields = Object.keys(corrections);
    const updateParts = fields.map(f => `${f} = ?`).join(', ');
    const values = fields.map(f=> corrections[f]);
    // set corrected flag
    values.push(1); values.push(itemId);
    const sql = `UPDATE claim_items SET ${updateParts}, corrected = ? WHERE id = ?`;
    db.prepare(sql).run(...values);
    // insert audit rows
    const auditStmt = db.prepare('INSERT INTO corrections_audit (item_id, field, old_value, new_value, user, reason) VALUES (?,?,?,?,?,?)');
    for(const f of fields){
      auditStmt.run(itemId, f, row[f], corrections[f], user || 'system', reason || null);
    }
    res.json({ success: true });
  } catch(e){ res.status(500).json({ error: e.message }); }
});

module.exports = router;
