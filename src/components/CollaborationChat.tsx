/**
 * Collaboration Chat Component
 *
 * Real-time chat sidebar for collaboration rooms.
 * Messages are stored in Yjs Y.Array for instant sync.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import * as Y from 'yjs';
import {
  getRoomDoc,
  getCurrentRoomId,
  type Peer,
} from '../services/collaboration';

/**
 * Chat message type stored in Yjs
 */
interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderColor: string;
  content: string;
  timestamp: number;
}

interface CollaborationChatProps {
  /** Whether the chat panel is open */
  isOpen: boolean;
  /** Close the chat panel */
  onClose: () => void;
  /** Current user ID */
  userId: string;
  /** Current user display name */
  userName: string;
  /** Current user color */
  userColor: string;
  /** List of peers for online indicator */
  peers: Peer[];
}

/**
 * Generate a unique message ID
 */
function generateMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Format timestamp to readable time
 */
function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function CollaborationChat({
  isOpen,
  onClose,
  userId,
  userName,
  userColor,
  peers,
}: CollaborationChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const yArrayRef = useRef<Y.Array<ChatMessage> | null>(null);

  // Scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Subscribe to Yjs chat array
  useEffect(() => {
    const doc = getRoomDoc();
    const roomId = getCurrentRoomId();

    if (!doc || !roomId) {
      setMessages([]);
      yArrayRef.current = null;
      return;
    }

    // Get or create chat array
    const chatArray = doc.getArray<ChatMessage>('chatMessages');
    yArrayRef.current = chatArray;

    // Load existing messages
    setMessages(chatArray.toArray());

    // Subscribe to changes
    const observer = () => {
      setMessages(chatArray.toArray());
      setTimeout(scrollToBottom, 50);
    };

    chatArray.observe(observer);

    return () => {
      chatArray.unobserve(observer);
    };
  }, [scrollToBottom]);

  // Scroll to bottom on initial load
  useEffect(() => {
    if (isOpen) {
      setTimeout(scrollToBottom, 100);
      inputRef.current?.focus();
    }
  }, [isOpen, scrollToBottom]);

  // Send a message
  const handleSendMessage = useCallback(() => {
    if (!inputValue.trim() || !yArrayRef.current) return;

    const message: ChatMessage = {
      id: generateMessageId(),
      senderId: userId,
      senderName: userName,
      senderColor: userColor,
      content: inputValue.trim(),
      timestamp: Date.now(),
    };

    yArrayRef.current.push([message]);
    setInputValue('');
    inputRef.current?.focus();
  }, [inputValue, userId, userName, userColor]);

  // Handle Enter key
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  if (!isOpen) return null;

  const onlineCount = peers.length + 1; // +1 for self

  return (
    <div className="fixed right-4 bottom-4 w-80 h-[500px] bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden z-50 border border-neutral-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-indigo-500 to-purple-500">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <h2 className="text-sm font-semibold text-white">Chat</h2>
          <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs text-white">
            {onlineCount} online
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-white/20 text-white transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-neutral-50">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-neutral-400">
            <svg className="w-12 h-12 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-sm">No messages yet</p>
            <p className="text-xs mt-1">Start the conversation!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOwnMessage = msg.senderId === userId;
            return (
              <div
                key={msg.id}
                className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] ${
                    isOwnMessage
                      ? 'bg-indigo-500 text-white rounded-2xl rounded-br-md'
                      : 'bg-white text-gray-800 rounded-2xl rounded-bl-md shadow-sm border border-gray-100'
                  }`}
                >
                  {/* Sender name (only for others) */}
                  {!isOwnMessage && (
                    <div
                      className="px-3 pt-2 text-xs font-medium"
                      style={{ color: msg.senderColor }}
                    >
                      {msg.senderName}
                    </div>
                  )}
                  {/* Message content */}
                  <div className="px-3 py-2 text-sm whitespace-pre-wrap break-words">
                    {msg.content}
                  </div>
                  {/* Timestamp */}
                  <div
                    className={`px-3 pb-2 text-[10px] ${
                      isOwnMessage ? 'text-indigo-200' : 'text-neutral-400'
                    }`}
                  >
                    {formatTime(msg.timestamp)}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-gray-100 bg-white">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 text-sm border border-neutral-200 rounded-full focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputValue.trim()}
            className="p-2 bg-indigo-500 text-white rounded-full hover:bg-secondary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
