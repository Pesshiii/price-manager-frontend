import { Table, ScrollArea } from '@mantine/core';

interface Props {
  columns: string[];
  rows: unknown[][];
  maxHeight?: number;
}

function renderCell(value: unknown) {
  if (value === null || value === undefined) {
    return <span style={{ color: 'var(--mantine-color-gray-5)' }}>—</span>;
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function PreviewTable({ columns, rows, maxHeight = 480 }: Props) {
  return (
    <ScrollArea h={maxHeight} type="auto" offsetScrollbars>
      <Table withTableBorder withColumnBorders striped stickyHeader>
        <Table.Thead style={{ background: 'var(--mantine-color-gray-0)' }}>
          <Table.Tr>
            {columns.map((c) => (
              <Table.Th key={c}>{c}</Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((row, ri) => (
            <Table.Tr key={ri}>
              {columns.map((_c, ci) => (
                <Table.Td key={ci}>{renderCell(row[ci])}</Table.Td>
              ))}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </ScrollArea>
  );
}
