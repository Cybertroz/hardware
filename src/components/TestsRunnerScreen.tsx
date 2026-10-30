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
    <div className="flex-1 flex flex-col h-[calc(100vh-80px)] overflow-hidden bg-slate-50 p-4 space-y-4 text-slate-900">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-sky-100 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-sky-600" />
            <span>Automated Business Logic Verification Test Suite</span>
          </h2>
          <p className="text-xs text-slate-500">
            Validating non-negative stock guards, WAC formulas, multi-unit conversions, Kenya 16% VAT, contractor credit limits, and split payments
          </p>
        </div>

        <button
          onClick={handleRunTests}
          disabled={isRunning}
          className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition shadow-xs disabled:opacity-50"
        >
          {isRunning ? <RotateCcw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          <span>{isRunning ? 'Running Invariant Tests...' : 'Execute Test Suite'}</span>
        </button>
      </div>

      {/* Summary Scorecard */}
      <div className="bg-white border border-sky-100 rounded-2xl p-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-full ${allPassed ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
            {allPassed ? <CheckCircle2 className="w-8 h-8" /> : <XCircle className="w-8 h-8" />}
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              {allPassed ? 'All Business Rules & Invariants Passed' : 'Test Failures Detected'}
            </h3>
            <p className="text-xs text-slate-500">
              {totalPassed} of {testResults.length} test assertions verified against system state
            </p>
          </div>
        </div>

        <div className="text-right">
          <div className="text-2xl font-extrabold font-mono text-sky-700">
            {Math.round((totalPassed / testResults.length) * 100)}%
          </div>
          <span className="text-[10px] text-slate-500 font-semibold">Success Rate</span>
        </div>
      </div>

      {/* Test Results Table */}
      <div className="flex-1 overflow-auto bg-white rounded-2xl border border-sky-100 p-4 shadow-xs">
        <div className="space-y-2.5">
          {testResults.map((t, idx) => (
            <div
              key={idx}
              className={`p-3.5 rounded-xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition ${
                t.passed ? 'bg-sky-50/40 border-sky-100' : 'bg-rose-50 border-rose-200'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {t.passed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span className="font-bold text-slate-900">{t.name}</span>
                  <span className="bg-sky-100 text-sky-800 text-[10px] font-semibold px-2 py-0.5 rounded-md">
                    {t.category}
                  </span>
                </div>
                <p className="text-slate-600 text-[11px] pl-6">{t.message}</p>
              </div>

              <div className="text-right shrink-0 pl-6 sm:pl-0 font-mono text-[11px]">
                <div className="text-slate-500">Expected: <span className="text-slate-800 font-medium">{t.expected}</span></div>
                <div className="text-slate-500">Actual: <span className={t.passed ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>{t.actual}</span></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
