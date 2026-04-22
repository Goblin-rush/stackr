import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useCreateToken } from '@/hooks/use-launchpad';
import { useLocation } from 'wouter';
import { useWatchContractEvent } from 'wagmi';
import { FACTORY_V2_ADDRESS, FACTORY_V2_ABI } from '@/lib/contracts';
import { saveTokenMetadata } from '@/lib/token-metadata';
import { Loader2, Upload, X } from 'lucide-react';
import { txPendingToast, txSubmittedToast, txSuccessToast, txErrorToast } from '@/lib/tx-toast';
import { toast } from 'sonner';
import { uploadImage } from '@/lib/upload';

const formSchema = z.object({
  name: z.string().min(1, 'Name is required').max(32, 'Name too long'),
  symbol: z.string().min(1, 'Symbol is required').max(8, 'Symbol too long').regex(/^[a-zA-Z0-9]+$/, 'Alphanumeric only'),
  description: z.string().max(280, 'Max 280 characters').optional(),
  website: z.string().url('Must be a valid URL').or(z.literal('')).optional(),
  twitter: z.string().optional(),
  telegram: z.string().optional(),
  initialBuy: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface CreateTokenModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = 'idle' | 'deploying' | 'confirming' | 'done';

export function CreateTokenModal({ open, onOpenChange }: CreateTokenModalProps) {
  const [, setLocation] = useLocation();
  const { createToken, isPending, isConfirming, error, hash: deployHash } = useCreateToken();
  const [step, setStep] = useState<Step>('idle');
  const [newTokenAddress, setNewTokenAddress] = useState<`0x${string}` | null>(null);

  const deployToastId = useRef<string | number | null>(null);

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImagePick = async (file: File | null) => {
    if (!file) return;
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(URL.createObjectURL(file));
    setImageUploading(true);
    const tid = toast.loading('Uploading image to IPFS...');
    try {
      const r = await uploadImage(file);
      setImageUri(r.url);
      toast.success('Image pinned to IPFS', { id: tid, description: r.cid.slice(0, 12) + '…' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      toast.error(msg, { id: tid });
      setImagePreview(null);
    } finally {
      setImageUploading(false);
    }
  };

  const clearImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageUri(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  useEffect(() => {
    if (!open) {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
      setImageUri(null);
      setImagePreview(null);
      setImageUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '', symbol: '', description: '', website: '', twitter: '', telegram: '', initialBuy: '' },
  });

  // Swap pending → submitted toast when tx hash arrives
  useEffect(() => {
    if (deployHash && deployToastId.current) {
      txSubmittedToast(deployToastId.current, deployHash, 'Deploying token');
    }
  }, [deployHash]);

  // Navigate on done
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

  // V2: watch TokenDeployed event on factory — single tx handles both deploy + dev buy
  useWatchContractEvent({
    address: FACTORY_V2_ADDRESS ?? undefined,
    abi: FACTORY_V2_ABI,
    eventName: 'TokenDeployed',
    enabled: !!FACTORY_V2_ADDRESS && step === 'confirming',
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
        image: imageUri || undefined,
      });

      setStep('done');
    },
  });

  async function onSubmit(data: FormValues) {
    if (!FACTORY_V2_ADDRESS) {
      toast.error('Factory contract not configured.');
      return;
    }
    setStep('deploying');
    const id = txPendingToast(`Deploying ${data.symbol.toUpperCase()}`);
    deployToastId.current = id;
    // Build metadataURI: use IPFS image URI if available, else empty string
    const metadataURI = imageUri || '';
    try {
      // V2: createToken handles deploy + optional dev buy in a single transaction
      await createToken(data.name, data.symbol.toUpperCase(), metadataURI, data.initialBuy);
      setStep('confirming');
    } catch (err) {
      txErrorToast(id, err);
      deployToastId.current = null;
      setStep('idle');
    }
  }

  const isLoading = step !== 'idle';
  const initialBuyVal = parseFloat(form.watch('initialBuy') || '0');

  const stepLabel = () => {
    if (step === 'deploying') return 'Confirm in wallet...';
    if (step === 'confirming') return 'Deploying + buying...';
    return 'Deploy Contract';
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !isLoading && onOpenChange(val)}>
      <DialogContent className="w-[calc(100vw-1rem)] sm:w-full sm:max-w-[500px] bg-background border-border shadow-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold tracking-tight">Initialize Token</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Deploy a new bonding curve token to Base mainnet.
            {initialBuyVal > 0 && ' Dev buy is included in the same transaction.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">

            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Token Image</p>
              <div className="flex items-center gap-3">
                <div className="relative w-20 h-20 rounded-md border border-border/50 bg-muted/30 flex items-center justify-center overflow-hidden shrink-0">
                  {imagePreview ? (
                    <>
                      <img src={imagePreview} alt="preview" className="w-full h-full object-cover" />
                      {imageUploading && (
                        <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                          <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        </div>
                      )}
                    </>
                  ) : (
                    <Upload className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex flex-col gap-2 min-w-0 flex-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={(e) => handleImagePick(e.target.files?.[0] ?? null)}
                    disabled={isLoading || imageUploading}
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="font-mono text-xs"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isLoading || imageUploading}
                    >
                      {imageUri ? 'Change Image' : 'Upload Image'}
                    </Button>
                    {imageUri && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="font-mono text-xs"
                        onClick={clearImage}
                        disabled={isLoading || imageUploading}
                      >
                        <X className="h-3 w-3 mr-1" /> Remove
                      </Button>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground font-mono truncate">
                    {imageUri ? `Pinned · ${imageUri.replace('ipfs://', '').slice(0, 20)}…` : 'PNG / JPG / GIF / WEBP · max 5MB · stored on IPFS'}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem className="col-span-2 sm:col-span-1">
                  <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground">Token Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Terminal Protocol" className="font-mono bg-muted/50" {...field} disabled={isLoading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="symbol" render={({ field }) => (
                <FormItem className="col-span-2 sm:col-span-1">
                  <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground">Ticker Symbol</FormLabel>
                  <FormControl>
                    <Input placeholder="TRM" className="font-mono bg-muted/50 uppercase" {...field} disabled={isLoading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground">Description</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Describe your token in a few words..."
                    className="font-mono bg-muted/50 resize-none text-sm"
                    rows={3}
                    {...field}
                    disabled={isLoading}
                  />
                </FormControl>
                <div className="flex justify-between">
                  <FormMessage />
                  <span className="text-xs text-muted-foreground ml-auto">{(field.value?.length ?? 0)}/280</span>
                </div>
              </FormItem>
            )} />

            <div className="border-t border-border/50 pt-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Socials (optional)</p>
              <div className="space-y-2">
                <FormField control={form.control} name="website" render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono w-16">Website</span>
                        <Input placeholder="https://..." className="font-mono bg-muted/50 pl-20 text-sm" {...field} disabled={isLoading} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="twitter" render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono w-16">Twitter</span>
                        <Input placeholder="@handle" className="font-mono bg-muted/50 pl-20 text-sm" {...field} disabled={isLoading} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="telegram" render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono w-16">Telegram</span>
                        <Input placeholder="@group or t.me/link" className="font-mono bg-muted/50 pl-20 text-sm" {...field} disabled={isLoading} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </div>

            <div className="border-t border-border/50 pt-3">
              <FormField control={form.control} name="initialBuy" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground">
                    Dev Buy (optional) — included in deploy tx
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type="number"
                        min="0"
                        step="0.001"
                        placeholder="0.0"
                        className="font-mono bg-muted/50 pr-14"
                        {...field}
                        disabled={isLoading}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono">ETH</span>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {initialBuyVal > 0 && (
              <div className="bg-primary/10 p-3 rounded border border-primary/20 text-xs font-mono text-primary space-y-1">
                <div className="flex justify-between">
                  <span>Dev Buy (5% tax)</span>
                  <span>{initialBuyVal.toFixed(4)} ETH</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Platform fee (1.5%)</span>
                  <span>{(initialBuyVal * 0.015).toFixed(4)} ETH</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Burn (1.5%)</span>
                  <span>{(initialBuyVal * 0.015).toFixed(4)} ETH</span>
                </div>
              </div>
            )}

            {error && (
              <p className="text-sm text-destructive break-words">{error.message || 'An error occurred'}</p>
            )}

            <Button type="submit" className="w-full font-bold tracking-wide" disabled={isLoading || !FACTORY_V2_ADDRESS}>
              {isLoading
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{stepLabel()}</>
                : !FACTORY_V2_ADDRESS ? 'Factory not configured'
                : 'Deploy Contract'
              }
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
