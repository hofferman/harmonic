import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun, Type } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Small, persistent reading preferences for use on phones. */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [largeText, setLargeText] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem('harmonic-large-text') === 'true';
    setLargeText(saved);
    document.documentElement.classList.toggle('text-large', saved);
  }, []);

  const toggleTextSize = () => {
    const next = !largeText;
    setLargeText(next);
    document.documentElement.classList.toggle('text-large', next);
    window.localStorage.setItem('harmonic-large-text', String(next));
  };

  return (
    <div className="flex items-center gap-1" aria-label="Preferências de leitura">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-11 w-11"
        onClick={toggleTextSize}
        aria-label={largeText ? 'Usar texto normal' : 'Aumentar o texto'}
        title={largeText ? 'Texto normal' : 'Aumentar texto'}
      >
        <Type className="h-5 w-5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-11 w-11"
        onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
        aria-label={resolvedTheme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'}
        title={resolvedTheme === 'dark' ? 'Tema claro' : 'Tema escuro'}
      >
        {resolvedTheme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </Button>
    </div>
  );
}
