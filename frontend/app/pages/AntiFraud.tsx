import React, { useState } from 'react';

const ALERTS = [
  { id: 'ALERT_001', type: 'Duplicate Registration', subject: 'DP_003_FAMILY', risk: 'high',   desc: 'Same identity factors detected across 2 regions', time: '2h ago',  resolved: false },
  { id: 'ALERT_002', type: 'Unusual Spending',        subject: 'DP_002_SOLO',   risk: 'medium', desc: 'Spending velocity 3× above 7-day average',         time: '5h ago',  resolved: false },
  { id: 'ALERT_003', type: 'Merchant Collusion',      subject: 'MRC_004',       risk: 'high',   desc: 'Flagged for processing split transactions',         time: '1d ago',  resolved: true  },
  { id: 'ALERT_004', type: 'Location Mismatch',       subject: 'DP_001_FAMILY', risk: 'low',    desc: 'Transaction location 80km from registered area',   time: '2d ago',  resolved: true  },
];

const RULES = [
  { name: 'Duplicate Registration',  desc: 'Cross-region identity factor matching',    enabled: true  },
  { name: 'Spending Velocity',        desc: 'Flags 3× normal spending in 24h window',   enabled: true  },
  { name: 'Geolocation Mismatch',     desc: 'Transaction >50km from registered area',   enabled: true  },
  { name: 'Merchant Collusion',       desc: 'Split transaction pattern detection',       enabled: true  },
  { name: 'Time-of-Day Anomaly',      desc: 'Transactions outside allowed hours',        enabled: false },
  { name: 'Category Abuse',           desc: 'Spending in restricted categories',         enabled: true  },
];

const RISK_COLOR: Record<string, string> = { high: 'red', medium: 'yellow', low: 'blue' };

export default function AntiFraud() {
  const [resolved, setResolved] = useState<Set<string>>(new Set(ALERTS.filter(a => a.resolved).map(a => a.id)));
  const open = ALERTS.filter(a => !resolved.has(a.id)).length;

  return (
    <>
      <div className="stats-grid">
        <div className="stat-card red"><div className="stat-label">Open Alerts</div><div className="stat-value red">{open}</div><div className="stat-sub">Require attention</div></div>
        <div className="stat-card red"><div className="stat-label">High Risk</div><div className="stat-value red">{ALERTS.filter(a => a.risk === 'high' && !resolved.has(a.id)).length}</div><div className="stat-sub">Immediate action</div></div>
        <div className="stat-card green"><div className="stat-label">Resolved (30d)</div><div className="stat-value green">{resolved.size}</div><div className="stat-sub">Closed alerts</div></div>
        <div className="stat-card blue"><div className="stat-label">Prevention Rate</div><div className="stat-value blue">98.4%</div><div className="stat-sub">Fraud blocked</div></div>
      </div>

      {open > 0 && (
        <div className="alert danger">
          <span>🔴</span>
          <span><strong>{open} unresolved alert{open > 1 ? 's' : ''}</strong> — review high-risk cases immediately</span>
        </div>
      )}

      <div className="card">
        <div className="card-header"><h2>Fraud Alerts</h2><p>Real-time anomaly detection across all operations</p></div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Alert ID</th><th>Type</th><th>Subject</th><th>Description</th><th>Risk</th><th>Time</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {ALERTS.map(a => (
                <tr key={a.id} style={{ opacity: resolved.has(a.id) ? 0.5 : 1 }}>
                  <td><code>{a.id}</code></td>
                  <td style={{ fontWeight: 500, fontSize: '0.8rem' }}>{a.type}</td>
                  <td><code>{a.subject}</code></td>
                  <td style={{ color: 'var(--text2)', fontSize: '0.8rem', maxWidth: 220 }}>{a.desc}</td>
                  <td><span className={`badge ${RISK_COLOR[a.risk]}`}>{a.risk}</span></td>
                  <td style={{ color: 'var(--text2)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{a.time}</td>
                  <td><span className={`badge ${resolved.has(a.id) ? 'green' : 'red'}`}>{resolved.has(a.id) ? 'Resolved' : 'Open'}</span></td>
                  <td>
                    {!resolved.has(a.id) && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-success btn-sm" onClick={() => setResolved(s => new Set([...s, a.id]))}>Resolve</button>
                        <button className="btn btn-danger btn-sm">Freeze</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h2>Detection Rules</h2><p>Active fraud detection rules and thresholds</p></div>
        <div className="grid2">
          {RULES.map(r => (
            <div key={r.name} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'var(--surface2)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '0.875rem 1rem',
              borderLeft: `3px solid ${r.enabled ? 'var(--accent)' : 'var(--text3)'}`,
            }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{r.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text2)', marginTop: 2 }}>{r.desc}</div>
              </div>
              <span className={`badge ${r.enabled ? 'green' : 'gray'}`}>{r.enabled ? 'Active' : 'Off'}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
