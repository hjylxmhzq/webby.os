import React, { useEffect } from 'react';
import './App.less';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import routers from './routers';
import { useTheme } from './hooks/common';
import { darkVars, lightVars } from './theme';

const router = createBrowserRouter(routers);


function App() {

  const [theme] = useTheme();

  useEffect(() => {
    document.body.setAttribute('theme', theme);
    if (theme === 'dark') {
      for (let key of Object.keys(darkVars)) {
        let k = key as keyof typeof darkVars;
        document.body.style.setProperty(key, darkVars[k]);
      }
    } else {
      Object.keys(lightVars).forEach((key) => {
        let k = key as keyof typeof lightVars;
        document.body.style.setProperty(key, lightVars[k]);
      });
    }
  }, [theme]);

  return (
    <div className="App">
      <RouterProvider router={router} />
    </div>
  );
}

export default App;
