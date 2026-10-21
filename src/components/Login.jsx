import { useState } from "react";
import { login } from "../store";
import { Field } from "./ui";
import { Icon } from "./icons";

const ACCOUNTS = [
  { email: "vendor1@gmail.com", label: "Vendor" },
  { email: "warehousemanager@gmail.com", label: "Warehouse" },
  { email: "manager@gmail.com", label: "Manager" },
];

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = (e) => {
    e.preventDefault();
    const user = login(email, password);
    if (!user) return setError("Invalid email or password");
    onLogin(user);
  };

  return (
    <div className="login-wrap">
      <div className="login-card">
        <aside className="login-aside">
          <span className="brand-mark"><Icon.cone size={17} /></span>
          <h2>Every bicycle, every flavour, every degree.</h2>
          <p>Live sales, flavour demand and cold-chain tracking for the whole vending fleet.</p>
          <ul className="login-points">
            <li><span><Icon.pin size={14} /></span> Know which flavour sells in which area</li>
            <li><span><Icon.thermo size={14} /></span> Catch a warm ice box before the stock is lost</li>
            <li><span><Icon.trending size={14} /></span> Season and time-of-day demand, per vendor</li>
          </ul>
        </aside>

        <form className="login-form" onSubmit={submit}>
          <h1>Sign in</h1>
          <p className="muted small">Use one of the demo accounts below.</p>
          <Field label="Email">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus required />
          </Field>
          <Field label="Password">
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
          {error && <div className="error">{error}</div>}
          <button className="primary" type="submit">Sign in</button>
          <div className="hint">
            {ACCOUNTS.map((a) => (
              <div className="hint-row" key={a.email}>
                <span>{a.label} · {a.email}</span>
                <button type="button" onClick={() => { setEmail(a.email); setPassword("123456"); setError(""); }}>Use</button>
              </div>
            ))}
            <div className="hint-row muted"><span>Password for all · 123456</span></div>
          </div>
        </form>
      </div>
    </div>
  );
}
