import { useQueryClient } from '@tanstack/react-query';
import { Hourglass } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { PageHeader } from '@/components/common/section';
import { EmptyState } from '@/components/common/states';
import { useAuth } from '@/context/auth-context';
import { projectKeys } from '@/features/projects/hooks';
import { ProjectForm, type ProjectFormSubmission } from '@/features/projects/project-form';
import { projectService } from '@/services/project.service';

export default function NewProjectPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<number | null>(null);

  if (!user?.approved) {
    return (
      <EmptyState
        icon={Hourglass}
        title="Waiting for approval"
        description="An admin needs to approve your account before you can share projects. We'll email you when they do, usually within a day."
      />
    );
  }

  const handleSubmit = async ({ data, cover, screenshots }: ProjectFormSubmission) => {
    setProgress(0);
    try {
      const project = await projectService.create({ data, cover, screenshots, onProgress: setProgress });
      queryClient.invalidateQueries({ queryKey: projectKeys.all });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.setQueryData(projectKeys.detail(project.id), project);
      toast.success('Project published!');
      navigate(`/projects/${project.id}`);
    } finally {
      setProgress(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Share a project"
        description="Show the community what you've been building."
      />
      <ProjectForm
        submitLabel="Publish project"
        onSubmit={handleSubmit}
        uploadProgress={progress}
        onCancel={() => navigate(-1)}
      />
    </div>
  );
}
