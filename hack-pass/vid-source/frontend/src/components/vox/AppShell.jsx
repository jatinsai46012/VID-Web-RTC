import { Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Header } from "./Header";
import { Sidebar, MobileNav } from "./Sidebar";
import { IslandContent } from "./DynamicIsland";
import { useRecorder } from "@/context/RecorderContext";

const FloatingIsland = () => {
  const { active } = useRecorder();
  const { pathname } = useLocation();
  const show = active && !["/", "/live"].includes(pathname);
  return (
    <AnimatePresence>
      {show && (
        <motion.div initial={{ y: -90, scale: 0.6, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} exit={{ y: -90, scale: 0.6, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 24 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 rounded-full bg-[#04201e] shadow-[0_20px_50px_-12px_rgba(4,32,30,.8)] ring-1 ring-white/10"
          data-testid="floating-dynamic-island">
          <IslandContent prefix="floating-" />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default function AppShell() {
  const { pathname } = useLocation();
  return (
    <div className="vox-bg min-h-screen p-3 md:p-6 text-slate-800">
      <Header />
      <div className="relative z-10 flex gap-5">
        <Sidebar />
        <main key={pathname} className="flex-1 min-w-0 pb-24 lg:pb-2 vox-fadeup">
          <Outlet />
        </main>
      </div>
      <FloatingIsland />
      <MobileNav />
    </div>
  );
}
