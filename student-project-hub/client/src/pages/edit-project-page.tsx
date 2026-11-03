import { useQueryClient } from '@tanstack/react-query';
import { ShieldX } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { PageHeader } from '@/components/common/section';
import { EmptyState, ErrorState, PageLoader } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { ContributorManager } from '@/features/projects/contributor-manager';
import { projectKeys, useProject } from '@/features/projects/hooks';
import { ProjectForm, type ProjectFormSubmission } from '@/features/projects/project-form';
import { projectService } from '@/services/project.service';

export default function EditProjectPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: project, isLoading, error, refetch } = useProject(id);
  const [progress, setProgress] = useState<number | null>(null);

  if (isLoading) return <PageLoader />;
  if (error || !project) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!project.permissions.canEdit) {
    return (
      <EmptyState
        icon={ShieldX}
        title="You can't edit this project"
        description="Only the project owner and administrators can make changes."
        action={
          <Button asChild variant="outline">
            <Link to={`/projects/${project.id}`}>Back to project</Link>
          </Button>
        }
      />
    );
  }

  const handleSubmit = async ({ data, cover, screenshots }: ProjectFormSubmission) => {
    setProgress(0);
    try {
      const updated = await projectService.update(project.id, {
        data,
        cover,
        screenshots,
        onProgress: setProgress,
      });
      queryClient.setQueryData(projectKeys.detail(project.id), updated);
      queryClient.invalidateQueries({ queryKey: projectKeys.all });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success('Project updated');
      navigate(`/projects/${project.id}`);
    } finally {
      setProgress(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Edit project" description={project.title} />
      <ProjectForm
        project={project}
        submitLabel="Save changes"
        onSubmit={handleSubmit}
        uploadProgress={progress}
        onCancel={() => navigate(`/projects/${project.id}`)}
      />
      <ContributorManager project={project} />
    </div>
  );
}
