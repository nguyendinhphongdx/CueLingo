import type { ReactNode } from 'react';
import { Avatar, type AvatarSize } from './avatar';

/** Avatar, name and email of one person; the one way the product shows who someone is. */
export function PersonRow({
  name,
  email,
  size = 'lg',
  actions,
}: {
  name: string;
  email: string;
  size?: AvatarSize;
  /** Icon buttons or similar, shown on the right. */
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <Avatar name={name} email={email} size={size} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="text-muted-foreground truncate text-sm">{email}</p>
      </div>
      {actions}
    </div>
  );
}
