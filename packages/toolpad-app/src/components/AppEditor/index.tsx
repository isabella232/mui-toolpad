import * as React from 'react';
import { styled, Alert, Box, CircularProgress } from '@mui/material';
import { Route, Routes, useParams } from 'react-router-dom';
import { JsRuntimeProvider } from '@mui/toolpad-core/runtime';
import PageEditor from './PageEditor';
import DomProvider, { useDomLoader } from '../DomLoader';
import ApiEditor from './ApiEditor';
import CodeComponentEditor from './CodeComponentEditor';
import ConnectionEditor from './ConnectionEditor';
import AppEditorShell from './AppEditorShell';

const classes = {
  content: 'Toolpad_Content',
  hierarchyPanel: 'Toolpad_HierarchyPanel',
  editorPanel: 'Toolpad_EditorPanel',
};

const EditorRoot = styled('div')(({ theme }) => ({
  height: '100vh',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  [`& .${classes.content}`]: {
    flex: 1,
    display: 'flex',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  [`& .${classes.hierarchyPanel}`]: {
    width: 250,
    borderRight: `1px solid ${theme.palette.divider}`,
  },
  [`& .${classes.editorPanel}`]: {
    flex: 1,
    overflow: 'hidden',
  },
}));

interface FileEditorProps {
  appId: string;
}

function FileEditor({ appId }: FileEditorProps) {
  return (
    <Routes>
      <Route element={<AppEditorShell appId={appId} />}>
        <Route path="connections/:nodeId" element={<ConnectionEditor appId={appId} />} />
        <Route path="apis/:nodeId" element={<ApiEditor appId={appId} />} />
        <Route path="pages/:nodeId" element={<PageEditor appId={appId} />} />
        <Route path="codeComponents/:nodeId" element={<CodeComponentEditor appId={appId} />} />
        <Route path="*" element={null} />
      </Route>
    </Routes>
  );
}

export interface EditorContentProps {
  appId: string;
}

function EditorContent({ appId }: EditorContentProps) {
  const domLoader = useDomLoader();

  return (
    <EditorRoot>
      {domLoader.dom ? (
        <FileEditor appId={appId} />
      ) : (
        <Box flex={1} display="flex" alignItems="center" justifyContent="center">
          {domLoader.error ? (
            <Alert severity="error">{domLoader.error}</Alert>
          ) : (
            <CircularProgress />
          )}
        </Box>
      )}
    </EditorRoot>
  );
}
export default function Editor() {
  const { appId } = useParams();

  if (!appId) {
    throw new Error(`Missing queryParam "appId"`);
  }

  return (
    <JsRuntimeProvider>
      <DomProvider appId={appId}>
        <EditorContent appId={appId} />
      </DomProvider>
    </JsRuntimeProvider>
  );
}
