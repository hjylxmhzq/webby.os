import { RouteObject } from 'react-router';
import FilePage from './pages/file';
import GalleryPage from './pages/gallery';
import { HomePage } from './pages/home';

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
    children: [
      {
        path: '/page/setting',
        async lazy() {
          const SettingPage = (await import('./pages/setting')).default;
          return {
            Component: SettingPage,
          }
        },
      },
      {
        path: '/page/gallery',
        element: <GalleryPage />
      },
      {
        path: '',
        element: <FilePage />
      }
    ]
  }
];

export default routers;
