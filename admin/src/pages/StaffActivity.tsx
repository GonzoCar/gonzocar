import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

type Activity = {
    id: string;
    staff_id: string;
    staff_name: string | null;
    event_type: string;
    application_id: string | null;
    metadata: { path?: string; method?: string } | null;
    created_at: string;
};

export default function StaffActivity() {
    const { user } = useAuth();
    const [rows, setRows] = useState<Activity[]>([]);
    const [hours, setHours] = useState(24);
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

    const lastByStaff = new Map<string, Activity>();
    for (const row of rows) {
        if (!lastByStaff.has(row.staff_id)) lastByStaff.set(row.staff_id, row);
    }

    return (
        <div style={{ padding: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                    <h1 style={{ margin: 0 }}>Staff Activity</h1>
                    <p style={{ margin: '8px 0 0', opacity: 0.7 }}>Authenticated app activity, lead views, status changes and comments.</p>
                </div>
                <select value={hours} onChange={e => setHours(Number(e.target.value))}>
                    <option value={8}>Last 8 hours</option>
                    <option value={24}>Last 24 hours</option>
                    <option value={72}>Last 3 days</option>
                    <option value={168}>Last 7 days</option>
                </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16, marginBottom: 24 }}>
                {[...lastByStaff.values()].map(last => (
                    <div key={last.staff_id} style={{ border: '1px solid #ddd', borderRadius: 12, padding: 16 }}>
                        <strong>{last.staff_name || 'Unknown'}</strong>
                        <div style={{ marginTop: 8 }}>{last.event_type}</div>
                        <small>{new Date(last.created_at).toLocaleString()}</small>
                    </div>
                ))}
            </div>

            {loading ? <div>Loading activity…</div> : (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead><tr><th align="left">Time</th><th align="left">Staff</th><th align="left">Activity</th><th align="left">Lead</th><th align="left">Page</th></tr></thead>
                        <tbody>
                            {rows.map(row => (
                                <tr key={row.id}>
                                    <td style={{ padding: '10px 8px', borderTop: '1px solid #eee' }}>{new Date(row.created_at).toLocaleString()}</td>
                                    <td style={{ padding: '10px 8px', borderTop: '1px solid #eee' }}>{row.staff_name || 'Unknown'}</td>
                                    <td style={{ padding: '10px 8px', borderTop: '1px solid #eee' }}>{row.event_type}</td>
                                    <td style={{ padding: '10px 8px', borderTop: '1px solid #eee', fontFamily: 'monospace' }}>{row.application_id || '—'}</td>
                                    <td style={{ padding: '10px 8px', borderTop: '1px solid #eee' }}>{row.metadata?.path || '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {!rows.length && <div style={{ padding: 24, opacity: 0.7 }}>No activity recorded in this period.</div>}
                </div>
            )}
        </div>
    );
}
