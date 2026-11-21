import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { RecorderProvider } from "@/context/RecorderContext";
import AppShell from "@/components/vox/AppShell";
import Login from "@/pages/Login";
import AuthCallback from "@/pages/AuthCallback";
import Home from "@/pages/Home";
import Live from "@/pages/Live";
import History from "@/pages/History";
import Settings from "@/pages/Settings";
import About from "@/pages/About";

const Protected = ({ children }) => {
  const { user } = useAuth();
  if (user === null) return <div className="vox-bg min-h-screen flex items-center justify-center" data-testid="auth-loading"><Loader2 size={40} className="animate-spin text-[#11847c]" /></div>;
  if (user === false) return <Navigate to="/login" replace />;
  return children;
};

function AppRouter() {
  const location = useLocation();
  if (location.hash?.includes("session_id=")) return <AuthCallback />;
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Protected><RecorderProvider><AppShell /></RecorderProvider></Protected>}>
        <Route path="/" element={<Home />} />
        <Route path="/live" element={<Live />} />
        <Route path="/history" element={<History />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/about" element={<About />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <TooltipProvider delayDuration={150}>
            <AppRouter />
            <Toaster position="top-right" richColors />
          </TooltipProvider>
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}
