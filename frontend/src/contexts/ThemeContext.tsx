import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  THEME_STORAGE_KEY,
} from "@/i18n/storage";

export type AppTheme =
  | "light"
  | "dark"
  | "system";

type ResolvedTheme =
  | "light"
  | "dark";

type ThemeContextValue = {
  theme: AppTheme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: AppTheme) => void;
  toggleTheme: () => void;
};

const ThemeContext =
  createContext<ThemeContextValue | null>(
    null,
  );

function readStoredTheme(): AppTheme {
  if (typeof window === "undefined") {
    return "dark";
  }

  const value = window.localStorage.getItem(
    THEME_STORAGE_KEY,
  ) as AppTheme | null;

  return value &&
    ["light", "dark", "system"].includes(
      value,
    )
    ? value
    : "dark";
}

function getSystemTheme(): ResolvedTheme {
  if (
    typeof window !== "undefined" &&
    window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches
  ) {
    return "dark";
  }

  return "light";
}

export function ThemeProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [theme, setThemeState] =
    useState<AppTheme>(readStoredTheme);

  const [systemTheme, setSystemTheme] =
    useState<ResolvedTheme>(
      getSystemTheme,
    );

  const resolvedTheme: ResolvedTheme =
    theme === "system"
      ? systemTheme
      : theme;

  const setTheme = useCallback(
    (nextTheme: AppTheme) => {
      setThemeState(nextTheme);

      window.localStorage.setItem(
        THEME_STORAGE_KEY,
        nextTheme,
      );
    },
    [],
  );

  const toggleTheme = useCallback(() => {
    setTheme(
      resolvedTheme === "dark"
        ? "light"
        : "dark",
    );
  }, [resolvedTheme, setTheme]);

  useEffect(() => {
    const media = window.matchMedia(
      "(prefers-color-scheme: dark)",
    );

    const handleChange = (
      event: MediaQueryListEvent,
    ) => {
      setSystemTheme(
        event.matches ? "dark" : "light",
      );
    };

    setSystemTheme(
      media.matches ? "dark" : "light",
    );

    media.addEventListener(
      "change",
      handleChange,
    );

    return () => {
      media.removeEventListener(
        "change",
        handleChange,
      );
    };
  }, []);

  useEffect(() => {
    const root =
      document.documentElement;

    root.classList.remove(
      "light",
      "dark",
    );

    root.classList.add(resolvedTheme);
    root.dataset.theme = theme;
    root.style.colorScheme =
      resolvedTheme;
  }, [theme, resolvedTheme]);

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
      toggleTheme,
    }),
    [
      theme,
      resolvedTheme,
      setTheme,
      toggleTheme,
    ],
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error(
      "useTheme must be used inside ThemeProvider.",
    );
  }

  return context;
}
