import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { ConnectKitProvider } from "connectkit";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { config } from "@/lib/wagmi";
import { WrongNetworkBanner } from "@/components/WrongNetworkBanner";
import NotFound from "@/pages/not-found";
import HomeFeedPage from "@/pages/HomeFeedPage";
import V4Page from "@/pages/V4Page";
import V4TokenDetailPage from "@/pages/V4TokenDetailPage";
import DemoTokenPage from "@/pages/DemoTokenPage";
import DocsPage from "@/pages/DocsPage";
import FaqPage from "@/pages/FaqPage";
import DisclaimerPage from "@/pages/DisclaimerPage";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomeFeedPage} />
      <Route path="/demo/:symbol" component={DemoTokenPage} />
      <Route path="/docs" component={DocsPage} />
      <Route path="/faq" component={FaqPage} />
      <Route path="/disclaimer" component={DisclaimerPage} />
      <Route path="/admin" component={V4Page} />
      <Route path="/token/:address" component={V4TokenDetailPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProvider
          mode="dark"
          customTheme={{
            "--ck-accent-color": "#e63946",
            "--ck-accent-text-color": "#ffffff",
            "--ck-border-radius": "8px",
            "--ck-font-family":
              "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
          }}
          options={{
            hideQuestionMarkCTA: true,
            hideTooltips: false,
            enforceSupportedChains: true,
            initialChainId: 1,
          }}
        >
          <TooltipProvider>
            <WrongNetworkBanner />
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
            <Toaster />
            <SonnerToaster
              position="top-right"
              theme="dark"
              richColors
              closeButton
            />
          </TooltipProvider>
        </ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default App;
