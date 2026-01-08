/**
 * Insights Panel for Research Partner
 *
 * Displays conversation insights including top questions, topics, and knowledge gaps.
 * Shown as a slide-out panel from the right side of the chat interface.
 */

import { useState, useEffect, useMemo } from 'react';
import type { Conversation } from '../../services/researchPartner';
import {
  type QuestionSummary,
  type TopicCount,
  type KnowledgeGap,
  type ConversationInsights,
  type DailyActivity,
  analyzeConversations,
  getConversationActivity,
} from '../../services/conversationInsights';

interface InsightsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  conversations: Conversation[];
  onSelectConversation?: (id: string) => void;
}

type Tab = 'questions' | 'topics' | 'gaps' | 'activity';

export function InsightsPanel({
  isOpen,
  onClose,
  conversations,
  onSelectConversation,
}: InsightsPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('questions');
  const [insights, setInsights] = useState<ConversationInsights | null>(null);
  const [activity, setActivity] = useState<DailyActivity[]>([]);
  const [loading, setLoading] = useState(false);

  // Load insights when panel opens
  useEffect(() => {
    if (isOpen && conversations.length > 0) {
      setLoading(true);
      Promise.all([
        analyzeConversations(conversations),
        Promise.resolve(getConversationActivity(conversations, 30)),
      ])
        .then(([insightsResult, activityResult]) => {
          setInsights(insightsResult);
          setActivity(activityResult);
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, conversations]);

  // Calculate max activity count for sparkline scaling
  const maxActivityCount = useMemo(() => {
    return Math.max(...activity.map(a => a.count), 1);
  }, [activity]);

  if (!isOpen) return null;

  const tabs: { id: Tab; label: string; icon: JSX.Element }[] = [
    {
      id: 'questions',
      label: 'Questions',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      id: 'topics',
      label: 'Topics',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
      ),
    },
    {
      id: 'gaps',
      label: 'Gaps',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
    },
    {
      id: 'activity',
      label: 'Activity',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900">Conversation Insights</h3>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Stats Summary */}
      {insights && (
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center">
              <div className="text-xl font-bold text-indigo-600">{insights.totalConversations}</div>
              <div className="text-xs text-gray-500">Conversations</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-purple-600">{insights.questionCount}</div>
              <div className="text-xs text-gray-500">Questions Asked</div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 px-2 text-xs font-medium flex items-center justify-center gap-1 transition-colors ${
              activeTab === tab.id
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="flex items-center gap-2 text-gray-500">
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-sm">Analyzing...</span>
            </div>
          </div>
        ) : !insights ? (
          <div className="flex items-center justify-center h-32 text-gray-500 text-sm">
            No conversations to analyze
          </div>
        ) : (
          <>
            {/* Questions Tab */}
            {activeTab === 'questions' && (
              <div className="p-4 space-y-3">
                {insights.topQuestions.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">No questions found</p>
                ) : (
                  insights.topQuestions.map((q, i) => (
                    <QuestionCard
                      key={i}
                      question={q}
                      rank={i + 1}
                      onSelectConversation={onSelectConversation}
                    />
                  ))
                )}
              </div>
            )}

            {/* Topics Tab */}
            {activeTab === 'topics' && (
              <div className="p-4 space-y-2">
                {insights.topTopics.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">No topics found</p>
                ) : (
                  insights.topTopics.map((topic, i) => (
                    <TopicCard key={i} topic={topic} />
                  ))
                )}
              </div>
            )}

            {/* Knowledge Gaps Tab */}
            {activeTab === 'gaps' && (
              <div className="p-4 space-y-3">
                {insights.knowledgeGaps.length === 0 ? (
                  <div className="text-center py-6">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-green-100 flex items-center justify-center">
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-gray-700">No knowledge gaps detected</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Your notes seem to cover all questions asked!
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-gray-500 mb-2">
                      Topics you asked about but don't have notes for:
                    </p>
                    {insights.knowledgeGaps.map((gap, i) => (
                      <GapCard
                        key={i}
                        gap={gap}
                        onSelectConversation={onSelectConversation}
                      />
                    ))}
                  </>
                )}
              </div>
            )}

            {/* Activity Tab */}
            {activeTab === 'activity' && (
              <div className="p-4">
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Last 30 Days</h4>
                  {/* Sparkline chart */}
                  <div className="h-20 flex items-end gap-0.5">
                    {activity.map((day, i) => (
                      <div
                        key={i}
                        className="flex-1 bg-indigo-200 hover:bg-indigo-400 rounded-t transition-colors cursor-default group relative"
                        style={{
                          height: `${Math.max((day.count / maxActivityCount) * 100, 4)}%`,
                        }}
                        title={`${day.date}: ${day.count} conversation${day.count !== 1 ? 's' : ''}`}
                      >
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                          {day.count}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>30 days ago</span>
                    <span>Today</span>
                  </div>
                </div>

                {/* Recent days breakdown */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-700">Recent Activity</h4>
                  {activity.slice(-7).reverse().map((day, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between py-1 text-sm"
                    >
                      <span className="text-gray-600">
                        {i === 0 ? 'Today' : i === 1 ? 'Yesterday' : formatDate(day.date)}
                      </span>
                      <span className={`font-medium ${day.count > 0 ? 'text-indigo-600' : 'text-gray-400'}`}>
                        {day.count} {day.count === 1 ? 'conversation' : 'conversations'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Sub-components

function QuestionCard({
  question,
  rank,
  onSelectConversation,
}: {
  question: QuestionSummary;
  rank: number;
  onSelectConversation?: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
      <div className="flex items-start gap-2">
        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 text-xs font-bold flex items-center justify-center">
          {rank}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-800 line-clamp-2">{question.question}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-gray-500">
              Asked {question.count}x
            </span>
            {question.conversations.length > 0 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-xs text-indigo-600 hover:text-indigo-700"
              >
                {expanded ? 'Hide' : 'Show'} conversations
              </button>
            )}
          </div>
          {expanded && (
            <div className="mt-2 space-y-1">
              {question.conversations.map((convId, i) => (
                <button
                  key={i}
                  onClick={() => onSelectConversation?.(convId)}
                  className="block w-full text-left text-xs px-2 py-1 bg-white rounded border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors truncate"
                >
                  Conversation {i + 1}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TopicCard({ topic }: { topic: TopicCount }) {
  const maxWidth = 100;
  const barWidth = Math.min((topic.count / 10) * maxWidth, maxWidth);

  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-gray-700 capitalize">{topic.topic}</span>
      </div>
      <div className="w-24 flex items-center gap-2">
        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-400 to-purple-600 rounded-full"
            style={{ width: `${barWidth}%` }}
          />
        </div>
        <span className="text-xs text-gray-500 w-6 text-right">{topic.count}</span>
      </div>
    </div>
  );
}

function GapCard({
  gap,
  onSelectConversation,
}: {
  gap: KnowledgeGap;
  onSelectConversation?: (id: string) => void;
}) {
  return (
    <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
      <div className="flex items-start gap-2">
        <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-800 capitalize">{gap.topic}</p>
          <p className="text-xs text-amber-600 mt-0.5 line-clamp-2">"{gap.originalQuestion}"</p>
          <button
            onClick={() => onSelectConversation?.(gap.conversationId)}
            className="text-xs text-amber-700 hover:text-amber-900 mt-1 underline"
          >
            View conversation
          </button>
        </div>
      </div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
