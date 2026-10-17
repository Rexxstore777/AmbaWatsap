'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from './lib/supabase';
import { Phone, PhoneOff, Mic, Send, LogOut, Search, MessageSquare } from 'lucide-react';

// === CSS INLINE BIAR GAK JELEK ===
const css = {
  container: { height: '100vh', display: 'flex', backgroundColor: '#0d0f12', color: '#e6e8eb', overflow: 'hidden' },
  sidebar: { width: '320px', backgroundColor: '#14171c', borderRight: '1px solid #232830', display: 'flex', flexDirection: 'column' },
  sidebarHead: { padding: '16px', borderBottom: '1px solid #232830', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  brand: { display: 'flex', alignItems: 'center', gap: '8px', color: '#4f7cff', fontWeight: 'bold' },
  searchWrap: { padding: '16px', borderBottom: '1px solid #232830', position: 'relative' },
  searchIcon: { position: 'absolute', left: '26px', top: '50%', transform: 'translateY(-50%)', color: '#5a626c' },
  searchInput: { width: '100%', backgroundColor: '#0d0f12', border: '1px solid #232830', borderRadius: '8px', padding: '10px 12px 10px 36px', fontSize: '14px', color: '#e6e8eb', outline: 'none' },
  list: { flex: 1, overflowY: 'auto', padding: '8px' },
  listItem: { display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', borderRadius: '8px', cursor: 'pointer', transition: 'background 0.2s' },
  avatar: (size) => ({ width: size, height: size, borderRadius: '50%', backgroundColor: '#2e343e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase' }),
  avatarMe: (size) => ({ width: size, height: size, borderRadius: '50%', backgroundColor: '#4f7cff', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase' }),
  sidebarFoot: { padding: '16px', borderTop: '1px solid #232830', display: 'flex', alignItems: 'center', gap: '12px' },
  main: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 },
  empty: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#8b929c' },
  chatHead: { padding: '16px 24px', borderBottom: '1px solid #232830', backgroundColor: '#14171c', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  chatUser: { display: 'flex', alignItems: 'center', gap: '12px' },
  chatActions: { display: 'flex', gap: '8px' },
  iconBtn: { padding: '8px', borderRadius: '8px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', color: '#8b929c' },
  iconBtnActive: { backgroundColor: '#e5484d', color: '#fff' },
  messages: { flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' },
  msgBubble: (isMe) => ({
    maxWidth: '70%', padding: '10px 14px', borderRadius: '12px', fontSize: '14px', lineHeight: '1.5',
    backgroundColor: isMe ? '#4f7cff' : '#14171c', color: isMe ? '#fff' : '#e6e8eb',
    alignSelf: isMe ? 'flex-end' : 'flex-start',
    border: isMe ? 'none' : '1px solid #232830',
    borderTopRightRadius: isMe ? '2px' : '12px', borderTopLeftRadius: isMe ? '12px' : '2px'
  }),
  time: { display: 'block', fontSize: '11px', marginTop: '4px', textAlign: 'right', opacity: 0.6 },
  composer: { padding: '16px', backgroundColor: '#14171c', borderTop: '1px solid #232830', display: 'flex', gap: '8px', alignItems: 'center' },
  inputMsg: { flex: 1, backgroundColor: '#0d0f12', border: '1px solid #232830', borderRadius: '8px', padding: '12px 16px', fontSize: '14px', color: '#e6e8eb', outline: 'none' },
  btnSend: { padding: '12px 20px', backgroundColor: '#4f7cff', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  authScreen: { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0d0f12', padding: '24px' },
  authBox: { width: '100%', maxWidth: '380px', display: 'flex', flexDirection: 'column', gap: '16px' },
  authTitle: { fontSize: '24px', fontWeight: 'bold', margin: '0 0 4px 0', color: '#e6e8eb' },
  authSub: { color: '#8b929c', fontSize: '14px', margin: '0 0 16px 0' },
  label: { display: 'block', fontSize: '13px', color: '#8b929c', marginBottom: '6px' },
  inputAuth: { width: '100%', backgroundColor: '#14171c', border: '1px solid #232830', borderRadius: '8px', padding: '12px', fontSize: '14px', color: '#e6e8eb', outline: 'none', boxSizing: 'border-box' },
  btnAuth: { width: '100%', padding: '12px', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer', border: 'none' },
  err: { color: '#e5484d', fontSize: '13px', margin: 0 }
};

export default function App() {
  const [session, setSession] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  
  const [contacts, setContacts] = useState([]);
  const [currentChat, setCurrentChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isRecording, setIsRecording] = useState(false);
  const [recTime, setRecTime] = useState(0);
  const [inCall, setInCall] = useState(false);
  
  const mediaRecorderRef = useRef(null);
  const recIntervalRef = useRef(null);
  const messagesEndRef = useRef(null);
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem('nextalk_session');
    if (saved) {
      const parsed = JSON.parse(saved);
      setSession(parsed);
      setUsername(parsed.username);
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    fetchContacts();
    const interval = setInterval(fetchContacts, 5000);
    return () => clearInterval(interval);
  }, [session]);

  useEffect(() => {
    if (!currentChat || !session) return;
    fetchMessages(currentChat);
    
    const channel = supabase.channel(`chat_${session.username}_${currentChat}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        const msg = payload.new;
        if ((msg.sender === session.username && msg.receiver === currentChat) || 
            (msg.sender === currentChat && msg.receiver === session.username)) {
          setMessages(prev => [...prev, msg]);
        }
      }).subscribe();
      
    return () => { supabase.removeChannel(channel); };
  }, [currentChat, session]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function fetchContacts() {
    const { data } = await supabase.from('users').select('username');
    if (data) setContacts(data.filter(u => u.username !== session.username));
  }

  async function fetchMessages(otherUser) {
    const { data } = await supabase.from('messages').select('*')
      .or(`and(sender.eq.${session.username},receiver.eq.${otherUser}),and(sender.eq.${otherUser},receiver.eq.${session.username})`)
      .order('created_at', { ascending: true });
    if (data) setMessages(data);
  }

  const handleAuth = async (isRegister) => {
    setErrorMsg('');
    if (!username || password.length < 4) return setErrorMsg('Isi username & password (min 4)');
    
    const { data: existing } = await supabase.from('users').select('*').eq('username', username).single();
    
    if (isRegister) {
      if (existing) return setErrorMsg('Username sudah dipakai');
      const { error } = await supabase.from('users').insert([{ username, password }]);
      if (error) return setErrorMsg(error.message);
    } else {
      if (!existing || existing.password !== password) return setErrorMsg('Username atau password salah');
    }
    
    const newSession = { username };
    setSession(newSession);
    localStorage.setItem('nextalk_session', JSON.stringify(newSession));
  };

  const handleLogout = () => {
    localStorage.removeItem('nextalk_session');
    setSession(null);
    setCurrentChat(null);
  };

  const sendMessage = async (type = 'text', content = inputText) => {
    if (!content.trim() || !currentChat) return;
    if (type === 'text') setInputText('');
    
    await supabase.from('messages').insert([{
      sender: session.username,
      receiver: currentChat,
      type,
      content
    }]);
  };

  const toggleRecord = async () => {
    if (isRecording) {
      mediaRecorderRef.current.stop();
      clearInterval(recIntervalRef.current);
      setIsRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];
      recorder.ondataavailable = e => chunks.push(e.data);
      recorder.onstop = () => {
        const reader = new FileReader();
        reader.readAsDataURL(new Blob(chunks, { type: 'audio/webm' }));
        reader.onloadend = () => sendMessage('audio', reader.result);
        stream.getTracks().forEach(t => t.stop());
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecTime(0);
      recIntervalRef.current = setInterval(() => setRecTime(t => t + 1), 1000);
    } catch { alert('Mikrofon diblokir'); }
  };

  const startCall = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      peerRef.current = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      stream.getTracks().forEach(track => peerRef.current.addTrack(track, stream));
      peerRef.current.ontrack = e => { remoteAudioRef.current.srcObject = e.streams[0]; };
      setInCall(true);
      alert('Panggilan dimulai.');
    } catch { alert('Gagal akses mikrofon'); }
  };

  const endCall = () => {
    if (peerRef.current) peerRef.current.close();
    if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => t.stop());
    setInCall(false);
  };

  if (!session) {
    return (
      <div style={css.authScreen}>
        <div style={css.authBox}>
          <div style={css.brand}>
            <MessageSquare size={24} /> <span style={{ fontSize: '20px' }}>NexTalk</span>
          </div>
          <div>
            <h1 style={css.authTitle}>Masuk ke akun Anda</h1>
            <p style={css.authSub}>Chat, panggilan suara, dan voice note.</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={css.label}>Username</label>
              <input type="text" style={css.inputAuth} placeholder="Masukkan username" value={username} onChange={e => setUsername(e.target.value)} />
            </div>
            <div>
              <label style={css.label}>Password</label>
              <input type="password" style={css.inputAuth} placeholder="Masukkan password" value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            {errorMsg && <p style={css.err}>{errorMsg}</p>}
            <button onClick={() => handleAuth(false)} style={{...css.btnAuth, backgroundColor: '#4f7cff', color: '#fff'}}>Masuk</button>
            <button onClick={() => handleAuth(true)} style={{...css.btnAuth, backgroundColor: 'transparent', border: '1px solid #232830', color: '#8b929c'}}>Buat akun baru</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={css.container}>
      <audio ref={remoteAudioRef} autoPlay />
      
      <aside style={css.sidebar}>
        <div style={css.sidebarHead}>
          <div style={css.brand}><MessageSquare size={18} /> <span>NexTalk</span></div>
          <button onClick={handleLogout} style={css.iconBtn}><LogOut size={16} /></button>
        </div>
        <div style={css.searchWrap}>
          <Search size={14} style={css.searchIcon} />
          <input type="text" placeholder="Cari username" style={css.searchInput} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
        <div style={css.list}>
          {contacts.filter(c => c.username.includes(searchQuery)).map(c => (
            <div key={c.username} onClick={() => setCurrentChat(c.username)} style={{...css.listItem, backgroundColor: currentChat === c.username ? '#1a1e25' : 'transparent'}}>
              <div style={css.avatar(32)}>{c.username[0]}</div>
              <span>{c.username}</span>
            </div>
          ))}
        </div>
        <div style={css.sidebarFoot}>
          <div style={css.avatarMe(32)}>{session.username[0]}</div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: '14px', fontWeight: '500' }}>{session.username}</p>
            <p style={{ margin: 0, fontSize: '12px', color: '#5a626c' }}>Online</p>
          </div>
        </div>
      </aside>

      <main style={css.main}>
        {!currentChat ? (
          <div style={css.empty}>
            <MessageSquare size={48} style={{ marginBottom: '16px', color: '#2e343e' }} />
            <p style={{ fontSize: '14px', margin: 0 }}>Pilih kontak untuk mulai chat</p>
          </div>
        ) : (
          <>
            <header style={css.chatHead}>
              <div style={css.chatUser}>
                <div style={css.avatar(36)}>{currentChat[0]}</div>
                <div>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: 'bold' }}>{currentChat}</p>
                  <p style={{ margin: 0, fontSize: '12px', color: '#5a626c' }}>Online</p>
                </div>
              </div>
              <div style={css.chatActions}>
                <button onClick={inCall ? endCall : startCall} style={{...css.iconBtn, ...(inCall ? css.iconBtnActive : {})}}>
                  {inCall ? <PhoneOff size={18} /> : <Phone size={18} />}
                </button>
              </div>
            </header>

            <div style={css.messages}>
              {messages.map(m => (
                <div key={m.id} style={css.msgBubble(m.sender === session.username)}>
                  {m.type === 'audio' ? <audio controls src={m.content} style={{ maxWidth: '240px' }} /> : m.content}
                  <span style={css.time}>{new Date(m.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {isRecording && (
              <div style={{ padding: '8px 24px', backgroundColor: 'rgba(229,72,77,0.1)', color: '#e5484d', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px', borderTop: '1px solid rgba(229,72,77,0.2)' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#e5484d' }} /> Merekam {recTime}s
              </div>
            )}

            <div style={css.composer}>
              <button onClick={toggleRecord} style={{...css.iconBtn, color: isRecording ? '#e5484d' : '#8b929c'}}>
                <Mic size={18} />
              </button>
              <input type="text" placeholder="Tulis pesan..." style={css.inputMsg} value={inputText} onChange={e => setInputText(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} />
              <button onClick={() => sendMessage()} style={css.btnSend}><Send size={16} /></button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}