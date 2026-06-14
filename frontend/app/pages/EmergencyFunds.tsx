import React, { useState } from 'react';

const FUNDS = [
  { id: 'EQ_2024_DR', name: 'Earthquake Emergency Response', type: 'Earthquake', area: 'Santo Domingo, DR', total: 1000000, released: 340000, expires: '2024-12-31', status: 'active', signers: 2, threshold: 3 },
  { id: 'FL_2024_BD', name: 'Bangladesh Flood Relief', type: 'Flood', area: 'Dhaka Region, BD', total: 750000, released: 210000, expires: '2024-11-15', status: 'active', signers: 1, threshold: 2 },
  { id: 'DT_2024_ET', name: 'Ethiopia Drought Response', type: 'Drought', area: 'Tigray, Ethiopia', total: 500000, released: 499000, expires: '2024-10-01', status: 'expiring', signers: 3, threshold: 3 },
  { id: 'HC_2024_HT', name: 'Haiti Hurricane Relief', type: 'Hurricane', area: 'Port-au-Prince, HT', total: 2000000, released: 0, expires: '2025-03-31', status: 'active', signers: 0, threshold: 3 },
];

const fmt = (n: number) => n >= 1000000 ? `$${(n/1000000).toFixed(1)}M` : n >= 1000 ? `$${(n/1000).toFixed(0)}K` : `$${n}`;

export default function EmergencyFunds() {
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<typeof FUNDS[0] | null>(null);

  return (
    <>
      <div className="stats-grid">
        <div className="stat-card blue">
          <div className="stat-label">Active Funds</div>
          <div className="stat-value blue">4</div>
          <div className="stat-sub">2 require signatures</div>
        </div>
        <div className="stat-card green">
          <div className="stat-label">Total Deployed</div>
          <div className="stat-value green">$4.25M</div>
          <div className="stat-sub">Across 4 regions</div>
        </div>
        <div className="stat-card orange">
          <div className="stat-label">Released</div>
          <div className="stat-value orange">$1.05M</div>
          <div className="stat-sub">24.7% utilization</div>
        </div>
        <div className="stat-card blue">
          <div className="stat-label">Remaining</div>
          <div className="stat-value blue">$3.20M</div>
          <div className="stat-sub">Available to disburse</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2>Active Funds</h2>
            <p>Multi-signature emergency relief funds on Stellar</p>
          </div>
          <div className="btn-row" style={{ margin: 0 }}>
            <button className="btn btn-primary" onClick={() => setShowForm(v => !v)}>+ Deploy Fund</button>
            <button className="btn btn-danger">⚡ Rapid Response</button>
            <button className="btn btn-ghost">Cleanup</button>
          </div>
        </div>

        {showForm && (
          <div className="panel">
            <h3>Deploy Emergency Fund</h3>
            <div className="grid2" style={{ gap: '0.75rem', marginBottom: '0.75rem' }}>
              <input className="input" placeholder="Fund ID (e.g. EQ_2024_DR)" />
              <input className="input" placeholder="Fund Name" />
              <select className="input">
                <option>Earthquake</option><option>Flood</option>
                <option>Hurricane</option><option>Drought</option><option>Wildfire</option>
              </select>
              <input className="input" placeholder="Geographic Scope" />
              <input className="input" type="number" placeholder="Total Amount (XLM)" />
              <input className="input" type="date" />
            </div>
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <button className="btn btn-primary">Deploy Fund</button>
              <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
        )}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fund</th><th>Type</th><th>Region</th>
                <th>Total</th><th>Utilization</th><th>Multi-sig</th>
                <th>Expires</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {FUNDS.map(f => {
                const pct = Math.round((f.released / f.total) * 100);
                return (
                  <tr key={f.id}>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: '0.825rem' }}>{f.name}</div>
                      <code>{f.id}</code>
                    </td>
                    <td>{f.type}</td>
                    <td style={{ color: 'var(--text2)', fontSize: '0.8rem' }}>{f.area}</td>
                    <td style={{ fontWeight: 600 }}>{fmt(f.total)}</td>
                    <td style={{ minWidth: 130 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="progress" style={{ flex: 1 }}>
                          <div className="progress-bar" style={{ width: `${pct}%`, background: pct > 90 ? 'var(--orange)' : undefined }} />
                        </div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text2)', minWidth: 28 }}>{pct}%</span>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.78rem', color: f.signers >= f.threshold ? 'var(--green)' : 'var(--orange)' }}>
                        {f.signers}/{f.threshold} signed
                      </span>
                    </td>
                    <td style={{ color: 'var(--text2)', fontSize: '0.8rem' }}>{f.expires}</td>
                    <td>
                      <span className={`badge ${f.status === 'active' ? 'green' : f.status === 'expiring' ? 'yellow' : 'red'}`}>
                        {f.status === 'expiring' ? 'Expiring' : f.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => setSelected(f)}>View</button>
                        <button className="btn btn-ghost btn-sm">QR</button>
                      </div>
                    </td>
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
            <h2>{selected.name}</h2>
            <div className="modal-sub">{selected.id} · {selected.type} · {selected.area}</div>
            <div className="modal-section">
              <h3>Financial Overview</h3>
              <div className="modal-row"><span>Total Deployed</span><span>{fmt(selected.total)}</span></div>
              <div className="modal-row"><span>Released</span><span>{fmt(selected.released)}</span></div>
              <div className="modal-row"><span>Remaining</span><span>{fmt(selected.total - selected.released)}</span></div>
              <div className="modal-row"><span>Utilization</span><span>{Math.round((selected.released / selected.total) * 100)}%</span></div>
            </div>
            <div className="modal-section">
              <h3>Multi-Signature</h3>
              <div className="modal-row"><span>Signers</span><span>{selected.signers} of {selected.threshold}</span></div>
              <div className="modal-row"><span>Expires</span><span>{selected.expires}</span></div>
            </div>
            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button className="btn btn-primary btn-sm">Sign Disbursement</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
