import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { parseEther } from 'viem';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { useCreateToken } from '@/hooks/use-launchpad';
import { useLocation } from 'wouter';
import { useWatchContractEvent } from 'wagmi';
import { FACTORY_V3_ADDRESS } from '@/lib/contracts';
import { saveTokenMetadata } from '@/lib/token-metadata';
import { Loader2, Upload, Rocket } from 'lucide-react';
import { txPendingToast, txSubmittedToast, txSuccessToast, txErrorToast } from '@/lib/tx-toast';
import { toast } from 'sonner';
import { uploadImage } from '@/lib/upload';

const formSchema = z.object({
  name: z.string().min(1, 'Required').max(32, 'Too long'),
  symbol: z.string().min(1, 'Required').max(8, 'Max 8 chars').regex(/^[a-zA-Z0-9]+$/, 'Letters & numbers only'),
  description: z.string().max(280, 'Max 280 chars').optional(),
  website: z.string().url('Must be a valid URL').or(z.literal('')).optional(),
  twitter: z.string().optional(),
  telegram: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface CreateTokenModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = 'idle' | 'deploying' | 'confirming' | 'done';

const fieldClass = 'w-full bg-white/4 border border-border/60 rounded-lg px-3 py-2.5 text-[13px] font-medium text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 focus:bg-white/6 transition-all font-mono disabled:opacity-50';

export function CreateTokenModal({ open, onOpenChange }: CreateTokenModalProps) {
  const [, setLocation] = useLocation();
  const { createToken, isPending, isConfirming, error, hash: deployHash } = useCreateToken();
  const [step, setStep] = useState<Step>('idle');
  const [newTokenAddress, setNewTokenAddress] = useState<`0x${string}` | null>(null);

  const deployToastId = useRef<string | number | null>(null);
  const [devBuyInput, setDevBuyInput] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const imageUriRef = useRef<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageUrlMode, setImageUrlMode] = useState(false);
  const [pastedUrl, setPastedUrl] = useState('');

  const handleImagePick = async (file: File | null) => {
    if (!file) return;
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(URL.createObjectURL(file));
    setImageUploading(true);
    const tid = toast.loading('Uploading to IPFS...');
    try {
      const r = await uploadImage(file);
      setImageUri(r.url);
      imageUriRef.current = r.url;
      toast.success('Image pinned', { id: tid, description: r.cid.slice(0, 12) + '…' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      toast.error(msg, { id: tid });
      setImagePreview(null);
    } finally {
      setImageUploading(false);
    }
  };

  const handlePastedUrl = (url: string) => {
    setPastedUrl(url);
    const trimmed = url.trim();
    if (!trimmed) { clearImage(); return; }
    try { new URL(trimmed); } catch { return; }
    if (imagePreview && !imagePreview.startsWith('blob:')) { /* no revoke needed */ }
    else if (imagePreview?.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
    setImagePreview(trimmed);
    setImageUri(trimmed);
    imageUriRef.current = trimmed;
  };

  const clearImage = () => {
    if (imagePreview?.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
    setImageUri(null);
    imageUriRef.current = null;
    setImagePreview(null);
    setPastedUrl('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  useEffect(() => {
    if (!open) {
      if (imagePreview?.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
      setImageUri(null);
      imageUriRef.current = null;
      setImagePreview(null);
      setImageUploading(false);
      setPastedUrl('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    return () => { if (imagePreview) URL.revokeObjectURL(imagePreview); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '', symbol: '', description: '', website: '', twitter: '', telegram: '' },
  });

  useEffect(() => {
    if (deployHash && deployToastId.current) {
      txSubmittedToast(deployToastId.current, deployHash, 'Deploying token');
    }
  }, [deployHash]);

  useEffect(() => {
    if (step === 'done' && newTokenAddress) {
      const addr = newTokenAddress;
      onOpenChange(false);
      form.reset();
      setStep('idle');
      setNewTokenAddress(null);
      setTimeout(() => setLocation(`/token/${addr}`), 80);
    }
  }, [step, newTokenAddress]);

  useWatchContractEvent({
    address: FACTORY_V3_ADDRESS ?? undefined,
    eventName: 'TokenDeployed',
    enabled: !!FACTORY_V3_ADDRESS && step === 'confirming',
    onLogs: async (logs) => {
      const log = logs[0];
      if (!log?.args?.token) return;
      const tokenAddr = log.args.token as `0x${string}`;
      setNewTokenAddress(tokenAddr);
      if (deployToastId.current && deployHash) {
        txSuccessToast(deployToastId.current, deployHash, `${(log.args.symbol as string) || 'Token'} deployed!`);
        deployToastId.current = null;
      }
      const vals = form.getValues();
      saveTokenMetadata(tokenAddr, {
        description: vals.description || undefined,
        website: vals.website || undefined,
        twitter: vals.twitter || undefined,
        telegram: vals.telegram || undefined,
        image: imageUriRef.current || undefined,
      });
      setStep('done');
    },
  });

  async function onSubmit(data: FormValues) {
    if (!FACTORY_V3_ADDRESS) { toast.error('Factory contract not configured.'); return; }
    if (!imageUri) {
      toast.error('Token image is required', { description: 'Upload a PNG, JPG, GIF or WEBP before launching.' });
      fileInputRef.current?.click();
      return;
    }
    setStep('deploying');
    const id = txPendingToast(`Deploying ${data.symbol.toUpperCase()}`);
    deployToastId.current = id;
    const metadataURI = imageUri || '';
    const devBuyWei = devBuyInput && parseFloat(devBuyInput) > 0
      ? parseEther(devBuyInput)
      : undefined;
    try {
      await createToken(data.name, data.symbol.toUpperCase(), metadataURI, devBuyWei);
      setStep('confirming');
    } catch (err) {
      txErrorToast(id, err);
      deployToastId.current = null;
      setStep('idle');
    }
  }

  const isLoading = step !== 'idle';
  const descLen = form.watch('description')?.length ?? 0;

  const btnLabel = () => {
    if (step === 'deploying') return 'Confirm in wallet…';
    if (step === 'confirming') return 'Deploying…';
    return 'Launch Token';
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !isLoading && onOpenChange(v)}>
      <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-[460px] p-0 bg-card border-border/60 shadow-2xl overflow-hidden max-h-[92vh] overflow-y-auto">
        {/* Header bar */}
        <div className="h-0.5 w-full bg-gradient-to-r from-primary via-primary/50 to-transparent" />
        <div className="flex items-center px-5 py-4 border-b border-border/50 pr-12">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10 border border-primary/20">
              <Rocket className="h-3.5 w-3.5 text-primary" />
            </div>
            <div>
              <h2 className="text-[14px] font-black tracking-tight text-foreground leading-none">Launch Token</h2>
              <p className="text-[10px] text-muted-foreground font-mono mt-0.5">Base Mainnet · Uniswap V4 Pool</p>
            </div>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="px-5 py-4 space-y-4">

            {/* Image upload */}
            <div className="space-y-2">
              <div className="flex items-center gap-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={(e) => handleImagePick(e.target.files?.[0] ?? null)}
                  disabled={isLoading || imageUploading}
                />
                <button
                  type="button"
                  onClick={() => { if (!imageUrlMode) fileInputRef.current?.click(); }}
                  disabled={isLoading || imageUploading || imageUrlMode}
                  className={`relative w-16 h-16 rounded-xl border-2 border-dashed flex items-center justify-center overflow-hidden shrink-0 transition-all group ${
                    imagePreview
                      ? 'border-primary/40 bg-white/3'
                      : 'border-destructive/50 hover:border-destructive/80 bg-destructive/5 hover:bg-destructive/8'
                  }`}
                >
                  {imagePreview ? (
                    <>
                      <img src={imagePreview} alt="preview" className="w-full h-full object-cover" onError={() => setImagePreview(null)} />
                      {imageUploading && (
                        <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        </div>
                      )}
                    </>
                  ) : (
                    <Upload className="h-4 w-4 text-destructive/60 group-hover:text-destructive transition-colors" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <p className="text-[12px] font-semibold text-foreground">Token Image</p>
                    {!imageUri && (
                      <span className="text-[9px] font-bold uppercase tracking-wider text-destructive bg-destructive/10 border border-destructive/20 rounded px-1.5 py-0.5">
                        Required
                      </span>
                    )}
                    {imageUri && (
                      <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded px-1.5 py-0.5">
                        ✓ Ready
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    {imageUri
                      ? imageUri.length > 32 ? imageUri.slice(0, 32) + '…' : imageUri
                      : 'PNG · JPG · GIF · WEBP · max 5MB'}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {imageUri ? (
                      <button
                        type="button"
                        onClick={clearImage}
                        disabled={isLoading}
                        className="text-[10px] text-muted-foreground hover:text-destructive font-mono transition-colors"
                      >
                        Remove
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => { setImageUrlMode((m) => !m); clearImage(); }}
                        disabled={isLoading}
                        className="text-[10px] text-primary/70 hover:text-primary font-mono transition-colors"
                      >
                        {imageUrlMode ? '← upload file' : 'or paste URL →'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
              {/* URL paste input */}
              {imageUrlMode && !imageUri && (
                <input
                  type="url"
                  placeholder="https://i.imgur.com/… or any image URL"
                  value={pastedUrl}
                  onChange={(e) => handlePastedUrl(e.target.value)}
                  disabled={isLoading}
                  className={`${fieldClass} text-[12px]`}
                />
              )}
            </div>

            {/* Name + Symbol */}
            <div className="grid grid-cols-5 gap-2.5">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem className="col-span-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 mb-1.5">Name</p>
                  <FormControl>
                    <input placeholder="Asteroid Shiba" className={fieldClass} {...field} disabled={isLoading} />
                  </FormControl>
                  <FormMessage className="text-[10px]" />
                </FormItem>
              )} />
              <FormField control={form.control} name="symbol" render={({ field }) => (
                <FormItem className="col-span-2">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 mb-1.5">Symbol</p>
                  <FormControl>
                    <input placeholder="STR" className={`${fieldClass} uppercase`} {...field} onChange={(e) => field.onChange(e.target.value.toUpperCase())} disabled={isLoading} />
                  </FormControl>
                  <FormMessage className="text-[10px]" />
                </FormItem>
              )} />
            </div>

            {/* Description */}
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 mb-1.5">Description <span className="normal-case font-normal tracking-normal">(optional)</span></p>
                <FormControl>
                  <textarea
                    placeholder="What is this token about?"
                    rows={3}
                    className={`${fieldClass} resize-none`}
                    {...field}
                    disabled={isLoading}
                  />
                </FormControl>
                <div className="flex justify-between items-center mt-1">
                  <FormMessage className="text-[10px]" />
                  <span className={`text-[10px] font-mono ml-auto ${descLen > 250 ? 'text-amber-400' : 'text-muted-foreground/50'}`}>{descLen}/280</span>
                </div>
              </FormItem>
            )} />

            {/* Socials */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 mb-1.5">Socials <span className="normal-case font-normal tracking-normal">(optional)</span></p>
              <div className="space-y-2">
                {[
                  { name: 'website' as const, label: 'Site', placeholder: 'https://…' },
                  { name: 'twitter' as const, label: 'X', placeholder: '@handle' },
                  { name: 'telegram' as const, label: 'TG', placeholder: 't.me/group' },
                ].map(({ name, label, placeholder }) => (
                  <FormField key={name} control={form.control} name={name} render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-mono font-semibold text-muted-foreground/50 w-7 shrink-0">{label}</span>
                          <input placeholder={placeholder} className={`${fieldClass} pl-10`} {...field} disabled={isLoading} />
                        </div>
                      </FormControl>
                      <FormMessage className="text-[10px]" />
                    </FormItem>
                  )} />
                ))}
              </div>
            </div>

            {/* Optional dev buy */}
            <div className="rounded-lg bg-white/3 border border-border/40 px-3 py-3">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-[11px] font-semibold text-foreground">Dev Buy <span className="text-muted-foreground font-normal">(optional)</span></p>
                  <p className="text-[10px] text-muted-foreground font-mono mt-0.5">Buy tokens at launch in the same tx · 3% tax applies</p>
                </div>
              </div>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  placeholder="0.00"
                  value={devBuyInput}
                  onChange={(e) => setDevBuyInput(e.target.value)}
                  disabled={isLoading}
                  className={`${fieldClass} pr-14`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-mono font-semibold text-muted-foreground/60">ETH</span>
              </div>
            </div>

            {/* V4 pool info note */}
            <div className="rounded-lg bg-primary/5 border border-primary/15 px-3 py-2.5">
              <p className="text-[10px] font-mono text-primary font-semibold mb-1">Uniswap V4 Pool · 3% swap tax</p>
              <p className="text-[10px] text-muted-foreground font-mono">1.5% to holder rewards · 1.5% platform · 0.3% LP fee</p>
            </div>

            {error && (
              <p className="text-[11px] text-destructive font-mono break-words">{error.message || 'An error occurred'}</p>
            )}

            <button
              type="submit"
              disabled={isLoading || imageUploading || !FACTORY_V3_ADDRESS || !imageUri}
              className="w-full py-3 rounded-xl text-[13px] font-bold tracking-wide transition-all disabled:opacity-40 disabled:cursor-not-allowed enabled:bg-primary enabled:text-primary-foreground enabled:hover:bg-primary/90 enabled:glow-primary flex items-center justify-center gap-2"
            >
              {isLoading
                ? <><Loader2 className="h-4 w-4 animate-spin" />{btnLabel()}</>
                : imageUploading ? <><Loader2 className="h-4 w-4 animate-spin" />Uploading image…</>
                : !FACTORY_V3_ADDRESS ? 'Not configured'
                : !imageUri ? 'Upload an image to continue'
                : <><Rocket className="h-4 w-4" />Launch Token</>
              }
            </button>

          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
