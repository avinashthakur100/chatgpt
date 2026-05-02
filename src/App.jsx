import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, Sparkles, AlertCircle, LayoutDashboard } from 'lucide-react';
import { callGemini } from './Agent';

export default function App() {
  const [apiKey, setApiKey] = useState(localStorage.getItem('gemini_api_key') || '');
  const [showKeyModal, setShowKeyModal] = useState(!apiKey);
  
  // App State (Controlled by Agent)
  const [appColor, setAppColor] = useState('#0f172a');
  const [notifications, setNotifications] = useState([]);
  const [cards, setCards] = useState([
    { id: 1, title: 'Welcome to your Agentic App', content: 'This UI can be modified by the AI. Ask it to change colors or add data!' }
  ]);

  // Chat State
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hello! I am your AI assistant. I have direct control over this dashboard. Try asking me to "change the background color to dark red" or "add a new card about the weather".' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef(null);

  // Apply background color
  useEffect(() => {
    document.body.style.backgroundColor = appColor;
  }, [appColor]);

  // Auto scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const saveApiKey = (key) => {
    localStorage.setItem('gemini_api_key', key);
    setApiKey(key);
    setShowKeyModal(false);
  };

  const handleToolCall = async (functionCall) => {
    const { name, args } = functionCall;
    let toolResult = "Success";

    try {
      if (name === 'changeBackgroundColor') {
        setAppColor(args.color);
        toolResult = `Changed background color to ${args.color}`;
      } 
      else if (name === 'addNotification') {
        const id = Date.now();
        setNotifications(prev => [...prev, { id, message: args.message }]);
        setTimeout(() => {
          setNotifications(prev => prev.filter(n => n.id !== id));
        }, 5000);
        toolResult = `Displayed notification: "${args.message}"`;
      } 
      else if (name === 'addCard') {
        setCards(prev => [...prev, { id: Date.now(), title: args.title, content: args.content }]);
        toolResult = `Added card: "${args.title}"`;
      }
    } catch (err) {
      toolResult = `Error executing tool: ${err.message}`;
    }

    return toolResult;
  };

  const processMessage = async (newMessages) => {
    try {
      const response = await callGemini(newMessages, apiKey);

      if (response.type === 'text') {
        setMessages(prev => [...prev, { role: 'assistant', content: response.text }]);
        setIsTyping(false);
      } 
      else if (response.type === 'functionCall') {
        // AI decided to use a tool
        const fnCall = response.functionCall;
        
        // Add the AI's function call intent to the history
        const intentMessage = { 
          role: 'assistant', 
          functionCall: fnCall,
          content: '' 
        };
        
        // Add a system message so the user sees what's happening
        setMessages(prev => [
          ...prev, 
          intentMessage,
          { role: 'system', content: `Agent used tool: ${fnCall.name}` }
        ]);

        // Execute the tool locally
        const result = await handleToolCall(fnCall);

        // Feed the result back to the AI
        const toolResultMessage = {
          role: 'tool',
          name: fnCall.name,
          content: result
        };

        const nextMessages = [...newMessages, intentMessage, toolResultMessage];
        
        // Call Gemini again with the tool result so it can generate a final response
        await processMessage(nextMessages);
      }
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'system', content: `Error: ${error.message}` }]);
      setIsTyping(false);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || !apiKey) return;

    const userMessage = { role: 'user', content: input.trim() };
    const updatedMessages = [...messages, userMessage];
    
    setMessages(updatedMessages);
    setInput('');
    setIsTyping(true);

    await processMessage(updatedMessages);
  };

  return (
    <div className="app-container">
      {showKeyModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h2><Sparkles size={20} style={{ display: 'inline', marginRight: '8px', color: '#60a5fa' }}/> Welcome to Agentic React</h2>
            <p>To power the AI agent, please provide your Google Gemini API key. This is stored locally in your browser and never sent to our servers.</p>
            <input 
              type="password" 
              placeholder="AIzaSy..." 
              id="api-key-input"
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveApiKey(e.target.value);
              }}
            />
            <button onClick={() => saveApiKey(document.getElementById('api-key-input').value)}>
              Start Agent
            </button>
          </div>
        </div>
      )}

      {/* Main Dashboard View */}
      <div className="main-view">
        <div className="notifications">
          {notifications.map(n => (
            <div key={n.id} className="notification">
              <AlertCircle size={18} />
              {n.message}
            </div>
          ))}
        </div>

        <div className="dashboard-header">
          <h1><LayoutDashboard size={36} style={{ display: 'inline', marginRight: '12px', verticalAlign: 'text-bottom', color: '#60a5fa' }}/> Dashboard</h1>
        </div>

        <div className="cards-grid">
          {cards.map(card => (
            <div key={card.id} className="card">
              <h3>{card.title}</h3>
              <p>{card.content}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Agent Chat Panel */}
      <div className="agent-panel">
        <div className="agent-header">
          <Bot size={28} color="#60a5fa" />
          <div className="agent-header-title">
            System Agent
            <div className="status-dot"></div>
          </div>
        </div>

        <div className="chat-history">
          {messages.map((msg, idx) => {
            if (msg.role === 'tool' || msg.functionCall) return null; // Hide raw tool calls
            return (
              <div key={idx} className={`message ${msg.role}`}>
                {msg.content}
              </div>
            );
          })}
          {isTyping && (
            <div className="message system">
              <Sparkles size={14} style={{ display: 'inline', marginRight: '4px' }}/> Agent is thinking...
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="chat-input-container">
          <form className="chat-form" onSubmit={handleSend}>
            <input 
              type="text" 
              className="chat-input"
              placeholder="Ask the agent to change the app..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isTyping}
            />
            <button type="submit" className="chat-submit" disabled={isTyping || !input.trim()}>
              <Send size={18} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
