import { getCatalog } from '@/lib/catalog';
import Finder from './finder';
export const dynamic = 'force-dynamic';
export default function Page() {
  return <Finder metadata={getCatalog().metadata} />;
}
