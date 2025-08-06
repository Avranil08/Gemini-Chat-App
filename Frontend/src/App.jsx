import { useState, useEffect } from 'react';
import './App.css';

function ChatBubble({ role, text }) {
  const className = role === 'user' ? 'bubble user' : 'bubble ai';
  return <div className={className}>{text}</div>;
}

function ChatList({ chats, selectChat, selectedIndex, createNewChat }) {
  return (
    <div className="chat-list">
      <div className="chat-list-header">
        <button onClick={createNewChat} className="new-chat-btn">+ New Chat</button>
      </div>
      {chats.map((chat, i) => (
        <div 
          key={chat._id || `new-${i}`} 
          className={`chat-list-item ${i === selectedIndex ? 'active' : ''}`} 
          onClick={() => selectChat(i)}
        >
          <div className="chat-title">
            {chat.history?.[0]?.parts?.[0]?.text.slice(0, 30) || 'New Chat...'}
          </div>
        </div>
      ))}
    </div>
  );
}


function AuthForm({ type, onSubmit }) {
  const [email, setEmail] = useState(''); 
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    await onSubmit({ email, password, setError }); 
  };

  return (
    <div className="auth-form-container">
      <h2>{type === 'login' ? 'Login' : 'Register'}</h2>
      <form onSubmit={handleSubmit}>
        <input 
          type="email" 
          placeholder="Email" 
          value={email} 
          onChange={(e) => setEmail(e.target.value)} 
          required 
        />
        <input 
          type="password" 
          placeholder="Password" 
          value={password} 
          onChange={(e) => setPassword(e.target.value)} 
          required 
        />
        <button type="submit">{type === 'login' ? 'Login' : 'Register'}</button>
      </form>
      {error && <div className="error-message">{error}</div>}
    </div>
  );
}

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(null);
  const [chats, setChats] = useState([]);
  const [selectedChatIndex, setSelectedChatIndex] = useState(0);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [authType, setAuthType] = useState('login');

  useEffect(() => {
    const fetchChats = async () => {
      if (!token) {
        setChats([]);
        return;
      }
      try {
        const res = await fetch('http://localhost:3001/api/chats', {
          headers: { 'x-auth-token': token },
        });
        if (res.status === 401) {
          handleLogout();
          return;
        }
        const data = await res.json();
        setChats(data.length > 0 ? data : [{ history: [] }]);
        setSelectedChatIndex(0);
      } catch (err) {
        console.error('Failed to fetch chats:', err);
      }
    };
    fetchChats();
  }, [token]);

  const sendPrompt = async () => {
    if (!prompt.trim() || !token) return;
    setLoading(true);

    const currentChat = chats[selectedChatIndex];
    const res = await fetch('http://localhost:3001/api/chat', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-auth-token': token 
      },
      body: JSON.stringify({
        prompt,
        chatId: currentChat._id,
      }),
    });

    const data = await res.json();
    if (data.reply) {
      const updatedChats = [...chats];
      if (!updatedChats[selectedChatIndex]._id) {
        updatedChats[selectedChatIndex]._id = data.chatId;
      }
      updatedChats[selectedChatIndex].history = data.history;
      setChats(updatedChats);
    }
    setPrompt('');
    setLoading(false);
  };
  
  
  const handleLogin = async ({ email, password, setError }) => {
    try {
      const res = await fetch('http://localhost:3001/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('token', data.token);
        setToken(data.token);
        setUser({ email: data.email });
        setAuthType('login');
      } else {
        setError(data.msg || 'Login failed');
      }
    } catch (err) {
      setError('An unexpected error occurred.');
    }
  };

  
  const handleRegister = async ({ email, password, setError }) => {
    try {
      const res = await fetch('http://localhost:3001/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('token', data.token);
        setToken(data.token);
        setUser({ email: data.email });
        setAuthType('login');
      } else {
        setError(data.msg || 'Registration failed');
      }
    } catch (err) {
      setError('An unexpected error occurred.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setChats([]);
    setSelectedChatIndex(0);
    setAuthType('login');
  };

  const createNewChat = () => {
    setChats([...chats, { history: [] }]);
    setSelectedChatIndex(chats.length);
  };

  const currentHistory = chats[selectedChatIndex]?.history || [];

  if (!token) {
    return (
      <div className="auth-container">
        {authType === 'login' ? (
          <>
            <AuthForm type="login" onSubmit={handleLogin} />
            <p>Don't have an account? <span onClick={() => setAuthType('register')} className="auth-link">Register here</span></p>
          </>
        ) : (
          <>
            <AuthForm type="register" onSubmit={handleRegister} />
            <p>Already have an account? <span onClick={() => setAuthType('login')} className="auth-link">Login here</span></p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="container">
      <ChatList
        chats={chats}
        selectChat={setSelectedChatIndex}
        selectedIndex={selectedChatIndex}
        createNewChat={createNewChat}
      />
      <div className="chat-area">
        <div className="header">
          <h2>Gemini Chat</h2>
          <button onClick={handleLogout} className="logout-btn">Logout</button>
        </div>
        <div className="history-window">
          {currentHistory.map((msg, i) => (
            <ChatBubble key={i} role={msg.role} text={msg.parts[0].text} />
          ))}
        </div>
        <div className="input-area">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Type your message..."
            disabled={loading}
          />
          <button onClick={sendPrompt} disabled={loading}>
            {loading ? 'Thinking...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}