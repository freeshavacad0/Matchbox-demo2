import React, { useEffect, useState } from "react";
import { Profile } from "./types";

const DEMO_PROFILES: Profile[] = [
  {
    id: "p1",
    name: "Maya R.",
    age: 29,
    avatarText: "Maya",
    bio: "Software engineer, sunrise runner, indie sci-fi fan.",
    styleExamples: ["Just shipped a tiny feature. Celebration: ramen + reading.", "If coffee had a loyalty program I'd be a platinum member."],
    photo: "/placeholder1.png"
  },
  {
    id: "p2",
    name: "Alex P.",
    age: 34,
    avatarText: "Alex",
    bio: "Freelance photographer who posts long-form travel stories.",
    styleExamples: ["Traded four rolls of film for a night's stay and a story.", "Golden hour makes cities feel like secrets."],
    photo: "/placeholder2.png"
  },
  {
    id: "p3",
    name: "Jordan K.",
    age: 27,
    avatarText: "Jordan",
    bio: "Nurse, family-oriented, likes weekend hikes and big dinners.",
    styleExamples: ["Family dinner = therapy, calories, and unsolicited advice.", "Hiked 7 miles. Knees: 0, Spirit: 100."],
    photo: "/placeholder3.png"
  }
];

type SaveRecord = {
  savedById: string; // user who saved
  savedProfileId: string; // profile id that was saved
  ts: number;
  expires?: number; // intro window
  revealed?: boolean;
  audioDataUrl?: string;
  messages?: { fromId: string; text: string; ts: number }[];
  generatedReplies?: string[];
};

function uid(prefix="u") {
  return prefix + Math.random().toString(36).slice(2,9);
}

const MOCK_USERS = [
  { id: "u_me", name: "You", provider: "email" },
  { id: "u_maya", name: "Maya", provider: "facebook" },
  { id: "u_alex", name: "Alex", provider: "x" }
];

export default function App(){
  const [profiles] = useState<Profile[]>(DEMO_PROFILES);
  const [currentUser, setCurrentUser] = useState(MOCK_USERS[0]);
  const [signedIn, setSignedIn] = useState(false);
  const [daily, setDaily] = useState<Profile[]>(profiles);
  const [deck, setDeck] = useState<Profile[]>([]);
  const [saves, setSaves] = useState<SaveRecord[]>([]);
  const [speedMs, setSpeedMs] = useState(60000); // demo timer speed for expirations
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);

  useEffect(()=>{
    // load from localStorage
    const ls = localStorage.getItem("match_demo_state");
    if (ls) {
      const parsed = JSON.parse(ls);
      setDeck(parsed.deck || []);
      setSaves(parsed.saves || []);
    }
  },[]);

  useEffect(()=>{
    // persist
    const state = { deck, saves };
    localStorage.setItem("match_demo_state", JSON.stringify(state));
  },[deck,saves]);

  useEffect(()=>{
    let t = setInterval(()=>{
      // expire saves based on simulated windows
      const now = Date.now();
      let changed=False;
    }, 2000);
    return ()=>clearInterval(t);
  },[saves]);


  function mockSignIn(provider: string){
    // simulated oauth: pick a mock user based on provider
    const user = MOCK_USERS.find(u=>u.provider===provider) || MOCK_USERS[0];
    setCurrentUser(user);
    setSignedIn(true);
  }

  function thumbDown(p: Profile){
    setDaily(d=>d.filter(x=>x.id!==p.id));
  }

  function saveForLater(p: Profile){
    if (!deck.find(d=>d.id===p.id)){
      setDeck(d=>[...d,p]);
      const now = Date.now();
      // when someone saves another, create a record: savedBy = currentUser, savedProfileId = p.id
      const rec: SaveRecord = { savedById: currentUser.id, savedProfileId: p.id, ts: now, expires: now + speedMs*4, messages: [] };
      setSaves(s=>[...s, rec]);
      alert(`Saved ${p.name}. The saved person will be able to generate replies when viewing their account.`);
    }
  }

  function requestReveal(rec: SaveRecord){
    // Only allow reveal action by the saved person viewing their account (i.e., currentUser.id === savedProfile owner simulated)
    // For demo, if currentUser is the person who was saved (we map profiles to user ids for Maya/Alex)
    const profileOwnerId = profileIdToUserId(rec.savedProfileId);
    if (currentUser.id !== profileOwnerId){
      alert("Only the saved person can request to generate replies or reveal. Switch users to simulate.");
      return;
    }
    // create a "reveal request" where saved person can send a message within 24h (simulated)
    const now = Date.now();
    const updated = saves.map(s=> s === rec ? {...s, revealed:true, revealExpires: now + speedMs} : s);
    setSaves(updated);
    alert("Reveal requested — you can generate replies now.");
  }

  function profileIdToUserId(pid: string){
    if (pid === "p1") return "u_maya";
    if (pid === "p2") return "u_alex";
    return "u_me";
  }

  // generate replies endpoint (mocked) — only allow when currentUser is the saved person for that save record
  function generateRepliesForSave(rec: SaveRecord){
    const profile = profiles.find(p=>p.id===rec.savedProfileId)!;
    const ownerId = profileIdToUserId(rec.savedProfileId);
    if (currentUser.id !== ownerId){
      alert("Only the person who was saved can generate replies for that save.");
      return;
    }
    // use styleExamples to craft 3 variants
    const seeds = profile.styleExamples.join(" | ");
    const suggestions = [
      `Hey ${rec.savedById === "u_me" ? "there" : "friend"}, loved what you wrote — would you like coffee sometime?`,
      `Hi! Your travel story was wild. Want to swap photos over drinks?`,
      `Nice to meet you — I’m ${profile.name.split(" ")[0]}. Your hiking story made my day.`
    ];
    // attach to save record
    const updated = saves.map(s=> s === rec ? {...s, generatedReplies: suggestions} : s);
    setSaves(updated);
  }

  // send message from current user to the other
  function sendMessage(rec: SaveRecord, text: string){
    const updated = saves.map(s=> s === rec ? {...s, messages: [...(s.messages||[]), {fromId: currentUser.id, text, ts: Date.now()}]} : s);
    setSaves(updated);
  }

  // audio recording via MediaRecorder
  async function startRecording(){
    if (!navigator.mediaDevices) { alert("Recording not supported in this browser"); return; }
    try{
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      setAudioChunks([]);
      mr.ondataavailable = (e)=> setAudioChunks(prev=>[...prev, e.data]);
      mr.onstop = async ()=>{
        const blob = new Blob(audioChunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = ()=>{
          const dataUrl = reader.result as string;
          // attach to latest save where currentUser is owner and reveal is true
          // find rec where profile owner === currentUser and revealed true
          const rec = saves.find(s=> profileIdToUserId(s.savedProfileId) === currentUser.id && s.revealed);
          if (rec){
            const updated = saves.map(s=> s === rec ? {...s, audioDataUrl: dataUrl} : s);
            setSaves(updated);
            alert("Audio saved to the interaction record.");
          } else {
            alert("No available save to attach audio to. (Switch to the saved user's account.)");
          }
        };
        reader.readAsDataURL(blob);
      };
      mr.start();
      setMediaRecorder(mr);
      setRecording(true);
    }catch(err){
      console.error(err);
      alert("Could not start recording: " + (err as any).message);
    }
  }

  function stopRecording(){
    if (mediaRecorder){
      mediaRecorder.stop();
      setRecording(false);
    }
  }

  function switchUser(id: string){
    const u = MOCK_USERS.find(x=>x.id===id);
    if (u){ setCurrentUser(u); setSignedIn(true); }
  }

  function revealUIFor(rec: SaveRecord){
    const ownerId = profileIdToUserId(rec.savedProfileId);
    if (currentUser.id !== ownerId) return null;
    // if revealed, show generate button + messages + audio UI
    if (rec.revealed){
      return (
        <div>
          <div className="section-title">Generate replies (only for you)</div>
          <div className="suggestions">
            {rec.generatedReplies ? rec.generatedReplies.map((r,i)=>(<div className="suggestion" key={i}>{r}</div>)) : <div className="muted">No suggestions yet.</div>}
          </div>
          <div style={{marginTop:8}}>
            <button className="btn ghost" onClick={()=>generateRepliesForSave(rec)}>Generate 3 replies</button>
            <button className="btn" style={{marginLeft:8}} onClick={()=> startRecording()} disabled={recording}>Start Recording</button>
            <button className="btn ghost" style={{marginLeft:8}} onClick={()=> stopRecording()} disabled={!recording}>Stop</button>
          </div>
          <div style={{marginTop:8}}>
            <div className="section-title">Messages</div>
            {(rec.messages||[]).map((m,idx)=>(
              <div key={idx} style={{padding:6,background:'#fff',borderRadius:8,marginBottom:6}}>
                <div style={{fontSize:13,fontWeight:700}}>{m.fromId === currentUser.id ? "You" : m.fromId}</div>
                <div className="muted">{m.text}</div>
              </div>
            ))}
            <SendBox onSend={(txt)=> sendMessage(rec, txt)} />
            {rec.audioDataUrl && <div style={{marginTop:8}}><audio src={rec.audioDataUrl} controls /></div>}
          </div>
        </div>
      );
    } else {
      // show reveal request
      return <button className="btn" onClick={()=> requestReveal(rec)}>Request Reveal (72h rule demo)</button>;
    }
  }

  return (
    <div className="app">
      <div className="header">
        <div className="brand">
          <div className="logo">MB</div>
          <div>
            <h1>Matchbox — React demo</h1>
            <div className="muted">Signed in as <strong>{currentUser.name}</strong></div>
          </div>
        </div>
        <div className="controls">
          <div>
            <label className="muted">Timer speed (ms): </label>
            <input value={speedMs} onChange={e=>setSpeedMs(Number(e.target.value))} style={{width:120,marginLeft:8}} />
          </div>
        </div>
      </div>

      <div className="pane">
        <div className="main">
          <div className="card">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <div className="section-title">Today's Matches</div>
                <div className="muted">Choose carefully. Save to enable replies for the saved person.</div>
              </div>
              <div>
                <div className="switch-user card">
                  <div style={{marginBottom:8}}>Simulate sign-in</div>
                  <div style={{display:'flex',gap:8}}>
                    {MOCK_USERS.map(u=>(
                      <button key={u.id} className="btn ghost" onClick={()=> switchUser(u.id)}>{u.name}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="profiles" style={{marginTop:12}}>
              {daily.map(p=>(
                <div key={p.id} className="profile">
                  <div className="avatar">
                    <div>
                      <div style={{fontSize:18,fontWeight:700}}>{p.name}</div>
                      <div className="muted" style={{fontSize:13}}>{p.age} • {p.bio}</div>
                    </div>
                  </div>
                  <div className="meta">
                    <div className="name">{p.name}</div>
                    <div className="muted">Active now</div>
                  </div>
                  <div style={{fontSize:14,color:'#222',marginTop:6}}>{p.bio}</div>
                  <div className="actions">
                    <button className="btn ghost" onClick={()=> thumbDown(p)}>Pass</button>
                    <button className="btn" onClick={()=> saveForLater(p)}>Save for later</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="section-title">Interaction History</div>
            <div className="muted">Saves and reveal requests</div>
            <div style={{marginTop:10}}>
              {saves.length===0 && <div className="muted">No interactions yet.</div>}
              {saves.map((rec,idx)=>(
                <div key={idx} className="deck-item" style={{marginTop:8,flexDirection:'column',alignItems:'stretch'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <div style={{display:'flex',gap:10,alignItems:'center'}}>
                      <div className="small-avatar">{(profiles.find(p=>p.id===rec.savedProfileId)?.avatarText) || 'P'}</div>
                      <div>
                        <div style={{fontWeight:700}}>{profiles.find(p=>p.id===rec.savedProfileId)?.name}</div>
                        <div className="muted">Saved by: {rec.savedById}</div>
                      </div>
                    </div>
                    <div className="muted">Expires: <span className="timer">{rec.expires? new Date(rec.expires).toLocaleString() : '—'}</span></div>
                  </div>
                  <div style={{marginTop:8}}>{revealUIFor(rec)}</div>
                </div>
              ))}
            </div>
          </div>

        </div>

        <aside className="sidebar">
          <div className="card">
            <div className="section-title">Saved Deck</div>
            <div className="deck-list">
              {deck.length===0 && <div className="muted">No saved profiles</div>}
              {deck.map(d=>(
                <div key={d.id} className="deck-item">
                  <div className="small-avatar">{d.avatarText}</div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700}}>{d.name}</div>
                    <div className="muted">{d.age} • saved</div>
                  </div>
                  <div>
                    <button className="btn ghost" onClick={()=> setSelectedProfile(d)}>View</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{marginTop:12}}>
            <div className="section-title">Notes</div>
            <div className="muted">Only the saved person (when signed into their account) can generate replies for a save record. This demo simulates that by allowing you to switch users on the top-right.</div>
          </div>

        </aside>
      </div>

      <div className="footer">
        This is a static demo. Next steps: convert to full-stack app with real OAuth and messaging.
      </div>
    </div>
  );
}

function SendBox({onSend}:{onSend:(t:string)=>void}){
  const [txt,setTxt] = useState("");
  return (
    <div style={{display:'flex',gap:8,marginTop:8}}>
      <input value={txt} onChange={e=>setTxt(e.target.value)} placeholder="Write a message..." style={{flex:1,padding:8,borderRadius:8,border:'1px solid #eef2ff'}} />
      <button className="btn" onClick={()=>{ onSend(txt); setTxt(""); }}>Send</button>
    </div>
  );
}
