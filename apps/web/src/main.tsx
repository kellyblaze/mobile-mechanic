import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.js';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } }
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found.');
}

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      {/* No extra props needed for v7's real behavior — confirmed by reading the actual shipped
          .d.ts (not blog posts): BrowserRouterProps has no `future` object anymore (that was a
          v6-only API). Its `useTransitions` prop, left undefined, already wraps every router
          state update in React.startTransition by default — the exact v6 "v7_startTransition"
          future-flag behavior, now unconditional. v6's other future flag, v7_relativeSplatPath,
          has no corresponding prop at all in v7 — that behavior is simply always-on now, and this
          app has no splat/"*" routes anyway. */}
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);
