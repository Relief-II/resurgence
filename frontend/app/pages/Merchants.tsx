import React, { useState } from 'react';

const MERCHANTS = [
  { id: 'MRC_001', name: 'Colmado San Jose',    type: 'Grocery',   city: 'Santo Domingo', country: 'DR', rep: 94, status: 'verified', tokens: ['XLM','USDC'], daily: 5000, volume: 12400 },
  { id: 'MRC_002', name: 'Farmacia Central',    type: 'Pharmacy',  city: 'Port-au-Prince', country: 'HT', rep: 88, status: 'verified', tokens: ['XLM'],        daily: 3000, volume: 8100  },
  { id: 'MRC_003', name: 'Transport Rapide',    type: 'Transport', city: 'Port-au-Prince', country: 'HT', rep: 71, status: 'verified', tokens: ['XLM','EURT'], daily: 2000, volume: 4200  },
  { id: 'MRC_004', name: 'Bazar Al-Amin',       type: 'Clothing',  city: 'Dhaka',          country: 'BD', rep: 55, status: 'pending',  tokens: ['XLM'],        daily: 1000, volume: 0     },
  { id: 'MRC_005', name: 'Tienda Campesina',    type: 'Hardware',  city: 'San Cristobal',  country: 'DR', rep: 82, status: 'verified', tokens: ['XLM','USDC'], daily: 4000, volume: 6700  },
];

const QUEUE = ['MRC_004', 'MRC_006'];
const fmt = (n: number) => n >= 1000 ? `${(n/1000).toFixed(1)}K` : `${n}`;

export default function Merchants() {
  const [showForm, setShowForm] = useState(false);

  return (
    <>
      <div className="stats-grid">
        <div className="stat-card blue"><div className="stat-label">Active Merchants</div><div className="stat-value blue">4</div><div className="stat-sub">GPS-verified locations</div></div>
        <div className="stat-card orange"><div className="stat-label">Pending Verification</div><div className="stat-value orange">{QUEUE.length}</div><div className="stat-sub">Awaiting approval</div></div>
        <div className="stat-card green"><div className="stat-label">Total Volume</div><div className="stat-value green">31.4K</div><div className="stat-sub">XLM processed</div></div>
        <div className="stat-card blue"><div className="stat-label">Avg Reputation</div><div className="stat-value blue">78</div><div className="stat-sub">Out of 100</div></div>
      </div>

      {QUEUE.length > 0 && (
        <div className="alert warning">
          <span>⏳</span>
          <span><strong>{QUEUE.length} merchants</strong> pending verification — {QUEUE.join(', ')}</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button className="btn btn-success btn-sm">Approve All</button>
            <button className="btn btn-danger btn-sm">Reject All</button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div><h2>Merchant Network</h2><p>Local merchants accepting Stellar-based relief payments</p></div>
          <div className="btn-row" style={{ margin: 0 }}>
            <button className="btn btn-primary" onClick={() => setShowForm(v => !v)}>+ Onboard Merchant</button>
            <button className="btn btn-ghost">Search by Location</button>
          </div>
        </div>

        {showForm && (
          <div className="panel">
            <h3>Onboard New Merchant</h3>
            <div className="grid2" style={{ gap: '0.75rem', marginBottom: '0.75rem' }}>
              <input className="input" placeholder="Merchant ID" />
              <input className="input" placeholder="Business Name" />
              <select className="input"><option>Grocery</option><option>Pharmacy</option><option>Hardware</option><option>Transport</option><option>Restaurant</option></select>
              <input className="input" placeholder="Contact Information" />
              <input className="input" placeholder="Stellar Address (G…)" />
              <input className="input" placeholder="Accepted Tokens (XLM, USDC…)" />
              <input className="input" type="number" placeholder="Latitude" />
              <input className="input" type="number" placeholder="Longitude" />
            </div>
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <button className="btn btn-primary">Register</button>
              <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
        )}

        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Merchant</th><th>Type</th><th>Location</th><th>Tokens</th><th>Daily Limit</th><th>Volume</th><th>Reputation</th><th>Status</th></tr>
            </thead>
            <tbody>
              {MERCHANTS.map(m => (
                <tr key={m.id}>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: '0.825rem' }}>{m.name}</div>
                    <code>{m.id}</code>
                  </td>
                  <td style={{ color: 'var(--text2)' }}>{m.type}</td>
                  <td style={{ color: 'var(--text2)', fontSize: '0.8rem' }}>{m.city}, {m.country}</td>
                  <td>{m.tokens.map(t => <span key={t} className="badge blue" style={{ marginRight: 4 }}>{t}</span>)}</td>
                  <td style={{ fontWeight: 500 }}>{fmt(m.daily)} XLM</td>
                  <td style={{ fontWeight: 500, color: m.volume > 0 ? 'var(--green)' : 'var(--text2)' }}>{fmt(m.volume)} XLM</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="progress" style={{ width: 60 }}>
                        <div className="progress-bar" style={{ width: `${m.rep}%`, background: m.rep >= 80 ? 'var(--green)' : m.rep >= 60 ? 'var(--orange)' : 'var(--red)' }} />
                      </div>
                      <span style={{ fontSize: '0.78rem', fontWeight: 600, color: m.rep >= 80 ? 'var(--green)' : m.rep >= 60 ? 'var(--orange)' : 'var(--red)' }}>{m.rep}</span>
                    </div>
                  </td>
                  <td><span className={`badge ${m.status === 'verified' ? 'green' : 'yellow'}`}>{m.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
