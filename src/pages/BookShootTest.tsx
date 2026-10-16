import { usePageLoading } from '@/hooks/use-page-loading';
import { useShoots } from '@/context/shootsContextState';
import { useBookShootController } from './useBookShootController';
import { BookingSentenceView } from '@/components/booking/sentence/BookingSentenceView';

export default function BookShootTest() {
  const controller = useBookShootController({ draftScope: 'sentence-test', bookingPath: '/book-shoot-test' });
  const { isInitialLoading } = useShoots();
  usePageLoading(controller.packagesLoading || controller.editShootLoading || isInitialLoading);
  return <BookingSentenceView controller={controller} />;
}
