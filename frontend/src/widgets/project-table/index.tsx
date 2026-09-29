import { Link } from 'react-router-dom';
import { offering, type ProjectRow } from '../../entities/project';
import { date } from '../../shared/lib';
import { Badge, Empty } from '../../shared/ui';
export function ProjectTable({ rows }: { rows: ProjectRow[] }) {
  if (!rows.length)
    return <Empty>Проекты по выбранным условиям не найдены.</Empty>;
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Программа / продукт</th>
            <th>Вуз</th>
            <th>Направление</th>
            <th>Текущий этап</th>
            <th>Статус</th>
            <th>Создан</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((project) => (
            <tr key={project.id}>
              <td>
                <Link className="text-link" to={`/projects/${project.id}`}>
                  {offering(project)}
                </Link>
                <small>{project.program ? 'Программа' : 'Продукт'}</small>
              </td>
              <td>
                <Link to={`/universities/${project.university.id}`}>
                  {project.university.name}
                </Link>
              </td>
              <td>{project.direction.name}</td>
              <td>{project.currentStage?.title ?? '—'}</td>
              <td>
                <Badge>{project.closedAt ? 'Закрыт' : 'Активен'}</Badge>
              </td>
              <td>{date(project.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
