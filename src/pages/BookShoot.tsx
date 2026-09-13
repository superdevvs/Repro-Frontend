import { BookShootView } from './BookShootView';
import { usePageLoading } from '@/hooks/use-page-loading';
import { useShoots } from '@/context/shootsContextState';
import { useBookShootController } from './useBookShootController';

const BookShoot = () => {
  const controller = useBookShootController();
  const { isInitialLoading: shootsLoading } = useShoots();
  usePageLoading(controller.packagesLoading || controller.editShootLoading || shootsLoading);
  return <BookShootView controller={controller} />;
};

export default BookShoot;
