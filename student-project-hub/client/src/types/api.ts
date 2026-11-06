// Types mirror the server's API responses.

export type Role = 'STUDENT' | 'ADMIN';
export type ProjectStatus = 'PLANNING' | 'ONGOING' | 'COMPLETED';
export type Visibility = 'PUBLIC' | 'PRIVATE';
export type ContributorStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED';
export type NotificationType =
  | 'PROJECT_LIKED'
  | 'PROJECT_COMMENTED'
  | 'COMMENT_REPLIED'
  | 'CONTRIBUTOR_INVITED'
  | 'CONTRIBUTOR_RESPONDED'
  | 'ACCOUNT_VERIFIED';
export type ReportReason =
  | 'SPAM'
  | 'HARASSMENT'
  | 'INAPPROPRIATE_CONTENT'
  | 'PLAGIARISM'
  | 'MISLEADING'
  | 'OTHER';
export type ReportStatus = 'PENDING' | 'RESOLVED' | 'DISMISSED';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  items: T[];
  meta: PaginationMeta;
}

export interface UserSummary {
  id: string;
  username: string;
  fullName: string;
  avatarUrl: string | null;
  university: string;
  department: string;
}

export interface SelfUser extends UserSummary {
  email: string;
  bio: string | null;
  skills: string[];
  githubUrl: string | null;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  role: Role;
  emailVerified: boolean;
  createdAt: string;
  /** Private topic for live notification pings. */
  realtimeTopic?: string;
  /** Admins only: live pings for the admin dashboard. */
  adminTopic?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  projectCount?: number;
}

export interface CommunityStats {
  projects: number;
  students: number;
  universities: number;
  likes: number;
}

export interface Technology {
  id: string;
  name: string;
  slug: string;
  projectCount?: number;
}

export interface ProjectCard {
  id: string;
  title: string;
  excerpt: string;
  coverImageUrl: string | null;
  status: ProjectStatus;
  visibility: Visibility;
  likeCount: number;
  commentCount: number;
  isFeatured: boolean;
  createdAt: string;
  owner: UserSummary;
  category: Category;
  technologies: Technology[];
  likedByMe: boolean;
}

export interface Contributor {
  id: string;
  role: string | null;
  status: ContributorStatus;
  createdAt: string;
  user: UserSummary;
}

export interface ProjectDetail {
  id: string;
  title: string;
  description: string;
  status: ProjectStatus;
  visibility: Visibility;
  githubUrl: string | null;
  liveUrl: string | null;
  coverImageUrl: string | null;
  isFeatured: boolean;
  likeCount: number;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
  ownerId: string;
  owner: UserSummary & { bio: string | null };
  category: Category;
  technologies: Technology[];
  images: { id: string; url: string; position: number }[];
  contributors: Contributor[];
  likedByMe: boolean;
  permissions: { canEdit: boolean; canDelete: boolean };
}

export interface CommentNode {
  id: string;
  content: string;
  parentId: string | null;
  isEdited: boolean;
  isDeleted: boolean;
  createdAt: string;
  author: UserSummary | null;
  replies: CommentNode[];
}

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  readAt: string | null;
  createdAt: string;
  projectId: string | null;
  commentId: string | null;
  actor: UserSummary | null;
  project: { id: string; title: string; coverImageUrl: string | null } | null;
}

export interface Invitation {
  id: string;
  role: string | null;
  createdAt: string;
  invitedBy: UserSummary | null;
  project: { id: string; title: string; coverImageUrl: string | null };
}

export interface Profile extends UserSummary {
  bio: string | null;
  skills: string[];
  githubUrl: string | null;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  role: Role;
  createdAt: string;
  lastActiveAt: string | null;
  stats: { projects: number; contributions: number; likesReceived: number };
  projects: ProjectCard[];
  contributions: ProjectCard[];
}

export interface ActiveUser extends UserSummary {
  lastActiveAt: string;
  projectCount: number;
}
