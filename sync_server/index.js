const express = require('express');
const app = express();
app.use(express.json({limit:'10mb'}));
app.post('/api/sync/push', (req,res)=>{
  // TODO: validate payload, store to central DB, respond with status
  console.log('Received push:', req.body && req.body.claims ? req.body.claims.length : 0);
  res.json({ success:true, received: req.body.claims ? req.body.claims.length : 0 });
});
app.get('/api/sync/pull', (req,res)=>{
  // TODO: return updated reference tables (benefit_list, medicine_rules, dx_tx_map)
  res.json({ success:true, benefit_list:[], medicine_rules:[], dx_tx_map:[] });
});
app.listen(4500, ()=>console.log('Sync server listening on 4500'));
