/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Clock,
  ShieldCheck,
  Layers,
  Database,
  FileCode2,
  RefreshCw,
  GitBranch,
  AlertTriangle,
} from 'lucide-react';

interface LiveHealthData {
  status: string;
  service: string;
  timestamp: string;
}

export default function App() {
  const [health, setHealth] = useState<LiveHealthData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [lastCheck, setLastCheck] = useState<string>('');

  const checkHealth = async () => {
    setLoading(true);
    try {
      const res = await fetch('/health/live');
      if (res.ok) {
        const data = (await res.json()) as LiveHealthData;
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
    void checkHealth();
  }, []);

  const capabilities = [
    { id: 'CAP-001', name: 'Merchant Onboarding & Profile Registry', status: 'NOT STARTED' },
    { id: 'CAP-002', name: 'PostgreSQL 16 Schema, Migrator/App Roles & RLS', status: 'NOT STARTED' },
    { id: 'CAP-003', name: 'Object Storage Media Pipeline (S3-compatible)', status: 'NOT STARTED' },
    { id: 'CAP-004', name: 'WhatsApp Webhook Ingestion & Signature Verification', status: 'NOT STARTED' },
    { id: 'CAP-005', name: 'AI-Assisted Listing Draft Generation (Server-Side)', status: 'NOT STARTED' },
    { id: 'CAP-006', name: 'Merchant Approval Gate (DRAFT -> PENDING_CONFIRMATION -> PUBLISHED)', status: 'NOT STARTED' },
    { id: 'CAP-007', name: 'Shareable Product Link & Single-Item Storefront', status: 'NOT STARTED' },
    { id: 'CAP-008', name: 'Single-Item Buyer Order Creation & Checkout', status: 'NOT STARTED' },
    { id: 'CAP-009', name: 'Payment Submission & Verification', status: 'NOT STARTED' },
    { id: 'CAP-010', name: 'Merchant Order Notifications via WhatsApp', status: 'NOT STARTED' },
    { id: 'CAP-011', name: 'Order Fulfilment & Delivery State Machine', status: 'NOT STARTED' },
    { id: 'CAP-012', name: 'Merchant Daily Reconciliation Summary', status: 'NOT STARTED' },
    { id: 'CAP-013', name: 'Background Job Queue & Retries (Worker + Redis/BullMQ)', status: 'NOT STARTED' },
  ];

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      <header className="border-b border-neutral-800/80 bg-neutral-900/50 backdrop-blur sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-lg">
              V
            </div>
            <div>
              <span className="font-semibold text-white tracking-tight">Vitrine</span>
              <span className="ml-2 text-xs text-neutral-400 border border-neutral-800 rounded px-1.5 py-0.5 bg-neutral-800/40">
                Task 0.1 Scaffold
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-neutral-300 font-medium">Node.js Monolith</span>
            </div>
            <button
              onClick={() => {
                void checkHealth();
              }}
              disabled={loading}
              className="flex items-center gap-1.5 text-neutral-400 hover:text-white bg-neutral-800/60 hover:bg-neutral-800 px-2.5 py-1.5 rounded border border-neutral-700/60 transition"
              title="Ping liveness endpoint"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Ping /health/live</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex-1 space-y-8 w-full">
        <section className="bg-gradient-to-br from-neutral-900 via-neutral-900 to-neutral-950 border border-neutral-800 rounded-xl p-6 sm:p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 text-xs text-emerald-400 font-medium px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-800/50 mb-3">
                <ShieldCheck className="w-3.5 h-3.5" />
                Task 0.1 Remediation Verified
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Plataforma de Vendas WhatsApp para Angola
              </h1>
              <p className="mt-2 text-neutral-400 text-sm max-w-2xl leading-relaxed">
                Modular monolith scaffold configured for merchant photo ingestion, AI-assisted draft listings,
                strict merchant approval gates, shareable links, verified payments, and local reconciliation.
              </p>
            </div>

            <div className="bg-neutral-950/70 border border-neutral-800 rounded-lg p-4 min-w-[240px]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs uppercase tracking-wider text-neutral-400 font-semibold">Liveness</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded font-mono font-medium ${
                    health?.status === 'ok'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  }`}
                >
                  {health?.status ? health.status.toUpperCase() : 'CHECKING'}
                </span>
              </div>
              <div className="space-y-1 text-xs text-neutral-400 font-mono">
                <div className="flex justify-between">
                  <span>Endpoint:</span>
                  <span className="text-neutral-200">/health/live</span>
                </div>
                <div className="flex justify-between">
                  <span>Service:</span>
                  <span className="text-neutral-200">{health?.service ?? 'vitrine-web'}</span>
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

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-neutral-900/60 border border-neutral-800 rounded-lg p-5">
            <div className="flex items-center gap-2 text-emerald-400 font-medium text-sm mb-3">
              <Layers className="w-4 h-4" />
              <span>Deployable Units</span>
            </div>
            <ul className="text-xs text-neutral-300 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-mono">apps/web</span>
                <span className="text-neutral-400">— Express API &amp; bundled production server</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-mono">apps/worker</span>
                <span className="text-neutral-400">— BullMQ &amp; Redis worker for async jobs</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-mono">packages/shared</span>
                <span className="text-neutral-400">— Zero-float Money &amp; domain contracts</span>
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
                <span className="text-neutral-400">— FORCE ROW LEVEL SECURITY per merchant</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-sky-300 font-mono">vitrine_migrator</span>
                <span className="text-neutral-400">— Owns schema objects; runs migrations</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-sky-300 font-mono">vitrine_app</span>
                <span className="text-neutral-400">— NOBYPASSRLS runtime role, non-owner</span>
              </li>
            </ul>
          </div>

          <div className="bg-neutral-900/60 border border-neutral-800 rounded-lg p-5">
            <div className="flex items-center gap-2 text-amber-400 font-medium text-sm mb-3">
              <ShieldCheck className="w-4 h-4" />
              <span>Strict Rules &amp; Invariants</span>
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

        <section className="bg-neutral-900/40 border border-neutral-800 rounded-xl overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-neutral-800 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">Phase 1 Capabilities Matrix</h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Scaffold and CI hardening only. All Phase 1 product capabilities remain NOT STARTED.
              </p>
            </div>
            <span className="text-xs text-neutral-400 font-mono">0/13 Started</span>
          </div>

          <div className="divide-y divide-neutral-800/60">
            {capabilities.map((cap) => (
              <div key={cap.id} className="p-3.5 sm:px-5 flex items-center justify-between hover:bg-neutral-800/20 transition">
                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-neutral-500 flex-shrink-0" />
                  <div>
                    <span className="font-mono text-xs text-neutral-400 mr-2">{cap.id}</span>
                    <span className="text-xs sm:text-sm font-medium text-neutral-200">{cap.name}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-neutral-800 text-neutral-400 border border-neutral-700/50">
                    {cap.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
              <FileCode2 className="w-4 h-4 text-emerald-400" />
              Project Documentation
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
              <span className="p-2 rounded bg-neutral-950/60 border border-neutral-800/80 font-mono">ADR-001-stack-and-rls.md</span>
            </div>
          </div>

          <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Open Issues &amp; Blockers (docs/OPEN_QUESTIONS.md)
            </h3>
            <div className="space-y-3 text-xs text-neutral-300">
              <div className="p-3 rounded-lg bg-neutral-950/80 border border-neutral-800">
                <div className="font-semibold text-amber-300 font-mono text-[11px] mb-1">OQ-001: Baseline DB_v7.sql</div>
                <p className="text-neutral-400 leading-relaxed">
                  Placeholder at <code className="text-neutral-200">db/migrations/0001_DB_v7.sql</code> with bootstrap separated into <code className="text-neutral-200">db/bootstrap/0000_bootstrap_roles.sql</code>. Awaiting user-provided DB_v7.sql.
                </p>
              </div>
              <div className="flex items-center gap-2 text-neutral-400 text-xs">
                <GitBranch className="w-3.5 h-3.5 text-neutral-500" />
                <span>GitHub Actions CI enforces ON_ERROR_STOP, migration ordering, secret scan, and production smoke test</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-neutral-800/80 py-4 text-center text-xs text-neutral-500">
        Vitrine • Angola WhatsApp-First Commerce • Modular Monolith Task 0.1
      </footer>
    </div>
  );
}
