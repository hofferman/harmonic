import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/hooks/useAuth";
import PasswordChangeGate from "@/components/auth/PasswordChangeGate";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ChangePassword from "./pages/ChangePassword";
import Dashboard from "./pages/Dashboard";
import Escalas from "./pages/Escalas";
import EscalaDetail from "./pages/EscalaDetail";
import Membros from "./pages/Membros";
import Musicas from "./pages/Musicas";
import OrdensCulto from "./pages/OrdensCulto";
import OrdemCultoEditor from "./pages/OrdemCultoEditor";
import Configuracoes from "./pages/Configuracoes";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark" enableSystem={false}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <PasswordChangeGate>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/change-password" element={<ChangePassword />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/escalas" element={<Escalas />} />
                <Route path="/escalas/:id" element={<EscalaDetail />} />
                <Route path="/membros" element={<Membros />} />
                <Route path="/musicas" element={<Musicas />} />
                <Route path="/configuracoes" element={<Configuracoes />} />
                <Route path="/ordens-culto" element={<OrdensCulto />} />
                <Route path="/ordens-culto/:id" element={<OrdemCultoEditor />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </PasswordChangeGate>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
