import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

type Activity = {
    id: string;
    staff_id: string;
    staff_name: string | null;
    event_type: string;
    application_id: string | null;
    metadata: { path?: string; method?: string; ip_address?: string } | null;
    ip_address: string | null;
    created_at: string;
};

function ipColor(ip: string | null) {
    if (!ip) return { background: '#f3f4f6', color: '#374151', border: '#d1d5db' };
    let hash = 0;
    for (let i = 0; i < ip.length; i++) hash = ((hash << 5) - hash + ip.charCodeAt(i)) | 0;
    const hue = Math.abs(hash) % 360;
    return {
        background: `hsl(${hue} 85% 94%)`,
        color: `hsl(${hue} 55% 28%)`,
        border: `hsl(${hue} 65% 75%)`,
    };
}

export default function StaffActivity() {
    const { user } = useAuth();
    const [rows, setRows] = useState<Activity[]>([]);
    const [hours, setHours] = useState(24);
    const [ipFilter, setIpFilter] = useState('');
    const [loading, setLoading] = useState(true);

    async function load() {
        const token = localStorage.getItem('token');
        if (!token) return;
        setLoading(true);
        try {
            const params = new URLSearchParams({ hours: String(hours) });
            if (ipFilter) params.set('ip', ipFilter);
            const response = await fetch(`${API_URL}/staff-activity?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (response.ok) setRows(await response.json());
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { void load(); }, [hours, ipFilter]);
    useEffect(() => {
        const timer = window.setInterval(() => { void load(); }, 60_000);
        return () => window.clearInterval(timer);
    }, [hours, ipFilter]);

    const knownIps = useMemo(() => Array.from(new Set(rows.map(row => row.ip_address).filter(Boolean) as string[])).sort(), [rows]);

    if (user?.role !== 'admin') return <div style={{ padding: 32 }}>Admin access required.</div>;

    const lastByStaff = new Map<string, Activity>();
    for (const row of rows) {
        if (!lastByStaff.has(row.staff_id)) lastByStaff.set(row.staff_id, row);
    }

    return (
        <div style={{ padding: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 16, flexWrap: 'wrap' }}>
                <div>
                    <h1 style={{ margin: 0 }}>Staff Activity</h1>
                    <p style={{ margin: '8px 0 0', opacity: 0.7 }}>Authenticated app activity, lead views, status changes, comments, session activity and client IPs.</p>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <select value={hours} onChange={e => setHours(Number(e.target.value))}>
                        <option value={8}>Last 8 hours</option>
                        <option value={24}>Last 24 hours</option>
                        <option value={72}>Last 3 days</option>
                        <option value={168}>Last 7 days</option>
                        <option value={720}>Last 30 days</option>
                        <option value={2160}>Last 90 days</option>
                        <option value={8760}>Last 365 days</option>
                    </select>
                    <select value={ipFilter} onChange={e => setIpFilter(e.target.value)}>
                        <option value="">All IP addresses</option>
                        {knownIps.map(ip => <option key={ip} value={ip}>{ip}</option>)}
                    </select>
                    {ipFilter && <button type="button" onClick={() => setIpFilter('')}>Clear IP</button>}
                </div>
            </div>

            {knownIps.length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
                    {knownIps.map(ip => {
                        const style = ipColor(ip);
                        return (
                            <button
                                key={ip}
                                type="button"
                                onClick={() => setIpFilter(ip)}
                                style={{ padding: '6px 10px', borderRadius: 999, border: `1px solid ${style.border}`, background: style.background, color: style.color, cursor: 'pointer', fontFamily: 'monospace' }}
                            >
                                {ip}
                            </button>
                        );
                    })}
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16, marginBottom: 24 }}>
                {[...lastByStaff.values()].map(last => {
                    const style = ipColor(last.ip_address);
                    return (
                        <div key={last.staff_id} style={{ border: '1px solid #ddd', borderRadius: 12, padding: 16 }}>
                            <strong>{last.staff_name || 'Unknown'}</strong>
                            <div style={{ marginTop: 8 }}>{last.event_type}</div>
                            <small>{new Date(last.created_at).toLocaleString()}</small>
                            <div style={{ marginTop: 10 }}>
                                <span style={{ padding: '4px 8px', borderRadius: 999, border: `1px solid ${style.border}`, background: style.background, color: style.color, fontFamily: 'monospace', fontSize: 12 }}>
                                    {last.ip_address || 'IP unavailable'}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {loading ? <div>Loading activity…</div> : (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead><tr><th align="left">Time</th><th align="left">Staff</th><th align="left">IP</th><th align="left">Activity</th><th align="left">Lead</th><th align="left">Page</th></tr></thead>
                        <tbody>
                            {rows.map(row => {
                                const style = ipColor(row.ip_address);
                                return (
                                    <tr key={row.id}>
                                        <td style={{ padding: '10px 8px', borderTop: '1px solid #eee' }}>{new Date(row.created_at).toLocaleString()}</td>
                                        <td style={{ padding: '10px 8px', borderTop: '1px solid #eee' }}>{row.staff_name || 'Unknown'}</td>
                                        <td style={{ padding: '10px 8px', borderTop: '1px solid #eee' }}>
                                            <button type="button" onClick={() => row.ip_address && setIpFilter(row.ip_address)} disabled={!row.ip_address} style={{ padding: '4px 8px', borderRadius: 999, border: `1px solid ${style.border}`, background: style.background, color: style.color, cursor: row.ip_address ? 'pointer' : 'default', fontFamily: 'monospace' }}>
                                                {row.ip_address || '—'}
                                            </button>
                                        </td>
                                        <td style={{ padding: '10px 8px', borderTop: '1px solid #eee' }}>{row.event_type}</td>
                                        <td style={{ padding: '10px 8px', borderTop: '1px solid #eee', fontFamily: 'monospace' }}>{row.application_id || '—'}</td>
                                        <td style={{ padding: '10px 8px', borderTop: '1px solid #eee' }}>{row.metadata?.path || '—'}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {!rows.length && <div style={{ padding: 24, opacity: 0.7 }}>No activity recorded for this period/filter.</div>}
                </div>
            )}
        </div>
    );
}
