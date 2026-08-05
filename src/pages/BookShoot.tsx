import { BookShootView } from './BookShootView';
import { useBookShootController } from './useBookShootController';

const BookShoot = () => {
  const controller = useBookShootController();
  return <BookShootView controller={controller} />;
};

export default BookShoot;
