import { RouteObject } from 'react-router';
import { HomePage } from './pages/desktop';

const routers: RouteObject[] = [
  {
    path: '/login',
    async lazy() {
      const LoginPage = (await import('./pages/login')).default;
      return {
        Component: LoginPage,
      }
    },
  },
  {
    path: '/',
    element: <HomePage />,
  }
];

export default routers;
