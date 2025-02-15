import {
  Stack,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  List,
  ListItem,
  DialogActions,
  Checkbox,
  FormControlLabel,
  TextField,
  InputAdornment,
  Divider,
  Typography,
  Toolbar,
} from '@mui/material';
import * as React from 'react';
import AddIcon from '@mui/icons-material/Add';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { BindableAttrValue, BindableAttrValues, LiveBinding } from '@mui/toolpad-core';
import { evaluateBindable } from '@mui/toolpad-core/runtime';
import { LoadingButton } from '@mui/lab';
import useLatest from '../../../utils/useLatest';
import { useDom, useDomApi } from '../../DomLoader';
import { usePageEditorState } from './PageEditorProvider';
import * as appDom from '../../../appDom';
import { NodeId } from '../../../types';
import dataSources from '../../../toolpadDataSources/client';
import NodeNameEditor from '../NodeNameEditor';
import JsonView from '../../JsonView';
import { ConnectionSelect } from '../HierarchyExplorer/CreateApiNodeDialog';
import { omit, update } from '../../../utils/immutability';
import client from '../../../api';
import ParametersEditor from './ParametersEditor';
import ErrorAlert from './ErrorAlert';

function refetchIntervalInSeconds(maybeInterval?: number) {
  if (typeof maybeInterval !== 'number') {
    return undefined;
  }
  const seconds = Math.floor(maybeInterval / 1000);
  return seconds > 0 ? seconds : undefined;
}

interface DataSourceSelectorProps<Q> {
  open: boolean;
  onClose: () => void;
  onCreated: (newNode: appDom.QueryNode<Q>) => void;
}

function ConnectionSelectorDialog<Q>({ open, onCreated, onClose }: DataSourceSelectorProps<Q>) {
  const dom = useDom();

  const [input, setInput] = React.useState<NodeId | null>(null);

  const handleClick = React.useCallback(() => {
    const connectionId = input;
    const connection = connectionId && appDom.getMaybeNode(dom, connectionId, 'connection');

    if (!connection) {
      throw new Error(`Invariant: Selected non-existing connection "${connectionId}"`);
    }

    const dataSourceId = connection.attributes.dataSource.value;
    const dataSource = dataSources[dataSourceId];
    if (!dataSource) {
      throw new Error(`Invariant: Selected non-existing dataSource "${dataSourceId}"`);
    }

    const queryNode = appDom.createNode(dom, 'query', {
      attributes: {
        query: appDom.createConst(dataSource.getInitialQueryValue()),
        connectionId: appDom.createConst(connectionId),
        dataSource: appDom.createConst(dataSourceId),
      },
    });

    onCreated(queryNode);
  }, [dom, input, onCreated]);

  return (
    <Dialog open={open} onClose={onClose} scroll="body">
      <DialogTitle>Create Query</DialogTitle>
      <DialogContent>
        <ConnectionSelect value={input} onChange={setInput} />
      </DialogContent>
      <DialogActions>
        <Button color="inherit" variant="text" onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={!input} onClick={handleClick}>
          Create query
        </Button>
      </DialogActions>
    </Dialog>
  );
}

interface QueryNodeEditorProps<Q, P> {
  open: boolean;
  onClose: () => void;
  onSave: (newNode: appDom.QueryNode) => void;
  onRemove: (newNode: appDom.QueryNode) => void;
  node: appDom.QueryNode<Q, P>;
}

function QueryNodeEditorDialog<Q, P, PQ>({
  open,
  node,
  onClose,
  onRemove,
  onSave,
}: QueryNodeEditorProps<Q, P>) {
  const { appId } = usePageEditorState();

  const [input, setInput] = React.useState(node);
  React.useEffect(() => setInput(node), [node]);

  const conectionId = node.attributes.connectionId.value;
  const dataSourceId = input.attributes.dataSource?.value;
  const dataSource = (dataSourceId && dataSources[dataSourceId]) || null;

  const handleConnectionChange = React.useCallback((newConnectionId) => {
    setInput((existing) =>
      update(existing, {
        attributes: update(existing.attributes, {
          connectionId: appDom.createConst(newConnectionId),
        }),
      }),
    );
  }, []);

  const handleQueryChange = React.useCallback((newQuery: Q) => {
    setInput((existing) =>
      update(existing, {
        attributes: update(existing.attributes, {
          query: appDom.createConst(newQuery),
        }),
      }),
    );
  }, []);

  const handleRefetchOnWindowFocusChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setInput((existing) =>
        update(existing, {
          attributes: update(existing.attributes, {
            refetchOnWindowFocus: appDom.createConst(event.target.checked),
          }),
        }),
      );
    },
    [],
  );

  const handleRefetchOnReconnectChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setInput((existing) =>
        update(existing, {
          attributes: update(existing.attributes, {
            refetchOnReconnect: appDom.createConst(event.target.checked),
          }),
        }),
      );
    },
    [],
  );

  const handleRefetchIntervalChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const interval = Number(event.target.value);

      setInput((existing) =>
        update(existing, {
          attributes:
            Number.isNaN(interval) || interval <= 0
              ? omit(existing.attributes, 'refetchInterval')
              : update(existing.attributes, {
                  refetchInterval: appDom.createConst(interval * 1000),
                }),
        }),
      );
    },
    [],
  );

  const [params, setParams] = React.useState<[string, BindableAttrValue<any>][]>(
    Object.entries(input.params || {}),
  );
  React.useEffect(() => setParams(Object.entries(input.params || {})), [input.params]);

  const { pageState } = usePageEditorState();
  const liveParams: [string, LiveBinding][] = React.useMemo(() => {
    return params.map(([name, bindable]) => [name, evaluateBindable(bindable, pageState)]);
  }, [params, pageState]);

  const handleParamsChange = React.useCallback((newParams: [string, BindableAttrValue<any>][]) => {
    setParams(newParams);
    const paramsObj: BindableAttrValues<any> = Object.fromEntries(newParams);
    setInput((existing) =>
      update(existing, {
        params: paramsObj,
      }),
    );
  }, []);

  const handleSave = React.useCallback(() => {
    onSave(input);
  }, [onSave, input]);

  const handleRemove = React.useCallback(() => {
    onRemove(node);
    onClose();
  }, [onRemove, node, onClose]);

  const queryEditorApi = React.useMemo(() => {
    return {
      fetchPrivate: async (query: PQ | {}) =>
        client.query.dataSourceFetchPrivate(appId, conectionId, query),
    };
  }, [appId, conectionId]);

  const paramsObject: Record<string, any> = React.useMemo(() => {
    const liveParamValues: [string, any][] = liveParams.map(([name, result]) => [
      name,
      result?.value,
    ]);
    return Object.fromEntries(liveParamValues);
  }, [liveParams]);

  const [previewQuery, setPreviewQuery] = React.useState<appDom.QueryNode<Q, P> | null>(null);
  const [previewParams, setPreviewParams] = React.useState(paramsObject);
  const queryPreview = client.useQuery(
    'execQuery',
    previewQuery ? [appId, previewQuery, previewParams] : null,
    { retry: false },
  );

  const handleUpdatePreview = React.useCallback(() => {
    setPreviewQuery(input);
    setPreviewParams(paramsObject);
  }, [input, paramsObject]);

  const isInputSaved = node === input;

  const handleClose = React.useCallback(() => {
    const ok = isInputSaved
      ? true
      : // eslint-disable-next-line no-alert
        window.confirm(
          'Are you sure you want to close the editor. All unsaved progress will be lost.',
        );

    if (ok) {
      onClose();
    }
  }, [onClose, isInputSaved]);

  if (!dataSourceId || !dataSource) {
    throw new Error(`DataSource "${dataSourceId}" not found`);
  }

  return (
    <Dialog fullWidth maxWidth="lg" open={open} onClose={handleClose} scroll="body">
      <DialogTitle>Edit Query ({node.id})</DialogTitle>
      <DialogContent>
        <Stack spacing={1} py={1} gap={2}>
          <Stack direction="row" gap={2}>
            <NodeNameEditor node={node} />
            <ConnectionSelect
              dataSource={dataSourceId}
              value={input.attributes.connectionId.value || null}
              onChange={handleConnectionChange}
            />
          </Stack>
          <Divider />
          <Typography>Parameters</Typography>
          <ParametersEditor
            value={params}
            onChange={handleParamsChange}
            globalScope={pageState}
            liveValue={liveParams}
          />
          <Divider />
          <Typography>Build query:</Typography>
          <dataSource.QueryEditor
            api={queryEditorApi}
            value={input.attributes.query.value}
            onChange={handleQueryChange}
            globalScope={{ query: paramsObject }}
          />
          <Divider />
          <Typography>Options:</Typography>
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={input.attributes.refetchOnWindowFocus?.value ?? true}
                onChange={handleRefetchOnWindowFocusChange}
              />
            }
            label="Refetch on window focus"
          />
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={input.attributes.refetchOnReconnect?.value ?? true}
                onChange={handleRefetchOnReconnectChange}
              />
            }
            label="Refetch on network reconnect"
          />
          <TextField
            InputProps={{
              startAdornment: <InputAdornment position="start">s</InputAdornment>,
            }}
            sx={{ maxWidth: 300 }}
            size="small"
            type="number"
            label="Refetch interval"
            value={refetchIntervalInSeconds(input.attributes.refetchInterval?.value) ?? ''}
            onChange={handleRefetchIntervalChange}
          />
          <Divider />
          <Toolbar disableGutters>
            preview
            <LoadingButton
              sx={{ ml: 2 }}
              disabled={previewParams === paramsObject && previewQuery === input}
              loading={queryPreview.isLoading}
              loadingPosition="start"
              onClick={handleUpdatePreview}
              startIcon={<PlayArrowIcon />}
            >
              Run
            </LoadingButton>
          </Toolbar>
          {queryPreview.error ? <ErrorAlert error={queryPreview.error} /> : null}
          {queryPreview.isSuccess ? <JsonView src={queryPreview.data} /> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" variant="text" onClick={handleClose}>
          Cancel
        </Button>
        <Button onClick={handleRemove}>Remove</Button>
        <Button disabled={isInputSaved} onClick={handleSave}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

type DialogState = {
  nodeId?: NodeId;
};

export default function QueryEditor() {
  const dom = useDom();
  const state = usePageEditorState();
  const domApi = useDomApi();

  const [dialogState, setDialogState] = React.useState<DialogState | null>(null);

  const handleEditStateDialogClose = React.useCallback(() => setDialogState(null), []);

  const page = appDom.getNode(dom, state.nodeId, 'page');
  const { queries = [] } = appDom.getChildNodes(dom, page) ?? [];

  const handleCreate = React.useCallback(() => {
    setDialogState({});
  }, []);

  const handleCreated = React.useCallback(
    (node) => {
      domApi.addNode(node, page, 'queries');
      setDialogState({ nodeId: node.id });
    },
    [domApi, page],
  );

  const handleSave = React.useCallback(
    (node: appDom.QueryNode) => {
      domApi.saveNode(node);
    },
    [domApi],
  );

  const handleRemove = React.useCallback(
    (node: appDom.QueryNode) => {
      domApi.removeNode(node.id);
    },
    [domApi],
  );

  const editedNode = dialogState?.nodeId
    ? appDom.getMaybeNode(dom, dialogState.nodeId, 'query')
    : null;

  // To keep it around during closing animation
  const lastEditednode = useLatest(editedNode);

  return (
    <Stack spacing={1} alignItems="start">
      <Button color="inherit" startIcon={<AddIcon />} onClick={handleCreate}>
        Add query
      </Button>
      <List>
        {queries.map((queryNode) => {
          return (
            <ListItem
              key={queryNode.id}
              button
              onClick={() => setDialogState({ nodeId: queryNode.id })}
            >
              {queryNode.name}
            </ListItem>
          );
        })}
      </List>
      {/* eslint-disable-next-line no-nested-ternary */}
      {dialogState?.nodeId && lastEditednode ? (
        <QueryNodeEditorDialog
          open={!!dialogState}
          node={lastEditednode}
          onSave={handleSave}
          onRemove={handleRemove}
          onClose={handleEditStateDialogClose}
        />
      ) : (
        <ConnectionSelectorDialog
          open={!!dialogState}
          onCreated={handleCreated}
          onClose={handleEditStateDialogClose}
        />
      )}
    </Stack>
  );
}
