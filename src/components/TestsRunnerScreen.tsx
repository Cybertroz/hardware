import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Play,
  RotateCcw,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { runBusinessLogicTests, TestResult } from '../utils/automatedTests.ts';

export const TestsRunnerScreen: React.FC = () => {
  const [testResults, setTestResults] = useState<TestResult[]>(runBusinessLogicTests());
  const [isRunning, setIsRunning] = useState(false);

  const handleRunTests = () => {
    setIsRunning(true);
    setTimeout(() => {
      setTestResults(runBusinessLogicTests());
      setIsRunning(false);
    }, 400);
  };

  const totalPassed = testResults.filter(t => t.passed).length;
  const allPassed = totalPassed === testResults.length;

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-80px)] overflow-hidden bg-slate-950 p-4 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 p-3.5 rounded-xl border border-slate-800 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <span>Automated Business Logic Verification Test Suite</span>
          </h2>
          <p className="text-xs text-slate-400">
            Validating non-negative stock guards, WAC formulas, multi-unit conversions, Kenya 16% VAT, contractor credit limits, and split payments
          </p>
        </div>

        <button
          onClick={handleRunTests}
          disabled={isRunning}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs flex items-center gap-2 transition shadow disabled:opacity-50"
        >
          {isRunning ? <RotateCcw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          <span>{isRunning ? 'Running Invariant Tests...' : 'Execute Test Suite'}</span>
        </button>
      </div>

      {/* Summary Scorecard */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-full ${allPassed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
            {allPassed ? <CheckCircle2 className="w-8 h-8" /> : <XCircle className="w-8 h-8" />}
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">
              {allPassed ? 'All Business Rules & Invariants Passed' : 'Test Failures Detected'}
            </h3>
            <p className="text-xs text-slate-400">
              {totalPassed} of {testResults.length} test assertions verified against system state
            </p>
          </div>
        </div>

        <div className="text-right">
          <div className="text-2xl font-extrabold font-mono text-emerald-400">
            {Math.round((totalPassed / testResults.length) * 100)}%
          </div>
          <span className="text-[10px] text-slate-400">Success Rate</span>
        </div>
      </div>

      {/* Test Results Table */}
      <div className="flex-1 overflow-auto bg-slate-900 rounded-xl border border-slate-800 p-4">
        <div className="space-y-3">
          {testResults.map((t, idx) => (
            <div
              key={idx}
              className={`p-3.5 rounded-lg border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                t.passed ? 'bg-slate-950 border-slate-800' : 'bg-red-950/40 border-red-800'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {t.passed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                  )}
                  <span className="font-bold text-white">{t.name}</span>
                  <span className="bg-slate-800 text-slate-300 text-[10px] px-2 py-0.5 rounded">
                    {t.category}
                  </span>
                </div>
                <p className="text-slate-400 text-[11px] pl-6">{t.message}</p>
              </div>

              <div className="text-right shrink-0 pl-6 sm:pl-0 font-mono text-[11px]">
                <div className="text-slate-400">Expected: <span className="text-slate-200">{t.expected}</span></div>
                <div className="text-slate-400">Actual: <span className={t.passed ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>{t.actual}</span></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
