import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase";

export interface Currency {
  code: string;
  symbol: string;
  name: string;
  locale: string; // used for Intl formatting (lakh/crore for INR)
}

export const CURRENCIES: Currency[] = [
  { code: "INR", symbol: "₹", name: "Indian Rupee", locale: "en-IN" },
  { code: "USD", symbol: "$", name: "US Dollar", locale: "en-US" },
  { code: "EUR", symbol: "€", name: "Euro", locale: "en-DE" },
  { code: "GBP", symbol: "£", name: "British Pound", locale: "en-GB" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen", locale: "ja-JP" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar", locale: "en-AU" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar", locale: "en-CA" },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar", locale: "en-SG" },
  { code: "AED", symbol: "AED", name: "UAE Dirham", locale: "en-AE" },
  { code: "CNY", symbol: "¥", name: "Chinese Yuan", locale: "zh-CN" },
  { code: "MYR", symbol: "RM", name: "Malaysian Ringgit", locale: "en-MY" },
  { code: "IDR", symbol: "Rp", name: "Indonesian Rupiah", locale: "id-ID" },
];

interface Ctx {
  currency: Currency;
  setCurrency: (c: Currency) => Promise<void>;
  ready: boolean;
}

const CurrencyContext = createContext<Ctx>({
  currency: CURRENCIES[0],
  setCurrency: async () => {},
  ready: false,
});

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>(CURRENCIES[0]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data } = await supabase
            .from("profiles")
            .select("currency")
            .eq("id", user.id)
            .single();
          if (data?.currency) {
            const match = CURRENCIES.find((c) => c.code === data.currency);
            if (match) setCurrencyState(match);
          }
        }
      } catch {}
      setReady(true);
    })();
  }, []);

  const setCurrency = useCallback(async (c: Currency) => {
    setCurrencyState(c);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("profiles")
          .update({ currency: c.code })
          .eq("id", user.id);
      }
    } catch {}
  }, []);

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, ready }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
