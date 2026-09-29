import { escapeHtml } from '../../../integrations/rendering/document.js';
export interface ChartData {
  status: { active: number; closed: number };
  directions: { name: string; count: number }[];
  months: { month: string; created: number; closed: number }[];
}
function bars(
  title: string,
  labels: string[],
  series: { name: string; color: string; values: number[] }[],
  scale?: number,
) {
  const width = 1100,
    left = 300,
    plot = 740,
    row = Math.max(
      48,
      ...labels.map((label) => Math.ceil(label.length / 36) * 16 + 8),
    );
  const maximum = scale ?? Math.max(1, ...series.flatMap((s) => s.values));
  const height = 100 + Math.max(1, labels.length) * row;
  const content = labels.length
    ? labels
        .map(
          (label, i) =>
            '<text x="290" y="' +
            (89 + i * row) +
            '" text-anchor="end">' +
            (label.match(/.{1,36}/gu) ?? [''])
              .map(
                (line, part) =>
                  '<tspan x="290" dy="' +
                  (part ? 16 : 0) +
                  '">' +
                  escapeHtml(line) +
                  '</tspan>',
              )
              .join('') +
            '</text>' +
            series
              .map(
                (s, j) =>
                  '<rect x="' +
                  left +
                  '" y="' +
                  (70 + i * row + j * 18) +
                  '" height="15" width="' +
                  (s.values[i] / maximum) * plot +
                  '" fill="' +
                  s.color +
                  '"/><text x="' +
                  (left + (s.values[i] / maximum) * plot + 5) +
                  '" y="' +
                  (83 + i * row + j * 18) +
                  '">' +
                  s.values[i] +
                  '</text>',
              )
              .join(''),
        )
        .join('')
    : '<text x="30" y="85">Нет данных</text>';
  return (
    '<section style="break-inside:avoid;padding:20px"><svg xmlns="http://www.w3.org/2000/svg" width="' +
    width +
    '" height="' +
    height +
    '" viewBox="0 0 ' +
    width +
    ' ' +
    height +
    '" role="img" aria-label="' +
    escapeHtml(title) +
    '"><rect width="100%" height="100%" fill="white"/><g font-family="Report,sans-serif" font-size="13" fill="#172033"><text x="20" y="25" font-size="20">' +
    escapeHtml(title) +
    '</text>' +
    series
      .map(
        (s, i) =>
          '<text x="' +
          (20 + i * 200) +
          '" y="50" fill="' +
          s.color +
          '">' +
          escapeHtml(s.name) +
          '</text>',
      )
      .join('') +
    content +
    '</g></svg></section>'
  );
}
function paginated(
  title: string,
  labels: string[],
  series: { name: string; color: string; values: number[] }[],
  size: number,
) {
  const scale = Math.max(1, ...series.flatMap((s) => s.values));
  const count = Math.max(1, Math.ceil(labels.length / size));
  return Array.from({ length: count }, (_, index) =>
    bars(
      title + (count > 1 ? ' (' + (index + 1) + '/' + count + ')' : ''),
      labels.slice(index * size, (index + 1) * size),
      series.map((s) => ({
        ...s,
        values: s.values.slice(index * size, (index + 1) * size),
      })),
      scale,
    ),
  ).join('');
}
export function charts(data: ChartData) {
  return (
    bars(
      'Активные и закрытые проекты',
      ['Активные', 'Закрытые'],
      [
        {
          name: 'Количество',
          color: '#2563eb',
          values: [data.status.active, data.status.closed],
        },
      ],
    ) +
    paginated(
      'Проекты по направлениям',
      data.directions.map((d) => d.name),
      [
        {
          name: 'Количество',
          color: '#08916c',
          values: data.directions.map((d) => d.count),
        },
      ],
      8,
    ) +
    paginated(
      'Создание и закрытие по месяцам',
      data.months.map((m) => m.month),
      [
        {
          name: 'Создано',
          color: '#2563eb',
          values: data.months.map((m) => m.created),
        },
        {
          name: 'Закрыто',
          color: '#dc6c24',
          values: data.months.map((m) => m.closed),
        },
      ],
      12,
    )
  );
}
