/**
 * Session Workflow Guide Component
 *
 * Shows the workflow steps during an active recording session,
 * helping users follow the template's suggested flow.
 */

import { useState, useEffect } from 'react';
import type { SessionTemplate, WorkflowStep } from '../types/sessionTemplate';

interface SessionWorkflowGuideProps {
  template: SessionTemplate;
  sessionDurationMs: number;
  onStepChange?: (stepIndex: number) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function SessionWorkflowGuide({
  template,
  sessionDurationMs,
  onStepChange,
  collapsed = false,
  onToggleCollapse,
}: SessionWorkflowGuideProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [expandedStep, setExpandedStep] = useState<number | null>(0);

  const workflow = template.workflow;
  const totalEstimatedMs = workflow.reduce(
    (sum, step) => sum + (step.estimatedMinutes || 0) * 60 * 1000,
    0
  );

  // Auto-suggest step based on elapsed time
  useEffect(() => {
    if (totalEstimatedMs === 0) return;

    let accumulated = 0;
    for (let i = 0; i < workflow.length; i++) {
      const stepMs = (workflow[i].estimatedMinutes || 0) * 60 * 1000;
      accumulated += stepMs;
      if (sessionDurationMs < accumulated) {
        // Don't auto-advance if user manually moved to a different step
        if (!completedSteps.has(i)) {
          setCurrentStep(i);
        }
        break;
      }
    }
  }, [sessionDurationMs, totalEstimatedMs, workflow, completedSteps]);

  const handleStepClick = (index: number) => {
    setCurrentStep(index);
    setExpandedStep(expandedStep === index ? null : index);
    onStepChange?.(index);
  };

  const handleCompleteStep = (index: number) => {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
        // Auto-advance to next step
        if (index < workflow.length - 1) {
          setCurrentStep(index + 1);
          setExpandedStep(index + 1);
          onStepChange?.(index + 1);
        }
      }
      return next;
    });
  };

  const formatTime = (minutes: number) => {
    if (minutes < 1) return '<1 min';
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  // Progress calculation
  const completedCount = completedSteps.size;
  const totalSteps = workflow.length;
  const progressPercent = (completedCount / totalSteps) * 100;

  if (collapsed) {
    return (
      <button
        onClick={onToggleCollapse}
        className="fixed bottom-24 right-4 z-40 px-4 py-2 bg-white shadow-lg rounded-full border border-neutral-200 flex items-center gap-2 hover:shadow-xl transition-shadow"
        style={{ borderColor: template.color }}
      >
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: template.color }}
        />
        <span className="text-sm font-medium text-neutral-700">
          Step {currentStep + 1}/{totalSteps}
        </span>
        <span className="text-sm text-neutral-500">
          {workflow[currentStep]?.title}
        </span>
        <svg className="w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      </button>
    );
  }

  return (
    <div
      className="fixed bottom-24 right-4 z-40 w-80 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden"
      style={{ borderTopColor: template.color, borderTopWidth: 3 }}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: template.color }}
          />
          <span className="text-sm font-medium text-neutral-900">
            {template.name} Workflow
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-400">
            {completedCount}/{totalSteps} done
          </span>
          <button
            onClick={onToggleCollapse}
            className="p-1 text-neutral-400 hover:text-neutral-600 rounded"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-neutral-100">
        <div
          className="h-full transition-all duration-500"
          style={{
            width: `${progressPercent}%`,
            backgroundColor: template.color,
          }}
        />
      </div>

      {/* Steps */}
      <div className="max-h-64 overflow-y-auto">
        {workflow.map((step, index) => {
          const isActive = index === currentStep;
          const isCompleted = completedSteps.has(index);
          const isExpanded = expandedStep === index;

          return (
            <div
              key={step.order}
              className={`border-b border-gray-50 last:border-0 ${
                isActive ? 'bg-neutral-50' : ''
              }`}
            >
              <button
                onClick={() => handleStepClick(index)}
                className="w-full px-4 py-2.5 flex items-start gap-3 text-left hover:bg-neutral-50 transition-colors"
              >
                {/* Step indicator */}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCompleteStep(index);
                  }}
                  className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-all cursor-pointer ${
                    isCompleted
                      ? 'bg-green-500 text-white'
                      : isActive
                      ? 'text-white'
                      : 'bg-neutral-100 text-neutral-500 hover:bg-gray-200'
                  }`}
                  style={{
                    backgroundColor: isCompleted
                      ? '#10B981'
                      : isActive
                      ? template.color
                      : undefined,
                  }}
                >
                  {isCompleted ? (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </div>

                {/* Step content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-sm font-medium ${
                        isCompleted
                          ? 'text-neutral-400 line-through'
                          : isActive
                          ? 'text-neutral-900'
                          : 'text-neutral-600'
                      }`}
                    >
                      {step.title}
                    </span>
                    {step.estimatedMinutes && (
                      <span className="text-xs text-neutral-400 ml-2">
                        {formatTime(step.estimatedMinutes)}
                      </span>
                    )}
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="mt-1.5">
                      <p className="text-xs text-neutral-500">{step.description}</p>
                      {step.tips && step.tips.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {step.tips.map((tip, i) => (
                            <li
                              key={i}
                              className="text-xs text-neutral-400 flex items-start gap-1.5"
                            >
                              <span style={{ color: template.color }}>•</span>
                              {tip}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>

                {/* Expand indicator */}
                <svg
                  className={`w-4 h-4 text-gray-300 flex-shrink-0 transition-transform ${
                    isExpanded ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>

      {/* Footer tip */}
      {currentStep < totalSteps && !completedSteps.has(currentStep) && (
        <div className="px-4 py-2 bg-neutral-50 border-t border-gray-100">
          <p className="text-xs text-neutral-500">
            <span className="font-medium">Tip:</span> Click the step number to mark it complete
          </p>
        </div>
      )}

      {/* Completion message */}
      {completedCount === totalSteps && (
        <div
          className="px-4 py-3 text-white text-center text-sm font-medium"
          style={{ backgroundColor: template.color }}
        >
          All steps complete! Great session!
        </div>
      )}
    </div>
  );
}
