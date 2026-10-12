import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';

export function CountChart({
  title,
  data,
}: {
  title: string;
  data: { label: string; value: number }[];
}) {
  return (
    <div className="min-w-0">
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      <div className="max-w-full overflow-x-auto">
        <BarChart
          width={360}
          height={200}
          data={data}
          margin={{ top: 8, right: 8, left: 0, bottom: 48 }}
        >
          <CartesianGrid vertical={false} stroke="#d5dbe3" />
          <XAxis
            dataKey="label"
            interval={0}
            angle={-30}
            textAnchor="end"
            height={56}
            tick={{ fontSize: 11, fill: '#3d4a5c' }}
          />
          <YAxis allowDecimals={false} width={32} tick={{ fontSize: 11, fill: '#3d4a5c' }} />
          <Tooltip />
          <Bar dataKey="value" name="Rows" fill="#1e3a5f" radius={[2, 2, 0, 0]} />
        </BarChart>
      </div>
    </div>
  );
}
