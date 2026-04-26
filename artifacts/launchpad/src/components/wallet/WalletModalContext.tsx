import { createContext, useContext, useState, type ReactNode } from 'react';

interface WalletModalCtx {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  setOpen: (v: boolean) => void;
}

const Ctx = createContext<WalletModalCtx>({
  isOpen: false,
  open: () => {},
  close: () => {},
  setOpen: () => {},
});

export function WalletModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <Ctx.Provider
      value={{
        isOpen,
        open: () => setIsOpen(true),
        close: () => setIsOpen(false),
        setOpen: setIsOpen,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useWalletModal() {
  return useContext(Ctx);
}
