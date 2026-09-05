import { RouterProvider } from 'react-router';
import { router } from './app/routes';
import { AppProviders } from './lib/store';

export default function App() {
  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  );
}
