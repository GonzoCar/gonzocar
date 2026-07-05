import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

interface SystemStatus {
    database: { status: string; message: string };
    openphone: { status: string; message: string };
    gmail: { status: string; message: string };
    payment_parser?: {
        status: string;
        message: string;
        tracking_started_at: string;
        expected_interval_minutes: number;
        grace_minutes: number;
        last_run_at: string | null;
        last_success_at: string | null;
        last_error: string | null;
        total_runs: number;
        failed_runs: number;
        total_missed_windows: number;
        currently_late: boolean;
        current_delay_minutes: number;
        miss_history: Array<{
            missed_at: string;
            recovered_at: string | null;
            missed_intervals: number;
            delay_minutes: number;
        }>;
    };
    billing_cron?: {
        status: string;
        message: string;
        tracking_started_at: string;
        expected_interval_minutes: number;
        grace_minutes: number;
        window_hours: number;
        health_score_24h: number;
        last_run_at: string | null;
        last_success_at: string | null;
        last_charge_window_run_at: string | null;
        last_error: string | null;
        total_runs: number;
        failed_runs_24h: number;
        missed_windows_24h: number;
        currently_late: boolean;
        current_delay_minutes: number;
        recent_runs: Array<{
            triggered_at: string | null;
            finished_at: string | null;
            success: boolean;
            result_status: string | null;
            within_charge_window: boolean | null;
            active_drivers: number | null;
            daily_debits: number | null;
            weekly_debits: number | null;
            late_drivers: number | null;
            sms_sent: number | null;
            sms_failed: number | null;
            error_message: string | null;
        }>;
    };
}

export default function Settings() {
    const { user } = useAuth();
    const [status, setStatus] = useState<SystemStatus | null>(null);
    const [initialLoading, setInitialLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [billingHistoryPage, setBillingHistoryPage] = useState(1);
    const [reminderMode, setReminderMode] = useState<"automatic" | "manual">("manual");
    const [savingReminderMode, setSavingReminderMode] = useState(false);
    const [reminderModeMessage, setReminderModeMessage] = useState("");

    useEffect(() => {
        loadStatus(false);
    }, []);

    async function loadStatus(asRefresh: boolean) {
        if (asRefresh) {
            setRefreshing(true);
        } else {
            setInitialLoading(true);
        }
        try {
            const data = await api.getSystemStatus();
            setStatus(data);
            if (data?.reminder_mode?.mode) {
                setReminderMode(data.reminder_mode.mode);
            }
        } catch (error) {
            console.error('Failed to load status:', error);
        } finally {
            if (asRefresh) {
                setRefreshing(false);
            } else {
                setInitialLoading(false);
            }
        }
    }

    const statusColors: Record<string, { bg: string; text: string }> = {
        ok: { bg: '#D4EDDA', text: '#155724' },
        warning: { bg: '#FFF3CD', text: '#856404' },
        error: { bg: '#F8D7DA', text: '#721C24' },
    };

    function getStatusBadge(s: { status: string; message: string } | undefined) {
        if (!s) {
            return (
                <span style={{
                    padding: '4px 8px',
                    background: '#E2E3E5',
                    color: '#383D41',
                    borderRadius: 'var(--radius-small)',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                }}>
                    Loading...
                </span>
            );
        }

        const statusStyle = statusColors[s.status] || statusColors.warning;
        return (
            <span style={{
                padding: '4px 8px',
                background: statusStyle.bg,
                color: statusStyle.text,
                borderRadius: 'var(--radius-small)',
                fontSize: '0.75rem',
                fontWeight: 500,
            }}>
                {s.message}
            </span>
        );
    }

    function formatDateTime(value: string | null | undefined): string {
        if (!value) return '—';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '—';
        return date.toLocaleString();
    }

    async function handleReminderModeSave() {
        setSavingReminderMode(true);
        setReminderModeMessage("");
        try {
            await api.updateReminderMode(reminderMode);
            setReminderModeMessage(`Reminder mode set to ${reminderMode}.`);
        } catch (error) {
            setReminderModeMessage("Unable to update reminder mode right now.");
        } finally {
            setSavingReminderMode(false);
        }
    }

    function getNextChargeWindowLabel(): string {
        const now = new Date();
        const chicagoHour = Number(new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/Chicago',
            hour: '2-digit',
            hour12: false,
        }).format(now));
        const isToday = chicagoHour < 17;
        const targetDate = isToday ? now : new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const dayLabel = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/Chicago',
            weekday: 'short',
            month: 'short',
            day: 'numeric',
        }).format(targetDate);
        return `${isToday ? 'Today' : 'Tomorrow'} · ${dayLabel} @ 5:00 PM CT`;
    }

    const parserHealth = status?.payment_parser;
    const billingHealth = status?.billing_cron;
    const billingHistoryRows = billingHealth?.recent_runs ?? [];
    const BILLING_HISTORY_PAGE_SIZE = 5;
    const billingHistoryTotalPages = Math.max(1, Math.ceil(billingHistoryRows.length / BILLING_HISTORY_PAGE_SIZE));
    const pagedBillingHistory = billingHistoryRows.slice(
        (billingHistoryPage - 1) * BILLING_HISTORY_PAGE_SIZE,
        billingHistoryPage * BILLING_HISTORY_PAGE_SIZE,
    );

    useEffect(() => {
        setBillingHistoryPage(1);
    }, [billingHistoryRows.length]);

    useEffect(() => {
        if (billingHistoryPage > billingHistoryTotalPages) {
            setBillingHistoryPage(billingHistoryTotalPages);
        }
    }, [billingHistoryPage, billingHistoryTotalPages]);

    return (
        <div style={{ padding: 'var(--space-4)' }}>
            {/* Header */}
            <div style={{ marginBottom: 'var(--space-4)' }}>
                <h1 style={{
                    fontFamily: 'var(--font-heading)',
                    fontSize: '1.75rem',
                    color: 'var(--dark-gray)',
                    marginBottom: 'var(--space-1)',
                }}>
                    Settings
                </h1>
                <p style={{ color: 'var(--dark-gray)', opacity: 0.7 }}>
                    System configuration and staff management
                </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                {/* Your Profile */}
                <div style={{
                    background: 'var(--white)',
                    borderRadius: 'var(--radius-standard)',
                    padding: 'var(--space-3)',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                }}>
                    <h3 style={{
                        fontFamily: 'var(--font-heading)',
                        fontSize: '1rem',
                        color: 'var(--dark-gray)',
                        marginBottom: 'var(--space-3)',
                    }}>
                        Your Profile
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                        <div>
                            <div style={{ color: 'var(--dark-gray)', opacity: 0.6, fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '4px' }}>
                                Name
                            </div>
                            <div style={{ color: 'var(--dark-gray)', fontSize: '1.1rem', fontWeight: 500 }}>{user?.name}</div>
                        </div>
                        <div>
                            <div style={{ color: 'var(--dark-gray)', opacity: 0.6, fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '4px' }}>
                                Email
                            </div>
                            <div style={{ color: 'var(--dark-gray)' }}>{user?.email}</div>
                        </div>
                        <div>
                            <div style={{ color: 'var(--dark-gray)', opacity: 0.6, fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '4px' }}>
                                Role
                            </div>
                            <span style={{
                                padding: '4px 8px',
                                background: user?.role === 'admin' ? '#D4EDDA' : '#FFF3CD',
                                color: user?.role === 'admin' ? '#155724' : '#856404',
                                borderRadius: 'var(--radius-small)',
                                fontSize: '0.75rem',
                                fontWeight: 500,
                                textTransform: 'capitalize',
                            }}>
                                {user?.role}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Reminder Automation */}
                <div style={{
                    background: 'var(--white)',
                    borderRadius: 'var(--radius-standard)',
                    padding: 'var(--space-3)',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                }}>
                    <h3 style={{
                        fontFamily: 'var(--font-heading)',
                        fontSize: '1rem',
                        color: 'var(--dark-gray)',
                        marginBottom: 'var(--space-2)',
                    }}>
                        Reminder Automation
                    </h3>
                    <p style={{ color: 'var(--dark-gray)', opacity: 0.7, marginBottom: 'var(--space-3)' }}>
                        Choose whether overdue reminders are sent automatically by the billing job or only when staff sends them manually.
                    </p>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: 'var(--space-2)' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--dark-gray)', opacity: 0.7, textTransform: 'uppercase' }}>Mode</span>
                        <select
                            value={reminderMode}
                            onChange={(e) => setReminderMode(e.target.value as "automatic" | "manual")}
                            style={{ padding: '8px 10px', borderRadius: 'var(--radius-small)', border: '1px solid var(--medium-gray)' }}
                        >
                            <option value="manual">Manual only</option>
                            <option value="automatic">Automatic</option>
                        </select>
                    </label>
                    <button
                        onClick={handleReminderModeSave}
                        disabled={savingReminderMode}
                        style={{
                            padding: '8px 12px',
                            background: 'var(--primary-blue)',
                            color: 'var(--white)',
                            border: 'none',
                            borderRadius: 'var(--radius-small)',
                            cursor: savingReminderMode ? 'not-allowed' : 'pointer',
                            opacity: savingReminderMode ? 0.8 : 1,
                        }}
                    >
                        {savingReminderMode ? 'Saving…' : 'Save Reminder Mode'}
                    </button>
                    {reminderModeMessage ? <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--dark-gray)' }}>{reminderModeMessage}</div> : null}
                </div>

                {/* System Status */}
                <div style={{
                    background: 'var(--white)',
                    borderRadius: 'var(--radius-standard)',
                    padding: 'var(--space-3)',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                        <h3 style={{
                            fontFamily: 'var(--font-heading)',
                            fontSize: '1rem',
                            color: 'var(--dark-gray)',
                        }}>
                            System Status
                        </h3>
                        <button
                            onClick={() => loadStatus(true)}
                            disabled={refreshing}
                            style={{
                                marginLeft: 'var(--space-2)',
                                background: refreshing ? 'var(--medium-gray)' : 'var(--light-gray)',
                                border: '1px solid var(--medium-gray)',
                                borderRadius: 'var(--radius-small)',
                                padding: '4px 8px',
                                color: refreshing ? 'var(--dark-gray)' : 'var(--primary-blue)',
                                cursor: refreshing ? 'not-allowed' : 'pointer',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                opacity: refreshing ? 0.8 : 1,
                            }}
                        >
                            {refreshing ? 'Refreshing...' : 'Refresh'}
                        </button>
                    </div>
                    {refreshing && (
                        <div style={{ marginBottom: 'var(--space-2)', fontSize: '0.75rem', color: 'var(--dark-gray)', opacity: 0.75 }}>
                            Updating all integration statuses...
                        </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: 'var(--dark-gray)' }}>Backend API</span>
                            <span style={{
                                padding: '4px 8px',
                                background: '#D4EDDA',
                                color: '#155724',
                                borderRadius: 'var(--radius-small)',
                                fontSize: '0.75rem',
                                fontWeight: 500,
                            }}>
                                Connected
                            </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: 'var(--dark-gray)' }}>Database</span>
                            {getStatusBadge(initialLoading ? undefined : status?.database)}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: 'var(--dark-gray)' }}>Gmail API</span>
                            {getStatusBadge(initialLoading ? undefined : status?.gmail)}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: 'var(--dark-gray)' }}>OpenPhone SMS</span>
                            {getStatusBadge(initialLoading ? undefined : status?.openphone)}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: 'var(--dark-gray)' }}>Payment Parser Cron</span>
                            {getStatusBadge(initialLoading ? undefined : parserHealth)}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: 'var(--dark-gray)' }}>Billing Charges Cron</span>
                            {getStatusBadge(initialLoading ? undefined : billingHealth)}
                        </div>
                    </div>
                </div>

                {/* Payment Parser Monitor */}
                <div style={{
                    gridColumn: 'span 2',
                    background: 'var(--white)',
                    borderRadius: 'var(--radius-standard)',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                    overflow: 'hidden',
                }}>
                    <div style={{ padding: 'var(--space-3)', borderBottom: '1px solid var(--light-gray)' }}>
                        <h3 style={{
                            fontFamily: 'var(--font-heading)',
                            fontSize: '1rem',
                            color: 'var(--dark-gray)',
                            marginBottom: '6px',
                        }}>
                            Payment Parser Miss History
                        </h3>
                        <div style={{ color: 'var(--dark-gray)', opacity: 0.75, fontSize: '0.875rem' }}>
                            Tracking cron gaps every {parserHealth?.expected_interval_minutes ?? 5} minutes
                        </div>
                    </div>

                    <div style={{ padding: 'var(--space-3)', borderBottom: '1px solid var(--light-gray)' }}>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                            gap: 'var(--space-2)',
                        }}>
                            <div style={{ border: '1px solid var(--light-gray)', borderRadius: 'var(--radius-small)', padding: 'var(--space-2)' }}>
                                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--dark-gray)', opacity: 0.65, marginBottom: '4px' }}>
                                    Last Run
                                </div>
                                <div style={{ color: 'var(--dark-gray)', fontWeight: 600, fontSize: '0.875rem' }}>
                                    {initialLoading ? 'Loading...' : formatDateTime(parserHealth?.last_run_at)}
                                </div>
                            </div>
                            <div style={{ border: '1px solid var(--light-gray)', borderRadius: 'var(--radius-small)', padding: 'var(--space-2)' }}>
                                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--dark-gray)', opacity: 0.65, marginBottom: '4px' }}>
                                    Missed Windows
                                </div>
                                <div style={{ color: 'var(--dark-gray)', fontWeight: 600, fontSize: '1rem' }}>
                                    {initialLoading ? '...' : parserHealth?.total_missed_windows ?? 0}
                                </div>
                            </div>
                            <div style={{ border: '1px solid var(--light-gray)', borderRadius: 'var(--radius-small)', padding: 'var(--space-2)' }}>
                                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--dark-gray)', opacity: 0.65, marginBottom: '4px' }}>
                                    Failed Runs
                                </div>
                                <div style={{ color: 'var(--dark-gray)', fontWeight: 600, fontSize: '1rem' }}>
                                    {initialLoading ? '...' : parserHealth?.failed_runs ?? 0}
                                </div>
                            </div>
                            <div style={{ border: '1px solid var(--light-gray)', borderRadius: 'var(--radius-small)', padding: 'var(--space-2)' }}>
                                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--dark-gray)', opacity: 0.65, marginBottom: '4px' }}>
                                    Tracking Since
                                </div>
                                <div style={{ color: 'var(--dark-gray)', fontWeight: 600, fontSize: '0.875rem' }}>
                                    {initialLoading ? 'Loading...' : formatDateTime(parserHealth?.tracking_started_at)}
                                </div>
                            </div>
                        </div>

                        {!initialLoading && parserHealth?.currently_late && (
                            <div style={{
                                marginTop: 'var(--space-2)',
                                padding: 'var(--space-2)',
                                borderRadius: 'var(--radius-small)',
                                border: '1px solid #f5c6cb',
                                background: '#f8d7da',
                                color: '#721c24',
                                fontSize: '0.875rem',
                                fontWeight: 600,
                            }}>
                                Parser is currently late by {parserHealth.current_delay_minutes} minutes.
                            </div>
                        )}
                    </div>

                    <div style={{ padding: 'var(--space-3)' }}>
                        {initialLoading ? (
                            <div style={{ color: 'var(--dark-gray)', opacity: 0.7 }}>Loading parser history...</div>
                        ) : !parserHealth || parserHealth.miss_history.length === 0 ? (
                            <div style={{ color: 'var(--dark-gray)', opacity: 0.7 }}>
                                No missed windows recorded since tracking started.
                            </div>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: 'var(--light-gray)' }}>
                                        <th style={{ padding: 'var(--space-2)', textAlign: 'left', color: 'var(--dark-gray)', fontSize: '0.75rem', fontWeight: 600 }}>Missed At</th>
                                        <th style={{ padding: 'var(--space-2)', textAlign: 'left', color: 'var(--dark-gray)', fontSize: '0.75rem', fontWeight: 600 }}>Recovered At</th>
                                        <th style={{ padding: 'var(--space-2)', textAlign: 'left', color: 'var(--dark-gray)', fontSize: '0.75rem', fontWeight: 600 }}>Delay</th>
                                        <th style={{ padding: 'var(--space-2)', textAlign: 'left', color: 'var(--dark-gray)', fontSize: '0.75rem', fontWeight: 600 }}>Missed Windows</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {parserHealth.miss_history.map((item, index) => (
                                        <tr key={`${item.missed_at}-${index}`} style={{ borderTop: '1px solid var(--light-gray)' }}>
                                            <td style={{ padding: 'var(--space-2)', color: 'var(--dark-gray)', fontSize: '0.875rem' }}>{formatDateTime(item.missed_at)}</td>
                                            <td style={{ padding: 'var(--space-2)', color: 'var(--dark-gray)', fontSize: '0.875rem' }}>
                                                {item.recovered_at ? formatDateTime(item.recovered_at) : 'Still delayed'}
                                            </td>
                                            <td style={{ padding: 'var(--space-2)', color: 'var(--dark-gray)', fontSize: '0.875rem' }}>{item.delay_minutes} min</td>
                                            <td style={{ padding: 'var(--space-2)', color: 'var(--dark-gray)', fontSize: '0.875rem', fontWeight: 600 }}>{item.missed_intervals}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* Billing Cron Monitor */}
                <div style={{
                    gridColumn: 'span 2',
                    background: 'var(--white)',
                    borderRadius: 'var(--radius-standard)',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                    overflow: 'hidden',
                }}>
                    <div style={{ padding: 'var(--space-3)', borderBottom: '1px solid var(--light-gray)' }}>
                        <h3 style={{
                            fontFamily: 'var(--font-heading)',
                            fontSize: '1rem',
                            color: 'var(--dark-gray)',
                            marginBottom: '6px',
                        }}>
                            Billing Cron Monitor
                        </h3>
                        <div style={{ color: 'var(--dark-gray)', opacity: 0.75, fontSize: '0.875rem' }}>
                            Hourly trigger, charges execute only in 5 PM Chicago window
                        </div>
                    </div>

                    <div style={{ padding: 'var(--space-3)', borderBottom: '1px solid var(--light-gray)' }}>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                            gap: 'var(--space-2)',
                        }}>
                            <div style={{ border: '1px solid var(--light-gray)', borderRadius: 'var(--radius-small)', padding: 'var(--space-2)' }}>
                                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--dark-gray)', opacity: 0.65, marginBottom: '4px' }}>
                                    Last Run
                                </div>
                                <div style={{ color: 'var(--dark-gray)', fontWeight: 600, fontSize: '0.875rem' }}>
                                    {initialLoading ? 'Loading...' : formatDateTime(billingHealth?.last_run_at)}
                                </div>
                            </div>
                            <div style={{ border: '1px solid var(--light-gray)', borderRadius: 'var(--radius-small)', padding: 'var(--space-2)' }}>
                                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--dark-gray)', opacity: 0.65, marginBottom: '4px' }}>
                                    Last Charge Window
                                </div>
                                <div style={{ color: 'var(--dark-gray)', fontWeight: 600, fontSize: '0.875rem' }}>
                                    {initialLoading ? 'Loading...' : formatDateTime(billingHealth?.last_charge_window_run_at)}
                                </div>
                            </div>
                            <div style={{ border: '1px solid var(--light-gray)', borderRadius: 'var(--radius-small)', padding: 'var(--space-2)' }}>
                                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--dark-gray)', opacity: 0.65, marginBottom: '4px' }}>
                                    Next Charge Window
                                </div>
                                <div style={{ color: 'var(--dark-gray)', fontWeight: 600, fontSize: '0.875rem' }}>
                                    {initialLoading ? 'Loading...' : getNextChargeWindowLabel()}
                                </div>
                            </div>
                            <div style={{ border: '1px solid var(--light-gray)', borderRadius: 'var(--radius-small)', padding: 'var(--space-2)' }}>
                                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--dark-gray)', opacity: 0.65, marginBottom: '4px' }}>
                                    24h Failed / Missed
                                </div>
                                <div style={{ color: 'var(--dark-gray)', fontWeight: 600, fontSize: '1rem' }}>
                                    {initialLoading ? '...' : `${billingHealth?.failed_runs_24h ?? 0} / ${billingHealth?.missed_windows_24h ?? 0}`}
                                </div>
                            </div>
                        </div>

                        {!initialLoading && billingHealth?.currently_late && (
                            <div style={{
                                marginTop: 'var(--space-2)',
                                padding: 'var(--space-2)',
                                borderRadius: 'var(--radius-small)',
                                border: '1px solid #f5c6cb',
                                background: '#f8d7da',
                                color: '#721c24',
                                fontSize: '0.875rem',
                                fontWeight: 600,
                            }}>
                                Billing cron is currently late by {billingHealth.current_delay_minutes} minutes.
                            </div>
                        )}
                    </div>

                    <div style={{ padding: 'var(--space-3)' }}>
                        {initialLoading ? (
                            <div style={{ color: 'var(--dark-gray)', opacity: 0.7 }}>Loading billing history...</div>
                        ) : !billingHealth || billingHistoryRows.length === 0 ? (
                            <div style={{ color: 'var(--dark-gray)', opacity: 0.7 }}>
                                No billing runs recorded yet.
                            </div>
                        ) : (
                            <>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ background: 'var(--light-gray)' }}>
                                            <th style={{ padding: 'var(--space-2)', textAlign: 'left', color: 'var(--dark-gray)', fontSize: '0.75rem', fontWeight: 600 }}>Triggered At</th>
                                            <th style={{ padding: 'var(--space-2)', textAlign: 'left', color: 'var(--dark-gray)', fontSize: '0.75rem', fontWeight: 600 }}>Result</th>
                                            <th style={{ padding: 'var(--space-2)', textAlign: 'left', color: 'var(--dark-gray)', fontSize: '0.75rem', fontWeight: 600 }}>Debits</th>
                                            <th style={{ padding: 'var(--space-2)', textAlign: 'left', color: 'var(--dark-gray)', fontSize: '0.75rem', fontWeight: 600 }}>SMS</th>
                                            <th style={{ padding: 'var(--space-2)', textAlign: 'left', color: 'var(--dark-gray)', fontSize: '0.75rem', fontWeight: 600 }}>Error</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pagedBillingHistory.map((item, index) => (
                                            <tr key={`${item.triggered_at || 'run'}-${index}`} style={{ borderTop: '1px solid var(--light-gray)' }}>
                                                <td style={{ padding: 'var(--space-2)', color: 'var(--dark-gray)', fontSize: '0.875rem' }}>
                                                    {formatDateTime(item.triggered_at)}
                                                </td>
                                                <td style={{ padding: 'var(--space-2)', color: 'var(--dark-gray)', fontSize: '0.875rem' }}>
                                                    {item.result_status || (item.success ? 'completed' : 'failed')}
                                                    {item.within_charge_window ? ' (charge window)' : ' (outside window)'}
                                                </td>
                                                <td style={{ padding: 'var(--space-2)', color: 'var(--dark-gray)', fontSize: '0.875rem' }}>
                                                    D:{item.daily_debits ?? 0} / W:{item.weekly_debits ?? 0}
                                                </td>
                                                <td style={{ padding: 'var(--space-2)', color: 'var(--dark-gray)', fontSize: '0.875rem' }}>
                                                    Sent {item.sms_sent ?? 0}, Failed {item.sms_failed ?? 0}
                                                </td>
                                                <td style={{ padding: 'var(--space-2)', color: 'var(--dark-gray)', fontSize: '0.875rem' }}>
                                                    {item.error_message || '—'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <div
                                    style={{
                                        marginTop: 'var(--space-2)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'flex-end',
                                        gap: 'var(--space-2)',
                                    }}
                                >
                                    <button
                                        onClick={() => setBillingHistoryPage((prev) => Math.max(1, prev - 1))}
                                        disabled={billingHistoryPage <= 1}
                                        style={{
                                            padding: '6px 10px',
                                            borderRadius: 'var(--radius-small)',
                                            border: '1px solid var(--medium-gray)',
                                            background: 'var(--white)',
                                            color: 'var(--dark-gray)',
                                            cursor: billingHistoryPage <= 1 ? 'not-allowed' : 'pointer',
                                            opacity: billingHistoryPage <= 1 ? 0.6 : 1,
                                        }}
                                    >
                                        Prev
                                    </button>
                                    <span style={{ color: 'var(--dark-gray)', fontSize: '0.8125rem' }}>
                                        Page {billingHistoryPage} / {billingHistoryTotalPages}
                                    </span>
                                    <button
                                        onClick={() => setBillingHistoryPage((prev) => Math.min(billingHistoryTotalPages, prev + 1))}
                                        disabled={billingHistoryPage >= billingHistoryTotalPages}
                                        style={{
                                            padding: '6px 10px',
                                            borderRadius: 'var(--radius-small)',
                                            border: '1px solid var(--medium-gray)',
                                            background: 'var(--white)',
                                            color: 'var(--dark-gray)',
                                            cursor: billingHistoryPage >= billingHistoryTotalPages ? 'not-allowed' : 'pointer',
                                            opacity: billingHistoryPage >= billingHistoryTotalPages ? 0.6 : 1,
                                        }}
                                    >
                                        Next
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Cron Jobs */}
                <div style={{
                    gridColumn: 'span 2',
                    background: 'var(--white)',
                    borderRadius: 'var(--radius-standard)',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                    overflow: 'hidden',
                }}>
                    <div style={{ padding: 'var(--space-3)', borderBottom: '1px solid var(--light-gray)' }}>
                        <h3 style={{
                            fontFamily: 'var(--font-heading)',
                            fontSize: '1rem',
                            color: 'var(--dark-gray)',
                        }}>
                            Cron Jobs
                        </h3>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'var(--light-gray)' }}>
                                <th style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'left', color: 'var(--dark-gray)', fontWeight: 600, fontSize: '0.75rem' }}>Job</th>
                                <th style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'left', color: 'var(--dark-gray)', fontWeight: 600, fontSize: '0.75rem' }}>Schedule</th>
                                <th style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'left', color: 'var(--dark-gray)', fontWeight: 600, fontSize: '0.75rem' }}>Description</th>
                                <th style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'left', color: 'var(--dark-gray)', fontWeight: 600, fontSize: '0.75rem' }}>Command</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr style={{ borderTop: '1px solid var(--light-gray)' }}>
                                <td style={{ padding: 'var(--space-2) var(--space-3)', fontWeight: 500, color: 'var(--dark-gray)' }}>Payment Parser</td>
                                <td style={{ padding: 'var(--space-2) var(--space-3)' }}>
                                    <code style={{ background: 'var(--light-gray)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', color: 'var(--dark-gray)' }}>*/5 * * * *</code>
                                </td>
                                <td style={{ padding: 'var(--space-2) var(--space-3)', color: 'var(--dark-gray)', fontSize: '0.875rem' }}>Parse payment emails from Gmail every 5 minutes</td>
                                <td style={{ padding: 'var(--space-2) var(--space-3)' }}>
                                    <code style={{ color: 'var(--primary-blue)', fontSize: '0.75rem' }}>python scripts/parse_payments.py</code>
                                </td>
                            </tr>
                            <tr style={{ borderTop: '1px solid var(--light-gray)' }}>
                                <td style={{ padding: 'var(--space-2) var(--space-3)', fontWeight: 500, color: 'var(--dark-gray)' }}>Billing Charges</td>
                                <td style={{ padding: 'var(--space-2) var(--space-3)' }}>
                                    <code style={{ background: 'var(--light-gray)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', color: 'var(--dark-gray)' }}>0 * * * *</code>
                                </td>
                                <td style={{ padding: 'var(--space-2) var(--space-3)', color: 'var(--dark-gray)', fontSize: '0.875rem' }}>Generate charges at 5:00 PM Chicago, check late payments, send SMS</td>
                                <td style={{ padding: 'var(--space-2) var(--space-3)' }}>
                                    <code style={{ color: 'var(--primary-blue)', fontSize: '0.75rem' }}>python scripts/midnight_billing.py</code>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
