import { useState, useMemo, useEffect } from 'react';
import { Box, Button, Grid, TextField, Typography } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { Download } from '@mui/icons-material';

type ValueType = 'string' | 'number' | 'boolean' | 'array' | 'object';
type Status = 'match' | 'mismatch' | 'unique1' | 'unique2';

interface ParamRow {
  id: string;
  key: string;
  value1: unknown;
  value2: unknown;
  type: ValueType;
  status: Status;
}

const parseValue = (value: string, type: ValueType): unknown => {
  try {
    switch (type) {
      case 'number':
        return Number(value);
      case 'boolean':
        return value === 'true';
      case 'array':
      case 'object':
        return JSON.parse(value);
      default:
        return value;
    }
  } catch {
    return value;
  }
};

const stringifyValue = (value: unknown, type: ValueType): string => {
  if (value === undefined || value === null) return '';
  if (type === 'array' || type === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  }
  return String(value);
};

const getStatus = (val1: unknown, val2: unknown): Status => {
  if (val1 !== undefined && val2 !== undefined) {
    return JSON.stringify(val1) === JSON.stringify(val2) ? 'match' : 'mismatch';
  }
  return val1 !== undefined ? 'unique1' : 'unique2';
};

const parseQueryParams = (url: string): Record<string, string> => {
  try {
    const parsedUrl = new URL(url);
    const params: Record<string, string> = {};
    parsedUrl.searchParams.forEach((value, key) => {
      params[key] = value;
    });
    return params;
  } catch {
    return {};
  }
};

const compareParams = (
  params1: Record<string, string>,
  params2: Record<string, string>
): ParamRow[] => {
  const keys = Array.from(
    new Set([...Object.keys(params1), ...Object.keys(params2)])
  );
  return keys.map((key, index) => {
    const raw1 = params1[key];
    const raw2 = params2[key];

    const candidate = raw1 ?? raw2 ?? '';
    let type: ValueType = 'string';

    try {
      const parsed = JSON.parse(candidate);
      if (Array.isArray(parsed)) type = 'array';
      else if (typeof parsed === 'object') type = 'object';
    } catch {
      if (candidate === 'true' || candidate === 'false') type = 'boolean';
      else if (!isNaN(Number(candidate))) type = 'number';
    }

    const value1 = raw1 ? parseValue(raw1, type) : undefined;
    const value2 = raw2 ? parseValue(raw2, type) : undefined;

    return {
      id: String(index),
      key,
      value1,
      value2,
      type,
      status: getStatus(value1, value2),
    };
  });
};

const buildUrl = (
  base: string,
  rows: ParamRow[],
  source: 'value1' | 'value2'
): string => {
  try {
    const url = new URL(base);
    url.search = '';
    rows.forEach(({ key, type, [source]: value }) => {
      if (key && value !== undefined && value !== '') {
        url.searchParams.set(key, stringifyValue(value, type));
      }
    });
    return url.toString();
  } catch {
    return '';
  }
};

const downloadCsv = (rows: ParamRow[]): void => {
  const header = ['Key', 'Value1', 'Value2', 'Type', 'Status'];
  const lines = rows.map(({ key, value1, value2, type, status }) => [
    key,
    stringifyValue(value1, type),
    stringifyValue(value2, type),
    type,
    status,
  ]);
  const csvContent = [header, ...lines]
    .map((row) => row.map((val) => `"${val}"`).join(','))
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'url-comparison.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export default function UrlComparator() {
  const [base1, setBase1] = useState('');
  const [base2, setBase2] = useState('');
  const [rows, setRows] = useState<ParamRow[]>([]);

  const previewUrl1 = useMemo(
    () => buildUrl(base1, rows, 'value1'),
    [base1, rows]
  );
  const previewUrl2 = useMemo(
    () => buildUrl(base2, rows, 'value2'),
    [base2, rows]
  );

  const handleCompare = (): void => {
    const params1 = parseQueryParams(base1);
    const params2 = parseQueryParams(base2);
    setRows(compareParams(params1, params2));
  };

  const updateRow = (
    id: string,
    field: keyof ParamRow,
    newValue: unknown
  ): void => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const updated: ParamRow = { ...row, [field]: newValue };
        if (field === 'type') {
          updated.value1 = parseValue(
            stringifyValue(row.value1, newValue as ValueType),
            newValue as ValueType
          );
          updated.value2 = parseValue(
            stringifyValue(row.value2, newValue as ValueType),
            newValue as ValueType
          );
        }
        updated.status = getStatus(updated.value1, updated.value2);
        return updated;
      })
    );
  };

  const columns: GridColDef[] = [
    { field: 'key', headerName: 'Key', flex: 1, editable: true },
    {
      field: 'value1',
      headerName: 'Value (URL 1)',
      flex: 1,
      editable: true,
      valueGetter: (value, row) => stringifyValue(value, row.type),
    },
    {
      field: 'value2',
      headerName: 'Value (URL 2)',
      flex: 1,
      editable: true,
      valueGetter: (value, row) => stringifyValue(value, row.type),
    },
    {
      field: 'type',
      headerName: 'Type',
      type: 'singleSelect',
      valueOptions: ['string', 'number', 'boolean', 'array', 'object'],
      editable: true,
      width: 120,
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 110,
      renderCell: ({ value }) => (
        <Typography
          color={
            value === 'match'
              ? 'green'
              : value === 'mismatch'
              ? 'orange'
              : 'red'
          }
        >
          {value}
        </Typography>
      ),
    },
  ];

  useEffect(handleCompare, [base1, base2]);

  return (
    <Box p={4}>
      <Typography variant="h4" gutterBottom>
        URL Comparator
      </Typography>

      <Grid container spacing={2} mb={2}>
        <Grid item xs={12} md={6}>
          <TextField
            label="URL 1"
            fullWidth
            value={base1}
            onChange={(e) => setBase1(e.target.value)}
          />
          <Typography
            variant="body2"
            mt={1}
            color="textSecondary"
            sx={{ wordBreak: 'break-all' }}
          >
            {previewUrl1}
          </Typography>
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            label="URL 2"
            fullWidth
            value={base2}
            onChange={(e) => setBase2(e.target.value)}
          />
          <Typography
            variant="body2"
            mt={1}
            color="textSecondary"
            sx={{ wordBreak: 'break-all' }}
          >
            {previewUrl2}
          </Typography>
        </Grid>

        <Grid item xs={12}>
          <Button
            variant="outlined"
            sx={{ ml: 2 }}
            startIcon={<Download />}
            onClick={() => downloadCsv(rows)}
            disabled={!rows.length}
          >
            Export CSV
          </Button>
        </Grid>
      </Grid>

      <Box sx={{ height: 500 }}>
        <DataGrid
          rows={rows}
          columns={columns}
          processRowUpdate={(updatedRow) => {
            updateRow(updatedRow.id, 'key', updatedRow.key);
            updateRow(updatedRow.id, 'value1', updatedRow.value1);
            updateRow(updatedRow.id, 'value2', updatedRow.value2);
            updateRow(updatedRow.id, 'type', updatedRow.type);
            return updatedRow;
          }}
        />
      </Box>
    </Box>
  );
}
