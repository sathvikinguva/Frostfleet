import { useState } from "react";
import { currentUser, logout, resetAll, ROLES, useDb } from "./store";
import { Icon } from "./components/icons";
import Login from "./components/Login";
import VendorDashboard from "./pages/VendorDashboard";
import WarehouseDashboard from "./pages/WarehouseDashboard";
import ManagerDashboard from "./pages/ManagerDashboard";

const ROLE_LABEL = { vendor: "Vendor", warehouse: "Warehouse Manager", manager: "Manager" };

const initials = (name) =>
  name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

export default function App() {
  const db = useDb();
  const [user, setUser] = useState(() => currentUser());
  // If the warehouse manager removed this vendor, drop them out.
  const live = user && db.users.find((u) => u.id === user.id);
  if (user && !live) {
    logout();
    setUser(null);
  }
  if (!live) return <Login onLogin={setUser} />;

  const signOut = () => { logout(); setUser(null); };
  const reset = () => {
    if (confirm("Clear ALL data (vendors, flavors, sales, temperature logs)? Login accounts are kept.")) {
      resetAll();
      signOut();
    }
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark"><Icon.cone size={17} /></span>
          Frostfleet
          <span className="role-chip">{ROLE_LABEL[live.role]}</span>
        </div>
        <div className="who">
          <span className="who-name">
            <span className="avatar">{initials(live.name)}</span>
            <span>{live.name}</span>
          </span>
          {live.role !== ROLES.VENDOR && <button className="danger" onClick={reset}>Reset data</button>}
          <button className="icon-btn" onClick={signOut}><Icon.logout size={15} /> Sign out</button>
        </div>
      </header>
      <main>
        {live.role === ROLES.VENDOR && <VendorDashboard user={live} />}
        {live.role === ROLES.WAREHOUSE && <WarehouseDashboard />}
        {live.role === ROLES.MANAGER && <ManagerDashboard />}
      </main>
    </div>
  );
}
