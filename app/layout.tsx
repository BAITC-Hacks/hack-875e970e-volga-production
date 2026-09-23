import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Собрано — подрядчики под ваше событие',
  description: 'До трёх event-подрядчиков из каталога Казахстана с понятным объяснением выбора.',
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><body>{children}</body></html>;
}
