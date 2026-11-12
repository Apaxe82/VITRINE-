/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  Clock, 
  Terminal, 
  ShieldCheck, 
  Layers, 
  Database, 
  FileCode2, 
  ArrowRight, 
  RefreshCw,
  GitBranch,
  AlertTriangle
} from 'lucide-react';

interface HealthData {
  status: string;
  service: string;
  version: string;
  timestamp: string;
  uptimeSeconds: number;
  environment: string;
  checks: {
    system: string;
    database?: string;
  };
}

export default function App() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [lastCheck, setLastCheck] = useState<string>('');

  const checkHealth = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        setHealth(data);
      } else {
        setHealth(null);
      }
    } catch {
      setHealth(null);
    } finally {
      setLoading(false);
      setLastCheck(new Date().toLocaleTimeString());
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  const capabilities = [
    { id: 'CAP-000', name: 'Repository Scaffold & CI', status: 'COMPLETE', phase: 'Task 0' },
    { id: 'CAP-001', name: 'PostgreSQL 16 Schema & RLS', status: 'NOT STARTED', phase: 'Phase 1' },
    { id: 'CAP-002', name: 'Media Storage (S3 / MinIO)', status: 'NOT STARTED', phase: 'Phase 1' },
    { id: 'CAP-003', name: 'WhatsApp Webhook & Inbound Photos', status: 'NOT STARTED', phase: 'Phase 1' },
    { id: 'CAP-004', name: 'AI Listing Draft Generation', status: 'NOT STARTED', phase: 'Phase 1' },
    { id: 'CAP-005', name: 'Merchant Approval Flow (DRAFT -> PUBLISHED)', status: 'NOT STARTED', phase: 'Phase 1' },
    { id: 'CAP-006', name: 'Shareable Product Link & Single-Item Storefront', status: 'NOT STARTED', phase: 'Phase 1' },
    { id: 'CAP-007', name: 'Buyer Order Placement Flow', status: 'NOT STARTED', phase: 'Phase 1' },
    { id: 'CAP-008', name: 'Payment Verification (Multicaixa / Transfer)', status: 'NOT STARTED', phase: 'Phase 1' },
    { id: 'CAP-009', name: 'Merchant WhatsApp Order Alerts', status: 'NOT STARTED', phase: 'Phase 1' },
    { id: 'CAP-010', name: 'Fulfilment & Delivery State Machine', status: 'NOT STARTED', phase: 'Phase 1' },
    { id: 'CAP-011', name: 'Merchant Daily Reconciliation', status: 'NOT STARTED', phase: 'Phase 1' },
    { id: 'CAP-012', name: 'Worker Background Queues (BullMQ / Redis)', status: 'NOT STARTED', phase: 'Phase 1' },
  ];

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Top Header */}
      <header className="border-b border-neutral-800/80 bg-neutral-900/50 backdrop-blur sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-lg">
              V
            </div>
            <div>
              <span className="font-semibold text-white tracking-tight">Vitrine</span>
              <span className="ml-2 text-xs text-neutral-400 border border-neutral-800 rounded px-1.5 py-0.5 bg-neutral-800/40">
                Phase 1 Scaffold
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-neutral-300 font-medium">Node.js Monolith</span>
            </div>
            <button
              onClick={checkHealth}
              disabled={loading}
              className="flex items-center gap-1.5 text-neutral-400 hover:text-white bg-neutral-800/60 hover:bg-neutral-800 px-2.5 py-1.5 rounded border border-neutral-700/60 transition"
              title="Ping health check endpoint"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Ping /api/health</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex-1 space-y-8 w-full">
        {/* Hero Banner */}
        <section className="bg-gradient-to-br from-neutral-900 via-neutral-900 to-neutral-950 border border-neutral-800 rounded-xl p-6 sm:p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 text-xs text-emerald-400 font-medium px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-800/50 mb-3">
                <ShieldCheck className="w-3.5 h-3.5" />
                Task 0 Initialized & Verified
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Plataforma de Vendas WhatsApp para Angola
              </h1>
              <p className="mt-2 text-neutral-400 text-sm max-w-2xl leading-relaxed">
                Modular monolith architecture configured for merchant photo ingestion, AI-assisted draft listings, 
                strict merchant approval gates, shareable links, verified payments, and local reconciliation.
              </p>
            </div>

            {/* Live Health Badge */}
            <div className="bg-neutral-950/70 border border-neutral-800 rounded-lg p-4 min-w-[240px]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs uppercase tracking-wider text-neutral-400 font-semibold">Service Health</span>
                <span className={`text-xs px-2 py-0.5 rounded font-mono font-medium ${health?.status === 'ok' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}`}>
                  {health?.status ? health.status.toUpperCase() : 'CHECKING'}
                </span>
              </div>
              <div className="space-y-1 text-xs text-neutral-400 font-mono">
                <div className="flex justify-between">
                  <span>Endpoint:</span>
                  <span className="text-neutral-200">/api/health (200 OK)</span>
                </div>
                <div className="flex justify-between">
                  <span>Unit:</span>
                  <span className="text-neutral-200">{health?.service || 'vitrine-web'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Uptime:</span>
                  <span className="text-neutral-200">{health?.uptimeSeconds ?? 0}s</span>
                </div>
                {lastCheck && (
                  <div className="flex justify-between pt-1 border-t border-neutral-800/80 text-[11px] text-neutral-500">
                    <span>Last Ping:</span>
                    <span>{lastCheck}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Monolith Structure & Invariants Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-neutral-900/60 border border-neutral-800 rounded-lg p-5">
            <div className="flex items-center gap-2 text-emerald-400 font-medium text-sm mb-3">
              <Layers className="w-4 h-4" />
              <span>Deployable Units</span>
            </div>
            <ul className="text-xs text-neutral-300 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-mono">apps/web</span>
                <span className="text-neutral-400">— Express API & Webhook handler + storefront</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-mono">apps/worker</span>
                <span className="text-neutral-400">— BullMQ & Redis worker for async jobs</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-mono">packages/shared</span>
                <span className="text-neutral-400">— Zero-float Money & domain contracts</span>
              </li>
            </ul>
          </div>

          <div className="bg-neutral-900/60 border border-neutral-800 rounded-lg p-5">
            <div className="flex items-center gap-2 text-sky-400 font-medium text-sm mb-3">
              <Database className="w-4 h-4" />
              <span>Data System of Record</span>
            </div>
            <ul className="text-xs text-neutral-300 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-sky-300 font-mono">PostgreSQL 16</span>
                <span className="text-neutral-400">— Row-Level Security per merchant</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-sky-300 font-mono">db/bootstrap</span>
                <span className="text-neutral-400">— Separated role creation script</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-sky-300 font-mono">db/migrations</span>
                <span className="text-neutral-400">— Versioned migrations (DB_v7.sql pending)</span>
              </li>
            </ul>
          </div>

          <div className="bg-neutral-900/60 border border-neutral-800 rounded-lg p-5">
            <div className="flex items-center gap-2 text-amber-400 font-medium text-sm mb-3">
              <ShieldCheck className="w-4 h-4" />
              <span>Strict Rules & Invariants</span>
            </div>
            <ul className="text-xs text-neutral-300 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-amber-300 font-mono">Integer Money</span>
                <span className="text-neutral-400">— Minor units only (never floating point)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-300 font-mono">Approval Gate</span>
                <span className="text-neutral-400">— AI output never auto-publishes</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-300 font-mono">Phase 1 Scope</span>
                <span className="text-neutral-400">— Single-item checkout only</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Capabilities Checklist */}
        <section className="bg-neutral-900/40 border border-neutral-800 rounded-xl overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-neutral-800 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">Phase 1 Capabilities Matrix</h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Task 0 establishes scaffold and verification tooling. Product features remain NOT STARTED.
              </p>
            </div>
            <span className="text-xs text-neutral-400 font-mono">1/13 Ready</span>
          </div>

          <div className="divide-y divide-neutral-800/60">
            {capabilities.map((cap) => (
              <div key={cap.id} className="p-3.5 sm:px-5 flex items-center justify-between hover:bg-neutral-800/20 transition">
                <div className="flex items-center gap-3">
                  {cap.status === 'COMPLETE' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  ) : (
                    <Clock className="w-4 h-4 text-neutral-500 flex-shrink-0" />
                  )}
                  <div>
                    <span className="font-mono text-xs text-neutral-400 mr-2">{cap.id}</span>
                    <span className="text-xs sm:text-sm font-medium text-neutral-200">{cap.name}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-[11px] font-mono px-2 py-0.5 rounded ${
                    cap.status === 'COMPLETE'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-neutral-800 text-neutral-400 border border-neutral-700/50'
                  }`}>
                    {cap.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Documentation & Open Issues Section */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
              <FileCode2 className="w-4 h-4 text-emerald-400" />
              Project Documentation Skeleton
            </h3>
            <div className="grid grid-cols-2 gap-2 text-xs text-neutral-300">
              <span className="p-2 rounded bg-neutral-950/60 border border-neutral-800/80 font-mono">docs/STATUS.md</span>
              <span className="p-2 rounded bg-neutral-950/60 border border-neutral-800/80 font-mono">docs/PRD.md</span>
              <span className="p-2 rounded bg-neutral-950/60 border border-neutral-800/80 font-mono">docs/ARCHITECTURE.md</span>
              <span className="p-2 rounded bg-neutral-950/60 border border-neutral-800/80 font-mono">docs/DATA_MODEL.md</span>
              <span className="p-2 rounded bg-neutral-950/60 border border-neutral-800/80 font-mono">docs/WEBHOOKS_AND_API.md</span>
              <span className="p-2 rounded bg-neutral-950/60 border border-neutral-800/80 font-mono">docs/TEST_PLAN.md</span>
              <span className="p-2 rounded bg-neutral-950/60 border border-neutral-800/80 font-mono">docs/SECURITY.md</span>
              <span className="p-2 rounded bg-neutral-950/60 border border-neutral-800/80 font-mono">docs/RUNBOOK.md</span>
              <span className="p-2 rounded bg-neutral-950/60 border border-neutral-800/80 font-mono">docs/OPEN_QUESTIONS.md</span>
              <span className="p-2 rounded bg-neutral-950/60 border border-neutral-800/80 font-mono">ADR-000-template.md</span>
            </div>
          </div>

          <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Open Issues & Next Step (docs/OPEN_QUESTIONS.md)
            </h3>
            <div className="space-y-3 text-xs text-neutral-300">
              <div className="p-3 rounded-lg bg-neutral-950/80 border border-neutral-800">
                <div className="font-semibold text-amber-300 font-mono text-[11px] mb-1">OQ-001: Baseline DB_v7.sql</div>
                <p className="text-neutral-400 leading-relaxed">
                  Placeholder created at <code className="text-neutral-200">db/migrations/0001_DB_v7.sql</code> with bootstrap separated into <code className="text-neutral-200">db/bootstrap/0000_bootstrap_roles.sql</code>. Awaiting user-provided DB_v7.sql.
                </p>
              </div>
              <div className="flex items-center gap-2 text-neutral-400 text-xs">
                <GitBranch className="w-3.5 h-3.5 text-neutral-500" />
                <span>GitHub Actions CI workflow configured with ephemeral PostgreSQL 16</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-800/80 py-4 text-center text-xs text-neutral-500">
        Vitrine • Angola WhatsApp-First Commerce • Modular Monolith Task 0
      </footer>
    </div>
  );
}
