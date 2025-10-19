const express = require('express');
const app = express();
app.use(express.json());
app.get('/', (req,res)=>res.send('NHIA Vetting Backend'));
app.listen(4000, ()=>console.log('Server on 4000'));
