import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
  styled,
  tooltipClasses,
  TooltipProps,
} from '@mui/material';
import * as React from 'react';
import LinkIcon from '@mui/icons-material/Link';
import AddLinkIcon from '@mui/icons-material/AddLink';
import { LiveBinding, PropValueType, BindableAttrValue } from '@mui/toolpad-core';
import { WithControlledProp } from '../../utils/types';
import { JsExpressionEditor } from './PageEditor/JsExpressionEditor';
import JsonView from '../JsonView';
import { tryFormatExpression } from '../../utils/prettier';
import useLatest from '../../utils/useLatest';
import useDebounced from '../../utils/useDebounced';
import { useEvaluateLiveBinding } from './useEvaluateLiveBinding';

const ErrorTooltip = styled(({ className, ...props }: TooltipProps) => (
  <Tooltip {...props} classes={{ popper: className }} />
))(({ theme }) => ({
  [`& .${tooltipClasses.tooltip}`]: {
    backgroundColor: theme.palette.error.dark,
  },
}));

interface JsExpressionBindingEditorProps<V>
  extends WithControlledProp<BindableAttrValue<V> | null> {
  globalScope: Record<string, unknown>;
  onCommit?: () => void;
}

function JsExpressionBindingEditor<V>({
  globalScope,
  value,
  onChange,
  onCommit,
}: JsExpressionBindingEditorProps<V>) {
  const handleChange = React.useCallback(
    (newValue: string) => onChange({ type: 'jsExpression', value: newValue }),
    [onChange],
  );

  return (
    <JsExpressionEditor
      globalScope={globalScope}
      value={value?.type === 'jsExpression' ? value.value : ''}
      onChange={handleChange}
      onCommit={onCommit}
    />
  );
}

interface JsExpressionPreviewProps {
  server?: boolean;
  input: BindableAttrValue<any> | null;
  globalScope: Record<string, unknown>;
}

function JsExpressionPreview({ server, input, globalScope }: JsExpressionPreviewProps) {
  const previewValue: LiveBinding = useEvaluateLiveBinding({ server, input, globalScope });

  const lastGoodPreview = useLatest(previewValue?.error ? undefined : previewValue);
  const previewErrorDebounced = useDebounced(previewValue?.error, 500);
  const previewError = previewValue?.error && previewErrorDebounced;

  return (
    <React.Fragment>
      <Toolbar variant="dense" disableGutters>
        <Typography color="error">{previewError?.message}</Typography>
      </Toolbar>
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        <JsonView src={lastGoodPreview?.value} />
      </Box>
    </React.Fragment>
  );
}

export interface BindingEditorProps<V> extends WithControlledProp<BindableAttrValue<V> | null> {
  label: string;
  globalScope: Record<string, unknown>;
  /**
   * Uses the QuickJs runtime to evaluate bindings, just like on the server
   */
  server?: boolean;
  disabled?: boolean;
  propType?: PropValueType;
  liveBinding?: LiveBinding;
}

export function BindingEditor<V>({
  label,
  globalScope,
  server,
  disabled,
  propType,
  value,
  onChange,
  liveBinding,
}: BindingEditorProps<V>) {
  const [input, setInput] = React.useState(value);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setInput(value);
    }
  }, [open, value]);

  const handleOpen = React.useCallback(() => setOpen(true), []);
  const handleClose = React.useCallback(() => setOpen(false), []);

  const hasBinding: boolean = !!value && value.type !== 'const';

  const committedInput = React.useRef<BindableAttrValue<V> | null>(null);
  const handleCommit = React.useCallback(() => {
    let newValue = input;

    if (input?.type === 'jsExpression') {
      newValue = {
        ...input,
        value: tryFormatExpression(input.value),
      };
    }

    committedInput.current = newValue;
    onChange(newValue);
    handleClose();
  }, [onChange, input, handleClose]);

  const error: string | undefined = liveBinding?.error?.message;

  const bindingButton = (
    <Checkbox
      size="small"
      aria-label="Bind property"
      checked={hasBinding}
      disabled={disabled}
      icon={<AddLinkIcon />}
      checkedIcon={<LinkIcon />}
      onClick={handleOpen}
      color={error ? 'error' : undefined}
    />
  );

  const TooltipComponent = error ? ErrorTooltip : Tooltip;
  const tooltipTitle: string =
    error ?? (hasBinding ? `Update "${label}" binding` : `Bind "${label}"`);
  const bindingButtonWithTooltip = disabled ? (
    bindingButton
  ) : (
    <TooltipComponent placement="left" title={tooltipTitle}>
      {bindingButton}
    </TooltipComponent>
  );

  return (
    <React.Fragment>
      {bindingButtonWithTooltip}
      <Dialog onClose={handleClose} open={open} fullWidth scroll="body" maxWidth="lg">
        <DialogTitle>Bind a property</DialogTitle>
        <DialogContent>
          <Stack direction="row" sx={{ height: 400, gap: 2 }}>
            <Box sx={{ width: 200, display: 'flex', flexDirection: 'column', height: '100%' }}>
              <Typography sx={{ mb: 1 }} variant="subtitle2">
                Scope
              </Typography>
              <Box sx={{ flex: 1, width: '100%', overflow: 'auto' }}>
                <JsonView src={globalScope} />
              </Box>
            </Box>

            <Box sx={{ height: '100%', display: 'flex', flex: 1, flexDirection: 'column' }}>
              <Typography sx={{ mb: 2 }}>
                Make the &quot;{label}&quot; property dynamic with a JavaScript expression. This
                property expects a type: <code>{propType?.type || 'any'}</code>.
              </Typography>

              <JsExpressionBindingEditor<V>
                globalScope={globalScope}
                onCommit={handleCommit}
                value={input}
                onChange={(newValue) => setInput(newValue)}
              />

              <JsExpressionPreview server={server} input={input} globalScope={globalScope} />
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" variant="text" onClick={handleClose}>
            Cancel
          </Button>
          <Button color="inherit" disabled={!value} onClick={() => onChange(null)}>
            Remove binding
          </Button>
          <Button
            disabled={!input || input === committedInput.current}
            color="primary"
            onClick={handleCommit}
          >
            Update binding
          </Button>
        </DialogActions>
      </Dialog>
    </React.Fragment>
  );
}
