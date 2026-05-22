import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useWallet } from "./hooks/useWallet";
import Navbar from "./components/Navbar";
import Dashboard from "./pages/Dashboard";
import CreateJob from "./pages/CreateJob";
import JobDetail from "./pages/JobDetail";
import Invoices from "./pages/Invoices";
import Landing from "./pages/Landing";

export default function App() {
  const wallet = useWallet();

  return (
    <BrowserRouter>
      <div className="app">
        <Navbar wallet={wallet} />
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
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
