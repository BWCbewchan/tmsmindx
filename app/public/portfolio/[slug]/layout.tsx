import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'MindX Student Portfolio',
  description: 'Portfolio học viên MindX',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

