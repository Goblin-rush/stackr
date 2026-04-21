import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useCreateToken } from '@/hooks/use-launchpad';
import { useLocation } from 'wouter';
import { useWatchContractEvent } from 'wagmi';
import { FACTORY_ABI, FACTORY_ADDRESS } from '@/lib/contracts';
import { Loader2 } from 'lucide-react';

const formSchema = z.object({
  name: z.string().min(1, 'Name is required').max(32, 'Name too long'),
  symbol: z.string().min(1, 'Symbol is required').max(8, 'Symbol too long').regex(/^[a-zA-Z0-9]+$/, 'Alphanumeric only'),
});

type FormValues = z.infer<typeof formSchema>;

interface CreateTokenModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateTokenModal({ open, onOpenChange }: CreateTokenModalProps) {
  const [, setLocation] = useLocation();
  const { createToken, isPending, isConfirming, error } = useCreateToken();
  const [waitingForEvent, setWaitingForEvent] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      symbol: '',
    },
  });

  useWatchContractEvent({
    address: FACTORY_ADDRESS,
    abi: FACTORY_ABI,
    eventName: 'TokenCreated',
    onLogs: (logs) => {
      const log = logs[0];
      if (log && log.args.token && waitingForEvent) {
        setWaitingForEvent(false);
        onOpenChange(false);
        form.reset();
        setLocation(`/token/${log.args.token}`);
      }
    },
  });

  async function onSubmit(data: FormValues) {
    try {
      setWaitingForEvent(true);
      await createToken(data.name, data.symbol.toUpperCase());
    } catch (err) {
      console.error('Failed to create token', err);
      setWaitingForEvent(false);
    }
  }

  const isLoading = isPending || isConfirming || waitingForEvent;

  return (
    <Dialog open={open} onOpenChange={(val) => !isLoading && onOpenChange(val)}>
      <DialogContent className="sm:max-w-[425px] bg-background border-border shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold tracking-tight">Initialize Token</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Deploy a new bonding curve token to Ethereum mainnet.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground">Token Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Terminal Protocol" className="font-mono bg-muted/50" {...field} disabled={isLoading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="symbol"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground">Ticker Symbol</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. TRM" className="font-mono bg-muted/50 uppercase" {...field} disabled={isLoading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="bg-secondary/50 p-4 rounded-md border border-border/50">
              <p className="text-xs text-muted-foreground flex justify-between items-center">
                <span>Deployment Fee</span>
                <span className="font-mono">Gas only (~0.002 ETH)</span>
              </p>
            </div>

            {error && (
              <p className="text-sm text-destructive">{error.message || 'An error occurred'}</p>
            )}

            <Button type="submit" className="w-full font-bold tracking-wide" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isConfirming ? 'Confirming...' : waitingForEvent ? 'Indexing...' : 'Confirm in Wallet'}
                </>
              ) : (
                'Deploy Contract'
              )}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
