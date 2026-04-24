import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { config } from "@/lib/wagmi";
import "@/lib/appkit";
import { WrongNetworkBanner } from "@/components/WrongNetworkBanner";
import NotFound from "@/pages/not-found";
import HomeFeedPage from "@/pages/HomeFeedPage";
import TokenDetailPage from "@/pages/TokenDetailPage";
import AdminPage from "@/pages/AdminPage";
import DashboardPage from "@/pages/DashboardPage";
import DemoTokenPage from "@/pages/DemoTokenPage";
import DocsPage from "@/pages/DocsPage";
import FaqPage from "@/pages/FaqPage";
import DisclaimerPage from "@/pages/DisclaimerPage";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomeFeedPage} />
      <Route path="/dashboard" component={DashboardPage} />
      <Route path="/token/:address" component={TokenDetailPage} />
      <Route path="/token/:chainId/:address" component={TokenDetailPage} />
      <Route path="/demo/:symbol" component={DemoTokenPage} />
      <Route path="/docs" component={DocsPage} />
      <Route path="/faq" component={FaqPage} />
      <Route path="/disclaimer" component={DisclaimerPage} />
      <Route path="/admin" component={AdminPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WrongNetworkBanner />
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
          <SonnerToaster position="top-right" theme="dark" richColors closeButton />
        </TooltipProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default App;
