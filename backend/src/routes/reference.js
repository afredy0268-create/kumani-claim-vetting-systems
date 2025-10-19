const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/reference/medicine/:code
router.get('/medicine/:code', (req, res) => {
  const code = req.params.code;
  try {
    const row = db.prepare('SELECT * FROM medicine_rules WHERE code = ?').get(code);
    res.json({ success: true, medicine: row || null });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/reference/dx/:icd
router.get('/dx/:icd', (req, res) => {
  const icd = req.params.icd;
  try {
    const row = db.prepare('SELECT recommended FROM dx_tx_map WHERE icd = ?').get(icd);
    res.json({ success: true, recommended: row ? row.recommended : null });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
