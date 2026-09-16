import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

type Activity = {
    id: string;
    staff_id: string;
    staff_name: string | null;
    event_type: string;
    application_id: string | null;
    metadata: { path?: string; method?: string; ip?: string | null } | null;
    created_at: string;
};

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
            const response = await fetch(`${API_URL}/staff-activity?hours=${hours}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (response.ok) setRows(await response.json());
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { void load(); }, [hours]);
    useEffect(() => {
        const timer = window.setInterval(() => { void load(); }, 60_000);
        return () => window.clearInterval(timer);
    }, [hours]);

    if (user?.role !== 'admin') return <div style={{ padding: 32 }}>Admin access required.</div>;

    const filteredRows = ipFilter ? rows.filter(row => (row.metadata?.ip || 'unknown') === ipFilter) : rows;
    const lastByStaff = new Map<string, Activity>();
    for (const row of filteredRows) {
        if (!lastByStaff.has(row.staff_id)) lastByStaff.set(row.staff_id, row);
    }
    const ips = [...new Set(rows.map(row => row.metadata?.ip).filter((ip): ip is string => Boolean(ip)))];
    const ipColors = new Map<string, string>();
    ips.forEach((ip, index) => {
        const hue = Math.round((index * 137.508) % 360);
        ipColors.set(ip, `hsl(${hue} 70% 90%)`);
    });

    return (
        <div style={{ padding: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
                <div>
                    <h1 style={{ margin: 0 }}>Staff Activity</h1>
                    <p style={{ margin: '8px 0 0', opacity: 0.7 }}>Authenticated app activity, lead views, status changes, comments and login IP addresses.</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <select value={hours} onChange={e => setHours(Number(e.target.value))}>
                        <option value={8}>Last 8 hours</option>
                        <option value={24}>Last 24 hours</option>
                        <option value={72}>Last 3 days</option>
                        <option value={168}>Last 7 days</option>
                    </select>
                    <select value={ipFilter} onChange={e => setIpFilter(e.target.value)}>
                        <option value="">All IP addresses</option>
                        {ips.map(ip => <option key={ip} value={ip}>{ip}</option>)}
                    </select>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16, marginBottom: 24 }}>
                {[...lastByStaff.values()].map(last => (
                    <div key={last.staff_id} style={{ border: '1px solid #ddd', borderRadius: 12, padding: 16 }}>
                        <strong>{last.staff_name || 'Unknown'}</strong>
                        <div style={{ marginTop: 8 }}>{last.event_type}</div>
                        <small>{new Date(last.created_at).toLocaleString()}</small>
                        {last.metadata?.ip && <div style={{ marginTop: 6, fontFamily: 'monospace' }}>IP: {last.metadata.ip}</div>}
                    </div>
                ))}
            </div>

            {loading ? <div>Loading activity…</div> : (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead><tr><th align="left">Time</th><th align="left">Staff</th><th align="left">Activity</th><th align="left">IP Address</th><th align="left">Lead</th><th align="left">Page</th></tr></thead>
                        <tbody>
                            {filteredRows.map(row => {
                                const ip = row.metadata?.ip || 'Not recorded';
                                return (
                                    <tr key={row.id} style={{ background: row.metadata?.ip ? ipColors.get(row.metadata.ip) : undefined }}>
                                        <td style={{ padding: '10px 8px', borderTop: '1px solid #eee' }}>{new Date(row.created_at).toLocaleString()}</td>
                                        <td style={{ padding: '10px 8px', borderTop: '1px solid #eee' }}>{row.staff_name || 'Unknown'}</td>
                                        <td style={{ padding: '10px 8px', borderTop: '1px solid #eee' }}>{row.event_type}</td>
                                        <td style={{ padding: '10px 8px', borderTop: '1px solid #eee', fontFamily: 'monospace', fontWeight: row.metadata?.ip ? 600 : 400 }}>{ip}</td>
                                        <td style={{ padding: '10px 8px', borderTop: '1px solid #eee', fontFamily: 'monospace' }}>{row.application_id || '—'}</td>
                                        <td style={{ padding: '10px 8px', borderTop: '1px solid #eee' }}>{row.metadata?.path || '—'}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {!filteredRows.length && <div style={{ padding: 24, opacity: 0.7 }}>No activity recorded in this period.</div>}
                </div>
            )}
        </div>
    );
}
