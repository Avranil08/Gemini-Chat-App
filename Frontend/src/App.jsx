import { useState } from 'react';
import './App.css';

function ChatBubble({ role, text }) {
  const className = role === 'user' ? 'bubble user' : 'bubble ai';
  return <div className={className}>{text}</div>;
}

function ChatList({ chats, selectChat, selectedIndex, deleteChat }) {
  return (
    <div className="chat-list">
      {chats.map((chat, i) => (
        <div key={i} className={`chat-list-item ${i === selectedIndex ? 'active' : ''}`}>
          <div onClick={() => selectChat(i)} className="chat-title">
            {chat.history[0]?.parts[0]?.text.slice(0, 30) || 'New Chat...'}
          </div>
          <button className="delete-btn" onClick={() => deleteChat(i)}>🗑️</button>
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [chats, setChats] = useState([{ history: [] }]);
  const [selectedChat, setSelectedChat] = useState(0);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);

  const sendPrompt = async () => {
    if (!prompt.trim()) return;
    setLoading(true);

    const current = chats[selectedChat];
    const res = await fetch('http://localhost:3001/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, history: current.history }),
    });

    const data = await res.json();
    if (data.reply) {
      const updatedChats = [...chats];
      updatedChats[selectedChat].history = data.history;
      setChats(updatedChats);
    }
    setPrompt('');
    setLoading(false);
  };

  const startNewChat = () => {
    setChats([...chats, { history: [] }]);
    setSelectedChat(chats.length);
    setPrompt('');
  };

  const deleteChat = (index) => {
    const updated = chats.filter((_, i) => i !== index);
    setChats(updated.length ? updated : [{ history: [] }]);
    setSelectedChat(Math.max(0, index - 1));
  };

  const currentHistory = chats[selectedChat]?.history || [];

  return (
    <div className="container">
      <ChatList
        chats={chats}
        selectChat={setSelectedChat}
        selectedIndex={selectedChat}
        deleteChat={deleteChat}
      />

      <div className="chat-area">
        <div className="header">
          <h2>Gemini Chat</h2>
          <button onClick={startNewChat} className="new-chat-btn">+ New Chat</button>
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
