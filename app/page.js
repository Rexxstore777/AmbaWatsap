'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from './lib/supabase';
import { Phone, PhoneOff, Mic, Send, LogOut, Search, MessageSquare } from 'lucide-react';

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
  const channelRef = useRef(null);

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
    
    // Supabase Realtime untuk pesan baru
    const channel = supabase.channel(`chat_${session.username}_${currentChat}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        const msg = payload.new;
        if ((msg.sender === session.username && msg.receiver === currentChat) || 
            (msg.sender === currentChat && msg.receiver === session.username)) {
          setMessages(prev => [...prev, msg]);
        }
      }).subscribe();
      
    channelRef.current = channel;
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

  // Voice Record
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

  // WebRTC Call (Sederhana, panggilan 1 arah P2P)
  const startCall = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      peerRef.current = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      stream.getTracks().forEach(track => peerRef.current.addTrack(track, stream));
      
      peerRef.current.ontrack = e => { remoteAudioRef.current.srcObject = e.streams[0]; };
      peerRef.current.onicecandidate = e => {
        if (e.candidate) supabase.channel(`webrtc_${currentChat}`).send({ type: 'broadcast', event: 'ice', payload: { from: session.username, candidate: e.candidate } });
      };
      
      setInCall(true);
      alert('Panggilan dimulai (Simulasi). Fitur suara WebRTC butuh signaling server penuh untuk production.');
    } catch { alert('Gagal akses mikrofon'); }
  };

  const endCall = () => {
    if (peerRef.current) peerRef.current.close();
    if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => t.stop());
    setInCall(false);
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-[#0d0f12] flex items-center justify-center p-4 text-[#e6e8eb] font-sans">
        <div className="w-full max-w-sm space-y-6">
          <div className="flex items-center gap-2 text-[#4f7cff]">
            <MessageSquare size={24} /> <span className="font-bold text-xl">NexTalk</span>
          </div>
          <div>
            <h1 className="text-2xl font-semibold mb-1">Masuk ke akun Anda</h1>
            <p className="text-[#8b929c] text-sm">Chat, panggilan suara, dan voice note.</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-[#8b929c] mb-1 block">Username</label>
              <input type="text" className="w-full bg-[#14171c] border border-[#232830] rounded-lg p-3 text-sm focus:outline-none focus:border-[#4f7cff]" placeholder="Masukkan username" value={username} onChange={e => setUsername(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-[#8b929c] mb-1 block">Password</label>
              <input type="password" className="w-full bg-[#14171c] border border-[#232830] rounded-lg p-3 text-sm focus:outline-none focus:border-[#4f7cff]" placeholder="Masukkan password" value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            {errorMsg && <p className="text-[#e5484d] text-sm">{errorMsg}</p>}
            <button onClick={() => handleAuth(false)} className="w-full bg-[#4f7cff] hover:bg-[#3d6bf0] text-white font-medium py-3 rounded-lg text-sm">Masuk</button>
            <button onClick={() => handleAuth(true)} className="w-full bg-transparent border border-[#232830] hover:bg-[#1a1e25] text-[#8b929c] font-medium py-3 rounded-lg text-sm">Buat akun baru</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#0d0f12] text-[#e6e8eb] font-sans flex overflow-hidden">
      <audio ref={remoteAudioRef} autoPlay />
      
      {/* Sidebar */}
      <aside className="w-[300px] bg-[#14171c] border-r border-[#232830] flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-[#232830] flex justify-between items-center">
          <div className="flex items-center gap-2 text-[#4f7cff]"><MessageSquare size={18} /> <span className="font-bold text-sm">NexTalk</span></div>
          <button onClick={handleLogout} className="text-[#8b929c] hover:text-[#e6e8eb]"><LogOut size={16} /></button>
        </div>
        <div className="p-4 border-b border-[#232830] relative">
          <Search size={14} className="absolute left-7 top-1/2 -translate-y-1/2 text-[#5a626c]" />
          <input type="text" placeholder="Cari username" className="w-full bg-[#0d0f12] border border-[#232830] rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-[#2e343e]" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {contacts.filter(c => c.username.includes(searchQuery)).map(c => (
            <div key={c.username} onClick={() => setCurrentChat(c.username)} className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer ${currentChat === c.username ? 'bg-[#1a1e25]' : 'hover:bg-[#1a1e25]'}`}>
              <div className="w-8 h-8 rounded-full bg-[#2e343e] flex items-center justify-center text-xs font-bold uppercase">{c.username[0]}</div>
              <span className="text-sm">{c.username}</span>
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-[#232830] flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#4f7cff] text-white flex items-center justify-center text-xs font-bold uppercase">{session.username[0]}</div>
          <div className="flex-1"><p className="text-sm font-medium">{session.username}</p><p className="text-xs text-[#5a626c]">Online</p></div>
        </div>
      </aside>

      {/* Chat Area */}
      <main className="flex-1 flex flex-col min-w-0">
        {!currentChat ? (
          <div className="flex-1 flex flex-col items-center justify-center text-[#8b929c]">
            <MessageSquare size={48} className="mb-4 text-[#2e343e]" />
            <p className="text-sm">Pilih kontak untuk mulai chat</p>
          </div>
        ) : (
          <>
            <header className="px-6 py-3 border-b border-[#232830] bg-[#14171c] flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#2e343e] flex items-center justify-center text-xs font-bold uppercase">{currentChat[0]}</div>
                <div><p className="text-sm font-semibold">{currentChat}</p><p className="text-xs text-[#5a626c]">Online</p></div>
              </div>
              <div className="flex gap-2">
                <button onClick={inCall ? endCall : startCall} className={`p-2 rounded-lg ${inCall ? 'bg-[#e5484d] text-white' : 'text-[#8b929c] hover:bg-[#1a1e25]'}`}>
                  {inCall ? <PhoneOff size={16} /> : <Phone size={16} />}
                </button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-2 flex flex-col bg-[#0d0f12]">
              {messages.map(m => (
                <div key={m.id} className={`max-w-[70%] p-3 rounded-xl text-sm ${m.sender === session.username ? 'bg-[#4f7cff] text-white self-end rounded-tr-sm' : 'bg-[#14171c] border border-[#232830] self-start rounded-tl-sm'}`}>
                  {m.type === 'audio' ? <audio controls src={m.content} className="max-w-[240px]" /> : m.content}
                  <span className="block text-[10px] text-right mt-1 opacity-60">{new Date(m.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {isRecording && (
              <div className="px-6 py-2 bg-[#e5484d]/10 text-[#e5484d] text-xs flex items-center gap-2 border-t border-[#e5484d]/20">
                <div className="w-2 h-2 rounded-full bg-[#e5484d] animate-pulse" /> Merekam {recTime}s
              </div>
            )}

            <div className="p-4 bg-[#14171c] border-t border-[#232830] flex gap-2">
              <button onClick={toggleRecord} className={`p-2.5 rounded-lg ${isRecording ? 'bg-[#e5484d] text-white' : 'text-[#8b929c] hover:bg-[#1a1e25]'}`}>
                <Mic size={18} />
              </button>
              <input type="text" placeholder="Tulis pesan..." className="flex-1 bg-[#0d0f12] border border-[#232830] rounded-lg px-4 text-sm focus:outline-none focus:border-[#2e343e]" value={inputText} onChange={e => setInputText(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} />
              <button onClick={() => sendMessage()} className="px-5 py-2.5 bg-[#4f7cff] hover:bg-[#3d6bf0] text-white rounded-lg text-sm font-medium"><Send size={16} /></button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}