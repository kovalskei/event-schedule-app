
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import Index from "./pages/Index";
import CampaignManager from "./pages/CampaignManager";
import CampaignHistory from "./pages/CampaignHistory";
import AISettings from "./pages/AISettings";
import EventsManager from "./pages/EventsManager";
import TemplatesManager from "./pages/TemplatesManager";
import TemplateTest from "./pages/TemplateTest";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppLayout>
          <Routes>
            <Route path="/" element={<EventsManager />} />
            <Route path="/campaigns" element={<CampaignManager />} />
            <Route path="/history" element={<CampaignHistory />} />
            <Route path="/ai-settings" element={<AISettings />} />
            <Route path="/templates" element={<TemplatesManager />} />
            <Route path="/templates-test" element={<TemplateTest />} />
            <Route path="/dashboard" element={<Index />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;