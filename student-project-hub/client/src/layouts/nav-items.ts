import { Bell, Compass, Home, Settings, Shield, User, type LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  auth?: boolean;
  admin?: boolean;
  end?: boolean;
}

export function navItems(username?: string): NavItem[] {
  return [
    { to: '/', label: 'Home', icon: Home, end: true },
    { to: '/explore', label: 'Explore', icon: Compass },
    { to: '/notifications', label: 'Notifications', icon: Bell, auth: true },
    { to: username ? `/u/${username}` : '/login', label: 'My profile', icon: User, auth: true },
    { to: '/settings', label: 'Settings', icon: Settings, auth: true },
    { to: '/admin', label: 'Admin', icon: Shield, admin: true },
  ];
}
