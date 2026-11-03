import {
  ArrowLeft,
  Calendar,
  ExternalLink,
  Flag,
  FolderX,
  Lock,
  MoreHorizontal,
  Pencil,
  Star,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { GithubIcon } from '@/components/common/brand-icons';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { Section } from '@/components/common/section';
import { EmptyState, ErrorState, PageLoader } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge, Card, UserAvatar } from '@/components/ui/misc';
import { useAuth } from '@/context/auth-context';
import { CommentSection } from '@/features/comments/comment-section';
import { useDeleteProject, useProject, useRelatedProjects } from '@/features/projects/hooks';
import { LikeButton } from '@/features/projects/like-button';
import { CoverFallback, statusVariant } from '@/features/projects/project-card';
import { ProjectGrid } from '@/features/projects/project-grid';
import { ReportDialog } from '@/features/projects/report-dialog';
import { ScreenshotGallery } from '@/features/projects/screenshot-gallery';
import { ShareButton } from '@/features/projects/share-button';
import { getStatus } from '@/services/api';
import { formatDate, STATUS_LABELS } from '@/utils/format';

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: project, isLoading, error, refetch } = useProject(id);
  const related = useRelatedProjects(id!);
  const deleteProject = useDeleteProject();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reporting, setReporting] = useState(false);

  if (isLoading) return <PageLoader />;
  if (getStatus(error) === 404 || getStatus(error) === 422) {
    return (
      <EmptyState
        icon={FolderX}
        title="Project not found"
        description="It may have been removed, or it's private and you don't have access."
        action={
          <Button asChild variant="outline">
            <Link to="/explore">Explore projects</Link>
          </Button>
        }
      />
    );
  }
  if (error || !project) return <ErrorState error={error} onRetry={() => refetch()} />;

  const contributors = project.contributors.filter((c) => c.status !== 'DECLINED');
  const isOwner = user?.id === project.ownerId;

  return (
    <div className="space-y-10">
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/explore'))}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back
        </button>

        <div className="aspect-[2/1] overflow-hidden rounded-xl border bg-muted sm:aspect-[21/9]">
          {project.coverImageUrl ? (
            <img src={project.coverImageUrl} alt="" className="size-full object-cover" />
          ) : (
            <CoverFallback title={project.title} />
          )}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-8">
          <header className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Link to={`/explore?category=${project.category.slug}`}>
                <Badge variant="outline" className="hover:border-primary hover:text-primary">
                  {project.category.name}
                </Badge>
              </Link>
              <Badge variant={statusVariant[project.status]}>{STATUS_LABELS[project.status]}</Badge>
              {project.visibility === 'PRIVATE' && (
                <Badge variant="secondary">
                  <Lock /> Private
                </Badge>
              )}
              {project.isFeatured && (
                <Badge variant="warning">
                  <Star className="fill-current" /> Featured
                </Badge>
              )}
            </div>
            <h1 className="text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
              {project.title}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              <LikeButton projectId={project.id} liked={project.likedByMe} count={project.likeCount} />
              <ShareButton title={project.title} url={window.location.href} />
              {project.permissions.canEdit && (
                <Button asChild variant="outline">
                  <Link to={`/projects/${project.id}/edit`}>
                    <Pencil /> Edit
                  </Link>
                </Button>
              )}
              {user && (project.permissions.canDelete || !isOwner) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="More actions">
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {!isOwner && (
                      <DropdownMenuItem onSelect={() => setReporting(true)}>
                        <Flag /> Report project
                      </DropdownMenuItem>
                    )}
                    {project.permissions.canDelete && (
                      <DropdownMenuItem destructive onSelect={() => setConfirmDelete(true)}>
                        <Trash2 /> Delete project
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </header>

          <section aria-labelledby="about-heading" className="space-y-3">
            <h2 id="about-heading" className="text-lg font-semibold">
              About this project
            </h2>
            <div className="whitespace-pre-line break-words leading-relaxed text-foreground/90">
              {project.description}
            </div>
          </section>

          {project.images.length > 0 && (
            <section aria-labelledby="gallery-heading" className="space-y-3">
              <h2 id="gallery-heading" className="text-lg font-semibold">
                Screenshots
              </h2>
              <ScreenshotGallery images={project.images} title={project.title} />
            </section>
          )}

          <CommentSection projectId={project.id} count={project.commentCount} />
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          {(project.githubUrl || project.liveUrl) && (
            <Card className="space-y-2 p-4">
              {project.liveUrl && (
                <Button asChild className="w-full">
                  <a href={project.liveUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink /> View live demo
                  </a>
                </Button>
              )}
              {project.githubUrl && (
                <Button asChild variant="outline" className="w-full">
                  <a href={project.githubUrl} target="_blank" rel="noopener noreferrer">
                    <GithubIcon /> Source code
                  </a>
                </Button>
              )}
            </Card>
          )}

          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold">Created by</h2>
            <Link to={`/u/${project.owner.username}`} className="group flex items-center gap-3">
              <UserAvatar user={project.owner} size="md" />
              <span className="min-w-0">
                <span className="block truncate font-medium group-hover:text-primary">
                  {project.owner.fullName}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {project.owner.department} · {project.owner.university}
                </span>
              </span>
            </Link>
            {project.owner.bio && (
              <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{project.owner.bio}</p>
            )}
          </Card>

          {contributors.length > 0 && (
            <Card className="p-4">
              <h2 className="mb-3 text-sm font-semibold">Contributors</h2>
              <ul className="space-y-3">
                {contributors.map((c) => (
                  <li key={c.id}>
                    <Link to={`/u/${c.user.username}`} className="group flex items-center gap-3">
                      <UserAvatar user={c.user} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium group-hover:text-primary">
                          {c.user.fullName}
                        </span>
                        {c.role && (
                          <span className="block truncate text-xs text-muted-foreground">{c.role}</span>
                        )}
                      </span>
                      {c.status === 'PENDING' && <Badge variant="secondary">Invited</Badge>}
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card className="space-y-4 p-4">
            <div>
              <h2 className="mb-2 text-sm font-semibold">Built with</h2>
              <ul className="flex flex-wrap gap-1.5">
                {project.technologies.map((t) => (
                  <li key={t.id}>
                    <Link
                      to={`/explore?technology=${t.slug}`}
                      className="inline-block rounded-md bg-secondary px-2 py-0.5 font-mono text-xs transition-colors hover:bg-primary/10 hover:text-primary"
                    >
                      {t.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="size-3.5" /> Shared {formatDate(project.createdAt)}
            </p>
          </Card>
        </aside>
      </div>

      {!!related.data?.length && (
        <Section title="Related projects">
          <ProjectGrid projects={related.data} isLoading={false} className="xl:grid-cols-4" />
        </Section>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this project?"
        description="The project, its images, likes and comments will be permanently removed. This cannot be undone."
        confirmLabel="Delete project"
        destructive
        loading={deleteProject.isPending}
        onConfirm={() =>
          deleteProject.mutate(project.id, {
            onSuccess: () => navigate(user ? `/u/${user.username}` : '/'),
          })
        }
      />
      {reporting && (
        <ReportDialog
          open={reporting}
          onOpenChange={setReporting}
          targetType="PROJECT"
          targetId={project.id}
        />
      )}
    </div>
  );
}
