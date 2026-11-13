/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import {
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

  const requirements = [
    { id: 'FR-1', name: 'Chat identity merchant registration & auto store/subdomain', status: 'Not started' },
    { id: 'FR-2', name: 'Product creation via photo and optional free text', status: 'Not started' },
    { id: 'FR-3', name: 'AI structured draft with uncertainty & merchant confirmation gate', status: 'Not started' },
    { id: 'FR-4', name: 'Deterministic buyer catalogue lookup (basic P0)', status: 'Not started' },
    { id: 'FR-5', name: 'Accountless buyer checkout', status: 'Not started' },
    { id: 'FR-6', name: 'Real provider payment request (or labelled manual review)', status: 'Not started' },
    { id: 'FR-7', name: 'Signed, deduplicated, idempotent payment event processing', status: 'Not started' },
    { id: 'FR-8', name: 'Merchant payment confirmation notification', status: 'Not started' },
    { id: 'FR-9', name: 'Independent order, payment, fulfilment, payout state histories', status: 'Not started' },
    { id: 'FR-10', name: 'Merchant open orders & sales totals via chat', status: 'Not started' },
    { id: 'FR-12', name: 'Lightweight public store and product pages', status: 'Not started' },
    { id: 'FR-13', name: 'Direct settlement / sub-account provider evaluation', status: 'Not started' },
    { id: 'FR-15', name: 'Simple pilot fee reporting', status: 'Not started' },
    { id: 'FR-17', name: 'Paid-order notification with itemized deductions', status: 'Not started' },
    { id: 'FR-18', name: 'Atomic, expiring checkout stock reservation', status: 'Not started' },
    { id: 'FR-19', name: 'Out-of-stock exclusion from purchase & recommendations', status: 'Not started' },
    { id: 'FR-21', name: 'Fulfilment due times & overdue merchant reminders', status: 'Not started' },
    { id: 'FR-22', name: 'Short chat commands to list, ship, and complete orders', status: 'Not started' },
    { id: 'FR-29', name: 'Basic support case handling for buyer disputes', status: 'Not started' },
    { id: 'FR-33', name: 'Approved WhatsApp templates for proactive notifications', status: 'Not started' },
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
                DB_v7 &amp; BUILD_PLAN_v8 Baseline
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
              <div className="inline-flex items-center gap-2 text-xs text-amber-300 font-medium px-2.5 py-1 rounded-full bg-amber-950/60 border border-amber-800/50 mb-3">
                <ShieldCheck className="w-3.5 h-3.5" />
                Task 1A In Progress — Baseline Aligned
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Plataforma de Vendas WhatsApp para Angola
              </h1>
              <p className="mt-2 text-neutral-400 text-sm max-w-2xl leading-relaxed">
                Modular monolith scaffold aligned with DB_v7 (10 roles, 3 schemas, signed transaction-local tenant context)
                and BUILD_PLAN_v8 P0 pilot scope.
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
              <span>DB_v7 Foundation</span>
            </div>
            <ul className="text-xs text-neutral-300 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-sky-300 font-mono">3 Schemas</span>
                <span className="text-neutral-400">— vitrine_core, vitrine_internal, vitrine_public_api</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-sky-300 font-mono">migrator</span>
                <span className="text-neutral-400">— Non-vitrine_* migration role owning DB</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-sky-300 font-mono">10 Roles</span>
                <span className="text-neutral-400">— Signed txn-local context &amp; FORCE RLS</span>
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
                <span className="text-amber-300 font-mono">Exact Money</span>
                <span className="text-neutral-400">— NUMERIC(20,2) &amp; string-parsed minor units (ADR-002 proposed)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-300 font-mono">Approval Gate</span>
                <span className="text-neutral-400">— AI output never auto-publishes</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-300 font-mono">Phase 1 Scope</span>
                <span className="text-neutral-400">— Single-product checkout only</span>
              </li>
            </ul>
          </div>
        </section>

        <section className="bg-neutral-900/40 border border-neutral-800 rounded-xl overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-neutral-800 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">BUILD_PLAN_v8 P0 Requirements</h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Database foundation &amp; CI baseline only. All product requirements remain Not started.
              </p>
            </div>
            <span className="text-xs text-neutral-400 font-mono">0/{requirements.length} Started</span>
          </div>

          <div className="divide-y divide-neutral-800/60">
            {requirements.map((req) => (
              <div key={req.id} className="p-3.5 sm:px-5 flex items-center justify-between hover:bg-neutral-800/20 transition">
                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-neutral-500 flex-shrink-0" />
                  <div>
                    <span className="font-mono text-xs text-neutral-400 mr-2">{req.id}</span>
                    <span className="text-xs sm:text-sm font-medium text-neutral-200">{req.name}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-neutral-800 text-neutral-400 border border-neutral-700/50">
                    {req.status}
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
              <span className="p-2 rounded bg-neutral-950/60 border border-neutral-800/80 font-mono">docs/BUILD_PLAN_v8.md</span>
              <span className="p-2 rounded bg-neutral-950/60 border border-neutral-800/80 font-mono">docs/SCHEMA_MIGRATION_BACKLOG_v8.md</span>
              <span className="p-2 rounded bg-neutral-950/60 border border-neutral-800/80 font-mono">docs/DATA_MODEL.md</span>
              <span className="p-2 rounded bg-neutral-950/60 border border-neutral-800/80 font-mono">docs/SECURITY.md</span>
              <span className="p-2 rounded bg-neutral-950/60 border border-neutral-800/80 font-mono">docs/TEST_PLAN.md</span>
              <span className="p-2 rounded bg-neutral-950/60 border border-neutral-800/80 font-mono">docs/RUNBOOK.md</span>
              <span className="p-2 rounded bg-neutral-950/60 border border-neutral-800/80 font-mono">docs/OPEN_QUESTIONS.md</span>
              <span className="p-2 rounded bg-neutral-950/60 border border-neutral-800/80 font-mono">ADR-001 (AMENDED)</span>
              <span className="p-2 rounded bg-neutral-950/60 border border-neutral-800/80 font-mono">ADR-002 (PROPOSED)</span>
            </div>
          </div>

          <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Open Questions (docs/OPEN_QUESTIONS.md)
            </h3>
            <div className="space-y-2 text-xs text-neutral-300">
              <div className="p-2.5 rounded-lg bg-neutral-950/80 border border-neutral-800">
                <div className="font-semibold text-amber-300 font-mono text-[11px]">OQ-004: Exact Money (NUMERIC(20,2))</div>
                <p className="text-neutral-400">Direction set by backlog principle 8; ADR-002 PROPOSED pending user approval.</p>
              </div>
              <div className="p-2.5 rounded-lg bg-neutral-950/80 border border-neutral-800">
                <div className="font-semibold text-amber-300 font-mono text-[11px]">OQ-005..007: Identity, Backlog &amp; Custom Domain</div>
                <p className="text-neutral-400">Identity ADR required before Migration 01; OQ-006 closed (backlog added); custom_domain unused.</p>
              </div>
              <div className="flex items-center gap-2 text-neutral-400 text-xs pt-1">
                <GitBranch className="w-3.5 h-3.5 text-neutral-500" />
                <span>Dual-job CI: Job A (test_v7.py) &amp; Job B (app tests + GET / 200 text/html smoke test)</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-neutral-800/80 py-4 text-center text-xs text-neutral-500">
        Vitrine • Angola WhatsApp-First Commerce • Task 1A Baseline Alignment
      </footer>
    </div>
  );
}
