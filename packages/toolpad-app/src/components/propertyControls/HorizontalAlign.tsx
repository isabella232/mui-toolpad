import * as React from 'react';
import { Box, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import AlignHorizontalLeftIcon from '@mui/icons-material/AlignHorizontalLeft';
import AlignHorizontalCenterIcon from '@mui/icons-material/AlignHorizontalCenter';
import AlignHorizontalRightIcon from '@mui/icons-material/AlignHorizontalRight';
import type { EditorProps } from '../../types';

function HorizontalAlignPropEditor({
  label,
  value = 'start',
  onChange,
  disabled,
}: EditorProps<string>) {
  const handleHorizontalAlign = (
    event: React.MouseEvent<HTMLElement>,
    newHorizontalAlign: string | null,
  ) => {
    if (newHorizontalAlign) {
      onChange(newHorizontalAlign);
    }
  };

  return (
    <Box>
      <Typography>{label}:</Typography>
      <ToggleButtonGroup
        size="small"
        exclusive
        disabled={disabled}
        value={value}
        onChange={handleHorizontalAlign}
        aria-label="HorizontalAlign"
      >
        <ToggleButton value="start" aria-label="start">
          <AlignHorizontalLeftIcon />
        </ToggleButton>
        <ToggleButton value="center" aria-label="center">
          <AlignHorizontalCenterIcon />
        </ToggleButton>
        <ToggleButton value="end" aria-label="end">
          <AlignHorizontalRightIcon />
        </ToggleButton>
      </ToggleButtonGroup>
    </Box>
  );
}

export default HorizontalAlignPropEditor;
