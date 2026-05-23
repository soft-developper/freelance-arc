import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useWallet } from "./hooks/useWallet";
import Navbar from "./components/Navbar";
import Dashboard from "./pages/Dashboard";
import CreateJob from "./pages/CreateJob";
import JobDetail from "./pages/JobDetail";
import Invoices from "./pages/Invoices";
import Landing from "./pages/Landing";
import Admin from "./pages/Admin";

// Deployer address — only this wallet can access admin
const ADMIN_ADDRESS = "0xfAB99Fe25EDB59317A06db5B831b6B8fE0a7E879";

export default function App() {
  const wallet = useWallet();
  const isAdmin = wallet.address?.toLowerCase() === ADMIN_ADDRESS.toLowerCase();

  return (
    <BrowserRouter>
      <div className="app">
        <Navbar wallet={wallet} isAdmin={isAdmin} />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Landing wallet={wallet} />} />
            <Route
              path="/dashboard"
              element={wallet.isConnected ? <Dashboard wallet={wallet} /> : <Navigate to="/" replace />}
            />
            <Route
              path="/create"
              element={wallet.isConnected ? <CreateJob wallet={wallet} /> : <Navigate to="/" replace />}
            />
            <Route
              path="/job/:jobId"
              element={wallet.isConnected ? <JobDetail wallet={wallet} /> : <Navigate to="/" replace />}
            />
            <Route
              path="/invoices"
              element={wallet.isConnected ? <Invoices wallet={wallet} /> : <Navigate to="/" replace />}
            />
            <Route
              path="/admin"
              element={isAdmin ? <Admin wallet={wallet} /> : <Navigate to="/" replace />}
            />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
