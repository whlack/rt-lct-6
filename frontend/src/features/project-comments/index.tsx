import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { projectApi, type Comment } from '../../entities/project';
import { useSession } from '../../shared/session';
import { date, employeeName, formText, useAction } from '../../shared/lib';
import {
  ActionState,
  Empty,
  Field,
  Form,
  Modal,
  Panel,
  QueryState,
  Submit,
} from '../../shared/ui';
export function ProjectComments({
  id,
  closed,
}: {
  id: string;
  closed: boolean;
}) {
  const { user, can } = useSession();
  const [reply, setReply] = useState<Comment>();
  const [editing, setEditing] = useState<Comment>();
  const [deleting, setDeleting] = useState<Comment>();
  const query = useQuery({
    queryKey: ['comments', id],
    queryFn: ({ signal }) => projectApi.comments(id, signal),
  });
  const create = useAction(
    (body: string) => projectApi.comment(id, body, reply?.id),
    ['comments', 'history', 'activity'],
  );
  const update = useAction(
    (body: string) => projectApi.comment(id, body, undefined, editing!.id),
    ['comments', 'history', 'activity'],
  );
  const remove = useAction(
    (commentId: string) => projectApi.deleteComment(id, commentId),
    ['comments', 'history', 'activity'],
  );
  return (
    <Panel>
      <h2>Комментарии</h2>
      <QueryState query={query} />
      {query.data &&
        (!query.data.length ? (
          <Empty />
        ) : (
          <div className="comment-list">
            {query.data.map((comment) => (
              <article
                key={comment.id}
                id={`comment-${comment.id}`}
                className={`comment-entry ${comment.parentId ? 'comment-reply' : ''}`}
              >
                <div className="flex justify-between gap-4">
                  <strong>{employeeName(comment.author)}</strong>
                  <small>
                    {date(comment.createdAt)}
                    {comment.updatedAt !== comment.createdAt
                      ? ' · изменён'
                      : ''}
                  </small>
                </div>
                {comment.parentId && (
                  <a
                    className="text-link"
                    href={`#comment-${comment.parentId}`}
                  >
                    Ответ на комментарий
                  </a>
                )}
                <p>{comment.deletedAt ? 'Комментарий удалён' : comment.body}</p>
                {!closed && !comment.deletedAt && (
                  <div className="flex gap-2 flex-wrap">
                    {can('projects.comments.create') && (
                      <button
                        className="button"
                        onClick={() => setReply(comment)}
                      >
                        Ответить
                      </button>
                    )}
                    {(comment.authorId === user?.id ||
                      (user?.level ?? 0) >= 20) && (
                      <>
                        {can('projects.comments.update') && (
                          <button
                            className="button"
                            onClick={() => {
                              update.reset();
                              setEditing(comment);
                            }}
                          >
                            Изменить
                          </button>
                        )}
                        {can('projects.comments.delete') && (
                          <button
                            className="button"
                            onClick={() => {
                              remove.reset();
                              setDeleting(comment);
                            }}
                          >
                            Удалить
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        ))}
      {!closed && can('projects.comments.create') && (
        <Form
          onSubmit={(data, form) =>
            create.mutate(formText(data, 'body'), {
              onSuccess: () => {
                form.reset();
                setReply(undefined);
              },
            })
          }
        >
          {reply && (
            <div className="flex justify-between items-center">
              <span>Ответ: {reply.body?.slice(0, 100)}</span>
              <button
                className="button"
                type="button"
                onClick={() => setReply(undefined)}
              >
                Отменить ответ
              </button>
            </div>
          )}
          <Field label="Новый комментарий">
            <textarea name="body" required maxLength={5000} rows={3} />
          </Field>
          <Submit pending={create.isPending}>Отправить</Submit>
          <ActionState action={create} />
        </Form>
      )}
      {editing && (
        <Modal
          title="Редактировать комментарий"
          onClose={() => setEditing(undefined)}
        >
          <Form
            onSubmit={(data) =>
              update.mutate(formText(data, 'body'), {
                onSuccess: () => setEditing(undefined),
              })
            }
          >
            <Field label="Комментарий">
              <textarea
                name="body"
                required
                maxLength={5000}
                defaultValue={editing.body ?? ''}
                rows={4}
              />
            </Field>
            <Submit pending={update.isPending} />
            <ActionState action={update} />
          </Form>
        </Modal>
      )}
      {deleting && (
        <Modal
          title="Удалить комментарий?"
          onClose={() => setDeleting(undefined)}
        >
          <p>Текст будет удалён, ответы сохранятся.</p>
          <button
            className="button button-primary"
            disabled={remove.isPending}
            onClick={() =>
              remove.mutate(deleting.id, {
                onSuccess: () => setDeleting(undefined),
              })
            }
          >
            Удалить
          </button>
          <ActionState action={remove} />
        </Modal>
      )}
    </Panel>
  );
}
