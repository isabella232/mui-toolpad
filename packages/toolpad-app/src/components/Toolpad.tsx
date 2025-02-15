import * as React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { NoSsr } from '@mui/material';
import Release from './Release';
import Releases from './Releases';
import AppEditor from './AppEditor';
import Home from './Home';

export interface EditorProps {
  basename: string;
}

export default function Editor({ basename }: EditorProps) {
  return (
    <NoSsr>
      <React.Suspense fallback="loading...">
        <BrowserRouter basename={basename}>
          <Routes>
            <Route>
              <Route path="/" element={<Home />} />
              <Route path="/app/:appId/editor/*" element={<AppEditor />} />
              <Route path="/app/:appId/releases" element={<Releases />} />
              <Route path="/app/:appId/releases/:version" element={<Release />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </React.Suspense>
    </NoSsr>
  );
}
