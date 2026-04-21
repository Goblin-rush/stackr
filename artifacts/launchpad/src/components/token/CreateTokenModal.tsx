import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { parseEther } from 'viem';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useCreateToken } from '@/hooks/use-launchpad';
import { useLocation } from 'wouter';
import { useWatchContractEvent, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { FACTORY_ABI, FACTORY_ADDRESS, BONDING_CURVE_ABI } from '@/lib/contracts';
import { saveTokenMetadata } from '@/lib/token-metadata';
import { Loader2 } from 'lucide-react';

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

type Step = 'idle' | 'deploying' | 'confirming-deploy' | 'buying' | 'confirming-buy' | 'done';

export function CreateTokenModal({ open, onOpenChange }: CreateTokenModalProps) {
  const [, setLocation] = useLocation();
  const { createToken, isPending, isConfirming, error } = useCreateToken();
  const [step, setStep] = useState<Step>('idle');
  const [newTokenAddress, setNewTokenAddress] = useState<`0x${string}` | null>(null);

  const { writeContractAsync: buyWrite, data: buyHash } = useWriteContract();
  const { isLoading: isBuyConfirming, isSuccess: isBuySuccess } = useWaitForTransactionReceipt({ hash: buyHash });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '', symbol: '', description: '', website: '', twitter: '', telegram: '', initialBuy: '' },
  });

  // Navigate after buy confirms
  useEffect(() => {
    if (isBuySuccess && step === 'confirming-buy' && newTokenAddress) {
      setStep('done');
    }
  }, [isBuySuccess, step, newTokenAddress]);

  // Navigate on done
  useEffect(() => {
    if (step === 'done' && newTokenAddress) {
      const addr = newTokenAddress;
      onOpenChange(false);
      form.reset();
      setStep('idle');
      setNewTokenAddress(null);
      setLocation(`/token/${addr}`);
    }
  }, [step, newTokenAddress]);

  useWatchContractEvent({
    address: FACTORY_ADDRESS,
    abi: FACTORY_ABI,
    eventName: 'TokenCreated',
    enabled: step === 'confirming-deploy',
    onLogs: async (logs) => {
      const log = logs[0];
      if (!log?.args.token) return;

      const tokenAddr = log.args.token as `0x${string}`;
      setNewTokenAddress(tokenAddr);

      const vals = form.getValues();
      saveTokenMetadata(tokenAddr, {
        description: vals.description || undefined,
        website: vals.website || undefined,
        twitter: vals.twitter || undefined,
        telegram: vals.telegram || undefined,
      });

      const buyAmt = parseFloat(vals.initialBuy || '0');
      if (buyAmt > 0) {
        setStep('buying');
        try {
          await buyWrite({
            address: tokenAddr,
            abi: BONDING_CURVE_ABI,
            functionName: 'buy',
            args: [0n],
            value: parseEther(String(buyAmt)),
          });
          setStep('confirming-buy');
        } catch {
          setStep('done');
        }
      } else {
        setStep('done');
      }
    },
  });

  async function onSubmit(data: FormValues) {
    try {
      setStep('deploying');
      await createToken(data.name, data.symbol.toUpperCase());
      setStep('confirming-deploy');
    } catch {
      setStep('idle');
    }
  }

  const isLoading = step !== 'idle';
  const initialBuyVal = parseFloat(form.watch('initialBuy') || '0');

  const stepLabel = () => {
    if (step === 'deploying') return 'Confirm in wallet...';
    if (step === 'confirming-deploy') return 'Deploying contract...';
    if (step === 'buying') return 'Confirm initial buy...';
    if (step === 'confirming-buy') return 'Buying tokens...';
    return 'Deploy Contract';
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !isLoading && onOpenChange(val)}>
      <DialogContent className="sm:max-w-[500px] bg-background border-border shadow-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold tracking-tight">Initialize Token</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Deploy a new bonding curve token to Ethereum mainnet.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">

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
                    Initial Dev Buy (optional)
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
              <div className="bg-secondary/50 p-3 rounded-md border border-border/50 text-xs font-mono text-primary">
                <div className="flex justify-between">
                  <span>Initial Buy</span>
                  <span>{initialBuyVal.toFixed(4)} ETH + gas</span>
                </div>
              </div>
            )}

            {error && (
              <p className="text-sm text-destructive break-words">{error.message || 'An error occurred'}</p>
            )}

            <Button type="submit" className="w-full font-bold tracking-wide" disabled={isLoading}>
              {isLoading
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{stepLabel()}</>
                : 'Deploy Contract'
              }
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
