import { useEffect, useMemo } from 'react';
import { useConnect, useAccount } from 'wagmi';
import type { Connector } from 'wagmi';
import { X, Loader2, Wallet } from 'lucide-react';
import { useWalletModal } from './WalletModalContext';

// wagmi types `connectors` as `(Connector | CreateConnectorFn)[]` because the
// config accepts both factories and instances, but at runtime wagmi has
// already instantiated everything by the time `useConnect()` returns. Narrow
// here for safe property access (uid, name, icon, etc.).
function asConnectors(arr: unknown[]): Connector[] {
  return arr as Connector[];
}

// Friendly display names for built-in connector ids that don't carry a
// nice .name (e.g. raw injected without an EIP-6963 announcer).
const CONNECTOR_LABELS: Record<string, string> = {
  injected: 'Browser Wallet',
  metaMask: 'MetaMask',
  metaMaskSDK: 'MetaMask',
  coinbaseWalletSDK: 'Coinbase Wallet',
  coinbaseWallet: 'Coinbase Wallet',
  walletConnect: 'WalletConnect',
};

// Prefer a connector's .name if it looks human-readable, otherwise fall
// back to our label map, then the id itself.
function displayName(c: Connector): string {
  if (c.name && c.name.length > 0 && c.name.toLowerCase() !== 'injected') return c.name;
  return CONNECTOR_LABELS[c.id] ?? CONNECTOR_LABELS[c.type] ?? c.name ?? c.id;
}

// Subtitle hint for the row.
function subtitle(c: Connector): string {
  if (c.id === 'walletConnect') return 'Scan with mobile wallet';
  if (c.id === 'coinbaseWalletSDK' || c.id === 'coinbaseWallet') return 'Coinbase Wallet';
  if (c.type === 'injected' && c.id !== 'injected') return 'Detected';
  if (c.id === 'injected') return 'Browser extension';
  if (c.id === 'metaMask' || c.id === 'metaMaskSDK') return 'MetaMask wallet';
  return '';
}

// Real PNG brand logos served from /public/wallets/. We prefix with
// import.meta.env.BASE_URL so it works under the artifact's path prefix
// (e.g. /launchpad/wallets/metamask.png).
const WALLET_LOGOS: Record<string, string> = {
  metaMask: `${import.meta.env.BASE_URL}wallets/metamask.png`,
  metaMaskSDK: `${import.meta.env.BASE_URL}wallets/metamask.png`,
  coinbaseWallet: `${import.meta.env.BASE_URL}wallets/coinbase.png`,
  coinbaseWalletSDK: `${import.meta.env.BASE_URL}wallets/coinbase.png`,
  walletConnect: `${import.meta.env.BASE_URL}wallets/walletconnect.png`,
};

function brandLogoUrlFor(c: Connector): string | null {
  return WALLET_LOGOS[c.id] ?? null;
}

// Generic browser-wallet tile for the bare `injected` connector when no
// matching brand asset is available.
function BrowserWalletTile() {
  return (
    <div className="h-9 w-9 rounded-md bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shrink-0">
      <Wallet className="h-4.5 w-4.5 text-white" strokeWidth={2.25} />
    </div>
  );
}

// Default placeholder icon when a connector has no icon (uses initials in svg).
function FallbackIcon({ name }: { name: string }) {
  const initial = name.charAt(0).toUpperCase();
  return (
    <div className="h-9 w-9 rounded-md bg-white/8 flex items-center justify-center text-[14px] font-bold text-foreground/70 shrink-0">
      {initial || <Wallet className="h-4 w-4" />}
    </div>
  );
}

export function WalletModal() {
  const { isOpen, close } = useWalletModal();
  const { connect, connectors: rawConnectors, error, isPending, variables, reset } = useConnect();
  const connectors = asConnectors(rawConnectors as unknown[]);
  const { isConnected } = useAccount();

  // Auto-close after successful connect.
  useEffect(() => {
    if (isConnected && isOpen) close();
  }, [isConnected, isOpen, close]);

  // Clear stale error when modal closes/opens.
  useEffect(() => {
    if (!isOpen) reset();
  }, [isOpen, reset]);

  // Dedupe + sort: EIP-6963 detected wallets first, then known options.
  const ordered = useMemo(() => {
    const seen = new Set<string>();
    const detected: Connector[] = [];
    const fallback: Connector[] = [];
    for (const c of connectors) {
      const key = (c.name || c.id).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      // EIP-6963 announced wallets get type 'injected' but a custom .id (rdns).
      if (c.type === 'injected' && c.id !== 'injected') {
        detected.push(c);
      } else {
        fallback.push(c);
      }
    }
    // Sort fallback into a sensible order.
    const order = ['injected', 'metaMask', 'metaMaskSDK', 'coinbaseWalletSDK', 'coinbaseWallet', 'walletConnect'];
    fallback.sort((a, b) => {
      const ai = order.indexOf(a.id);
      const bi = order.indexOf(b.id);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
    return [...detected, ...fallback];
  }, [connectors]);

  // ESC key + body scroll lock.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [isOpen, close]);

  if (!isOpen) return null;

  const pendingConnectorUid = isPending
    ? (variables?.connector as Connector | undefined)?.uid
    : undefined;

  return (
    <>
      {/* Backdrop — fades in */}
      <div
        onClick={close}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[300] animate-in fade-in duration-300"
      />
      {/* Modal — bottom sheet on mobile (slides up), centered card on desktop (fade+zoom) */}
      <div
        className="fixed inset-0 z-[301] flex items-end sm:items-center justify-center sm:p-4 pointer-events-none"
      >
        <div
          className="
            w-full sm:max-w-sm
            rounded-t-2xl sm:rounded-xl
            border border-white/8 sm:border bg-[#0c0c0d] shadow-2xl
            pointer-events-auto overflow-hidden
            pb-[env(safe-area-inset-bottom)] sm:pb-0
            animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:fade-in sm:zoom-in-95
            duration-300 ease-out
          "
        >
          {/* Drag-handle indicator (mobile only) */}
          <div className="sm:hidden flex justify-center pt-2.5 pb-1">
            <div className="h-1 w-9 rounded-full bg-white/15" />
          </div>
          {/* Header */}
          <div className="flex items-center justify-between px-5 h-14 border-b border-white/8">
            <h2 className="text-[14px] font-semibold tracking-tight text-foreground">
              Connect Wallet
            </h2>
            <button
              onClick={close}
              aria-label="Close"
              className="text-muted-foreground/60 hover:text-foreground transition-colors p-1"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Wallet list */}
          <div className="p-2 max-h-[60vh] overflow-y-auto">
            {ordered.length === 0 ? (
              <div className="px-3 py-8 text-center text-[12px] text-muted-foreground">
                No wallet connectors available.
              </div>
            ) : (
              ordered.map((c) => {
                const name = displayName(c);
                const sub = subtitle(c);
                const pending = pendingConnectorUid === c.uid;
                // Icon priority:
                //   1. EIP-6963 announced icon (real Phantom/Rainbow/etc.)
                //   2. Hardcoded brand PNG for the known fallback connectors
                //   3. Generic browser-wallet tile for raw injected
                //   4. Letter fallback as last resort
                const brandUrl = brandLogoUrlFor(c);
                return (
                  <button
                    key={c.uid}
                    disabled={isPending}
                    onClick={() => connect({ connector: c })}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-white/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-left"
                  >
                    {c.icon ? (
                      <img
                        src={c.icon}
                        alt=""
                        className="h-9 w-9 rounded-md shrink-0 bg-white/5 object-contain"
                      />
                    ) : brandUrl ? (
                      <img
                        src={brandUrl}
                        alt=""
                        className="h-9 w-9 rounded-md shrink-0 object-contain"
                      />
                    ) : c.id === 'injected' ? (
                      <BrowserWalletTile />
                    ) : (
                      <FallbackIcon name={name} />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-foreground truncate">
                        {name}
                      </div>
                      {sub && (
                        <div className="text-[11px] text-muted-foreground/70 truncate">
                          {sub}
                        </div>
                      )}
                    </div>
                    {pending && (
                      <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="border-t border-white/8 px-5 py-3 text-[11px] text-destructive bg-destructive/5">
              {error.message}
            </div>
          )}

          {/* Footer */}
          <div className="border-t border-white/8 px-5 py-3 text-[10px] text-muted-foreground/50 text-center">
            By connecting, you agree to our terms. We never request signatures
            to connect.
          </div>
        </div>
      </div>
    </>
  );
}
