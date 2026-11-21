import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function AuthCallback() {
  const nav = useNavigate();
  const { setUser } = useAuth();
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const sid = new URLSearchParams(window.location.hash.slice(1)).get("session_id");
    (async () => {
      try {
        const { data } = await api.post("/auth/google/session", { session_id: sid });
        setUser(data.user);
        nav("/", { replace: true });
      } catch (e) {
        toast.error(formatApiError(e));
        nav("/login", { replace: true });
      }
    })();
  }, [nav, setUser]);
  return (
    <div className="min-h-screen bg-[#031a19] flex items-center justify-center text-[#5fe3d8]" data-testid="auth-callback">
      <Loader2 className="animate-spin" size={36} />
    </div>
  );
}
