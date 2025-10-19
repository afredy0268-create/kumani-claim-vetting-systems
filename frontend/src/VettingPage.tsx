import React, { useEffect, useState } from 'react';
import axios from 'axios';

export default function VettingPage(){ 
  const [claimId, setClaimId] = useState(''); 
  const [issues, setIssues] = useState([]); 
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);

  async function runValidate(){
    if(!claimId) return alert('Enter claimId to validate');
    setLoading(true);
    try{
      const r = await axios.post(`http://localhost:4000/api/validate/${claimId}`);
      // r.data.results expected: array of { item, issues }
      const data = r.data.results || r.data;
      // fetch suggestions for items where applicable
      for(const entry of data){
        entry.suggestions = [];
        for(const iss of entry.issues){
          if(iss.code === 'MISSING_MED_CODE'){
            // no suggestion from DB; leave to user
          } else if(iss.code === 'OVERSUPPLY' || iss.code === 'AGE_MED_MISMATCH' || iss.code === 'AGE_MED_ADULTONLY'){
            // fetch medicine rule
            try{
              const m = await axios.get(`http://localhost:4000/api/reference/medicine/${entry.item.code}`);
              if(m.data && m.data.medicine) entry.suggestions.push({ type:'medicine_rule', payload: m.data.medicine });
            }catch(e){}
          } else if(iss.code === 'TREATMENT_DIAGNOSIS_MISMATCH'){
            // fetch recommended treatments for diagnosis
            try{
              const rec = await axios.get(`http://localhost:4000/api/reference/dx/${entry.item.diagnosis}`);
              if(rec.data && rec.data.recommended) entry.suggestions.push({ type:'dx_recommended', payload: rec.data.recommended });
            }catch(e){}
          }
        }
      }
      setIssues(data);
    }catch(e){ alert('Validation failed: '+(e.response?.data?.error||e.message)); }
    setLoading(false);
  }

  async function applyStructuredFix(itemId, corrections, reason){
    try{
      const r = await axios.post(`http://localhost:4000/api/claim-item/${itemId}/correct`, { corrections, user: 'Alfred Quansah', reason });
      alert('Applied corrections');
      runValidate();
    }catch(e){ alert('Apply failed: '+(e.response?.data?.error||e.message)); }
  }

  return (
    <div style={{padding:20}}>
      <h2>Vetting / Validation</h2>
      <div>
        <input placeholder="Claim ID" value={claimId} onChange={e=>setClaimId(e.target.value)} />
        <button onClick={runValidate} disabled={loading}>{loading?'Validating...':'Run Validation'}</button>
      </div>
      <div style={{marginTop:12}}>
        {issues.length===0 && <div>No issues or run validation</div>}
        {issues.map((it:any, idx:number)=>(
          <div key={idx} style={{border:'1px solid #ddd', padding:8, marginBottom:8}}>
            <div><strong>Item ID:</strong> {it.item.id} | Code: {it.item.code} | Patient: {it.item.nhis_id}</div>
            <ul>
              {it.issues.map((iss:any,i:number)=>(<li key={i}><strong>{iss.code}</strong>: {iss.message}</li>))}
            </ul>
            <div>
              <strong>Suggestions:</strong>
              <ul>
                {it.suggestions.map((s:any,i:number)=>(
                  <li key={i}>
                    {s.type==='medicine_rule' && <div>Medicine rule: max_qty={s.payload.max_qty}, adult_only={s.payload.adult_only}</div>}
                    {s.type==='dx_recommended' && <div>Recommended treatments: {s.payload}</div>}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              {/* Quick-fix buttons for common issues */}
              {it.issues.some((x:any)=>x.code==='MISSING_MED_CODE') && <button onClick={()=>{ const code=prompt('Enter missing medicine code'); if(code) applyStructuredFix(it.item.id, { code }, 'Fill missing code'); }}>Fill med code</button>}
              {it.suggestions.some((s:any)=>s.type==='medicine_rule') && <button onClick={()=>{ const mr = it.suggestions.find((x:any)=>x.type==='medicine_rule').payload; const newQty = prompt('Adjust quantity to max allowed', String(mr.max_qty)); if(newQty) applyStructuredFix(it.item.id, { quantity: Number(newQty) }, 'Adjust qty to rule'); }}>Apply medicine-rule fix</button>}
              {it.suggestions.some((s:any)=>s.type==='dx_recommended') && <button onClick={()=>{ const rec = it.suggestions.find((x:any)=>x.type==='dx_recommended').payload; const pick = prompt('Recommended: ' + rec + '\nEnter treatment code to apply'); if(pick) applyStructuredFix(it.item.id, { treatment: pick }, 'Apply recommended treatment'); }}>Apply recommended treatment</button>}
              <button onClick={()=>{ applyStructuredFix(it.item.id, { corrected:1 }, 'Mark resolved') }}>Mark Resolved</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
