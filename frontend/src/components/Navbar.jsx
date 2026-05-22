import { Link, useLocation } from "react-router-dom";
import { ConnectButton } from "@rainbow-me/rainbowkit";

export default function Navbar({ wallet }) {
  const { isConnected } = wallet;
  const { pathname }    = useLocation();

  return (
    <nav style={{
      borderBottom: "1px solid #1f2330",
      padding: "0 24px",
      height: "60px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      background: "#0a0b0f",
      position: "sticky",
      top: 0,
      zIndex: 100,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "32px" }}>
        <Link to="/" style={{ textDecoration: "none" }}>
          <span style={{ fontWeight: 700, fontSize: "1rem", fontFamily: "monospace" }}>
            <span style={{ color: "#00d4aa" }}>◈</span> FreelanceArc
          </span>
        </Link>

        {isConnected && (
          <div style={{ display: "flex", gap: "4px" }}>
            {[
              { path: "/dashboard", label: "Dashboard" },
              { path: "/create",    label: "Post Job"  },
              { path: "/invoices",  label: "Invoices"  },
            ].map(({ path, label }) => (
              <Link key={path} to={path} style={{
                padding: "6px 14px",
                borderRadius: "6px",
                fontSize: "0.875rem",
                textDecoration: "none",
                color: pathname === path ? "#00d4aa" : "#7a8099",
                background: pathname === path ? "rgba(0,212,170,0.1)" : "transparent",
                fontWeight: pathname === path ? 500 : 400,
              }}>
                {label}
              </Link>
            ))}
          </div>
        )}
      </div>

      <ConnectButton
        chainStatus="icon"
        showBalance={false}
        accountStatus="address"
      />
    </nav>
  );
}
