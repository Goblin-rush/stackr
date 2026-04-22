import { toast } from 'sonner';

export function shortHash(hash?: string) {
  if (!hash) return '';
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}

export function basescanTx(hash: string) {
  return `https://basescan.org/tx/${hash}`;
}

export function parseTxError(err: unknown): string {
  if (!err) return 'Transaction failed';
  const e = err as { shortMessage?: string; message?: string; cause?: { shortMessage?: string; message?: string } };
  const raw = e.shortMessage || e.cause?.shortMessage || e.message || e.cause?.message || '';

  if (/user rejected|user denied|rejected the request/i.test(raw)) return 'Transaction rejected in wallet';
  if (/insufficient funds|exceeds the balance/i.test(raw)) return 'Not enough ETH for gas + value';
  if (/slippage|min(EthOut|TokensOut)|too little|min received/i.test(raw)) return 'Price moved. Increase slippage and retry.';
  if (/nonce/i.test(raw)) return 'Nonce conflict. Reset wallet activity.';
  if (/replacement transaction underpriced/i.test(raw)) return 'Replacement transaction underpriced';
  if (raw.length > 0 && raw.length < 140) return raw;
  return 'Transaction failed';
}

export function txPendingToast(label: string) {
  return toast.loading(label, { description: 'Confirm in your wallet…' });
}

export function txSubmittedToast(id: string | number, hash: `0x${string}`, label: string) {
  toast.loading(label, {
    id,
    description: `Tx ${shortHash(hash)} pending…`,
    action: {
      label: 'Basescan',
      onClick: () => window.open(basescanTx(hash), '_blank'),
    },
  });
}

export function txSuccessToast(id: string | number, hash: `0x${string}`, label: string) {
  toast.success(label, {
    id,
    description: `Tx ${shortHash(hash)} confirmed`,
    action: {
      label: 'Basescan',
      onClick: () => window.open(basescanTx(hash), '_blank'),
    },
  });
}

export function txErrorToast(id: string | number | undefined, err: unknown) {
  const msg = parseTxError(err);
  if (id !== undefined) toast.error(msg, { id });
  else toast.error(msg);
}
