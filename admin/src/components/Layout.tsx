import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Layout.css';

export default function Layout() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    function handleLogout() {
        logout();
        navigate('/login');
    }

    return (
        <div className="layout">
            <aside className="sidebar">
                <div className="sidebar-header"><h1>Gonzo Car</h1><span>Admin Panel</span></div>
                <nav className="sidebar-nav">
                    <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Dashboard</NavLink>
                    <div className="nav-divider" aria-hidden="true" />
                    <NavLink to="/drivers" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Drivers</NavLink>
                    <NavLink to="/payments" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Payments</NavLink>
                    <div className="nav-divider" aria-hidden="true" />
                    <NavLink to="/applications" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Vetting Hub</NavLink>
                    <NavLink to="/ticket-finder" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Ticket Finder</NavLink>
                    {user?.role === 'admin' && <NavLink to="/staff-activity" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Staff Activity</NavLink>}
                    <div className="nav-divider" aria-hidden="true" />
                    <NavLink to="/settings" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Settings</NavLink>
                </nav>
                <div className="sidebar-footer">
                    <div className="user-info">
                        <div className="user-avatar">{user?.name?.charAt(0) || 'A'}</div>
                        <div className="user-details"><span className="user-name">{user?.name}</span><span className="user-role">{user?.role}</span></div>
                    </div>
                    <button onClick={handleLogout} className="logout-button" aria-label="Log out">Log out</button>
                </div>
            </aside>
            <main className="main-content"><Outlet /></main>
        </div>
    );
}
