import { PrivyProvider } from '@privy-io/react-auth';
import { Toaster } from "@/components/ui/toaster";
import PresalePage from "@/pages/PresalePage";
import ArticlePage from "@/pages/ArticlePage";
import { Analytics } from "@vercel/analytics/react";

function App() {
  const path = window.location.pathname;
  const isArticle = path === '/article' || path.endsWith('/article');

  return (
    <PrivyProvider
      appId="cmo7fgk0c02zy0cifvtqmn9gj"
      config={{
        loginMethods: ['wallet'],
        appearance: {
          theme: 'dark',
          accentColor: '#f59e0b',
          logo: '/logo.jpg',
        },
        defaultChain: { id: 1, name: 'Ethereum', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: ['https://cloudflare-eth.com'] } } },
      }}
    >
      {isArticle ? <ArticlePage /> : <PresalePage />}
      <Toaster />
      <Analytics />
    </PrivyProvider>
  );
}

export default App;
