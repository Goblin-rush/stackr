import { Link } from 'wouter';
import { Rocket, Home } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-6 flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20">
            <Rocket className="h-7 w-7 text-primary" />
          </div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-primary mb-2">404 · Off-curve</p>
          <h1 className="text-2xl font-black tracking-tight text-foreground mb-3">
            Page not found
          </h1>
          <p className="text-sm text-muted-foreground mb-8">
            Hindi namin mahanap ang page na hinahanap mo. Baka na-rename, na-delete,
            o na-mistype ang link.
          </p>
          <Link href="/">
            <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md text-[13px] font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all glow-primary cursor-pointer">
              <Home className="h-4 w-4" />
              Back to feed
            </span>
          </Link>
        </div>
      </main>
    </div>
  );
}
