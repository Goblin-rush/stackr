import { Toaster } from "@/components/ui/toaster";
import PresalePage from "@/pages/PresalePage";
import ArticlePage from "@/pages/ArticlePage";
import { Analytics } from "@vercel/analytics/react";

function App() {
  const path = window.location.pathname;
  const isArticle = path === '/article' || path.endsWith('/article');

  return (
    <>
      {isArticle ? <ArticlePage /> : <PresalePage />}
      <Toaster />
      <Analytics />
    </>
  );
}

export default App;
