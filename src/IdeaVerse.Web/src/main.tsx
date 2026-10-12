import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import { AuthProvider } from './auth/AuthContext';
import { startFreshLoadsAtTop } from './freshLoadScroll';
import { registerServiceWorker } from './registerServiceWorker';
import '@fontsource-variable/nunito';
import './styles.css';

startFreshLoadsAtTop();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: true },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);

registerServiceWorker();
