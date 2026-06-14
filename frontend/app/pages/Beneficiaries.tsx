import React, { useState } from 'react';

const DATA = [
  { id: 'DP_001_FAMILY', name: 'Maria Rodriguez Family', disaster: 'EQ_2024_DR', location: 'Santo Domingo Centro', family: 4, trust: 87, status: 'verified', needs: ['medical', 'elderly_care'], registered: '2024-02-14' },
  { id: 'DP_002_SOLO',   name: 'Jean-Pierre Morel',       disaster: 'HC_2024_HT', location: 'Port-au-Prince Nord', family: 1, trust: 62, status: 'verified', needs: [],                  registered: '2024-03-01' },
  { id: 'DP_003_FAMILY', name: 'Amara Diallo Family',     disaster: 'DT_2024_ET', location: 'Mekelle, Tigray',     family: 6, trust: 45, status: 'pending',  needs: ['mobility'],         registered: '2024-03-10' },
  { id: 'DP_004_CHILD',  name: 'Fatima Al-Hassan',        disaster: 'FL_2024_BD', location: 'Dhaka South',         family: 3, trust: 91, status: 'verified', needs: [],                  registered: '2024-01-22' },
  { id: 'DP_005_ELDER',  name: 'Carlos Mendez',           disaster: 'EQ_2024_DR', location: 'San Cristobal',       family: 2, trust: 73, status: 'verified', needs: ['elderly_care'],     registered: '2024-02-19' },
];

export default function Beneficiaries() {
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<typeof DATA[0] | null>(null);
  const verified = DATA.filter(b => b.status === 'verified').length;
  const avgTrust = Math.round(DATA.reduce((s, b) => s + b.trust, 0) / DATA.length);

  return (
    <>
      <div className="stats-grid">
        <div className="stat-card blue">
          <div className="stat-label">Registered</div>
          <div className="stat-value blue">{DATA.length}</div>
          <div className="stat-sub">Total beneficiaries</div>
        </div>
        <div className="stat-card green">
          <div className="stat-label">Verified</div>
          <div className="stat-value green">{verified}</div>
          <div className="stat-sub">{Math.round(verified/DATA.length*100)}% verification rate</div>
        </div>
        <div className="stat-card orange">
          <div className="stat-label">Pending</div>
          <div className="stat-value orange">{DATA.length - verified}</div>
          <div className="stat-sub">Awaiting review</div>
        </div>
        <div className="stat-card blue">
          <div className="stat-label">Avg Trust Score</div>
          <div className="stat-value blue">{avgTrust}</div>
          <div className="stat-sub">Out of 100</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div><h2>Beneficiary Registry</h2><p>Biometric-free multi-factor identity verification</p></div>
          <div className="btn-row" style={{ margin: 0 }}>
            <button className="btn btn-primary" onClick={() => setShowForm(v => !v)}>+ Register</button>
            <button className="btn btn-success">Verify Identity</button>
            <button className="btn btn-ghost">USSD Demo</button>
          </div>
        </div>

        {showForm && (
          <div className="panel">
            <h3>Register New Beneficiary</h3>
            <div className="grid2" style={{ gap: '0.75rem', marginBottom: '0.75rem' }}>
              {['Beneficiary ID', 'Full Name', 'Disaster ID', 'Location', 'Stellar Wallet Address', 'Family Size'].map(p => (
                <input key={p} className="input" placeholder={p} />
              ))}
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
                Verification Factors
              </div>
              <div className="grid3" style={{ gap: '0.75rem' }}>
                <input className="input" placeholder="Possession (phone, ID card…)" />
                <input className="input" placeholder="Behavioral (signature pattern…)" />
                <input className="input" placeholder="Social (community vouch…)" />
              </div>
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
              <tr><th>Beneficiary</th><th>Disaster</th><th>Location</th><th>Family</th><th>Trust Score</th><th>Special Needs</th><th>Registered</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {DATA.map(b => (
                <tr key={b.id}>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: '0.825rem' }}>{b.name}</div>
                    <code>{b.id}</code>
                  </td>
                  <td><code>{b.disaster}</code></td>
                  <td style={{ color: 'var(--text2)', fontSize: '0.8rem' }}>{b.location}</td>
                  <td style={{ textAlign: 'center' }}>{b.family}</td>
                  <td style={{ minWidth: 120 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="progress" style={{ flex: 1 }}>
                        <div className="progress-bar" style={{
                          width: `${b.trust}%`,
                          background: b.trust >= 80 ? 'var(--green)' : b.trust >= 60 ? 'var(--orange)' : 'var(--red)'
                        }} />
                      </div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text2)', minWidth: 24 }}>{b.trust}</span>
                    </div>
                  </td>
                  <td>
                    {b.needs.length > 0
                      ? b.needs.map(n => <span key={n} className="badge gray" style={{ marginRight: 4, fontSize: '0.65rem' }}>{n}</span>)
                      : <span style={{ color: 'var(--text3)', fontSize: '0.75rem' }}>—</span>}
                  </td>
                  <td style={{ color: 'var(--text2)', fontSize: '0.8rem' }}>{b.registered}</td>
                  <td><span className={`badge ${b.status === 'verified' ? 'green' : 'yellow'}`}>{b.status}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => setSelected(b)}>View</button>
                      <button className="btn btn-ghost btn-sm">QR</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{selected.name}</h2>
            <div className="modal-sub">{selected.id} · {selected.disaster}</div>
            <div className="modal-section">
              <h3>Identity Details</h3>
              <div className="modal-row"><span>Location</span><span>{selected.location}</span></div>
              <div className="modal-row"><span>Family Size</span><span>{selected.family} members</span></div>
              <div className="modal-row"><span>Registered</span><span>{selected.registered}</span></div>
              <div className="modal-row"><span>Trust Score</span>
                <span style={{ color: selected.trust >= 80 ? 'var(--green)' : selected.trust >= 60 ? 'var(--orange)' : 'var(--red)', fontWeight: 700 }}>
                  {selected.trust}/100
                </span>
              </div>
            </div>
            {selected.needs.length > 0 && (
              <div className="modal-section">
                <h3>Special Needs</h3>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {selected.needs.map(n => <span key={n} className="badge blue">{n}</span>)}
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button className="btn btn-success btn-sm">Verify</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
