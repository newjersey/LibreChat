import { BookOpen, LucideIcon } from 'lucide-react';

interface InfoLinkProps {
  text: string;
  link: string;
  icon: LucideIcon;
}

export default function InfoLink({ text, link, icon: Icon }: InfoLinkProps) {
  return (
    <div>
      <a href={link} className="inline-flex gap-1 underline hover:no-underline">
        {text}
        <div className="inline-flex rounded bg-surface-secondary p-1">
          <Icon size={16} />
        </div>
      </a>
    </div>
  );
}
