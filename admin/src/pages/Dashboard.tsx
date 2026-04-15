import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import api from "../services/api";

interface PaymentStats {
    total_payments: number;
    matched_payments: number;
    unmatched_payments: number;
    total_amount: number;
    matched_amount?: number;
}

interface PaymentRecord {
    id: string;
    source: string;
    amount: number;
    sender_name: string | null;
    memo: string | null;
    received_at: string;
    matched: boolean;
    driver_id: string | null;
}

interface ApplicationRecord {
    id: string;
    status: string;
    driver_id?: string | null;
    form_data: Record<string, unknown>;
    created_at: string;
}

interface ApplicationsPagePayload {
    items: ApplicationRecord[];
    counts: Record<string, number>;
}

interface DriverRecord {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    balance: number;
    billing_type?: string;
    billing_status?: string;
    billing_active?: boolean;
    weekly_due_day?: string | null;
}

interface DriversPagePayload {
    items: DriverRecord[];
    total: number;
    active_count: number;
    balance_total: number;
}

interface SystemStatusItem {
    status: "ok" | "warning" | "error";
    message: string;
}

interface SystemStatus {
    database: SystemStatusItem;
    gmail: SystemStatusItem;
    openphone: SystemStatusItem;
}

const DEFAULT_COUNTS: Record<string, number> = {
    all: 0,
    pending: 0,
    approved: 0,
    declined: 0,
    hold: 0,
    onboarding: 0,
};

const sourceBadgeStyles: Record<string, { bg: string; color: string }> = {
    zelle: { bg: "#EAF1FF", color: "#315FB9" },
    cashapp: { bg: "#E5F7E9", color: "#1C8F49" },
    venmo: { bg: "#E7F1FF", color: "#1D5CB6" },
    chime: { bg: "#E6FBF7", color: "#1A8D7D" },
    stripe: { bg: "#F0EBFF", color: "#6A4ACF" },
};

function asNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value: number): string {
    return `$${value.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

function displayStatus(status?: string, active?: boolean): "active" | "paused" | "terminated" {
    const normalized = (status || "").toLowerCase();
    if (normalized === "active" || normalized === "paused" || normalized === "terminated") {
        return normalized;
    }
    return active === false ? "paused" : "active";
}

function applicationName(application: ApplicationRecord): string {
    const form = application.form_data || {};
    const first = typeof form.first_name === "string" ? form.first_name : "";
    const last = typeof form.last_name === "string" ? form.last_name : "";
    const direct = `${first} ${last}`.trim();
    if (direct) return direct;

    for (const [key, value] of Object.entries(form)) {
        if (!key.toLowerCase().includes("name") || typeof value !== "object" || value === null) continue;
        const nested = value as Record<string, unknown>;
        const nestedFirst =
            (typeof nested.first_name === "string" && nested.first_name) ||
            (typeof nested.First_Name === "string" && nested.First_Name) ||
            (typeof nested.first === "string" && nested.first) ||
            "";
        const nestedLast =
            (typeof nested.last_name === "string" && nested.last_name) ||
            (typeof nested.Last_Name === "string" && nested.Last_Name) ||
            (typeof nested.last === "string" && nested.last) ||
            "";
        const nestedName = `${nestedFirst} ${nestedLast}`.trim();
        if (nestedName) return nestedName;
    }

    if (typeof form.email === "string" && form.email.trim()) {
        return form.email;
    }

    return "Unknown Applicant";
}

function SourceBadge({ source }: { source: string }) {
    const key = String(source || "").toLowerCase();
    const style = sourceBadgeStyles[key] || sourceBadgeStyles.zelle;

    return (
        <span
            style={{
                display: "inline-block",
                padding: "3px 9px",
                borderRadius: "999px",
                background: style.bg,
                color: style.color,
                fontSize: "0.72rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.02em",
            }}
        >
            {key || "payment"}
        </span>
    );
}

function HealthPill({ item }: { item: SystemStatusItem }) {
    const tone =
        item.status === "ok"
            ? { bg: "#E7F6ED", color: "#1C7A46" }
            : item.status === "warning"
                ? { bg: "#FEF5DF", color: "#9A6A00" }
                : { bg: "#FDEBEC", color: "#A5363E" };

    return (
        <span
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 10px",
                borderRadius: "999px",
                background: tone.bg,
                color: tone.color,
                fontSize: "0.72rem",
                fontWeight: 700,
                textTransform: "capitalize",
            }}
        >
            <span
                style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "999px",
                    background: tone.color,
                }}
            />
            {item.status}
        </span>
    );
}

function MetricCard({
    label,
    value,
    hint,
}: {
    label: string;
    value: string;
    hint?: string;
}) {
    return (
        <div
            style={{
                background: "linear-gradient(160deg, #ffffff 0%, #f8fafc 100%)",
                border: "1px solid #e5e9ef",
                borderRadius: "18px",
                padding: "14px 16px",
                boxShadow: "0 8px 24px rgba(20, 40, 60, 0.05)",
            }}
        >
            <div style={{ fontSize: "0.72rem", color: "#67758A", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {label}
            </div>
            <div style={{ fontFamily: "var(--font-heading)", fontSize: "1.5rem", color: "#1B2430", lineHeight: 1.1 }}>{value}</div>
            {hint && <div style={{ marginTop: "6px", fontSize: "0.78rem", color: "#6C7A8E" }}>{hint}</div>}
        </div>
    );
}

export default function Dashboard() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [paymentStats, setPaymentStats] = useState<PaymentStats | null>(null);
    const [weeklyPaymentStats, setWeeklyPaymentStats] = useState<PaymentStats | null>(null);
    const [payments, setPayments] = useState<PaymentRecord[]>([]);

    const [driversPage, setDriversPage] = useState<DriversPagePayload | null>(null);
    const [drivers, setDrivers] = useState<DriverRecord[]>([]);

    const [applicationsPage, setApplicationsPage] = useState<ApplicationsPagePayload | null>(null);
    const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        setLoading(true);
        setError("");

        try {
            const [
                paymentsOverall,
                paymentsWeekly,
                allPayments,
                driversSnapshot,
                allDrivers,
                pendingApplications,
                status,
            ] = await Promise.all([
                api.getPaymentStats(),
                api.getPaymentStats("weekly"),
                api.getAllPayments(0, 200),
                api.getDriversPage({ page: 1, pageSize: 50 }),
                api.getDrivers(),
                api.getApplicationsPage({
                    statusFilter: "pending",
                    page: 1,
                    pageSize: 8,
                    excludeLinkedDrivers: true,
                }),
                api.getSystemStatus(),
            ]);

            setPaymentStats(paymentsOverall as PaymentStats);
            setWeeklyPaymentStats(paymentsWeekly as PaymentStats);
            setPayments(Array.isArray(allPayments) ? (allPayments as PaymentRecord[]) : []);
            setDriversPage(driversSnapshot as DriversPagePayload);
            setDrivers(Array.isArray(allDrivers) ? (allDrivers as DriverRecord[]) : []);
            setApplicationsPage(pendingApplications as ApplicationsPagePayload);
            setSystemStatus(status as SystemStatus);
        } catch (loadError) {
            console.error("Failed to load dashboard data:", loadError);
            setError(loadError instanceof Error ? loadError.message : "Failed to load dashboard");
        } finally {
            setLoading(false);
        }
    }

    const chicagoWeekday = useMemo(() => {
        return new Intl.DateTimeFormat("en-US", {
            weekday: "long",
            timeZone: "America/Chicago",
        })
            .format(new Date())
            .toLowerCase();
    }, []);

    const driverTotals = useMemo(() => {
        const totals = {
            total: 0,
            active: 0,
            paused: 0,
            terminated: 0,
            daily: 0,
            weekly: 0,
            weeklyDueToday: 0,
        };

        for (const driver of drivers) {
            totals.total += 1;
            const status = displayStatus(driver.billing_status, driver.billing_active);
            if (status === "active") totals.active += 1;
            if (status === "paused") totals.paused += 1;
            if (status === "terminated") totals.terminated += 1;

            const billingType = (driver.billing_type || "daily").toLowerCase();
            if (billingType === "weekly") {
                totals.weekly += 1;
                if (status === "active" && (driver.weekly_due_day || "") === chicagoWeekday) {
                    totals.weeklyDueToday += 1;
                }
            } else {
                totals.daily += 1;
            }
        }

        return totals;
    }, [drivers, chicagoWeekday]);

    const counts = useMemo(() => {
        return { ...DEFAULT_COUNTS, ...(applicationsPage?.counts || {}) };
    }, [applicationsPage]);

    const recentPendingApplications = useMemo(() => {
        return Array.isArray(applicationsPage?.items) ? applicationsPage!.items.slice(0, 6) : [];
    }, [applicationsPage]);

    const unmatchedQueue = useMemo(() => {
        return payments
            .filter((payment) => !payment.matched)
            .sort((a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime())
            .slice(0, 7);
    }, [payments]);

    const unmatchedAmount = useMemo(() => {
        return unmatchedQueue.reduce((sum, payment) => sum + asNumber(payment.amount), 0);
    }, [unmatchedQueue]);

    const matchedRate = useMemo(() => {
        const total = asNumber(paymentStats?.total_payments);
        if (!total) return 0;
        return Math.round((asNumber(paymentStats?.matched_payments) / total) * 100);
    }, [paymentStats]);

    const lowestBalances = useMemo(() => {
        const sorted = [...(driversPage?.items || [])].sort((a, b) => asNumber(a.balance) - asNumber(b.balance));
        return sorted.slice(0, 6);
    }, [driversPage]);

    const snapshotTopGap = unmatchedAmount - asNumber(weeklyPaymentStats?.matched_amount || 0);

    if (loading) {
        return <div style={{ padding: "var(--space-4)", color: "var(--dark-gray)" }}>Loading dashboard...</div>;
    }

    if (error) {
        return <div style={{ padding: "var(--space-4)", color: "var(--error-red)" }}>{error}</div>;
    }

    return (
        <div style={{ padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <div
                style={{
                    position: "relative",
                    overflow: "hidden",
                    borderRadius: "24px",
                    border: "1px solid #d7deea",
                    background: "radial-gradient(circle at 90% 20%, #dce9ff 0%, #edf2fb 38%, #f8fbff 100%)",
                    boxShadow: "0 16px 44px rgba(28, 47, 73, 0.10)",
                    padding: "24px",
                }}
            >
                <div style={{ display: "flex", justifyContent: "space-between", gap: "20px", flexWrap: "wrap" }}>
                    <div>
                        <div style={{ fontFamily: "var(--font-heading)", fontSize: "2rem", lineHeight: 1, color: "#1C2430", marginBottom: "8px" }}>
                            Operations Command
                        </div>
                        <div style={{ color: "#5E6D84", fontSize: "0.95rem" }}>
                            Chicago billing day: <strong style={{ textTransform: "capitalize", color: "#2D415D" }}>{chicagoWeekday}</strong>
                        </div>
                    </div>
                    <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                        <MetricCard
                            label="Collected (All Time)"
                            value={formatCurrency(asNumber(paymentStats?.total_amount))}
                            hint={`${asNumber(paymentStats?.total_payments)} total payments`}
                        />
                        <MetricCard
                            label="Weekly Collected"
                            value={formatCurrency(asNumber(weeklyPaymentStats?.matched_amount || 0))}
                            hint="Current weekly window"
                        />
                        <MetricCard
                            label="Unmatched Queue"
                            value={formatCurrency(unmatchedAmount)}
                            hint={`${unmatchedQueue.length} newest pending items`}
                        />
                    </div>
                </div>
            </div>

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "12px",
                }}
            >
                <MetricCard
                    label="Drivers Active"
                    value={String(driverTotals.active)}
                    hint={`${driverTotals.paused} paused, ${driverTotals.terminated} terminated`}
                />
                <MetricCard
                    label="Weekly Due Today"
                    value={String(driverTotals.weeklyDueToday)}
                    hint={`${driverTotals.weekly} weekly / ${driverTotals.daily} daily`}
                />
                <MetricCard
                    label="Vetting Pending"
                    value={String(asNumber(counts.pending))}
                    hint={`${asNumber(counts.approved)} approved, ${asNumber(counts.declined)} declined`}
                />
                <MetricCard
                    label="Auto-Match Rate"
                    value={`${matchedRate}%`}
                    hint={`${asNumber(paymentStats?.matched_payments)} matched / ${asNumber(paymentStats?.unmatched_payments)} unmatched`}
                />
            </div>

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                    gap: "12px",
                }}
            >
                <div
                    style={{
                        background: "var(--white)",
                        border: "1px solid #e1e6ef",
                        borderRadius: "20px",
                        padding: "16px",
                        boxShadow: "0 8px 20px rgba(19, 34, 56, 0.05)",
                    }}
                >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                        <div style={{ fontFamily: "var(--font-heading)", color: "#1D2836", fontSize: "1.05rem" }}>Unmatched Queue</div>
                        <Link to="/payments" style={{ fontSize: "0.8rem", color: "var(--primary-blue)", textDecoration: "none", fontWeight: 600 }}>
                            Open Payments
                        </Link>
                    </div>

                    {unmatchedQueue.length === 0 ? (
                        <div style={{ padding: "12px 4px", color: "#6D7C92", fontSize: "0.9rem" }}>Queue is clear.</div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            {unmatchedQueue.map((payment) => (
                                <div
                                    key={payment.id}
                                    style={{
                                        display: "grid",
                                        gridTemplateColumns: "auto 1fr auto",
                                        gap: "10px",
                                        alignItems: "center",
                                        padding: "10px",
                                        borderRadius: "12px",
                                        background: "#F7F9FD",
                                        border: "1px solid #e8edf5",
                                    }}
                                >
                                    <SourceBadge source={payment.source} />
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ color: "#253142", fontWeight: 600, fontSize: "0.86rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                            {payment.sender_name || "Unknown Sender"}
                                        </div>
                                        <div style={{ color: "#6C7B91", fontSize: "0.78rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                            {payment.memo || "No memo"}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: "right" }}>
                                        <div style={{ color: "#B45309", fontWeight: 700, fontSize: "0.86rem" }}>{formatCurrency(asNumber(payment.amount))}</div>
                                        <div style={{ color: "#7A889D", fontSize: "0.72rem" }}>
                                            {new Date(payment.received_at).toLocaleDateString()}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div
                    style={{
                        background: "var(--white)",
                        border: "1px solid #e1e6ef",
                        borderRadius: "20px",
                        padding: "16px",
                        boxShadow: "0 8px 20px rgba(19, 34, 56, 0.05)",
                    }}
                >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                        <div style={{ fontFamily: "var(--font-heading)", color: "#1D2836", fontSize: "1.05rem" }}>Driver Exposure</div>
                        <Link to="/drivers" style={{ fontSize: "0.8rem", color: "var(--primary-blue)", textDecoration: "none", fontWeight: 600 }}>
                            Open Drivers
                        </Link>
                    </div>

                    {lowestBalances.length === 0 ? (
                        <div style={{ padding: "12px 4px", color: "#6D7C92", fontSize: "0.9rem" }}>No drivers found.</div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            {lowestBalances.map((driver) => {
                                const balance = asNumber(driver.balance);
                                return (
                                    <div
                                        key={driver.id}
                                        style={{
                                            display: "grid",
                                            gridTemplateColumns: "1fr auto",
                                            gap: "10px",
                                            alignItems: "center",
                                            padding: "10px",
                                            borderRadius: "12px",
                                            background: "#F7F9FD",
                                            border: "1px solid #e8edf5",
                                        }}
                                    >
                                        <Link
                                            to={`/drivers/${driver.id}`}
                                            style={{ color: "#253142", fontWeight: 600, textDecoration: "none", fontSize: "0.86rem" }}
                                        >
                                            {(driver.first_name || driver.last_name)
                                                ? `${driver.first_name || ""} ${driver.last_name || ""}`.trim()
                                                : driver.email}
                                        </Link>
                                        <span style={{ color: balance >= 0 ? "#1C8F49" : "#B3261E", fontWeight: 700, fontSize: "0.86rem" }}>
                                            {formatCurrency(balance)}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div
                    style={{
                        background: "var(--white)",
                        border: "1px solid #e1e6ef",
                        borderRadius: "20px",
                        padding: "16px",
                        boxShadow: "0 8px 20px rgba(19, 34, 56, 0.05)",
                    }}
                >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                        <div style={{ fontFamily: "var(--font-heading)", color: "#1D2836", fontSize: "1.05rem" }}>Vetting Funnel</div>
                        <Link to="/applications" style={{ fontSize: "0.8rem", color: "var(--primary-blue)", textDecoration: "none", fontWeight: 600 }}>
                            Open Vetting Hub
                        </Link>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: "8px", marginBottom: "10px" }}>
                        <MetricCard label="All" value={String(asNumber(counts.all))} />
                        <MetricCard label="Pending" value={String(asNumber(counts.pending))} />
                        <MetricCard label="Approved" value={String(asNumber(counts.approved))} />
                        <MetricCard label="Declined" value={String(asNumber(counts.declined))} />
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {recentPendingApplications.length === 0 ? (
                            <div style={{ color: "#6D7C92", fontSize: "0.9rem" }}>No pending applications.</div>
                        ) : (
                            recentPendingApplications.map((application) => (
                                <Link
                                    key={application.id}
                                    to={`/applications/${application.id}`}
                                    style={{
                                        display: "grid",
                                        gridTemplateColumns: "1fr auto",
                                        gap: "10px",
                                        alignItems: "center",
                                        padding: "10px",
                                        borderRadius: "12px",
                                        background: "#F7F9FD",
                                        border: "1px solid #e8edf5",
                                        color: "#253142",
                                        textDecoration: "none",
                                    }}
                                >
                                    <span style={{ fontSize: "0.84rem", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                        {applicationName(application)}
                                    </span>
                                    <span style={{ fontSize: "0.75rem", color: "#6C7B91" }}>{new Date(application.created_at).toLocaleDateString()}</span>
                                </Link>
                            ))
                        )}
                    </div>
                </div>
            </div>

            <div
                style={{
                    background: "var(--white)",
                    border: "1px solid #e1e6ef",
                    borderRadius: "20px",
                    padding: "16px",
                    boxShadow: "0 8px 20px rgba(19, 34, 56, 0.05)",
                }}
            >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", flexWrap: "wrap", gap: "10px" }}>
                    <div style={{ fontFamily: "var(--font-heading)", color: "#1D2836", fontSize: "1.05rem" }}>System Readiness</div>
                    <div style={{ fontSize: "0.82rem", color: "#6B7B92" }}>
                        Snapshot gap: {formatCurrency(snapshotTopGap)} (queue minus weekly matched)
                    </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px" }}>
                    {[
                        { label: "Database", item: systemStatus?.database },
                        { label: "Gmail Parser", item: systemStatus?.gmail },
                        { label: "OpenPhone", item: systemStatus?.openphone },
                    ].map(({ label, item }) => (
                        <div
                            key={label}
                            style={{
                                border: "1px solid #e4eaf3",
                                borderRadius: "14px",
                                padding: "12px",
                                background: "#FAFCFF",
                            }}
                        >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                                <div style={{ fontWeight: 700, fontSize: "0.86rem", color: "#2A3648" }}>{label}</div>
                                {item ? <HealthPill item={item} /> : <span style={{ fontSize: "0.75rem", color: "#7A889D" }}>N/A</span>}
                            </div>
                            <div style={{ fontSize: "0.78rem", color: "#627286", lineHeight: 1.4 }}>
                                {item?.message || "Status unavailable"}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
