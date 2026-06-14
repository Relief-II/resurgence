import React, { useState } from 'react';
import EmergencyFunds from './pages/EmergencyFunds';
import Beneficiaries from './pages/Beneficiaries';
import Merchants from './pages/Merchants';
import Transfers from './pages/Transfers';
import SupplyChain from './pages/SupplyChain';
import AntiFraud from './pages/AntiFraud';
import './index.css';

const TABS = [
  { id: 'funds',         icon: '⬡', label: 'Emergency Funds',  group: 'Operations' },
  { id: 'beneficiaries', icon: '◈', label: 'Beneficiaries',    group: 'Operations' },
  { id: 'transfers',     icon: '⇄', label: 'Cash Transfers',   group: 'Operations' },
  { id: 'merchants',     icon: '⊞', label: 'Merchant Network', group: 'Network' },
  { id: 'supply',        icon: '⬡', label: 'Supply Chain',     group: 'Network' },
  { id: 'fraud',         icon: '⊛', label: 'Anti-Fraud',       group: 'Security' },
];

const PAGE_META: Record<string, { title: string; sub: string }> = {
  funds:         { title: 'Emergency Funds', sub: 'Deploy and monitor emergency relief funds' },
  beneficiaries: { title: 'Beneficiaries', sub: 'Biometric-free identity management' },
  transfers:     { title: 'Cash Transfers', sub: 'Conditional transfers with spending rules' },
  merchants:     { title: 'Merchant Network', sub: 'GPS-verified merchant onboarding' },
  supply:        { title: 'Supply Chain', sub: 'Shipment tracking & temperature monitoring' },
  fraud:         { title: 'Anti-Fraud', sub: 'Pattern detection & alert management' },
};

export default function App() {
  const [tab, setTab] = useState('funds');
  const groups = [...new Set(TABS.map(t => t.group))];
  const meta = PAGE_META[tab];

  return (
    <div className="layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-mark">⚡</div>
          <h1>Resurgence</h1>
          <p>Stellar Disaster Relief</p>
        </div>

        <nav className="sidebar-nav">
          {groups.map(group => (
            <div key={group}>
              <div className="nav-section-label">{group}</div>
              {TABS.filter(t => t.group === group).map(t => (
                <button
                  key={t.id}
                  className={`nav-item ${tab === t.id ? 'active' : ''}`}
                  onClick={() => setTab(t.id)}
                >
                  <span className="nav-icon">{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="status-pill">
            <span className="status-dot" />
            Stellar Testnet
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="main">
        <header className="topbar">
          <div>
            <div className="topbar-title">{meta.title}</div>
            <div className="topbar-sub">{meta.sub}</div>
          </div>
          <div className="topbar-right">
            <span className="network-badge">TESTNET</span>
            <div className="avatar">AD</div>
          </div>
        </header>

        <div className="page">
          {tab === 'funds'         && <EmergencyFunds />}
          {tab === 'beneficiaries' && <Beneficiaries />}
          {tab === 'transfers'     && <Transfers />}
          {tab === 'merchants'     && <Merchants />}
          {tab === 'supply'        && <SupplyChain />}
          {tab === 'fraud'         && <AntiFraud />}
        </div>
      </div>
    </div>
  );
}
