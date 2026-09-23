import type { Metadata } from 'next';
import { MantineProvider, createTheme } from '@mantine/core';
import { DatesProvider } from '@mantine/dates';
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import 'dayjs/locale/ru';
import './globals.css';
const theme = createTheme({
  primaryColor: 'forest',
  colors: {
    forest: ['#edf2ec', '#dfe9df', '#bfd3c3', '#9ebca6', '#79a389', '#568b6b', '#407654', '#326147', '#244b3d', '#193c2e'],
  },
  fontFamily: "'Avenir Next', 'Segoe UI', sans-serif",
  headings: { fontFamily: "Georgia, 'Times New Roman', serif" },
  defaultRadius: 'sm',
});
export const metadata: Metadata = {
  title: 'Собрано — подрядчики под ваше событие',
  description: 'До трёх event-подрядчиков из каталога Казахстана с понятным объяснением выбора.',
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><body><MantineProvider theme={theme}><DatesProvider settings={{ locale: 'ru', firstDayOfWeek: 1, weekendDays: [0, 6] }}>{children}</DatesProvider></MantineProvider></body></html>;
}
