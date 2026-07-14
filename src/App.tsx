import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@/lib/theme-provider';
import { RootLayout } from '@/components/layout/root-layout';

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider defaultTheme="dark" storageKey="lexas-theme">
          <RootLayout />
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
