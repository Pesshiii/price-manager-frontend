import { forwardRef } from 'react';
import { Table } from '@mantine/core';
import { TableVirtuoso, type TableComponents } from 'react-virtuoso';

interface Props {
  columns: string[];
  rows: unknown[][];
  maxHeight?: number;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onEndReached?: () => void;
}

function renderCell(value: unknown) {
  if (value === null || value === undefined) {
    return <span style={{ color: 'var(--mantine-color-gray-5)' }}>—</span>;
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

const VirtuosoTableComponents: TableComponents<unknown[]> = {
  Table: (props) => (
    <Table
      withTableBorder
      withColumnBorders
      striped
      {...props}
      style={{ ...props.style, borderCollapse: 'separate' }}
    />
  ),
  TableHead: forwardRef<HTMLTableSectionElement>((props, ref) => (
    <Table.Thead
      {...props}
      ref={ref}
      style={{ background: 'var(--mantine-color-gray-0)' }}
    />
  )),
  TableRow: (props) => <Table.Tr {...props} />,
  TableBody: forwardRef<HTMLTableSectionElement>((props, ref) => (
    <Table.Tbody {...props} ref={ref} />
  )),
};

export function PreviewTable({
  columns,
  rows,
  maxHeight = 480,
  hasNextPage = false,
  isFetchingNextPage = false,
  onEndReached,
}: Props) {
  return (
    <TableVirtuoso
      style={{ height: maxHeight }}
      data={rows}
      components={VirtuosoTableComponents}
      endReached={() => {
        if (hasNextPage && !isFetchingNextPage && onEndReached) onEndReached();
      }}
      fixedHeaderContent={() => (
        <tr>
          {columns.map((c) => (
            <th key={c}>{c}</th>
          ))}
        </tr>
      )}
      itemContent={(_index, row) =>
        columns.map((_c, ci) => <td key={ci}>{renderCell(row[ci])}</td>)
      }
    />
  );
}
