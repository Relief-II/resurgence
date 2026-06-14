import React from 'react';

const SHIPMENTS = [
  { id: 'SHIP_001', type: 'Medicine',            qty: '50,000 units', origin: 'Geneva, CH',  dest: 'Santo Domingo, DR',  status: 'in_transit', temp: '4°C ✓', eta: '2024-06-20', org: 'WHO',   critical: true  },
  { id: 'SHIP_002', type: 'Food Aid',             qty: '120 tonnes',   origin: 'Nairobi, KE', dest: 'Mekelle, ET',        status: 'delivered',  temp: 'N/A',   eta: '2024-05-15', org: 'WFP',   critical: false },
  { id: 'SHIP_003', type: 'Shelter Kits',         qty: '2,000 kits',   origin: 'Dubai, AE',   dest: 'Port-au-Prince, HT', status: 'dispatched', temp: 'N/A',   eta: '2024-06-25', org: 'UNHCR', critical: false },
  { id: 'SHIP_004', type: 'Water Purification',   qty: '500 units',    origin: 'London, UK',  dest: 'Dhaka, BD',          status: 'customs',    temp: 'N/A',   eta: '2024-06-18', org: 'UNICEF',critical: false },
];

const STATUS: Record<string, string> = { in_transit: 'blue', delivered: 'green', dispatched: 'yellow', customs: 'yellow' };

const TIMELINE = [
  { date: '2024-06-10', label: 'Dispatched from WHO Geneva warehouse', done: true },
  { date: '2024-06-12', label: 'Departed Geneva Airport (GVA)', done: true },
  { date: '2024-06-14', label: 'Arrived Miami Hub — customs clearance', done: true },
  { date: '2024-06-16', label: 'Cleared customs, loaded on truck', done: true },
  { date: '2024-06-20', label: 'Estimated delivery — Santo Domingo Relief Hub', done: false },
];

export default function SupplyChain() {
  return (
    <>
      <div className="stats-grid">
        <div className="stat-card blue"><div className="stat-label">Active Shipments</div><div className="stat-value blue">3</div><div className="stat-sub">Across 4 countries</div></div>
        <div className="stat-card green"><div className="stat-label">Delivered</div><div className="stat-value green">1</div><div className="stat-sub">On time</div></div>
        <div className="stat-card orange"><div className="stat-label">In Customs</div><div className="stat-value orange">1</div><div className="stat-sub">Processing</div></div>
        <div className="stat-card red"><div className="stat-label">Temp Alerts</div><div className="stat-value red">0</div><div className="stat-sub">All within range</div></div>
      </div>

      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div><h2>Shipments</h2><p>Real-time tracking with GPS checkpoints and temperature monitoring</p></div>
          <button className="btn btn-primary">+ New Shipment</button>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Shipment</th><th>Type</th><th>Quantity</th><th>Route</th><th>Org</th><th>Temperature</th><th>ETA</th><th>Status</th></tr>
            </thead>
            <tbody>
              {SHIPMENTS.map(s => (
                <tr key={s.id}>
                  <td>
                    <code>{s.id}</code>
                    {s.critical && <span className="badge red" style={{ marginLeft: 6, fontSize: '0.62rem' }}>CRITICAL</span>}
                  </td>
                  <td style={{ fontWeight: 500 }}>{s.type}</td>
                  <td style={{ color: 'var(--text2)', fontSize: '0.8rem' }}>{s.qty}</td>
                  <td style={{ fontSize: '0.8rem' }}>
                    <span style={{ color: 'var(--text2)' }}>{s.origin}</span>
                    <span style={{ color: 'var(--text3)', margin: '0 6px' }}>→</span>
                    <span>{s.dest}</span>
                  </td>
                  <td><span className="badge gray">{s.org}</span></td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: s.temp !== 'N/A' ? 'var(--accent)' : 'var(--text2)' }}>{s.temp}</td>
                  <td style={{ color: 'var(--text2)', fontSize: '0.8rem' }}>{s.eta}</td>
                  <td><span className={`badge ${STATUS[s.status]}`}>{s.status.replace(/_/g, ' ')}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h2>SHIP_001 — Live Tracking</h2><p>WHO Medical Supplies · Geneva → Santo Domingo</p></div>
        <div className="timeline">
          {TIMELINE.map((step, i) => (
            <div key={i} className="timeline-item">
              <div className={`timeline-dot ${step.done ? 'done' : 'pending'}`} />
              <div className="timeline-content">
                <div className="tdate">{step.date}</div>
                <div className={`tlabel ${!step.done ? 'pending' : ''}`}>{step.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
