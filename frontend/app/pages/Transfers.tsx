import React, { useState } from 'react';

const TRANSFERS = [
  { id: 'CT_EMERGENCY_001', beneficiary: 'DP_001_FAMILY', amount: 1000, spent: 340, token: 'XLM', purpose: 'Earthquake relief — family of 4', expires: '2024-12-31', status: 'active' },
  { id: 'CT_EMERGENCY_002', beneficiary: 'DP_004_CHILD',  amount: 500,  spent: 500, token: 'XLM', purpose: 'Flood relief — food & medical',  expires: '2024-11-01', status: 'expired' },
  { id: 'CT_CASH_003',      beneficiary: 'DP_002_SOLO',   amount: 800,  spent: 150, token: 'USDC', purpose: 'Hurricane relief — shelter',      expires: '2025-01-15', status: 'active' },
  { id: 'CT_CASH_004',      beneficiary: 'DP_005_ELDER',  amount: 600,  spent: 580, token: 'XLM', purpose: 'Earthquake relief — elderly care', expires: '2024-10-20', status: 'expiring' },
];

const RULES = [
  { cat: 'Food',      limit: 400, used: 150, color: 'var(--green)' },
  { cat: 'Medical',   limit: 300, used: 90,  color: 'var(--accent)' },
  { cat: 'Shelter',   limit: 200, used: 100, color: 'var(--accent2)' },
  { cat: 'Transport', limit: 100, used: 0,   color: 'var(--text2)' },
];

export default function Transfers() {
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<typeof TRANSFERS[0] | null>(null);

  return (
    <>
      <div className="stats-grid">
        <div className="stat-card blue"><div className="stat-label">Active</div><div className="stat-value blue">3</div><div className="stat-sub">Transfers in progress</div></div>
        <div className="stat-card green"><div className="stat-label">Total Value</div><div className="stat-value green">2,900</div><div className="stat-sub">XLM deployed</div></div>
        <div className="stat-card orange"><div className="stat-label">Spent</div><div className="stat-value orange">1,070</div><div className="stat-sub">36.9% utilization</div></div>
        <div className="stat-card red"><div className="stat-label">Expiring Soon</div><div className="stat-value red">1</div><div className="stat-sub">Within 7 days</div></div>
      </div>

      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div><h2>Conditional Transfers</h2><p>Rule-based spending with category limits and expiry</p></div>
          <div className="btn-row" style={{ margin: 0 }}>
            <button className="btn btn-primary" onClick={() => setShowCreate(v => !v)}>+ Create Transfer</button>
            <button className="btn btn-success">Process Payment</button>
            <button className="btn btn-ghost">Cleanup Expired</button>
          </div>
        </div>

        {showCreate && (
          <div className="panel">
            <h3>Create Conditional Transfer</h3>
            <div className="grid2" style={{ gap: '0.75rem', marginBottom: '0.75rem' }}>
              <input className="input" placeholder="Transfer ID" />
              <input className="input" placeholder="Beneficiary ID" />
              <input className="input" type="number" placeholder="Amount" />
              <select className="input"><option>XLM</option><option>USDC</option><option>EURT</option></select>
              <input className="input" type="date" />
              <input className="input" placeholder="Purpose" />
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>Spending Rules</div>
              <div className="grid4" style={{ gap: '0.6rem' }}>
                {RULES.map(r => (
                  <div key={r.cat} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.75rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text2)', marginBottom: '0.4rem' }}>{r.cat}</div>
                    <input className="input" defaultValue={r.limit} style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem' }} />
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <button className="btn btn-primary">Create</button>
              <button className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
            </div>
          </div>
        )}

        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Transfer</th><th>Beneficiary</th><th>Amount</th><th>Utilization</th><th>Token</th><th>Purpose</th><th>Expires</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {TRANSFERS.map(t => {
                const pct = Math.round((t.spent / t.amount) * 100);
                return (
                  <tr key={t.id}>
                    <td><code>{t.id}</code></td>
                    <td style={{ fontSize: '0.8rem' }}>{t.beneficiary}</td>
                    <td style={{ fontWeight: 600 }}>{t.amount} <span style={{ color: 'var(--text2)', fontWeight: 400 }}>{t.token}</span></td>
                    <td style={{ minWidth: 130 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="progress" style={{ flex: 1 }}>
                          <div className="progress-bar" style={{ width: `${pct}%`, background: pct > 90 ? 'var(--orange)' : undefined }} />
                        </div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text2)', minWidth: 28 }}>{pct}%</span>
                      </div>
                    </td>
                    <td><span className="badge blue">{t.token}</span></td>
                    <td style={{ color: 'var(--text2)', fontSize: '0.8rem', maxWidth: 180 }}>{t.purpose}</td>
                    <td style={{ color: 'var(--text2)', fontSize: '0.8rem' }}>{t.expires}</td>
                    <td><span className={`badge ${t.status === 'active' ? 'green' : t.status === 'expiring' ? 'yellow' : 'red'}`}>{t.status}</span></td>
                    <td><button className="btn btn-ghost btn-sm" onClick={() => setSelected(t)}>View</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{selected.id}</h2>
            <div className="modal-sub">{selected.purpose}</div>
            <div className="modal-section">
              <h3>Overview</h3>
              <div className="modal-row"><span>Beneficiary</span><span>{selected.beneficiary}</span></div>
              <div className="modal-row"><span>Total Amount</span><span>{selected.amount} {selected.token}</span></div>
              <div className="modal-row"><span>Spent</span><span>{selected.spent} {selected.token}</span></div>
              <div className="modal-row"><span>Remaining</span><span>{selected.amount - selected.spent} {selected.token}</span></div>
              <div className="modal-row"><span>Expires</span><span>{selected.expires}</span></div>
            </div>
            <div className="modal-section">
              <h3>Spending Rules</h3>
              {RULES.map(r => (
                <div key={r.cat} style={{ marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 4 }}>
                    <span style={{ color: 'var(--text2)' }}>{r.cat}</span>
                    <span style={{ fontWeight: 500 }}>{r.used} / {r.limit} {selected.token}</span>
                  </div>
                  <div className="progress">
                    <div className="progress-bar" style={{ width: `${Math.round(r.used/r.limit*100)}%`, background: r.color }} />
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
              {selected.status === 'expired' && <button className="btn btn-danger btn-sm">Recall Funds</button>}
              <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
