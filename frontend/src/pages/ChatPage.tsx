import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  intent?: string;
  latencyMs?: number;
  traceId?: string;
  timestamp: Date;
}

export function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: "Hello! I'm the Toka AI Assistant. I can help you query user data, generate reports, or answer questions about the system. How can I help?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { accessToken } = useAuthStore();

  const getCsrfToken = async () => {
    const response = await fetch('/auth/csrf-token', { credentials: 'include' });
    const data = (await response.json()) as { csrfToken: string };
    return data.csrfToken;
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    setMessages((m) => [...m, userMsg]);
    setInput('');
    setIsStreaming(true);

    // Placeholder for streaming response
    const assistantMsgId = crypto.randomUUID();
    setMessages((m) => [
      ...m,
      { id: assistantMsgId, role: 'assistant', content: '', timestamp: new Date() },
    ]);

    try {
      const csrfToken = await getCsrfToken();
      // Use SSE streaming endpoint
      const response = await fetch('/api/ai/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ message: text, session_id: sessionId }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6);
          try {
            const parsed = JSON.parse(raw) as {
              token?: string;
              done?: boolean;
              session_id?: string;
              intent?: string;
              latency_ms?: number;
              trace_id?: string;
              error?: string;
            };
            if (parsed.error) throw new Error(parsed.error);
            if (parsed.token) {
              setMessages((msgs) =>
                msgs.map((m) =>
                  m.id === assistantMsgId
                    ? { ...m, content: m.content + parsed.token }
                    : m,
                ),
              );
            }
            if (parsed.done) {
              if (parsed.session_id) setSessionId(parsed.session_id);
              setMessages((msgs) =>
                msgs.map((m) =>
                  m.id === assistantMsgId
                    ? {
                        ...m,
                        intent: parsed.intent,
                        latencyMs: parsed.latency_ms,
                        traceId: parsed.trace_id,
                      }
                    : m,
                ),
              );
            }
          } catch {
            // ignore parse errors
          }
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred';
      setMessages((msgs) =>
        msgs.map((m) =>
          m.id === assistantMsgId ? { ...m, content: `Error: ${msg}` } : m,
        ),
      );
    } finally {
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 4rem)' }}>
      <div className="page-header" style={{ marginBottom: '1rem' }}>
        <h1 className="page-title">AI Assistant</h1>
        {sessionId && (
          <span className="text-muted text-sm" style={{ fontFamily: 'monospace' }}>
            session: {sessionId.slice(0, 8)}
          </span>
        )}
      </div>

      <div
        className="card"
        style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1rem' }}
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              gap: '0.75rem',
              alignItems: 'flex-start',
              flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
            }}
          >
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: msg.role === 'user' ? 'var(--primary)' : 'var(--bg-surface)',
              border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
            </div>
            <div style={{ maxWidth: '75%' }}>
              <div style={{
                background: msg.role === 'user' ? 'var(--primary)' : 'var(--bg-surface)',
                padding: '0.65rem 0.9rem',
                borderRadius: msg.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                fontSize: '0.875rem',
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>
                {msg.content || (isStreaming ? <span className="spinner" style={{ width: 14, height: 14 }} /> : '')}
              </div>
              {msg.intent && (
                <div style={{ marginTop: '0.3rem', display: 'flex', gap: '0.4rem' }}>
                  <span className="badge badge-gray">{msg.intent}</span>
                  {msg.latencyMs && (
                    <span className="badge badge-gray">{msg.latencyMs}ms</span>
                  )}
                  {msg.traceId && (
                    <span className="badge badge-gray">trace {msg.traceId.slice(0, 8)}</span>
                  )}
                </div>
              )}
              <div className="text-muted text-sm" style={{ marginTop: '0.2rem' }}>
                {msg.timestamp.toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <textarea
          className="input"
          placeholder="Ask the AI assistant... (Enter to send, Shift+Enter for newline)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          style={{ resize: 'none', flex: 1 }}
          disabled={isStreaming}
        />
        <button
          className="btn btn-primary"
          onClick={() => void sendMessage()}
          disabled={isStreaming || !input.trim()}
          style={{ alignSelf: 'flex-end', height: 60 }}
        >
          {isStreaming ? <span className="spinner" style={{ width: 16, height: 16 }} /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
}
