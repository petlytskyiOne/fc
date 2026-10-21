import { render } from 'solid-js/web';
import { AuthProvider } from './lib/auth';
import App from './App';
import './styles.css';

render(
  () => (
    <AuthProvider>
      <App />
    </AuthProvider>
  ),
  document.getElementById('root')!,
);
